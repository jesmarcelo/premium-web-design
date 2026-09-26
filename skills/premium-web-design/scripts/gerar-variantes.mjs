#!/usr/bin/env node
// Cria versões WebP de cada imagem em várias larguras, prontas para o srcset.
//
// Execute na raiz do projeto; o `sharp` é procurado em .tmp/ e, se não estiver lá, no projeto:
//   node <skill>/scripts/gerar-variantes.mjs --in imagens-originais --out public/images
//   opções: --larguras-json .tmp/larguras.json  --larguras 480,768,1024,1280,1920
//           --max 2400  --qualidade 76  --prefixo /images  --avif  --paralelo 4
//   --avif gera também versões AVIF (menores que as WebP), para usar num <picture> com <source type="image/avif">.
//   --paralelo define quantas imagens são processadas ao mesmo tempo (padrão: até 4, conforme os núcleos).
//
// Dê preferência a --larguras-json, gerado por dimensionar-imagens.mjs: as larguras saem sob medida
// para cada imagem, incluindo as telas do PageSpeed. Uma lista fixa sempre desperdiça bytes em alguma tela.
//
// Para cada <nome>.(png|jpg|jpeg|webp), cria <nome>.webp (limitado a --max px) e
// <nome>-<largura>.webp apenas para larguras menores que a da imagem original. Ao final,
// imprime o srcset de cada uma, com width e height; o `sizes` correspondente vem de dimensionar-imagens.mjs.
// Cada original é decodificado uma vez só, e arquivos já gerados e mais novos que o original são pulados;
// para refazer tudo, apague a pasta de saída.

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Dependências de apoio ficam em .tmp/ do projeto; se não estiverem lá, usa as do próprio projeto.
const exigir = (nome) => {
  for (const base of [path.join(process.cwd(), '.tmp'), process.cwd()]) {
    try { return createRequire(path.join(base, 'noop.js'))(nome); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  console.error(`Dependência "${nome}" não encontrada em .tmp/ nem no projeto. Rode o script a partir da raiz do projeto e veja a preparação em references/capturas-e-medicao.md.`);
  process.exit(1);
};
const sharp = exigir('sharp');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);
if (!args.in || !args.out) {
  console.error('uso: --in <pasta de originais> --out <pasta pública> [--larguras 480,768,...] [--max 2400] [--qualidade 76] [--prefixo /images] [--avif] [--paralelo n]');
  process.exit(1);
}
const LARGURAS = String(args.larguras || '480,768,1024,1280,1920').split(',').map(Number);
const POR_IMAGEM = args['larguras-json'] ? JSON.parse(fs.readFileSync(args['larguras-json'], 'utf8')) : {};
const MAX = +(args.max || 2400);
const WEBP = { quality: +(args.qualidade || 76), effort: 6, smartSubsample: true };
const PREFIXO = String(args.prefixo || '/images').replace(/\/$/, '');
const AVIF = !!args.avif;
const PARALELO = Math.max(1, +(args.paralelo || Math.min(4, os.cpus().length)));

fs.mkdirSync(args.out, { recursive: true });
const arquivos = fs.readdirSync(args.in).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!arquivos.length) {
  console.error(`Nenhuma imagem em ${args.in}.`);
  process.exit(1);
}

// Cada imagem é decodificada uma única vez (já reduzida a --max) e as larguras saem desse buffer.
// Arquivos já gerados e mais novos que o original são pulados. Várias imagens são processadas ao mesmo tempo.
const atual = (saida, src) => fs.existsSync(saida) && fs.statSync(saida).mtimeMs >= fs.statSync(src).mtimeMs;
const FORMATOS = [['webp', (p) => p.webp(WEBP)], ...(AVIF ? [['avif', (p) => p.avif({ quality: Math.max(30, WEBP.quality - 26), effort: 4 })]] : [])];

async function processar(f) {
  const nome = path.parse(f).name;
  const src = path.join(args.in, f);
  const principal = path.join(args.out, `${nome}.webp`);
  let base = null;
  const decodificar = async () => (base ||= await sharp(src).rotate().resize({ width: MAX, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true }));
  const deBase = async () => { const { data, info } = await decodificar(); return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }); };

  const meta = atual(principal, src) ? await sharp(principal).metadata() : (await decodificar()).info;
  const larguraFinal = meta.width, alturaFinal = meta.height;
  const menores = (POR_IMAGEM[nome] || LARGURAS).filter((w) => w > 0 && w < larguraFinal * 0.97);
  let gerados = 0, pulados = 0;
  for (const [ext, codificar] of FORMATOS) {
    const alvos = [[path.join(args.out, `${nome}.${ext}`), null], ...menores.map((w) => [path.join(args.out, `${nome}-${w}.${ext}`), w])];
    for (const [saida, w] of alvos) {
      if (atual(saida, src)) { pulados++; continue; }
      let p = await deBase();
      if (w) p = p.resize({ width: w });
      await codificar(p).toFile(saida);
      gerados++;
    }
  }
  const linhas = [`✓ ${nome}: ${larguraFinal}×${alturaFinal} · ${gerados} arquivo(s) gerado(s), ${pulados} já atualizado(s)`];
  for (const [ext] of FORMATOS) {
    const srcset = [...menores.map((w) => `${PREFIXO}/${nome}-${w}.${ext} ${w}w`), `${PREFIXO}/${nome}.${ext} ${larguraFinal}w`].join(', ');
    linhas.push(`  ${ext}: srcset="${srcset}"`);
  }
  linhas.push(`  width="${larguraFinal}" height="${alturaFinal}" (reservam o espaço da imagem e evitam deslocamento de layout)`);
  return linhas.join('\n');
}

const saidas = new Array(arquivos.length);
let proxima = 0;
await Promise.all(Array.from({ length: Math.min(PARALELO, arquivos.length) }, async () => {
  while (proxima < arquivos.length) { const i = proxima++; saidas[i] = await processar(arquivos[i]); }
}));
console.log(saidas.join('\n'));
