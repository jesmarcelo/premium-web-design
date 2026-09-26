#!/usr/bin/env node
// Resume os relatórios do Lighthouse e do PageSpeed de uma rodada num único arquivo curto, para que o
// construtor e os avaliadores de performance e de SEO não precisem ler JSONs de mais de 1 MB.
//
// Execute na raiz do projeto (não precisa de nenhuma dependência):
//   node <skill>/scripts/resumir-lighthouse.mjs --pasta .tmp/performance/r1/medicoes/performance [--limites nota-celular=90,nota-desktop=95,lcp=2500,cls=0.1,tbt=200]
//
// Lê todos os .json da pasta e agrupa os do Lighthouse local pelo nome sem o número final: lh-celular-inicial-1.json,
// lh-celular-inicial-2.json e lh-celular-inicial-3.json formam o grupo "lh-celular-inicial". Os do PageSpeed usam o
// sufixo -exec<n>: pagespeed-celular-inicial-exec1.json, -exec2 e -exec3 formam o grupo "pagespeed-celular-inicial"
// (um número solto no fim, como servico-1, é parte do rótulo da página e não agrupa). Aceita tanto o JSON
// do Lighthouse quanto o da API do PageSpeed (que traz o relatório dentro de "lighthouseResult").
// Para cada grupo: a mediana das notas de cada categoria, das métricas (LCP, CLS, TBT, FCP, Speed Index) e dos bytes
// transferidos; o elemento de LCP e as fases dele; e as auditorias que falharam (nota abaixo de 0,9) na maioria das
// execuções, com a economia estimada e os três itens que mais pesam em cada uma. Nos JSON da API do PageSpeed, também os
// dados de campo (visitantes reais, percentil 75: LCP, INP e CLS), quando o Google os tiver. E o benchmarkIndex da
// máquina de cada grupo do Lighthouse local, com um aviso quando ele sai da faixa em que a desaceleração padrão de 4×
// representa um celular intermediário (veja --cpu em medir-lighthouse.mjs).
// Com --limites, marca cada número como "ok" ou "FALHA" e o script termina com código 1 se algum limite falhar; útil
// para o construtor iterar até as metas passarem. Chaves: nota e seo (0–100), lcp, tbt, fcp e si (ms), cls (sem
// unidade), js (KiB de JavaScript transferidos), fontes (arquivos de fonte baixados) e inp (ms; só existe nos dados de
// campo do PageSpeed, e lcp e cls também são conferidos neles). Um sufixo limita a chave aos
// grupos que têm esse pedaço no nome: nota-celular=90,nota-desktop=95 vale 90 para lh-celular-… e pagespeed-celular…
// e 95 para os de desktop; a chave sem sufixo vale para os grupos que nenhum sufixo alcança.
// Um limite que se aplica mas ficou sem número (execução com erro, auditoria ausente) conta como FALHA, e um lh-*.json ou
// pagespeed-*.json ilegível (truncado, erro da API) também: medição incompleta não passa.
// Saída: <pasta>/resumo.md, também impresso na tela.

import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);
if (!args.pasta) {
  console.error('uso: --pasta <pasta com os .json da rodada> [--limites nota-celular=90,nota-desktop=95,lcp=2500,cls=0.1,tbt=200,seo=100,js=100,fontes=3]');
  process.exit(1);
}

const CHAVES = ['nota', 'seo', 'lcp', 'cls', 'tbt', 'fcp', 'si', 'js', 'fontes', 'inp'];
const MINIMOS = ['nota', 'seo']; // nessas, o número precisa ficar acima do limite; nas demais, abaixo
const limites = [];
for (const par of String(args.limites || '').split(',').map((p) => p.trim()).filter(Boolean)) {
  const [k, v] = par.split('=');
  const [chave, ...resto] = k.trim().split('-');
  if (!CHAVES.includes(chave) || v === undefined || v.trim() === '' || Number.isNaN(+v)) {
    console.error(`Limite não reconhecido: "${par}". Chaves aceitas: ${CHAVES.join(', ')}, com sufixo opcional (nota-desktop=95).`);
    process.exit(1);
  }
  limites.push({ chave, filtro: resto.join('-'), valor: +v, usado: false });
}
// O limite de uma chave num grupo: o sufixo que aparece primeiro entre os pedaços do nome do grupo (no empate, o mais
// longo, que é o mais específico); senão, a chave sem sufixo.
const limiteDe = (chave, grupo) => {
  const pedacos = grupo.split('-');
  const posicao = (l) => {
    if (!l.filtro) return Infinity;
    const i = pedacos.findIndex((_, k) => { const resto = pedacos.slice(k).join('-'); return resto === l.filtro || resto.startsWith(`${l.filtro}-`); });
    return i < 0 ? -1 : i;
  };
  const candidatos = limites.filter((l) => l.chave === chave && posicao(l) !== -1);
  return candidatos.sort((a, b) => posicao(a) - posicao(b) || b.filtro.length - a.filtro.length)[0] || null;
};

const METRICAS = [
  ['lcp', 'largest-contentful-paint', 'LCP', (v) => `${Math.round(v)} ms`],
  ['cls', 'cumulative-layout-shift', 'CLS', (v) => v.toFixed(3)],
  ['tbt', 'total-blocking-time', 'TBT', (v) => `${Math.round(v)} ms`],
  ['fcp', 'first-contentful-paint', 'FCP', (v) => `${Math.round(v)} ms`],
  ['si', 'speed-index', 'Speed Index', (v) => `${Math.round(v)} ms`],
];
// Auditorias que dependem do servidor: o vite preview não manda cabeçalhos de cache longo, então elas falham por lá sem
// que isso diga algo do site publicado. Compressão não entra aqui: o vite preview comprime com gzip, e uma falha de
// compressão medida nele é real. Os nomes mudam entre versões do Lighthouse (as "insights" vieram na versão 13).
const SO_NO_SERVIDOR = ['cache-insight', 'uses-long-cache-ttl'];
const COMPRESSAO = ['uses-text-compression', 'document-latency-insight'];
const semCompressao = (id, a) => id === 'uses-text-compression' || Object.entries(a.details?.items || {}).some(([k, i]) => k === 'usesCompression' && i.value === false);
// Dados de campo da API do PageSpeed (percentil 75 dos visitantes reais). O CLS vem multiplicado por 100.
const CAMPO = [
  ['lcp', 'LARGEST_CONTENTFUL_PAINT_MS', 'LCP', (v) => `${Math.round(v)} ms`, 1],
  ['inp', 'INTERACTION_TO_NEXT_PAINT', 'INP', (v) => `${Math.round(v)} ms`, 1],
  ['cls', 'CUMULATIVE_LAYOUT_SHIFT_SCORE', 'CLS', (v) => v.toFixed(2), 100],
];
// Preview local: localhost, 0.0.0.0 e endereços de rede local (vite preview --host).
const ehLocal = (url) => /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)[:/]/.test(url);
const mediana = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const kib = (b) => `${Math.round(b / 1024)} KiB`;

// Os três itens que mais pesam numa auditoria, em texto curto (endereço, seletor ou rótulo, com a economia).
const itensDe = (a) => {
  const d = a.details;
  if (!d) return [];
  if (d.type === 'checklist' && d.items) return Object.values(d.items).filter((i) => i.value === false).map((i) => i.label).slice(0, 3);
  if (d.type === 'network-tree') {
    // Cadeia de dependências (network-dependency-tree-insight): a duração da cadeia mais longa e os seus pedidos, na ordem.
    const urls = [];
    const percorrer = (nos) => { for (const n of Object.values(nos || {})) if (n && n.isLongest) { urls.push(String(n.url || '').slice(0, 120)); percorrer(n.children); } };
    percorrer(d.chains);
    const duracao = d.longestChain?.duration;
    return [`cadeia mais longa: ${Number.isFinite(duracao) ? `${Math.round(duracao)} ms` : 'duração não informada'}`, ...urls.slice(0, 3)];
  }
  const tabelas = d.type === 'list' ? (d.items || []).filter((i) => Array.isArray(i.items)) : [d];
  const itens = tabelas.flatMap((t) => t.items || []).filter((i) => i && typeof i === 'object');
  return itens.slice(0, 3).map((i) => {
    // Posição no código (reflows forçados etc.): linha a partir de 1 e coluna a partir de 0, como o PageSpeed mostra e como localizar-reflow.mjs espera.
    const posicao = i.source?.type === 'source-location' && Number.isFinite(i.source.line) ? `${i.source.url}:${i.source.line + 1}:${i.source.column ?? 0}` : null;
    const nome = i.url || i.node?.selector || i.node?.nodeLabel || posicao || i.source?.url || i.entity?.text || i.entity || i.label || i.groupLabel || '';
    const peso = i.wastedBytes ? `, ~${kib(i.wastedBytes)} a economizar` : i.wastedMs ? `, ~${Math.round(i.wastedMs)} ms` : i.totalBytes ? `, ${kib(i.totalBytes)}` : '';
    return `${String(nome).slice(0, 120)}${peso}`;
  }).filter((t) => t.trim());
};

// Elemento de LCP e as fases dele (Lighthouse 13: lcp-breakdown-insight; versões anteriores: largest-contentful-paint-element).
const lcpDe = (lh) => {
  const a = lh.audits['lcp-breakdown-insight'] || lh.audits['largest-contentful-paint-element'];
  const blocos = a?.details?.type === 'list' ? a.details.items : a?.details ? [a.details] : [];
  let elemento = null;
  const fases = [];
  for (const b of blocos) {
    if (b.type === 'node') elemento = b;
    for (const i of b.items || []) {
      if (i.node?.type === 'node' || i.node?.selector) elemento ||= i.node;
      const ms = i.duration ?? i.timing;
      if (typeof ms === 'number' && (i.label || i.phase)) fases.push(`${i.label || i.phase} ${Math.round(ms)} ms`);
    }
  }
  if (!elemento && !fases.length) return null;
  const nome = elemento ? `\`${elemento.selector || elemento.snippet || ''}\`${elemento.nodeLabel ? ` (“${String(elemento.nodeLabel).slice(0, 60)}”)` : ''}` : '—';
  return `${nome}${fases.length ? `; fases: ${fases.join(', ')}` : ''}`;
};

const arquivos = fs.readdirSync(args.pasta).filter((f) => f.endsWith('.json'));
const grupos = {};
const campo = {}; // dados de campo do PageSpeed, por grupo
const comErro = {}; // execuções em que a página não carregou (servidor fora do ar, erro de rede): ficam fora das medianas
const ilegiveis = []; // lh-*.json ou pagespeed-*.json que não são um relatório válido (arquivo truncado, erro da API)
for (const f of arquivos) {
  const relatorio = /^(lh|pagespeed)-/.test(f);
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(args.pasta, f), 'utf8')); } catch { if (relatorio) ilegiveis.push(`${f}: JSON inválido ou truncado`); continue; }
  const lh = j.lighthouseResult || j;
  if (!lh.categories || !lh.audits) { if (relatorio) ilegiveis.push(`${f}: ${j.error?.message || lh.runtimeError?.message || 'sem categorias nem auditorias'}`); continue; }
  // Nos arquivos do Lighthouse local, a execução é o número no fim do nome; nos do PageSpeed, é o sufixo -exec<n>,
  // porque ali um número solto no fim faz parte do rótulo da página (servico-1, servico-2) e não pode juntar páginas
  // diferentes num grupo.
  const nome = f.replace(/\.json$/, '');
  const grupo = f.startsWith('lh-') ? nome.replace(/-\d+$/, '') : nome.replace(/-exec\d+$/, '');
  grupos[grupo] ||= [];
  if (j.loadingExperience?.metrics && Object.keys(j.loadingExperience.metrics).length) campo[grupo] = j.loadingExperience;
  if (lh.runtimeError) (comErro[grupo] ||= []).push(`${f}: ${lh.runtimeError.code}`);
  else grupos[grupo].push(lh);
}
if (!Object.keys(grupos).length) {
  console.error(`Nenhum relatório do Lighthouse ou do PageSpeed encontrado em ${args.pasta}.${ilegiveis.length ? ` Arquivos inválidos: ${ilegiveis.join('; ')}` : ''}`);
  process.exit(1);
}

let falhouLimite = false;
// Um limite que se aplica mas não tem número (execução com erro, auditoria ausente) conta como falha: não foi conferido.
const marca = (chave, grupo, valor) => {
  const l = limiteDe(chave, grupo);
  if (!l) return '';
  l.usado = true;
  const ok = valor != null && (MINIMOS.includes(chave) ? valor >= l.valor : valor <= l.valor);
  if (!ok) falhouLimite = true;
  return ok ? ' · ok' : valor == null ? ` · FALHA (sem medida; limite ${l.valor})` : ` · FALHA (limite ${l.valor})`;
};

const L = [`# Resumo do Lighthouse — ${args.pasta}`, ''];
for (const [grupo, execs] of Object.entries(grupos).sort()) {
  if (!execs.length) {
    L.push(`## ${grupo} (nenhuma execução válida)`, '', ...comErro[grupo].map((e) => `- Erro: ${e}`), '');
    for (const chave of CHAVES) marca(chave, grupo, null);
    falhouLimite = true;
    continue;
  }
  const url = execs[0].finalDisplayedUrl || execs[0].finalUrl || execs[0].requestedUrl || '';
  const local = ehLocal(url);
  L.push(`## ${grupo} (${execs.length} ${execs.length > 1 ? 'execuções' : 'execução'}${url ? ` · ${url}` : ''})`, '');
  if (comErro[grupo]) L.push(`> ${comErro[grupo].length} execução(ões) com erro, fora da mediana: ${comErro[grupo].join('; ')}`, '');
  L.push('| Item | Mediana |', '| --- | --- |');
  const categorias = [...new Set(execs.flatMap((e) => Object.keys(e.categories)))];
  for (const c of categorias) {
    const nota = mediana(execs.map((e) => (e.categories[c]?.score ?? NaN) * 100));
    const chave = c === 'performance' ? 'nota' : c;
    L.push(`| Nota de ${c} | ${nota == null ? '—' : Math.round(nota)}${marca(chave, grupo, nota)} |`);
  }
  if (categorias.includes('performance')) {
    for (const [chave, id, nome, fmt] of METRICAS) {
      const v = mediana(execs.map((e) => e.audits[id]?.numericValue));
      L.push(`| ${nome} | ${v == null ? '—' : fmt(v)}${marca(chave, grupo, v)} |`);
    }
    // Bytes transferidos por tipo (auditoria resource-summary), para conferir o orçamento.
    const tipo = (e, t) => (e.audits['resource-summary']?.details?.items || []).find((i) => i.resourceType === t);
    const bytes = (t) => mediana(execs.map((e) => tipo(e, t)?.transferSize));
    const js = bytes('script');
    L.push(`| JavaScript transferido | ${js == null ? '—' : kib(js)}${marca('js', grupo, js == null ? null : js / 1024)} |`);
    const nFontes = mediana(execs.map((e) => tipo(e, 'font')?.requestCount));
    L.push(`| Arquivos de fonte | ${nFontes == null ? '—' : `${nFontes} (${kib(bytes('font') || 0)})`}${marca('fontes', grupo, nFontes)} |`);
    for (const [t, nome] of [['stylesheet', 'CSS em arquivo'], ['image', 'Imagens'], ['total', 'Total transferido']]) {
      const v = bytes(t);
      if (v != null) L.push(`| ${nome} | ${kib(v)} |`);
    }
    // O elemento de LCP vem da execução com o LCP mais próximo da mediana.
    const lcpMed = mediana(execs.map((e) => e.audits['largest-contentful-paint']?.numericValue));
    const tipica = [...execs].sort((a, b) => Math.abs((a.audits['largest-contentful-paint']?.numericValue ?? 0) - lcpMed) - Math.abs((b.audits['largest-contentful-paint']?.numericValue ?? 0) - lcpMed))[0];
    const lcp = tipica && lcpDe(tipica);
    if (lcp) L.push('', `Elemento de LCP: ${lcp}.`);
    // A desaceleração de CPU só representa o celular de referência numa máquina da faixa esperada (docs/throttling.md do Lighthouse).
    const indice = mediana(execs.map((e) => e.environment?.benchmarkIndex));
    const fator = mediana(execs.map((e) => e.configSettings?.throttling?.cpuSlowdownMultiplier));
    if (grupo.startsWith('lh-') && indice != null && fator > 1) {
      // Um fator diferente do 4× padrão veio de --cpu, já calibrado para esta máquina: o aviso não se aplica.
      const fora = fator !== 4 ? '' : indice > 2000 ? 'acima da faixa de 1500 a 2000, em que o fator 4× simula um celular intermediário: com este fator, o celular simulado é mais rápido que o de referência, e TBT e INP saem otimistas' : indice < 1500 ? 'abaixo da faixa de 1500 a 2000, em que o fator 4× simula um celular intermediário: com este fator, o celular simulado é mais lento que o de referência' : '';
      L.push('', `Máquina: benchmarkIndex ${Math.round(indice)}, CPU ${fator}× mais lenta${fator !== 4 ? ' (fator passado com --cpu)' : ''}.${fora ? ` **Aviso:** índice ${fora}. Calcule o fator em https://lighthouse-cpu-throttling-calculator.vercel.app/ e passe-o com --cpu a medir-lighthouse.mjs e a medir-interacoes.mjs.` : ''}`);
    }
  }
  L.push('');

  // Dados de campo (API do PageSpeed): quando existem, valem mais que os de laboratório.
  const c = campo[grupo];
  if (c) {
    L.push(`### Dados de campo (visitantes reais, percentil 75${c.origin_fallback ? '; **do site inteiro**, porque a página não tem visitas suficientes' : ''})`, '', '| Métrica | Valor |', '| --- | --- |');
    for (const [chave, id, nome, fmt, escala] of CAMPO) {
      const p = c.metrics[id]?.percentile;
      if (p == null) continue;
      const v = p / escala;
      L.push(`| ${nome} | ${fmt(v)}${marca(chave, grupo, v)} |`);
    }
    L.push('');
  }

  // Auditorias que falharam na maioria das execuções.
  const contagem = {};
  for (const e of execs) {
    for (const [id, a] of Object.entries(e.audits)) {
      if (a.score == null || a.score >= 0.9 || ['notApplicable', 'informative', 'manual'].includes(a.scoreDisplayMode)) continue;
      (contagem[id] ||= []).push(a);
    }
  }
  const falhas = Object.entries(contagem).filter(([, as]) => as.length > execs.length / 2);
  if (falhas.length) {
    L.push('### Auditorias que falharam', '');
    for (const [id, as] of falhas.sort((a, b) => a[1][0].score - b[1][0].score)) {
      const a = as[0];
      const ms = mediana(as.map((x) => x.details?.overallSavingsMs ?? x.metricSavings?.LCP ?? NaN));
      const bytesEco = mediana(as.map((x) => x.details?.overallSavingsBytes ?? x.details?.debugData?.wastedBytes ?? NaN));
      const economia = [ms ? `~${Math.round(ms)} ms` : '', bytesEco ? `~${kib(bytesEco)}` : ''].filter(Boolean).join(', ');
      const aviso = !local ? '' : SO_NO_SERVIDOR.includes(id) ? ' · *o preview local não manda cabeçalhos de cache: confira no servidor real*'
        : COMPRESSAO.includes(id) && semCompressao(id, a) ? ' · *o vite preview comprime com gzip, então a falta de compressão é real; só num servidor local que não comprime ela fica para o servidor real*' : '';
      L.push(`- **${a.title}** (\`${id}\`, nota ${Math.round(a.score * 100)})${a.displayValue ? `: ${a.displayValue}` : ''}${economia ? ` · economia estimada ${economia}` : ''}${aviso}`);
      for (const item of itensDe(a)) L.push(`  - ${item}`);
    }
    L.push('');
  } else {
    L.push('Nenhuma auditoria falhou na maioria das execuções.', '');
  }
}
if (ilegiveis.length) {
  L.push('## Relatórios inválidos', '', ...ilegiveis.map((e) => `- ${e}`), '');
  falhouLimite = true;
}
for (const l of limites.filter((x) => !x.usado)) L.push(`> Aviso: o limite ${l.chave}${l.filtro ? `-${l.filtro}` : ''}=${l.valor} não se aplicou a nenhum grupo desta pasta.`, '');
if (limites.length || falhouLimite) L.push(falhouLimite ? '**Resultado: há limites que falharam ou medições que não se completaram.**' : '**Resultado: todos os limites passaram.**', '');

const texto = L.join('\n');
fs.writeFileSync(path.join(args.pasta, 'resumo.md'), texto);
console.log(texto);
process.exit(falhouLimite ? 1 : 0);
