#!/usr/bin/env node
// Mede em laboratório duas Core Web Vitals que o Lighthouse de carregamento não cobre bem:
//   INP: quanto tempo cada interação (clique, toque, tecla) leva até a tela responder;
//   CLS: quanto o layout se desloca durante o carregamento e a rolagem da página.
// Um site novo não tem dados de campo no PageSpeed, então é daqui que sai o número de INP.
//
// Execute na raiz do projeto; o `playwright` é procurado em .tmp/ e, se não estiver lá, no projeto:
//   node <skill>/scripts/medir-interacoes.mjs --url http://localhost:4173/ --estados design/estados-resultado.json \
//        --out .tmp/performance/r1/medicoes/performance [--perfil celular|desktop] [--cpu 4] [--limites inp=200,cls=0.1]
//
// --estados: o mesmo arquivo usado por capturar-telas.mjs. Estados com acao "click" viram cliques (toques, no celular)
//            e estados com acao "focus" viram uma tecla Tab que leva o foco até o elemento (a partir do elemento anterior,
//            sem ativá-lo); "hover" não conta para o INP. Sem --estados, o script mede o CLS e algumas teclas Tab.
//            O navegador só registra interações a partir de 16 ms: uma ação que chegou à página sem registro aparece como
//            "< 16 ms", o que passa em qualquer limite. Um clique que troca de página não tem medida (meça o destino à parte).
// --perfil:  celular ou desktop, com as mesmas telas do Lighthouse e do PageSpeed: celular com 412×823, densidade 1,75,
//            toque e CPU 4× mais lenta; desktop com 1350×940, densidade 1 e CPU normal.
// --cpu:     fator de desaceleração da CPU; o padrão é 4 no celular e 1 no desktop. O 4× só representa um celular
//            intermediário numa máquina com benchmarkIndex entre 1500 e 2000 (o resumo do Lighthouse mostra o índice e
//            avisa quando ele sai dessa faixa); fora dela, use o mesmo fator calibrado de medir-lighthouse.mjs --cpu.
// --limites: marca cada número como "ok" ou "FALHA" e termina com código 1 se algum falhar.
// Saída: <out>/interacoes.md e <out>/interacoes.json, também impressos na tela.

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
  console.error('uso: --url <url[,url2,...]> --out <pasta> [--estados arquivo.json] [--perfil celular|desktop] [--cpu n] [--limites inp=200,cls=0.1]');
  process.exit(1);
}
const URLS = String(args.url).split(',').map((u) => u.trim()).filter(Boolean);
const perfil = args.perfil === 'desktop' ? 'desktop' : 'celular';
const celular = perfil === 'celular';
const cpu = +(args.cpu || (celular ? 4 : 1));
const TELA = celular ? { width: 412, height: 823 } : { width: 1350, height: 940 };
const estados = args.estados ? JSON.parse(fs.readFileSync(args.estados, 'utf8')) : [];
const limites = Object.fromEntries(String(args.limites || '').split(',').filter(Boolean).map((p) => p.split('=')).map(([k, v]) => [k.trim(), +v]));
fs.mkdirSync(args.out, { recursive: true });

// Registrado antes de qualquer script da página: guarda interações e deslocamentos de layout.
const observador = () => {
  window.__eventos = [];
  window.__deslocamentos = [];
  // Conta as entradas que chegaram à página, para separar "rápida demais para ser registrada" de "não aconteceu".
  window.__entradas = 0;
  for (const t of ['pointerdown', 'touchstart', 'keydown', 'click']) addEventListener(t, () => { window.__entradas++; }, true);
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.interactionId) window.__eventos.push({ id: e.interactionId, nome: e.name, duracao: e.duration, inicio: e.startTime });
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__deslocamentos.push({ valor: e.value, inicio: e.startTime });
  }).observe({ type: 'layout-shift', buffered: true });
};

// CLS pela regra oficial: a maior "janela de sessão" (deslocamentos com menos de 1 s entre si, janela de até 5 s).
const clsDeSessao = (ds) => {
  let maior = 0, atual = 0, inicioJanela = 0, ultimo = -Infinity;
  for (const d of [...ds].sort((a, b) => a.inicio - b.inicio)) {
    if (d.inicio - ultimo > 1000 || d.inicio - inicioJanela > 5000) { atual = 0; inicioJanela = d.inicio; }
    atual += d.valor; ultimo = d.inicio; maior = Math.max(maior, atual);
  }
  return maior;
};

const browser = await chromium.launch();
const resultado = { perfil, cpu, paginas: [] };
let falhou = false;
const marca = (chave, valor) => {
  if (!(chave in limites)) return '';
  // Sem número (nenhuma interação medida, seletor que não existe) o limite não foi conferido: conta como falha.
  const ok = valor != null && valor <= limites[chave];
  if (!ok) falhou = true;
  return ok ? ' · ok' : valor == null ? ` · FALHA (sem medida; limite ${limites[chave]})` : ` · FALHA (limite ${limites[chave]})`;
};

for (const url of URLS) {
  const caminho = new URL(url).pathname.replace(/\/$/, '') || '/';
  const ctx = await browser.newContext(celular
    ? { viewport: TELA, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 }
    : { viewport: TELA, deviceScaleFactor: 1 });
  // Uma página que não abre fica registrada como falha no relatório, sem impedir a medição das outras.
  try {
    await ctx.addInitScript(observador);
    const page = await ctx.newPage();
    if (cpu > 1) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    }
    const abrir = async () => {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
    };
    await abrir();

    // CLS: carregamento e rolagem até o fim, em passos de meia tela.
    const altura = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const passo = Math.max(200, Math.round(TELA.height / 2));
    for (let y = 0; y < altura; y += passo) { await page.evaluate((v) => scrollTo(0, v), y + passo); await page.waitForTimeout(250); }
    await page.waitForTimeout(800);
    const cls = clsDeSessao(await page.evaluate(() => window.__deslocamentos));

    // INP: cada interação parte da página recém-carregada.
    const interacoes = [];
    const lista = estados.filter((e) => ['click', 'focus'].includes(e.acao) && (!e.pagina || (e.pagina.replace(/\/$/, '') || '/') === caminho));
    if (!lista.length) lista.push({ nome: 'teclas-tab', acao: 'tab' });
    // Marca a página antes da ação: se a marca sumir, a interação trocou de página e o registro se perdeu.
    const preparar = () => page.evaluate(() => { window.__marca = Math.random(); return { marca: window.__marca, eventos: window.__eventos.length, entradas: window.__entradas }; });
    for (const e of lista) {
      try {
        await abrir();
        let antes;
        let observacao = '';
        if (e.acao === 'tab') { antes = await preparar(); for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(150); } }
        else {
          const el = page.locator(e.seletor).first();
          await el.scrollIntoViewIfNeeded({ timeout: 5000 });
          await page.waitForTimeout(300);
          if (e.acao === 'focus') {
            // Foco no elemento anterior (Shift+Tab a partir dele) e uma única tecla Tab medida, que leva o foco até ele.
            await el.focus({ timeout: 5000 });
            await page.keyboard.press('Shift+Tab');
            await page.waitForTimeout(300);
            antes = await preparar();
            await page.keyboard.press('Tab');
            if (!(await el.evaluate((n) => n === document.activeElement || n.contains(document.activeElement)))) observacao = 'o Tab não levou o foco ao elemento; medida a tecla assim mesmo';
          } else {
            antes = await preparar();
            await (celular ? el.tap({ timeout: 5000 }) : el.click({ timeout: 5000, noWaitAfter: true }));
          }
        }
        await page.waitForTimeout(800);
        const depois = await page.evaluate((n) => ({ marca: window.__marca, eventos: window.__eventos.slice(n), entradas: window.__entradas }), antes.eventos).catch(() => null);
        if (!depois || depois.marca !== antes.marca) {
          interacoes.push({ nome: e.nome, acao: e.acao, duracao: null, observacao: 'a interação trocou de página e o registro se perdeu; meça a página de destino à parte' });
        } else if (depois.eventos.length) {
          interacoes.push({ nome: e.nome, acao: e.acao, duracao: Math.round(depois.eventos.reduce((m, x) => Math.max(m, x.duracao), 0)), observacao });
        } else if (depois.entradas > antes.entradas) {
          interacoes.push({ nome: e.nome, acao: e.acao, duracao: null, abaixoDe: 16, observacao });
        } else {
          interacoes.push({ nome: e.nome, acao: e.acao, duracao: null, observacao: 'a ação não chegou à página (nenhum evento de entrada)' });
        }
      } catch (err) {
        interacoes.push({ nome: e.nome, acao: e.acao, duracao: null, observacao: `falhou: ${String(err.message).split('\n')[0]}` });
      }
    }
    // O INP é a pior interação; uma interação abaixo do registro conta como 16 ms (o máximo que ela pode ter levado).
    const medidas = interacoes.map((i) => i.duracao ?? i.abaixoDe).filter((d) => d != null);
    const inp = medidas.length ? Math.max(...medidas) : null;
    const inpAbaixoDe = inp != null && !interacoes.some((i) => i.duracao === inp);
    resultado.paginas.push({ url, cls: +cls.toFixed(3), inp, inpAbaixoDe, interacoes });
  } catch (err) {
    resultado.paginas.push({ url, cls: null, inp: null, interacoes: [], erro: String(err.message).split('\n')[0] });
  } finally {
    await ctx.close();
  }
}
await browser.close();

const L = [`# Interações e deslocamentos — perfil ${perfil}, CPU ${cpu}× mais lenta`, ''];
for (const p of resultado.paginas) {
  L.push(`## ${p.url}`, '');
  if (p.erro) L.push(`> A página não pôde ser medida: ${p.erro}`, '');
  L.push('| Item | Valor |', '| --- | --- |');
  L.push(`| CLS (carregamento e rolagem) | ${p.cls == null ? '—' : p.cls.toFixed(3)}${marca('cls', p.cls)} |`);
  L.push(`| INP estimado (pior interação) | ${p.inp == null ? '—' : p.inpAbaixoDe ? `< ${p.inp} ms` : `${p.inp} ms`}${marca('inp', p.inp)} |`, '');
  if (p.interacoes.length) L.push('| Interação | Ação | Duração |', '| --- | --- | --- |');
  for (const i of p.interacoes) {
    const valor = i.duracao != null ? `${i.duracao} ms` : i.abaixoDe ? `< ${i.abaixoDe} ms (abaixo do registro do navegador)` : '—';
    L.push(`| ${i.nome} | ${i.acao} | ${valor}${i.observacao ? ` (${i.observacao})` : ''} |`);
  }
  L.push('');
}
if (Object.keys(limites).length) L.push(falhou ? '**Resultado: há limites que falharam.**' : '**Resultado: todos os limites passaram.**', '');
const texto = L.join('\n');
fs.writeFileSync(path.join(args.out, 'interacoes.md'), texto);
fs.writeFileSync(path.join(args.out, 'interacoes.json'), JSON.stringify(resultado, null, 2));
console.log(texto);
process.exit(falhou ? 1 : 0);
