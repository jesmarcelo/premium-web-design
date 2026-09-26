#!/usr/bin/env node
// Registra uma página sempre da mesma forma, para que os avaliadores comparem referência e resultado em pé de igualdade.
// Saída: primeira-tela.png, sequencia-carregamento.png, sequencia-rolagem.png, sobre-a-captura.txt e os quadros avulsos em f/.
//
// Execute na raiz do projeto; o `playwright` é procurado em .tmp/ e, se não estiver lá, no projeto:
//   node <skill>/scripts/capturar-telas.mjs --url http://localhost:4173/ --out .tmp/blocos/r1/capturas
//   opções: --mobile  --viewport 360x740  --from 0  --to <px|fim>  --steps 24  --wait 450  --tile 4
//   --tile define as colunas da sequência de rolagem (padrão: 4 no desktop, 8 no celular); as linhas saem do número de
//   quadros, e as sequências de carregamento e de estados têm sempre 4 colunas.
//   --mobile simula um celular alto (390×844). Para um celular baixo, some --viewport 360x740.
//   Várias larguras de uma vez: --viewports 1440x900,390x844,360x740:primeira (abaixo de 768 px vira celular, com toque),
//   cada uma numa subpasta (desktop-1440x900, celular-390x844, celular-360x740). Tudo roda num único navegador,
//   duas capturas por vez (--paralelo 2, o padrão; use o mesmo valor em todas as rodadas).
//   O sufixo :primeira numa largura grava só o carregamento e a primeira tela (sem rolagem nem estados): é o caso do
//   celular baixo, de que o avaliador visual abre só a primeira-tela.png. Com --viewports, --from e --to aceitam um
//   valor por largura, na ordem delas (--from 0,0,0 --to 3200,5100,5400), porque a posição do trecho muda com a largura;
//   um valor só vale para todas.
//   Várias páginas: --url http://localhost:4173/,http://localhost:4173/sobre/ (uma subpasta por página dentro de --out).
//   Com --rotulos inicial,sobre, as subpastas recebem esses nomes em vez do caminho da URL, e a subpasta existe mesmo
//   com uma página só. Use os MESMOS rótulos na referência e no resultado (numa rodada que captura só parte das
//   páginas, os rótulos dessas páginas), para que os nomes das pastas não revelem qual versão é qual.
//   Interações: --estados design/estados-resultado.json captura estados como hover, menu aberto e foco.
//
// Arquivo de estados: uma lista de objetos { "nome", "acao", "seletor", "pagina"? }.
//   nome    = identificador do estado; use os MESMOS nomes nos arquivos da referência e do resultado,
//             para que o A/B compare estados equivalentes (os seletores mudam de um site para o outro);
//   acao    = "hover", "click" ou "focus" (no celular, "click" vira toque, e "hover" é ignorado: tela de toque não tem hover);
//   seletor = seletor CSS do elemento (o primeiro encontrado é usado);
//   pagina  = opcional; caminho da página em que o estado existe (ex.: "/sobre"). Sem ele, vale para todas.
// Cada estado parte da página recém-carregada e gera estado-<nome>.png (estado final) e
// sequencia-estado-<nome>.png (antes da ação e a transição, ~80 ms entre quadros).
//
// Os quadros do carregamento são tirados pelo protocolo do Chrome (CDP), porque a captura comum do Playwright espera as
// fontes carregarem e esconderia a troca de fontes. Os tempos reais de cada quadro e do load saem só na tela, e não no
// sobre-a-captura.txt, que vai para o par A/B: a referência carrega pela internet, e os tempos revelariam qual é qual.
// A primeira tela e a rolagem só começam depois do evento load (até 30 s); se a página não abrir, a captura falha e
// as demais continuam.
// As sequências são montadas pelo próprio navegador do Playwright; não é preciso instalar mais nada.

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
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
  console.error('uso: --url <url> --out <pasta> [--mobile] [--viewport LxA] [--from px] [--to px|fim] [--steps n] [--wait ms] [--tile colunas] [--estados arquivo.json] [--rotulos a,b] [--viewports LxA,LxA[:primeira]] [--paralelo n]');
  process.exit(1);
}
const URLS = String(args.url).split(',').map(u => u.trim()).filter(Boolean);
const rotulos = args.rotulos ? String(args.rotulos).split(',').map(r => r.trim()) : null;
if (rotulos && rotulos.length !== URLS.length) { console.error('--rotulos precisa ter um rótulo para cada URL de --url.'); process.exit(1); }
const slug = k => rotulos ? rotulos[k].replace(/[^\w-]+/g, '-') : (new URL(URLS[k]).pathname.replace(/^\/|\/$/g, '').replace(/[^\w-]+/g, '-') || 'home');

// Larguras: com --viewports, várias de uma vez, cada uma numa subpasta (desktop-1440x900, celular-390x844…);
// sem ela, uma só, definida por --mobile e --viewport, gravada direto na pasta de saída.
const VIEWPORTS = args.viewports
  ? String(args.viewports).split(',').map(v => {
    const [tamanho, sufixo] = v.trim().split(':');
    const [w, h] = tamanho.split('x').map(Number);
    if (!(w > 0 && h > 0) || (sufixo && sufixo !== 'primeira')) { console.error(`Largura inválida em --viewports: "${v.trim()}" (use LxA ou LxA:primeira).`); process.exit(1); }
    const mobile = w < 768;
    return { width: w, height: h, mobile, primeira: sufixo === 'primeira', nome: `${mobile ? 'celular' : 'desktop'}-${w}x${h}` };
  })
  : [(() => {
    const mobile = !!args.mobile;
    const [vw, vh] = args.viewport ? String(args.viewport).split('x').map(Number) : [];
    return { ...(vw ? { width: vw, height: vh } : mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }), mobile, nome: '' };
  })()];
// --from e --to: um valor para todas as larguras ou um por largura, na ordem de --viewports.
const porLargura = (opcao, padrao) => {
  const valores = String(args[opcao] ?? padrao).split(',').map(v => v.trim());
  if (valores.length !== 1 && valores.length !== VIEWPORTS.length) { console.error(`--${opcao} precisa de um valor só ou de um valor para cada largura de --viewports (${VIEWPORTS.length}).`); process.exit(1); }
  const invalido = valores.find(v => !(opcao === 'to' && v === 'fim') && !(Number(v) >= 0));
  if (invalido !== undefined) { console.error(`Valor inválido em --${opcao}: "${invalido}".`); process.exit(1); }
  return VIEWPORTS.map((_, k) => valores.length === 1 ? valores[0] : valores[k]);
};
const FROMS = porLargura('from', '0');
const TOS = porLargura('to', 'fim');
VIEWPORTS.forEach((vp, k) => { vp.from = +FROMS[k]; vp.to = TOS[k]; });
const steps = +(args.steps || 24);
const wait = +(args.wait || 450);
const PARALELO = Math.max(1, +(args.paralelo || 2));
const estados = args.estados ? JSON.parse(fs.readFileSync(args.estados, 'utf8')) : [];

const browser = await chromium.launch();

async function capturar(url, out, vp) {
  const mobile = vp.mobile;
  // Uma captura anterior na mesma pasta (com outro --steps ou outros estados) deixaria quadros velhos nas montagens.
  fs.rmSync(path.join(out, 'f'), { recursive: true, force: true });
  if (fs.existsSync(out)) for (const a of fs.readdirSync(out)) if (/^(sequencia-)?estado-.*\.png$/.test(a)) fs.rmSync(path.join(out, a));
  fs.mkdirSync(path.join(out, 'f'), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', m => m.type() === 'error' && erros.push(m.text()));

    // Carregamento: 12 quadros, marcados para 300 ms depois do início e a cada 220 ms, sem esperar as fontes.
    // Em JPEG: um PNG de 1440×900 leva ~250 ms para codificar, mais que o intervalo, e os quadros atrasariam em cascata.
    const cdp = await ctx.newCDPSession(page);
    const inicio = Date.now();
    let fimDaCarga = null, status = null;
    const navegacao = page.goto(url, { waitUntil: 'load', timeout: 30000 }).then(r => { fimDaCarga = Date.now() - inicio; status = r?.status() ?? null; return null; }, err => err);
    const tempos = [];
    let salvos = 0;
    for (let i = 0; i < 12; i++) {
      const falta = inicio + 300 + i * 220 - Date.now();
      if (falta > 0) await page.waitForTimeout(falta);
      tempos.push(Date.now() - inicio);
      const quadro = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }).catch(() => null);
      if (quadro) { fs.writeFileSync(`${out}/f/load${String(i).padStart(2, '0')}.jpg`, Buffer.from(quadro.data, 'base64')); salvos++; }
    }
    await cdp.detach().catch(() => {});
    // A primeira tela e a altura da página só valem com a página carregada.
    const erroNavegacao = await navegacao;
    let avisoCarga = '';
    if (erroNavegacao) {
      if (erroNavegacao.name !== 'TimeoutError') throw new Error(`a página não abriu: ${String(erroNavegacao.message).split('\n')[0]}`);
      avisoCarga = 'o evento load não terminou em 30 s; a primeira tela e a rolagem foram capturadas assim mesmo';
    } else if (status >= 400) avisoCarga = `o servidor respondeu ${status}; confira o endereço`;
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}/primeira-tela.png` });
    const titulo = await page.title().catch(() => '');

    const scrollBy = async d => (mobile ? page.evaluate(dd => window.scrollBy(0, dd), d) : page.mouse.wheel(0, d));
    const from = vp.from;
    const altura = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const to = vp.to === 'fim' ? altura : +vp.to;
    // Numa largura marcada com :primeira, só o carregamento e a primeira tela interessam: sem rolagem nem estados.
    const quadrosDeRolagem = vp.primeira ? 0 : steps;
    for (let y = 0; y < from && !vp.primeira; y += 300) { await scrollBy(300); await page.waitForTimeout(120); }
    if (from > 0 && !vp.primeira) await page.waitForTimeout(1200);

    const passo = (to - from) / steps;
    for (let i = 0; i < quadrosDeRolagem; i++) {
      await scrollBy(passo);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${out}/f/scroll${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 85 });
    }

    // Estados de interação: cada um parte da página recém-carregada, para não herdar o estado anterior.
    const estadosFeitos = [];
    const estadosFalhos = [];
    const estadosIgnorados = [];
    const caminhoAtual = new URL(url).pathname.replace(/\/$/, '') || '/';
    for (const e of vp.primeira ? [] : estados) {
      if (e.pagina && (e.pagina.replace(/\/$/, '') || '/') !== caminhoAtual) continue;
      const nome = String(e.nome).replace(/[^\w-]+/g, '-');
      if (mobile && e.acao === 'hover') { estadosIgnorados.push(nome); continue; }
      try {
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        const el = page.locator(e.seletor).first();
        await el.scrollIntoViewIfNeeded({ timeout: 5000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${out}/f/estado-${nome}-00.png` });
        if (e.acao === 'hover') await el.hover({ timeout: 5000 });
        else if (e.acao === 'focus') { await page.keyboard.press('Tab'); await el.focus({ timeout: 5000 }); }
        else if (e.acao === 'click') await (mobile ? el.tap({ timeout: 5000 }) : el.click({ timeout: 5000 }));
        else throw new Error(`ação desconhecida "${e.acao}"`);
        for (let i = 1; i < 8; i++) {
          await page.waitForTimeout(80);
          await page.screenshot({ path: `${out}/f/estado-${nome}-${String(i).padStart(2, '0')}.png` });
        }
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${out}/estado-${nome}.png` });
        estadosFeitos.push(nome);
      } catch (err) {
        estadosFalhos.push(`${nome}: ${String(err.message).split('\n')[0]}`);
      }
    }

    // Monta as sequências (grade de quadros) com o próprio navegador, numa página HTML temporária ao lado dos
    // quadros, que aponta para os arquivos em vez de embutir cada quadro no texto da página.
    const montar = async (prefixo, cols, destino) => {
      const quadros = fs.readdirSync(path.join(out, 'f')).filter(f => f.startsWith(prefixo) && /\.(png|jpg)$/.test(f)).sort();
      if (!quadros.length) return;
      const w = mobile ? 260 : 480;
      const html = path.resolve(out, 'f', `montagem-${prefixo}.html`);
      fs.writeFileSync(html, `<!doctype html><style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${w}px)}img{width:${w}px;display:block}</style>${quadros.map(f => `<img src="${encodeURIComponent(f)}">`).join('')}`);
      const pg = await browser.newPage({ viewport: { width: cols * w, height: 100 }, deviceScaleFactor: 1 });
      try {
        await pg.goto(pathToFileURL(html).href);
        await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
        await pg.screenshot({ path: destino, fullPage: true });
      } finally {
        await pg.close();
        fs.rmSync(html, { force: true });
      }
    };
    const colsRolagem = args.tile ? +String(args.tile).split('x')[0] || 4 : mobile ? 8 : 4;
    await montar('load', 4, `${out}/sequencia-carregamento.png`);
    await montar('scroll', colsRolagem, `${out}/sequencia-rolagem.png`);
    for (const nome of estadosFeitos) await montar(`estado-${nome}-`, 4, `${out}/sequencia-estado-${nome}.png`);

    fs.writeFileSync(`${out}/sobre-a-captura.txt`,
      `Página: ${titulo || '(sem título)'} (confira se é o site desta rodada).\nViewport ${vp.width}x${vp.height}${mobile ? ' (touch)' : ''}. ${vp.primeira ? 'Só o carregamento e a primeira tela (largura marcada com :primeira): sem rolagem nem estados.' : `Rolagem de ${from} a ${Math.round(to)} px em ${steps} passos, ~${wait} ms entre quadros.`}\n` +
      `Carregamento: ${salvos} quadros, marcados para 300 ms e depois a cada 220 ms, sem esperar as fontes; instantes reais: ${tempos.join(', ')} ms.\n` +
      (estados.length && !vp.primeira ? `Estados de interação: ${estadosFeitos.join(', ') || 'nenhum'} (primeiro quadro antes da ação, depois ~80 ms entre quadros).${estadosIgnorados.length ? `\nHover ignorado nesta tela de toque: ${estadosIgnorados.join(', ')}.` : ''}${estadosFalhos.length ? `\nEstados que falharam: ${estadosFalhos.join('; ')}` : ''}\n` : '') +
      `Sequências: da esquerda para a direita, de cima para baixo.\nErros de console: ${erros.length}\n`);
    console.log(`ok ${out} (${vp.primeira ? 'só a primeira tela' : `${steps} quadros`}${estados.length && !vp.primeira ? `; estados: ${estadosFeitos.length} ok, ${estadosFalhos.length} com falha` : ''}; erros de console: ${erros.length})`);
    if (estadosFalhos.length) console.error(`Estados com falha em ${out}: ${estadosFalhos.join('; ')}`);
    console.log(`  carregamento em ${out}: quadros em ${tempos.join(', ')} ms; load ${fimDaCarga == null ? 'não concluído' : `em ${fimDaCarga} ms`}`);
    if (tempos.some((t, i) => t > 300 + i * 220 + 110)) console.error(`Aviso em ${out}: quadros do carregamento atrasaram mais de 110 ms (máquina ocupada); o intervalo declarado ficou impreciso.`);
    if (avisoCarga) console.error(`Aviso em ${out}: ${avisoCarga}.`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Páginas e larguras no mesmo navegador, com um limite de capturas simultâneas. As sequências dependem do
// tempo das animações, então a concorrência é baixa (padrão 2); use o mesmo valor em todas as rodadas.
// Com --rotulos, cada página ganha sempre a sua subpasta, mesmo sozinha, para que a estrutura das pastas seja igual à
// da referência capturada com várias páginas.
const tarefas = URLS.flatMap((u, k) => VIEWPORTS.map(vp => ({ u, vp, out: path.join(args.out, URLS.length > 1 || rotulos ? slug(k) : '', vp.nome) })));
let proxima = 0;
const falhas = [];
await Promise.all(Array.from({ length: Math.min(PARALELO, tarefas.length) }, async () => {
  while (proxima < tarefas.length) {
    const t = tarefas[proxima++];
    // Uma captura que falha não derruba as outras; o erro fica registrado e o script termina com código 1.
    try { await capturar(t.u, t.out, t.vp); }
    catch (err) { falhas.push(`${t.out}: ${String(err.message).split('\n')[0]}`); console.error(`falhou ${t.out}: ${String(err.message).split('\n')[0]}`); }
  }
}));
await browser.close();
if (falhas.length) { console.error(`${falhas.length} de ${tarefas.length} capturas falharam:\n${falhas.join('\n')}`); process.exit(1); }
