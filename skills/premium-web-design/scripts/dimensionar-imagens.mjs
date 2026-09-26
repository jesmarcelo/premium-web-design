#!/usr/bin/env node
// Descobre, no navegador, quantos pixels cada imagem ocupa de fato em diferentes telas,
// confere se o atributo `sizes` corresponde a isso e calcula as larguras de arquivo sem desperdício,
// inclusive nos perfis usados pelo PageSpeed e pelo Lighthouse.
//
// Execute na raiz do projeto; o `playwright` é procurado em .tmp/ e, se não estiver lá, no projeto:
//   node <skill>/scripts/dimensionar-imagens.mjs --url http://localhost:4173/[,http://localhost:4173/sobre/] [--json .tmp/larguras.json]
//
// Telas medidas: celular do PageSpeed (412×823, densidade 1,75), desktop do PageSpeed (1350×940, densidade 1),
// iPhone (390×844, densidade 3), tablet (768×1024, densidade 2), 1440×900 e 1920×1080 (densidade 1) e MacBook (1512×982, densidade 2, o notebook comum do público de um site premium).
//
// Em cada imagem e tela:
//   exibida = largura de layout em CSS (sem as transformações de animação), multiplicada pela
//             ampliação fixa da imagem (parallax ou zoom) e corrigida pelo object-fit: cover;
//   sizes   = o valor a que o atributo `sizes` chega naquela tela;
//   arquivo = a largura que o navegador vai baixar (sizes × densidade).
// Emite um aviso quando `sizes` e largura exibida diferem mais de 10% (arquivo grande ou pequeno demais). Sem o
// atributo `sizes`, num srcset com larguras (480w), o navegador usa 100vw, e o aviso diz isso; `sizes="auto"` usa a
// largura exibida e não gera aviso.
// Com --json, grava { "<nome>": [larguras] } para usar em gerar-variantes.mjs --larguras-json.
// Imagens com loading="lazy" são carregadas à força, e a medição espera todas decodificarem (no máximo 10 s).
// Uma imagem que não aparece num perfil (display:none, aba ou slide fechado) é ignorada nesse perfil,
// em vez de virar largura 0. Imagens de fundo feitas em CSS não são medidas.
// Várias páginas são aceitas; os perfis de cada página são medidos três de cada vez.

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
if (!args.url) {
  console.error('uso: --url <url[,url2,...]> [--json larguras.json]');
  process.exit(1);
}

const PERFIS = [
  { nome: 'PageSpeed celular', w: 412, h: 823, dpr: 1.75, mobile: true },
  { nome: 'PageSpeed desktop', w: 1350, h: 940, dpr: 1, mobile: false },
  { nome: 'iPhone', w: 390, h: 844, dpr: 3, mobile: true },
  { nome: 'tablet', w: 768, h: 1024, dpr: 2, mobile: true },
  { nome: '1440', w: 1440, h: 900, dpr: 1, mobile: false },
  { nome: 'MacBook', w: 1512, h: 982, dpr: 2, mobile: false },
  { nome: '1920', w: 1920, h: 1080, dpr: 1, mobile: false },
];

const URLS = String(args.url).split(',').map((u) => u.trim()).filter(Boolean);
const browser = await chromium.launch();
const tabela = {};

async function medirPerfil(url, pf) {
  const page = await browser.newPage({ viewport: { width: pf.w, height: pf.h }, deviceScaleFactor: pf.dpr, isMobile: pf.mobile, hasTouch: pf.mobile });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  // Carrega as imagens adiadas e espera todas decodificarem, com teto de 10 s.
  await page.evaluate(() => Promise.race([
    Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })).then(() => document.fonts.ready),
    new Promise((r) => setTimeout(r, 10000)),
  ]));
  await page.waitForTimeout(300);
  const medidas = await page.evaluate(() => {
    // Resolve o atributo sizes nesta tela: primeira condição verdadeira, medida numa div.
    const resolveSizes = (s) => {
      if (!s || s.trim() === 'auto') return null;
      for (const parte of s.split(/,(?![^(]*\))/)) {
        const m = parte.trim().match(/^(\(.*\))\s+(.+)$/);
        const [cond, len] = m ? [m[1], m[2]] : [null, parte.trim()];
        if (cond && !matchMedia(cond).matches) continue;
        if (len === 'auto') return null;
        const d = document.createElement('div');
        d.style.cssText = `position:absolute;visibility:hidden;width:${len}`;
        document.body.appendChild(d);
        const w = d.getBoundingClientRect().width;
        d.remove();
        return w;
      }
      return null;
    };
    return [...document.images].map((img) => {
      const pic = img.parentElement?.tagName === 'PICTURE' ? img.parentElement : null;
      const src = pic && [...pic.querySelectorAll('source')].find((s) => !s.media || matchMedia(s.media).matches);
      const sizes = src?.getAttribute('sizes') ?? img.getAttribute('sizes');
      const srcset = (src ?? img).getAttribute('srcset') || '';
      const candidatos = srcset.split(/,\s+/).map((c) => c.trim().split(/\s+/)).map(([u, d]) => [String(u).split('/').pop().split('?')[0], d || '']);
      // Sem sizes, um srcset com larguras (480w) é escolhido como se a imagem ocupasse a tela inteira (100vw).
      const semSizes = sizes == null && candidatos.some(([, d]) => /^\d+w$/.test(d));
      // Largura de layout, sem as transformações de animação em andamento.
      const bw = img.offsetWidth, bh = img.offsetHeight;
      // Nome da imagem sem a largura: tira o "-480" de hero-480.webp só quando o srcset diz que esse arquivo tem 480w,
      // para que hero-1.webp e hero-2.webp continuem sendo imagens diferentes.
      const arquivo = (img.currentSrc || img.src).split('/').pop().split('?')[0];
      const sufixo = arquivo.match(/^(.*)-(\d+)(\.\w+)$/);
      const nome = (sufixo && candidatos.some(([u, d]) => u === arquivo && d === `${sufixo[2]}w`) ? `${sufixo[1]}${sufixo[3]}` : arquivo).replace(/\.\w+$/, '');
      if (!bw || !bh) return { nome, oculta: true };
      const ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : bw / bh;
      let exibida = getComputedStyle(img).objectFit === 'cover' ? Math.max(bw, bh * ar) : bw;
      const m = getComputedStyle(img).transform.match(/matrix\(([^,]+)/);
      if (m) exibida *= Math.max(1, Math.abs(parseFloat(m[1])) || 1);
      return { nome, exibida: Math.round(exibida), sizes: semSizes ? innerWidth : resolveSizes(sizes), semSizes, natural: img.naturalWidth };
    });
  });
  await page.close();
  return medidas.map((x) => ({ ...x, perfil: pf }));
}

for (const url of URLS) {
  const fila = [...PERFIS];
  const resultados = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (fila.length) { const pf = fila.shift(); resultados.push(...(await medirPerfil(url, pf))); }
  }));
  // Mantém a ordem dos perfis na saída.
  resultados.sort((a, b) => PERFIS.indexOf(a.perfil) - PERFIS.indexOf(b.perfil));
  for (const x of resultados) ((tabela[x.nome] ??= []).push(x));
}
await browser.close();

const saida = {};
let avisos = 0;
for (const [nome, linhas] of Object.entries(tabela)) {
  console.log(`\n${nome}`);
  const larguras = new Set();
  for (const { perfil, exibida, sizes, semSizes, oculta } of linhas) {
    if (oculta) { console.log(`  ${perfil.nome.padEnd(18)} não aparece neste perfil (ignorada)`); continue; }
    const pedido = Math.ceil(((sizes ?? exibida) * perfil.dpr) / 8) * 8;
    larguras.add(pedido);
    const desvio = sizes ? sizes / exibida - 1 : 0;
    const aviso = Math.abs(desvio) > 0.1 ? `  ← ${semSizes ? 'sem o atributo sizes, o navegador usa 100vw, ' : 'sizes '}${desvio > 0 ? 'maior' : 'menor'} que o exibido (${Math.round(desvio * 100)}%)` : '';
    if (aviso) avisos++;
    console.log(`  ${perfil.nome.padEnd(18)} exibida ${String(exibida).padStart(4)}  sizes ${(sizes ? String(Math.round(sizes)) : '—').padStart(4)}  arquivo ${String(pedido).padStart(4)} px${aviso}`);
  }
  // Funde larguras a menos de 3% uma da outra, ficando com a maior (sobra desprezível).
  const ordenadas = [...larguras].filter((w) => w > 0).sort((a, b) => b - a);
  if (!ordenadas.length) { console.log('  sem medida válida em nenhum perfil'); continue; }
  saida[nome] = ordenadas.filter((w, i) => i === 0 || w < ordenadas[i - 1] * 0.97).reverse();
  console.log(`  larguras: ${saida[nome].join(', ')}`);
}
if (args.json) {
  fs.writeFileSync(args.json, JSON.stringify(saida, null, 2));
  console.log(`\nGravado ${args.json} (use em gerar-variantes.mjs --larguras-json).`);
}
console.log(avisos ? `\n${avisos} aviso(s) de sizes impreciso: corrija o sizes antes de gerar as larguras.` : '\nsizes coerente com o exibido em todos os perfis.');
