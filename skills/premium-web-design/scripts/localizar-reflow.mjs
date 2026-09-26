#!/usr/bin/env node
// Converte posições apontadas pelo PageSpeed ou pelo Lighthouse (arquivo.js:linha:coluna do código
// minificado) no arquivo, na linha e no trecho correspondentes do código-fonte.
// Útil para apontamentos como "Reflow forçado", que só informam posições no código minificado.
//
// Execute na raiz do projeto; o `source-map-js` é procurado em .tmp/ e, se não estiver lá, no projeto (o Vite já inclui):
//   npx vite build --sourcemap hidden      # gera o mapa sem expor o comentário no JS publicado
//   node <skill>/scripts/localizar-reflow.mjs --map dist/assets/index-XXXX.js.map \
//        --pos "1:97647=108,1:10870=169,2:16145=203"
//
// --pos: lista de linha:coluna, com o tempo em ms opcional depois de "=". O resultado sai
// agrupado por arquivo de origem e ordenado pelo tempo, separando o código do projeto
// do código das bibliotecas (node_modules).
// Importante: o build com mapa precisa ter o mesmo hash do JS que está publicado.

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
const { SourceMapConsumer } = exigir('source-map-js');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);
if (!args.map || !args.pos) {
  console.error('uso: --map <arquivo.js.map> --pos "linha:coluna[=ms],..."');
  process.exit(1);
}

const mapa = new SourceMapConsumer(JSON.parse(fs.readFileSync(args.map, 'utf8')));
const itens = String(args.pos).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [lc, ms] = s.split('=');
  const [linha, coluna] = lc.split(':').map(Number);
  // Lighthouse e PageSpeed mostram a linha a partir de 1 e a coluna a partir de 0 (a mesma base do mapa): vai direto.
  let o = mapa.originalPositionFor({ line: linha, column: coluna });
  if (!o.source) o = mapa.originalPositionFor({ line: linha, column: coluna, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
  const src = o.source ? mapa.sourceContentFor(o.source, true) : null;
  const trecho = src && o.line ? src.split('\n')[o.line - 1]?.trim().slice(0, 110) : '';
  return { pos: lc, ms: +(ms || 0), fonte: o.source ? o.source.replace(/^.*?(node_modules|src)\//, '$1/') : '(sem mapa)', linha: o.line, nome: o.name, trecho };
});

const grupos = {};
itens.forEach((i) => (grupos[i.fonte] ??= []).push(i));
const total = (g) => g.reduce((s, i) => s + i.ms, 0);
const ordem = Object.entries(grupos).sort((a, b) => total(b[1]) - total(a[1]));
for (const proprio of [true, false]) {
  console.log(proprio ? '\n## Código do projeto' : '\n## Bibliotecas (node_modules)');
  for (const [fonte, g] of ordem) {
    if (fonte.startsWith('node_modules') === proprio) continue;
    console.log(`\n${fonte}  — ${total(g)} ms`);
    g.sort((a, b) => b.ms - a.ms).forEach((i) =>
      console.log(`  ${String(i.ms).padStart(4)} ms  ${i.pos} → linha ${i.linha}${i.nome ? ` (${i.nome})` : ''}: ${i.trecho}`)
    );
  }
}
console.log('\nLeituras de geometria em bibliotecas quase sempre são disparadas pelo projeto:');
console.log('procure no código do projeto quem chama a biblioteca logo depois de escrever estilo ou DOM.');
