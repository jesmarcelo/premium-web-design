#!/usr/bin/env node
// Roda o Lighthouse em todas as páginas e perfis de uma rodada, uma execução de cada vez (em paralelo, os números se
// distorcem), grava um JSON por execução e, no fim, gera o resumo com resumir-lighthouse.mjs. Usa a API do Lighthouse
// num único Chrome, aberto uma vez e reaproveitado por todas as execuções (a CLI relançava o navegador a cada uma, o
// que custava vários segundos por execução); cada execução continua numa aba nova, com o mesmo perfil da CLI.
//
// Execute na raiz do projeto; o `lighthouse` (e o `chrome-launcher`, que vem com ele) é procurado em .tmp/ e, se não
// estiver lá, no projeto. O Chrome é o do Playwright (também procurado em .tmp/), a menos que CHROME_PATH já esteja definido:
//   node <skill>/scripts/medir-lighthouse.mjs --url http://localhost:4173/,http://localhost:4173/sobre/ --rotulos inicial,sobre \
//        --out .tmp/performance/r1/medicoes/performance [--categoria performance|seo] [--perfis celular,desktop] [--execucoes 1] [--cpu 4] [--limites …]
//
// --categoria: performance (padrão) ou seo.
// --perfis:    celular, desktop ou os dois (padrão: celular,desktop em performance; celular em seo).
// --execucoes: execuções por página e perfil (padrão 1). Use 1 enquanto itera e 3 na medição que vai ao avaliador de
//              performance, que lê a mediana. Em seo, 1 basta: a nota não oscila.
// --cpu:       desaceleração da CPU no perfil celular (padrão 4, o do Lighthouse; o desktop fica sem desaceleração). O 4× só
//              representa um celular intermediário numa máquina com benchmarkIndex entre 1500 e 2000; fora disso, o resumo
//              avisa, e o fator calibrado vai aqui e em medir-interacoes.mjs.
// --rotulos:   nomes das páginas nos arquivos (um por URL); sem eles, o nome sai do caminho da URL.
// --limites:   repassado a resumir-lighthouse.mjs (por exemplo, nota-celular=90,nota-desktop=95,lcp=2500,cls=0.1,tbt=200).
// A captura da página inteira do Lighthouse fica desligada: nenhum script a usa, e ela custa tempo e alguns MB por JSON.
// Saída: <out>/lh-<perfil>-<rótulo>-<n>.json (em seo, lh-seo-<rótulo>-<n>.json) e <out>/resumo.md. Os lh-*.json que já
// estavam na pasta são apagados antes, para que o resumo não misture medições; os do PageSpeed (pagespeed-*.json) ficam.
// Termina com código 1 se alguma execução falhar ou se algum limite falhar (o código de resumir-lighthouse.mjs).

import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);
if (!args.url || !args.out) {
  console.error('uso: --url <url[,url2,...]> --out <pasta> [--rotulos a,b] [--categoria performance|seo] [--perfis celular,desktop] [--execucoes n] [--cpu n] [--limites …]');
  process.exit(1);
}
const URLS = String(args.url).split(',').map((u) => u.trim()).filter(Boolean);
const invalida = URLS.find((u) => { try { return !/^https?:$/.test(new URL(u).protocol); } catch { return true; } });
if (invalida) { console.error(`Endereço inválido em --url: "${invalida}" (use o endereço completo, com http:// ou https://).`); process.exit(1); }
const rotulos = args.rotulos ? String(args.rotulos).split(',').map((r) => r.trim()) : null;
if (rotulos && rotulos.length !== URLS.length) { console.error('--rotulos precisa ter um rótulo para cada URL de --url.'); process.exit(1); }
const slug = (k) => rotulos ? rotulos[k].replace(/[^\w-]+/g, '-') : (() => { const u = new URL(URLS[k]); return `${u.pathname}${u.search}`.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'home'; })();
const nomes = URLS.map((_, k) => slug(k));
const repetido = nomes.find((n, k) => nomes.indexOf(n) !== k);
if (repetido) { console.error(`Duas páginas dariam o mesmo nome de arquivo ("${repetido}"), e uma medição apagaria a outra. Passe --rotulos com um nome diferente para cada URL.`); process.exit(1); }
const categoria = args.categoria === 'seo' ? 'seo' : 'performance';
const perfis = String(args.perfis || (categoria === 'seo' ? 'celular' : 'celular,desktop')).split(',').map((p) => p.trim());
if (perfis.some((p) => !['celular', 'desktop'].includes(p))) { console.error('--perfis aceita apenas celular e desktop.'); process.exit(1); }
if (categoria === 'seo' && perfis.length > 1) { console.error('Em seo, meça um perfil só (a nota não muda entre celular e desktop, e os arquivos teriam o mesmo nome).'); process.exit(1); }
const execucoes = +(args.execucoes || 1);
if (!Number.isInteger(execucoes) || execucoes < 1) { console.error('--execucoes precisa ser um número inteiro a partir de 1.'); process.exit(1); }
const cpu = args.cpu === undefined ? null : +args.cpu;
if (cpu !== null && !(cpu >= 1)) { console.error('--cpu precisa ser um número a partir de 1.'); process.exit(1); }
// Confere os limites antes de medir: um erro de digitação só apareceria no resumo, minutos depois.
const CHAVES = ['nota', 'seo', 'lcp', 'cls', 'tbt', 'fcp', 'si', 'js', 'fontes', 'inp'];
const limiteInvalido = String(args.limites || '').split(',').map((p) => p.trim()).filter(Boolean)
  .find((p) => { const [k, v = ''] = p.split('='); return !CHAVES.includes(k.trim().split('-')[0]) || v.trim() === '' || Number.isNaN(+v); });
if (limiteInvalido) { console.error(`Limite não reconhecido: "${limiteInvalido}". Chaves aceitas: ${CHAVES.join(', ')}, com sufixo opcional (nota-desktop=95).`); process.exit(1); }

// Dependências de apoio ficam em .tmp/ do projeto; se não estiverem lá, usa as do próprio projeto.
const bases = [path.join(process.cwd(), '.tmp'), process.cwd()];
const baseLighthouse = bases.find((b) => fs.existsSync(path.join(b, 'node_modules', 'lighthouse', 'core', 'index.js')));
if (!baseLighthouse) {
  console.error('Dependência "lighthouse" não encontrada em .tmp/ nem no projeto. Rode o script a partir da raiz do projeto e veja a preparação em references/capturas-e-medicao.md.');
  process.exit(1);
}
const importar = async (nome) => import(pathToFileURL(createRequire(path.join(baseLighthouse, 'noop.js')).resolve(nome)).href);
const { default: lighthouse, desktopConfig } = await importar('lighthouse/core/index.js');
const { launch } = await importar('chrome-launcher');
// O navegador do Playwright fica em .tmp/navegadores, dentro do projeto, quando instalado ali.
if (!process.env.CHROME_PATH) {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(path.join(process.cwd(), '.tmp', 'navegadores'))) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.cwd(), '.tmp', 'navegadores');
  for (const b of bases) {
    try { process.env.CHROME_PATH = createRequire(path.join(b, 'noop.js'))('playwright').chromium.executablePath(); break; } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  if (!process.env.CHROME_PATH) console.warn('AVISO: playwright não encontrado; o Lighthouse vai procurar um Chrome instalado no sistema.');
  else if (!fs.existsSync(process.env.CHROME_PATH)) {
    console.error(`O navegador do Playwright não foi baixado (${process.env.CHROME_PATH}). Veja a preparação em references/capturas-e-medicao.md.`);
    process.exit(1);
  }
}
fs.mkdirSync(args.out, { recursive: true });
for (const f of fs.readdirSync(args.out)) if (/^lh-.*\.json$/.test(f)) fs.unlinkSync(path.join(args.out, f));

// Um Chrome só para todas as execuções, com os mesmos flags que a CLI usava; se ele cair, o próximo run abre outro.
const abrirChrome = () => launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless=new'] });
let chrome = null;
// kill() é síncrono no chrome-launcher 1.x e devolvia uma promessa nas versões anteriores; os dois casos passam aqui.
const fecharChrome = async () => { if (chrome) { const c = chrome; chrome = null; try { await c.kill(); } catch {} } };
process.on('SIGINT', async () => { await fecharChrome(); process.exit(130); });

const total = URLS.length * perfis.length * execucoes;
let feitas = 0, falhas = 0;
for (let i = 1; i <= execucoes; i++) {
  for (const [k, url] of URLS.entries()) {
    for (const perfil of perfis) {
      const nome = `lh-${categoria === 'seo' ? 'seo' : perfil}-${slug(k)}-${i}.json`;
      const destino = path.join(args.out, nome);
      let motivo = null;
      try {
        chrome ??= await abrirChrome();
        // Perfil desktop = o preset desktop da CLI; no celular, o padrão do Lighthouse, com a CPU de --cpu, se houver.
        const flags = { port: chrome.port, output: 'json', onlyCategories: [categoria], disableFullPageScreenshot: true, logLevel: 'error', ...(perfil !== 'desktop' && cpu ? { throttling: { cpuSlowdownMultiplier: cpu } } : {}) };
        const resultado = await lighthouse(url, flags, perfil === 'desktop' ? desktopConfig : undefined);
        if (!resultado?.report) throw new Error('o Lighthouse não devolveu relatório');
        fs.writeFileSync(destino, Array.isArray(resultado.report) ? resultado.report[0] : resultado.report);
        if (resultado.lhr.runtimeError) motivo = `${resultado.lhr.runtimeError.code}: ${resultado.lhr.runtimeError.message}`;
      } catch (err) {
        motivo = String(err?.message || err).split('\n')[0].trim().slice(0, 300) || 'sem mensagem';
        await fecharChrome();
      }
      feitas++;
      if (!motivo) { console.log(`ok (${feitas}/${total}) ${nome}`); continue; }
      falhas++;
      console.error(`falhou (${feitas}/${total}) ${nome}: ${motivo}`);
      // Sem relatório, a página sumiria do resumo; um registro de erro no lugar faz o resumo acusá-la.
      if (!fs.existsSync(destino)) fs.writeFileSync(destino, JSON.stringify({ requestedUrl: url, categories: {}, audits: {}, runtimeError: { code: 'SEM_RELATORIO', message: motivo } }));
    }
  }
}
await fecharChrome();

const resumir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'resumir-lighthouse.mjs');
const r = spawnSync(process.execPath, [resumir, '--pasta', args.out, ...(args.limites ? ['--limites', String(args.limites)] : [])], { stdio: 'inherit' });
if (falhas) console.error(`${falhas} de ${total} execuções falharam; elas aparecem no resumo e ficam fora das medianas.`);
process.exit(falhas ? 1 : r.status ?? 1);
