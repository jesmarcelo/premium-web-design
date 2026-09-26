#!/usr/bin/env node
// Inspeção automática de páginas renderizadas, usada pelo construtor, pelos avaliadores de pedido e de sistema e pelo
// coordenador (na comparação com a rodada em que algo foi aprovado).
// Mede tudo sempre do mesmo jeito, para que os números de uma rodada possam ser comparados com os da outra:
//   1. contraste de cada texto visível em N pontos da rolagem, contra o fundo que realmente aparece
//      (o texto é escondido na captura, então granulado, sobreposições, fotos e mesclagens entram na conta; percentil 5);
//   2. cores de texto fora da paleta de tokens (com --tokens);
//   3. tamanhos de fonte e raios de canto em uso (com --tokens, os raios que não batem com nenhum token de raio são marcados);
//   4. foco por teclado: anel existe, aparece, não está coberto e tem contraste de pelo menos 3:1 com o entorno;
//   5. movimento reduzido: texto que segue escondido ou apagado depois do carregamento, animações e transições que continuam
//      rodando (CSS ou Web Animations) e quadros de requestAnimationFrame com a página parada (laço contínuo: rolagem suave, parallax, canvas);
//   6. rolagem horizontal indevida e erros no console;
//   7. textos que se sobrepõem: elementos diferentes cujas caixas de texto se cruzam sem um fundo opaco entre elas.
//
// Execute na raiz do projeto; o `playwright` é procurado em .tmp/ e, se não estiver lá, no projeto:
//   node <skill>/scripts/inspecionar-pagina.mjs --url http://localhost:4173/ --out .tmp/blocos/r1/inspecao \
//        [--tokens src/styles/tokens.css] [--stops 14] [--viewports 1440x900,390x844,360x740] [--tabs 60] [--paralelo 3]
//   As larguras padrão incluem um celular baixo (360×740, com a barra do navegador aparecendo): é nele que
//   primeiro quebram os layouts que centralizam um elemento por cima do conteúdo.
//   Várias páginas: --url http://localhost:4173/,http://localhost:4173/sobre/,...
//   --paralelo: quantas combinações de página e largura são medidas ao mesmo tempo (padrão 3, as três larguras de uma página numa leva; não passe disso, porque a disputa de CPU muda o momento das animações). Use o mesmo
//   valor em todas as rodadas, para que os números sejam comparáveis.
//   --tokens aceita CSS com variáveis (--nome: cor) ou qualquer arquivo com pares nome: 'cor' (tailwind.config.js,
//   tokens.json), com a cor em #hex, rgb(), hsl(), oklch(), oklab(), lab(), lch() ou color(). Se nenhuma cor for
//   encontrada, o relatório avisa e pula essa verificação.
//   Todas as cores (as da página e as dos tokens) são convertidas para sRGB pelo próprio navegador antes de qualquer
//   conta: o Chromium devolve oklch() e lab() como foram escritos (o padrão do Tailwind v4), e não em rgb().
//
// Saída: <out>/inspecao.json (completo) e <out>/inspecao.md (resumo para os avaliadores).
// Limitações: não mede a duração de animações feitas em JS (GSAP e similares); os momentos
// "entrando/saindo" são estimados (opacidade < 0,98, escala ≠ 1 ou filtro em algum ancestral).
// Quem decide quais falhas contam, com base nas regras do sistema de design, é o avaliador.

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

// Dependências de apoio ficam em .tmp/ do projeto; se não estiverem lá, usa as do próprio projeto.
const exigir = (nome) => {
  for (const base of [path.join(process.cwd(), '.tmp'), process.cwd()]) {
    try { return createRequire(path.join(base, 'noop.js'))(nome); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  console.error(`Dependência "${nome}" não encontrada em .tmp/ nem no projeto. Rode o script a partir da raiz do projeto e veja a preparação em references/capturas-e-medicao.md.`);
  process.exit(1);
};
// O navegador do Playwright fica em .tmp/navegadores, dentro do projeto, quando instalado ali.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(path.join(process.cwd(), '.tmp', 'navegadores'))) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.cwd(), '.tmp', 'navegadores');
const { chromium } = exigir('playwright');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);
if (!args.url || !args.out) {
  console.error('uso: --url <url[,url2,...]> --out <pasta> [--tokens arquivo] [--stops n] [--viewports LxA,LxA] [--tabs n] [--paralelo n]');
  process.exit(1);
}
const URLS = String(args.url).split(',').map(u => u.trim()).filter(Boolean);
const STOPS = +(args.stops || 14);
const TABS = +(args.tabs || 60);
const PARALELO = Math.max(1, +(args.paralelo || 3));
const VIEWPORTS = String(args.viewports || '1440x900,390x844,360x740').split(',').map(v => {
  const [w, h] = v.split('x').map(Number);
  return { width: w, height: h, mobile: w < 768 };
});
fs.mkdirSync(args.out, { recursive: true });

// ---------- paleta ----------
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length <= 4) h = h.slice(0, 3).split('').map(c => c + c).join(''); // #rgb e #rgba (o alfa não entra na paleta)
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
const paleta = {};
const tokensBrutos = {};
let avisoPaleta = '';
if (!args.tokens) avisoPaleta = 'Paleta NÃO verificada: passe --tokens <arquivo de tokens> para checar cores fora do sistema.';
else if (!fs.existsSync(args.tokens)) avisoPaleta = `Paleta NÃO verificada: arquivo não encontrado (${args.tokens}).`;
else {
  const txt = fs.readFileSync(args.tokens, 'utf8');
  // 1) variáveis CSS; 2) pares nome: 'cor' (tailwind, JSON, JS). As funções de cor são convertidas no navegador, mais abaixo.
  const COR = String.raw`#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\([^)]*\)`;
  for (const m of txt.matchAll(new RegExp(String.raw`--([\w-]+)\s*:\s*(${COR})`, 'g'))) tokensBrutos[m[1]] = m[2];
  if (!Object.keys(tokensBrutos).length)
    for (const m of txt.matchAll(new RegExp(String.raw`["']?([\w-]+)["']?\s*:\s*["'](${COR})["']`, 'g'))) tokensBrutos[m[1]] = m[2];
  for (const [n, v] of Object.entries(tokensBrutos)) if (v.startsWith('#')) paleta[n] = hexToRgb(v);
  if (!Object.keys(tokensBrutos).length) avisoPaleta = `Paleta NÃO verificada: nenhuma cor encontrada em ${args.tokens} (formatos aceitos: --nome: cor, ou nome: 'cor').`;
}
if (avisoPaleta) console.warn('AVISO: ' + avisoPaleta);
// Tokens de raio (--radius-*, --raio-*, --rounded-*, --corner-*), em px; rem e em contam 16 px.
const raiosTokens = [];
if (args.tokens && fs.existsSync(args.tokens)) {
  for (const m of fs.readFileSync(args.tokens, 'utf8').matchAll(/--([\w-]*(?:radius|raio|round|corner)[\w-]*)\s*:\s*(-?[\d.]+)(px|rem|em|%)/gi)) {
    raiosTokens.push({ nome: m[1], px: m[3] === '%' ? `${m[2]}%` : +m[2] * (m[3] === 'px' ? 1 : 16) });
  }
}
const raioNoToken = valor => {
  if (typeof valor === 'string' && valor.endsWith('%')) return raiosTokens.some(t => t.px === valor);
  return raiosTokens.some(t => typeof t.px === 'number' && Math.abs(t.px - valor) <= 0.5);
};
// Razão de contraste (WCAG) entre duas cores sRGB opacas, para o anel de foco sobre fundo sólido.
const razaoSolida = (a, b) => {
  const lum = c => { const [r, g, bl] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const nomeNaPaleta = rgb => {
  for (const [n, p] of Object.entries(paleta)) if (p.every((c, i) => Math.abs(c - rgb[i]) <= 3)) return n;
  return null;
};

// ---------- funções executadas na página ----------
// Instalada em cada página antes dos scripts dela: converte qualquer cor computada em [r, g, b, alfa] no sRGB. rgb() é
// lido direto (sem arredondar); as demais (oklch, oklab, lab, lch, color()) são pintadas opacas num canvas de 1 pixel e
// lidas de volta, com o alfa separado antes, para não perder precisão em cores quase transparentes.
const instalarParaRgba = () => {
  let tinta = null;
  window.__paraRgba = cor => {
    const rgb = /^rgba?\(([^)]*)\)$/.exec(cor);
    if (rgb && !cor.includes('%')) { const n = rgb[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return [n[0], n[1], n[2], n[3] ?? 1]; }
    const m = /^([\w-]+)\((.*?)(?:\s*\/\s*([\d.]+)(%?))?\)$/.exec(String(cor).trim());
    if (!m) return [0, 0, 0, cor === 'transparent' ? 0 : 1];
    if (!tinta) { const c = document.createElement('canvas'); c.width = c.height = 1; tinta = c.getContext('2d', { willReadFrequently: true }); }
    tinta.clearRect(0, 0, 1, 1);
    tinta.fillStyle = '#000';
    tinta.fillStyle = `${m[1]}(${m[2]})`;
    tinta.fillRect(0, 0, 1, 1);
    const d = tinta.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], m[3] == null ? 1 : +m[3] / (m[4] ? 100 : 1)];
  };
};

// Recebe o tamanho da tela configurada: no celular (isMobile), um conteúdo que vaza para o lado alarga o innerWidth até
// o scrollWidth, e a rolagem horizontal nunca apareceria; a tela e a captura continuam com a largura configurada.
const coletarTextos = (tela) => {
  const out = [];
  const W = tela.width, H = tela.height;
  const cruza = (a, b) => a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y;
  // Elementos fixos/sticky que não ocupam a tela toda (nav, botão flutuante): texto embaixo deles
  // está só rolando por trás, não conta. Véus translúcidos (opacidade < 0,99 com fundo, sem
  // eventos de ponteiro) indicam camada entrando/saindo.
  const fixos = [], veus = [], raios = {};
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= H) continue;
    const box = { x: r.left, y: r.top, r: r.right, b: r.bottom };
    if ((cs.position === 'fixed' || cs.position === 'sticky') && r.width * r.height < W * H * 0.6 && +cs.opacity > 0.05) fixos.push({ el: e, box });
    const temFundo = window.__paraRgba(cs.backgroundColor)[3] > 0 || cs.backgroundImage !== 'none';
    // Raios de canto em uso: só em caixas que se veem (com fundo, borda ou recorte).
    const raio = cs.borderTopLeftRadius;
    if (raio && raio !== '0px' && (temFundo || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') || cs.overflow !== 'visible')) raios[raio] = (raios[raio] || 0) + 1;
    if (cs.pointerEvents === 'none' && temFundo && +cs.opacity > 0.02 && +cs.opacity < 0.99 && (cs.position === 'absolute' || cs.position === 'fixed')) veus.push(box);
  }
  const vis = el => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const alfaDe = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Map();
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || !vis(el) || el.closest('[aria-hidden="true"],[inert],script,style,noscript')) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const b of r.getClientRects()) {
      if (b.width < 2 || b.height < 2 || b.bottom <= 0 || b.top >= H || b.right <= 0 || b.left >= W) continue;
      const box = { x: Math.max(0, b.left), y: Math.max(0, b.top), r: Math.min(W, b.right), b: Math.min(H, b.bottom) };
      if (!vistos.has(el)) vistos.set(el, { boxes: [], texto: '' });
      const v = vistos.get(el);
      v.boxes.push(box);
      if (v.texto.length < 60) v.texto += n.textContent.trim().slice(0, 60 - v.texto.length) + ' ';
    }
  }
  // Opacidade acumulada e sinais de transição de cada ancestral, calculados uma vez só e reaproveitados.
  const estadoDe = new Map();
  const estado = a => {
    if (!a || a === document.documentElement) return { op: 1, t: false };
    if (estadoDe.has(a)) return estadoDe.get(a);
    const s = getComputedStyle(a), pai = estado(a.parentElement);
    const m = s.transform.match(/matrix\(([^,]+),[^,]+,[^,]+,([^,]+)/);
    const escala = m && (Math.abs(+m[1] - 1) > 0.005 || Math.abs(+m[2] - 1) > 0.005);
    const e = { op: pai.op * +s.opacity, t: pai.t || s.filter !== 'none' || !!escala };
    estadoDe.set(a, e);
    return e;
  };
  for (const [el, v] of vistos) {
    const cs = getComputedStyle(el);
    const { op } = estado(el);
    let transicao = estado(el).t;
    // coberto por outra camada, ou rolando por trás de um elemento fixo (nav, flutuante)?
    const emFixo = f => f.el !== el && !f.el.contains(el) && !el.contains(f.el);
    const coberto = v.boxes.every(bx => {
      if (fixos.some(f => emFixo(f) && cruza(bx, f.box))) return true;
      const h = document.elementFromPoint((bx.x + bx.r) / 2, (bx.y + bx.b) / 2);
      return h && h !== el && !el.contains(h) && !h.contains(el);
    });
    if (v.boxes.some(bx => veus.some(vb => cruza(bx, vb)))) transicao = true;
    const c = window.__paraRgba(cs.color);
    alfaDe.set(el, (c[3] ?? 1) * op);
    out.push({
      tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), texto: v.texto.trim(),
      fs: parseFloat(cs.fontSize), fw: +cs.fontWeight || 400, cor: c.slice(0, 3), alfa: (c[3] ?? 1) * op,
      transicao: transicao || op < 0.98, coberto, boxes: v.boxes.slice(0, 6),
    });
    if (out.length >= 250) break;
  }

  // Texto sobre texto: dois elementos de texto distintos (nenhum contém o outro, ambos visíveis)
  // cujas caixas se cruzam, sem fundo opaco entre o de cima e o ancestral comum. Camadas que
  // passam por cima de outras têm fundo e não entram; o que sobra é sobreposição real.
  // Barreira = cor de fundo opaca, imagem de fundo, ou gradiente grande. Gradiente pequeno é
  // decoração (sublinhado de link feito com background-image) e não esconde o texto de baixo.
  const opaco = e => {
    const s = getComputedStyle(e);
    if (window.__paraRgba(s.backgroundColor)[3] > 0.5) return true;
    if (s.backgroundImage === 'none') return false;
    if (/url\(/.test(s.backgroundImage)) return true;
    const r = e.getBoundingClientRect();
    return r.width * r.height > W * H * 0.2;
  };
  const BLOCOS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,dt,dd,label,button,a,summary,td,th';
  const blocoDe = new Map();
  const bloco = el => { if (!blocoDe.has(el)) blocoDe.set(el, el.closest(BLOCOS) || el.parentElement); return blocoDe.get(el); };
  const lista = [...vistos.keys()].filter(el => (alfaDe.get(el) ?? 0) >= 0.3);
  const sobre = [];
  for (let i = 0; i < lista.length && sobre.length < 20; i++) for (let j = i + 1; j < lista.length; j++) {
    const A = lista[i], B = lista[j];
    if (A.contains(B) || B.contains(A)) continue;
    let achou = null;
    // Linhas do mesmo bloco de texto (título com entrelinha < 1, palavras divididas em linhas) podem
    // se encostar: é o desenho. Só conta texto de blocos diferentes.
    if (bloco(A) === bloco(B)) continue;
    for (const a of vistos.get(A).boxes) for (const b of vistos.get(B).boxes) {
      if (achou) break;
      const x = Math.max(a.x, b.x), rr = Math.min(a.r, b.r), y = Math.max(a.y, b.y), bb = Math.min(a.b, b.b);
      if (rr - x < 4 || bb - y < 3) continue;
      const menor = Math.min((a.r - a.x) * (a.b - a.y), (b.r - b.x) * (b.b - b.y));
      if ((rr - x) * (bb - y) < menor * 0.1) continue;
      const h = document.elementFromPoint((x + rr) / 2, (y + bb) / 2);
      const cima = h && A.contains(h) ? A : h && B.contains(h) ? B : null;
      if (!cima) continue;
      const baixo = cima === A ? B : A;
      let barreira = false;
      for (let e = cima; e && !e.contains(baixo); e = e.parentElement) if (opaco(e)) { barreira = true; break; }
      if (!barreira) achou = { y: Math.round(y) };
    }
    if (achou) sobre.push({ ...achou, a: vistos.get(A).texto.trim().slice(0, 40), b: vistos.get(B).texto.trim().slice(0, 40) });
  }
  return { textos: out, sobre, raios, y: Math.round(scrollY), sw: [document.documentElement.scrollWidth, W] };
};

const ESTILO_OCULTA = `*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important;transition:none!important}`;

// Recebe a captura (base64) e uma lista de alvos; devolve, para cada alvo, o p5 e a mediana do
// contraste entre a cor dada e os pixels amostrados.
const medirContraste = async ({ png, alvos }) => {
  const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob());
  const cv = new OffscreenCanvas(img.width, img.height);
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const dados = cx.getImageData(0, 0, img.width, img.height).data;
  const lum = ([r, g, b]) => {
    const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const px = (x, y) => {
    x = Math.min(img.width - 1, Math.max(0, Math.round(x))); y = Math.min(img.height - 1, Math.max(0, Math.round(y)));
    const i = (y * img.width + x) * 4;
    return [dados[i], dados[i + 1], dados[i + 2]];
  };
  return alvos.map(({ cor, alfa, pontos }) => {
    const rs = pontos.map(([x, y]) => {
      const bg = px(x, y);
      const fg = cor.map((c, k) => alfa * c + (1 - alfa) * bg[k]);
      return razao(fg, bg);
    }).sort((a, b) => a - b);
    if (!rs.length) return null;
    return { p5: +rs[Math.floor(rs.length * 0.05)].toFixed(2), mediana: +rs[Math.floor(rs.length / 2)].toFixed(2) };
  });
};

const pontosDaCaixa = boxes => {
  const pts = [];
  for (const b of boxes) {
    const nx = Math.max(3, Math.min(20, Math.round((b.r - b.x) / 6))), ny = Math.max(2, Math.min(6, Math.round((b.b - b.y) / 6)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push([b.x + ((i + 0.5) * (b.r - b.x)) / nx, b.y + ((j + 0.5) * (b.b - b.y)) / ny]);
  }
  return pts;
};

// ---------- execução ----------
const browser = await chromium.launch();
// Tokens em oklch(), lab() e afins: convertidos para sRGB pelo mesmo navegador que mede a página.
const pendentes = Object.entries(tokensBrutos).filter(([n]) => !paleta[n]);
if (pendentes.length) {
  const pg = await browser.newPage();
  try {
    await pg.evaluate(instalarParaRgba);
    const convertidas = await pg.evaluate(lista => lista.map(([n, v]) => [n, window.__paraRgba(v)]), pendentes);
    for (const [n, c] of convertidas) paleta[n] = c.slice(0, 3);
  } finally {
    await pg.close();
  }
}
const relatorio = { urls: URLS, data: new Date().toISOString(), tokens: Object.keys(paleta).length, avisoPaleta, viewports: [] };

// Abre a página sem ficar preso a sites que nunca param de usar a rede (vídeo, análise, conexões abertas):
// espera o load e as fontes, dá até 5 s para a rede ficar ociosa e registra quando isso não acontece.
// Só o tempo esgotado deixa a medição seguir; um erro de rede (servidor fora do ar, DNS) derruba esta combinação,
// que vai para o relatório como não medida, em vez de medir a página de erro do navegador.
const abrir = async (p, url, avisos) => {
  try {
    const resp = await p.goto(url, { waitUntil: 'load', timeout: 30000 });
    const http = `a página respondeu com HTTP ${resp?.status()}; a medição seguiu assim mesmo`;
    if (resp && resp.status() >= 400 && !avisos.includes(http)) avisos.push(http);
  } catch (e) {
    if (e.name !== 'TimeoutError') throw new Error(`a página não abriu (${String(e.message).split('\n')[0]})`);
    if (!avisos.some(a => a.startsWith('carregamento'))) avisos.push(`carregamento incompleto em 30 s (${String(e.message).split('\n')[0]}); a medição seguiu assim mesmo`);
  }
  await p.evaluate(() => document.fonts.ready).catch(() => {});
  try { await p.waitForLoadState('networkidle', { timeout: 5000 }); }
  catch { if (!avisos.some(a => a.startsWith('rede'))) avisos.push('rede não ficou ociosa em 5 s (vídeo, análise ou conexão aberta); a medição seguiu assim mesmo'); }
};

// Espera o foco se desenhar: dois quadros e a duração da transição do elemento focado, com teto de 400 ms.
const esperarFoco = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return res();
  const cs = getComputedStyle(el);
  const ms = t => t.split(',').map(x => parseFloat(x) * (x.includes('ms') ? 1 : 1000) || 0);
  const dur = ms(cs.transitionDuration), atraso = ms(cs.transitionDelay);
  const total = Math.max(0, ...dur.map((d, i) => d + (atraso[i] || 0)));
  setTimeout(res, Math.min(400, total) + 20);
})));

// Os contextos abertos numa medição ficam em `contextos`, para serem fechados mesmo quando algo falha no meio.
async function medir(URL_, vp, contextos) {
  const novoContexto = async opcoes => { const c = await browser.newContext(opcoes); contextos.push(c); await c.addInitScript(instalarParaRgba); return c; };
  const r = { pagina: URL_, viewport: `${vp.width}x${vp.height}`, sobreposicao: [], contraste: [], foraDaPaleta: {}, tamanhos: {}, raios: {}, overflow: [], foco: [], reduzido: [], movimentoReduzido: null, console: [], avisos: [], invisiveis: 0, cobertos: 0 };
  const ctx = await novoContexto({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => m.type() === 'error' && r.console.push(m.text().slice(0, 160)));
  page.on('pageerror', e => r.console.push(String(e).slice(0, 160)));
  await abrir(page, URL_, r.avisos);
  r.titulo = await page.title().catch(() => '');
  await page.waitForTimeout(1500);

  // 1–3 e 6: paradas de rolagem
  const contraste = new Map();
  const altura = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let k = 0; k <= STOPS; k++) {
    const alvo = Math.round((altura * k) / STOPS);
    if (vp.mobile) await page.evaluate(y => scrollTo(0, y), alvo);
    else {
      // Rola com a roda do mouse até a parada. Para quando chega, quando a página deixa de rolar (conteúdo
      // que cresce ou rolagem presa) ou depois de 40 tentativas, para nunca ficar preso.
      let antes = await page.evaluate(() => scrollY), parado = 0;
      for (let tentativa = 0; tentativa < 40; tentativa++) {
        const d = alvo - antes;
        if (Math.abs(d) < 4) break;
        await page.mouse.wheel(0, Math.sign(d) * Math.min(Math.abs(d), 600));
        await page.waitForTimeout(120);
        const agora = await page.evaluate(() => scrollY);
        parado = Math.abs(agora - antes) < 1 ? parado + 1 : 0;
        if (parado >= 3) break;
        antes = agora;
      }
    }
    await page.waitForTimeout(900);
    const { y, sw, textos, sobre, raios } = await page.evaluate(coletarTextos, { width: vp.width, height: vp.height });
    for (const [k, v] of Object.entries(raios)) r.raios[k] = (r.raios[k] || 0) + v;
    if (sw[0] > sw[1] + 1) r.overflow.push({ y, scrollWidth: sw[0] });
    for (const o of sobre) if (!r.sobreposicao.some(x => x.a === o.a && x.b === o.b)) r.sobreposicao.push({ ...o, y: y + o.y });
    // Captura só a área que contém os textos (com eles ocultos), e não a tela inteira.
    let medidas = [];
    const caixas = textos.flatMap(t => t.boxes);
    if (caixas.length) {
      const x0 = Math.max(0, Math.floor(Math.min(...caixas.map(b => b.x)))), y0 = Math.max(0, Math.floor(Math.min(...caixas.map(b => b.y))));
      const x1 = Math.min(vp.width, Math.ceil(Math.max(...caixas.map(b => b.r)))), y1 = Math.min(vp.height, Math.ceil(Math.max(...caixas.map(b => b.b))));
      if (x1 > x0 && y1 > y0) {
        const tag = await page.addStyleTag({ content: ESTILO_OCULTA });
        await page.waitForTimeout(60);
        const png = (await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })).toString('base64');
        await tag.evaluate(n => n.remove());
        medidas = await page.evaluate(medirContraste, { png, alvos: textos.map(t => ({ cor: t.cor, alfa: t.alfa, pontos: pontosDaCaixa(t.boxes).map(([x, y]) => [x - x0, y - y0]) })) });
      }
    }

    textos.forEach((t, i) => {
      if (t.alfa < 0.05) { r.invisiveis++; return; }
      if (t.coberto) { r.cobertos++; return; }
      r.tamanhos[t.fs] = (r.tamanhos[t.fs] || 0) + 1;
      const nome = nomeNaPaleta(t.cor);
      const chave = `rgb(${t.cor.join(',')})${t.alfa < 0.99 ? ` a ${t.alfa.toFixed(2)}` : ''}`;
      if (Object.keys(paleta).length && (!nome || t.alfa < 0.99)) (r.foraDaPaleta[chave] ||= []).push(t.texto.slice(0, 30));
      const m = medidas[i];
      if (!m) return;
      const grande = t.fs >= 24 || (t.fs >= 18.66 && t.fw >= 700);
      const minimo = grande ? 3 : 4.5;
      if (m.p5 >= minimo) return;
      // O mesmo texto aparece em várias paradas: guarda uma falha só, com o pior valor e todas as posições.
      const id = `${t.texto}|${t.cls}|${nome || chave}`;
      const f = contraste.get(id);
      if (!f) contraste.set(id, { y, ys: [y], texto: t.texto, tag: t.tag, cls: t.cls, fs: t.fs, cor: nome || chave, p5: m.p5, mediana: m.mediana, minimo, emTransicao: t.transicao });
      else {
        if (!f.ys.includes(y)) f.ys.push(y);
        if (m.p5 < f.p5) { f.p5 = m.p5; f.mediana = m.mediana; f.y = y; }
        if (!t.transicao) f.emTransicao = false; // se falha também em repouso, conta como falha em repouso
      }
    });
  }
  r.contraste = [...contraste.values()];
  for (const k in r.foraDaPaleta) r.foraDaPaleta[k] = [...new Set(r.foraDaPaleta[k])].slice(0, 4);

  // 4: foco por teclado (sem recarregar a página: volta ao topo e recomeça a navegação pelo início do documento)
  if (!vp.mobile) {
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      document.body.removeAttribute('tabindex');
      window.__primeiroFoco = null;
    });
    await page.waitForTimeout(300);
    for (let i = 0; i < TABS; i++) {
      await page.keyboard.press('Tab');
      await page.evaluate(esperarFoco);
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const ow = parseFloat(cs.outlineWidth) || 0, oo = parseFloat(cs.outlineOffset) || 0;
        const dentro = b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth;
        // cantos recuados conforme o raio, para não testar pontos fora da curva de um botão arredondado
        const br = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, b.height / 2, b.width / 2);
        const k = Math.min(b.height / 2, b.width / 2, Math.max(3, br * 0.3 + 2));
        const pts = [[b.left + b.width / 2, b.top + b.height / 2], [b.left + k, b.top + k], [b.right - k, b.top + k], [b.left + k, b.bottom - k], [b.right - k, b.bottom - k]];
        let cobridor = null;
        const coberto = pts.some(([x, y]) => {
          const h = document.elementFromPoint(x, y);
          const c = h && h !== el && !el.contains(h);
          if (c) cobridor = `${h.tagName.toLowerCase()}${h.className ? '.' + String(h.className).split(' ')[0] : ''}`;
          return c;
        });
        const d = oo + ow + 3;
        const anel = [];
        for (let t = 0; t <= 1; t += 0.1) anel.push([b.left + t * b.width, b.top - d], [b.left + t * b.width, b.bottom + d], [b.left - d, b.top + t * b.height], [b.right + d, b.top + t * b.height]);
        // Pontos do entorno fora da tela (elemento encostado na borda) seriam lidos na borda da captura, em cima do próprio elemento.
        const anelVisivel = anel.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
        // Fundo sólido atrás do anel: quando todos os pontos do entorno caem sobre uma mesma cor opaca, sem imagem,
        // transparência, filtro, mesclagem, pseudoelemento pintado ou texto no elemento atingido, o contraste é
        // calculado direto, sem captura (a captura fica para os casos em que a cor de fundo não basta).
        const fundoEm = (x, y) => {
          const h = document.elementFromPoint(x, y);
          if (!h) return null;
          if ([...h.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return null;
          for (let e = h; e; e = e.parentElement) {
            const s = getComputedStyle(e);
            if (s.backgroundImage !== 'none' || +s.opacity < 0.99 || s.filter !== 'none' || s.mixBlendMode !== 'normal') return null;
            for (const ps of ['::before', '::after']) {
              const p = getComputedStyle(e, ps);
              if (p.content !== 'none' && p.content !== 'normal' && (p.backgroundImage !== 'none' || window.__paraRgba(p.backgroundColor)[3] > 0.01)) return null;
            }
            const c = window.__paraRgba(s.backgroundColor);
            if (c[3] >= 0.99) return c.slice(0, 3).join(',');
            if (c[3] > 0.01) return null;
          }
          return '255,255,255';
        };
        const fundos = new Set(anelVisivel.map(([x, y]) => fundoEm(x, y)));
        const fundoSolido = fundos.size === 1 && !fundos.has(null) ? [...fundos][0].split(',').map(Number) : null;
        const id = el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30);
        // A volta ao primeiro elemento é reconhecida pelo próprio elemento, e não pelo id: um logotipo só com imagem tem id
        // vazio, e dois links com o mesmo texto seriam confundidos.
        const voltou = window.__primeiroFoco === el;
        window.__primeiroFoco ||= el;
        return { id, voltou, cobridor, tag: el.tagName.toLowerCase(), estilo: cs.outlineStyle, largura: ow, offset: oo, cor: window.__paraRgba(cs.outlineColor), dentro, coberto, anel: anelVisivel, fundoSolido };
      });
      if (!f) continue;
      if (f.voltou) break;
      let contrasteAnel = null;
      if (f.estilo !== 'none' && f.largura > 0 && f.anel.length && f.fundoSolido && (f.cor[3] ?? 1) >= 0.99) {
        // Anel opaco sobre fundo sólido: contraste calculado, sem captura (metade do custo do laço num site típico).
        const c = +razaoSolida(f.cor.slice(0, 3), f.fundoSolido).toFixed(2);
        contrasteAnel = { p5: c, mediana: c };
      } else if (f.estilo !== 'none' && f.largura > 0 && f.anel.length) {
        // Captura só a região do anel, e não a tela inteira.
        const xs = f.anel.map(p => p[0]), ys = f.anel.map(p => p[1]);
        const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2), y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
        const x1 = Math.min(vp.width, Math.ceil(Math.max(...xs)) + 2), y1 = Math.min(vp.height, Math.ceil(Math.max(...ys)) + 2);
        if (x1 - x0 >= 2 && y1 - y0 >= 2) {
          const png = (await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })).toString('base64');
          [contrasteAnel] = await page.evaluate(medirContraste, { png, alvos: [{ cor: f.cor.slice(0, 3), alfa: f.cor[3] ?? 1, pontos: f.anel.map(([x, y]) => [x - x0, y - y0]) }] });
        }
      }
      const problemas = [];
      if (f.estilo === 'none' || f.largura === 0) problemas.push('sem anel');
      if (!f.dentro) problemas.push('fora da tela');
      if (f.coberto) problemas.push(`coberto por ${f.cobridor}`);
      if (contrasteAnel && contrasteAnel.p5 < 3) problemas.push(`anel ${contrasteAnel.p5}:1`);
      r.foco.push({ id: f.id, tag: f.tag, anel: `${f.largura}px ${f.estilo} +${f.offset}`, contraste: contrasteAnel?.p5 ?? null, problemas });
    }
  }
  await ctx.close();

  // 5: movimento reduzido
  const ctxR = await novoContexto({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion: 'reduce' });
  // Conta os quadros em que algum requestAnimationFrame rodou (vários callbacks no mesmo quadro contam uma vez).
  await ctxR.addInitScript(() => {
    window.__quadrosRaf = 0;
    let ultimo = -1;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => original(t => { if (t !== ultimo) { ultimo = t; window.__quadrosRaf++; } cb(t); });
  });
  const pR = await ctxR.newPage();
  await abrir(pR, URL_, r.avisos);
  await pR.waitForTimeout(1500);
  // Com a página parada, nada deveria continuar se mexendo: mede 1 s de quadros e as animações que seguem rodando.
  r.movimentoReduzido = await pR.evaluate(async () => {
    const antes = window.__quadrosRaf;
    await new Promise(res => setTimeout(res, 1000));
    return { quadrosPorSegundo: window.__quadrosRaf - antes, animacoes: document.getAnimations().filter(a => a.playState === 'running').length };
  }).catch(() => null);
  r.reduzido = await pR.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,figcaption,dd,dt,blockquote,span')) {
      if (!el.textContent.trim() || el.closest('[aria-hidden="true"],[inert],details:not([open])')) continue;
      let op = 1, oculto = false;
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        op *= +s.opacity;
        if (s.display === 'none') { oculto = null; break; }
        if (s.visibility === 'hidden') oculto = true;
      }
      if (oculto === null) continue;
      if (oculto || op < 0.5) res.push({ texto: el.textContent.trim().slice(0, 40), tag: el.tagName.toLowerCase(), opacidade: +op.toFixed(2), oculto });
      if (res.length >= 25) break;
    }
    return res;
  });
  await ctxR.close();
  return r;
}

// Páginas e larguras em paralelo, com um limite de contextos simultâneos. Use o mesmo --paralelo em todas as
// rodadas: com muita concorrência, a disputa de CPU pode mudar o momento das animações e, com isso, a medição.
const tarefas = URLS.flatMap(u => VIEWPORTS.map(vp => ({ u, vp })));
const resultados = new Array(tarefas.length);
let proxima = 0;
await Promise.all(Array.from({ length: Math.min(PARALELO, tarefas.length) }, async () => {
  while (proxima < tarefas.length) {
    const i = proxima++;
    const { u, vp } = tarefas[i];
    // Uma combinação que falha (página que não abre, recarga no meio da medição) fica registrada no relatório, e as
    // outras continuam.
    const contextos = [];
    try { resultados[i] = await medir(u, vp, contextos); }
    catch (e) { resultados[i] = { pagina: u, viewport: `${vp.width}x${vp.height}`, erro: String(e.message).split('\n')[0] }; }
    finally { for (const c of contextos) await c.close().catch(() => {}); }
  }
}));
relatorio.viewports = resultados;
await browser.close();

// ---------- saída ----------
fs.writeFileSync(path.join(args.out, 'inspecao.json'), JSON.stringify(relatorio, null, 2));
const L = [`# Inspeção — ${URLS.length} página(s)`, '', URLS.map(u => `- ${u}`).join('\n'), '', `${relatorio.data} · tokens de cor lidos: ${relatorio.tokens}`, '',
  ...(avisoPaleta ? [`> **${avisoPaleta}**`, ''] : []),
  'Contraste medido sobre o fundo real (texto oculto na captura), percentil 5. Textos invisíveis (opacidade ≈ 0) e cobertos por outra camada não entram. "transição?" = heurística (opacidade < 0,98, escala ≠ 1 ou filtro nos ancestrais); decida pelas regras do sistema se conta.', ''];
const comErro = relatorio.viewports.filter(r => r.erro);
for (const r of relatorio.viewports) {
  if (r.erro) { L.push(`## ${r.pagina} · ${r.viewport}`, '', `> **Não foi possível medir:** ${r.erro}. Rode de novo esta página e largura.`, ''); continue; }
  const semTrans = r.contraste.filter(c => !c.emTransicao);
  L.push(`## ${r.pagina} · ${r.viewport}`, '', `Título da página: ${r.titulo || '(vazio)'} (confira se é o site desta rodada)`, '',
    `| Verificação | Resultado |`, `|---|---|`,
    `| Falhas de contraste (em repouso / possivelmente em transição) | ${semTrans.length} / ${r.contraste.length - semTrans.length} |`,
    `| Cores de texto fora da paleta ou com alfa | ${Object.keys(r.foraDaPaleta).length} |`,
    `| Focos com problema | ${r.foco.filter(f => f.problemas.length).length} de ${r.foco.length}${r.foco.length ? '' : ' (não medido nesta largura)'} |`,
    `| Texto oculto/esmaecido com movimento reduzido | ${r.reduzido.length} |`,
    `| Com movimento reduzido e a página parada: animações e transições rodando / quadros de requestAnimationFrame em 1 s | ${r.movimentoReduzido ? `${r.movimentoReduzido.animacoes} / ${r.movimentoReduzido.quadrosPorSegundo}` : 'não medido'} |`,
    `| Textos sobrepostos (texto sobre texto) | ${r.sobreposicao.length} |`,
    `| Paradas com rolagem horizontal | ${r.overflow.length} |`,
    `| Erros de console | ${r.console.length} |`,
    `| Textos ignorados: invisíveis (aguardando revelação) / cobertos por outra camada | ${r.invisiveis} / ${r.cobertos} |`, '');
  if (r.avisos.length) { L.push('### Avisos de carregamento', ''); for (const a of r.avisos) L.push(`- ${a}`); L.push(''); }
  if (r.contraste.length) {
    L.push('### Contraste abaixo do mínimo', '', 'Cada texto aparece uma vez, com o pior valor medido e as posições de rolagem (y) em que falhou.', '', '| y (pior) | texto | px | cor | p5 | mín. | transição? | posições (y) |', '|---|---|---|---|---|---|---|---|');
    const ordenado = r.contraste.sort((a, b) => a.p5 - b.p5);
    for (const c of ordenado.slice(0, 40)) L.push(`| ${c.y} | ${c.texto.replace(/\|/g, '/').slice(0, 40)} | ${c.fs} | ${c.cor} | ${c.p5} | ${c.minimo} | ${c.emTransicao ? 'sim' : 'não'} | ${[...c.ys].sort((a, b) => a - b).join(', ')} |`);
    if (ordenado.length > 40) L.push('', `+${ordenado.length - 40} falhas não listadas aqui; todas estão em inspecao.json.`);
    L.push('');
  }
  if (r.sobreposicao.length) {
    L.push('### Texto sobre texto', '');
    for (const o of r.sobreposicao.slice(0, 20)) L.push(`- y ${o.y}: "${o.a}" × "${o.b}"`);
    L.push('');
  }
  if (Object.keys(r.foraDaPaleta).length) {
    L.push('### Cores fora da paleta ou com alfa', '');
    for (const [k, v] of Object.entries(r.foraDaPaleta)) L.push(`- ${k}: ${v.join(' · ')}`);
    L.push('');
  }
  L.push('### Tamanhos de fonte (px: ocorrências)', '', Object.entries(r.tamanhos).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}: ${v}`).join(' · '), '');
  // Raios de canto: "12px", "50%" ou "12px 24px" (elíptico), como o navegador calcula; com tokens de raio, marca os que não batem.
  const raioValor = k => (k.includes(' ') ? k : k.endsWith('%') ? k : parseFloat(k));
  const foraDoToken = k => raiosTokens.length && !raioNoToken(raioValor(k));
  L.push(`### Raios de canto (valor: ocorrências${raiosTokens.length ? `; ${raiosTokens.length} tokens de raio lidos, ✗ = fora dos tokens` : '; sem tokens de raio, só a lista'})`, '',
    Object.keys(r.raios).length ? Object.entries(r.raios).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, v]) => `${k}: ${v}${foraDoToken(k) ? ' ✗' : ''}`).join(' · ') : 'nenhum', '');
  const fp = r.foco.filter(f => f.problemas.length);
  if (fp.length) { L.push('### Foco com problema', ''); for (const f of fp) L.push(`- ${f.tag} "${f.id}": ${f.problemas.join(', ')} (${f.anel})`); L.push(''); }
  if (r.reduzido.length) { L.push('### Movimento reduzido: texto oculto ou esmaecido', ''); for (const x of r.reduzido) L.push(`- ${x.tag} "${x.texto}" (opacidade ${x.opacidade}${x.oculto ? ', visibility hidden' : ''})`); L.push(''); }
  if (r.console.length) { L.push('### Console', ''); for (const c of r.console.slice(0, 10)) L.push(`- ${c}`); L.push(''); }
}
L.push('## Limites', '', '- Não mede duração de animações feitas em JS (GSAP etc.): use a sequência de quadros de capturar-telas.mjs.', '- Foco medido em todas as larguras sem toque (768 px ou mais); nas larguras de celular não há navegação por Tab.', '- A classificação "texto grande" segue a WCAG (≥ 24 px, ou ≥ 18,66 px em negrito).', '- Movimento reduzido parado: dezenas de quadros por segundo indicam um laço contínuo (rolagem suave, parallax, canvas, carrossel automático). Se isso conta, quem diz é o sistema de design.');
fs.writeFileSync(path.join(args.out, 'inspecao.md'), L.join('\n'));
console.log(`ok ${args.out}/inspecao.md`);
if (comErro.length) { console.error(`${comErro.length} de ${relatorio.viewports.length} combinações de página e largura não foram medidas: ${comErro.map(r => `${r.pagina} · ${r.viewport}: ${r.erro}`).join('; ')}`); process.exitCode = 1; }
