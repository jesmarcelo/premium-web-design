import { defineConfig } from 'vite';
import { minify } from 'html-minifier-terser';
import { gzipSync } from 'zlib';
import path from 'path';

// Modelo de vite.config.js do pacote de performance da skill premium-web-design.
// Salve na raiz do projeto e instale a dependência: npm i -D html-minifier-terser
//
// PERSONALIZE: liste as fontes usadas na primeira tela (duas ou três, no máximo). Elas são
// pré-carregadas para não esperar a leitura do CSS. Os nomes abaixo são apenas exemplos
// (no formato gerado pelo @fontsource); substitua pelos arquivos de fonte do seu projeto.
const FONTES_PRIMEIRA_TELA = [/fonte-titulos-latin-400-normal-.*\.woff2$/, /fonte-texto-latin-400-normal-.*\.woff2$/];

// Soma dos CSS de uma página (comprimidos) acima da qual eles continuam como arquivos externos: dentro
// do HTML, eles atrasariam a primeira pintura e deixariam de ser reaproveitados pelo cache entre páginas.
const LIMITE_CSS_INLINE_KB = 10;
// HTML final (comprimido) acima disto não cabe na primeira ida e volta da conexão; o plugin só avisa.
const AVISO_HTML_KB = 14;

/**
 * O que este plugin faz no build de produção, em todas as páginas HTML:
 * 1) coloca dentro do <head> os CSS de cada página, se a soma deles couber no limite acima, para que nenhum
 *    arquivo externo trave a renderização (a sequência HTML → CSS → fonte passa a ser HTML → fonte). Um CSS usado
 *    por várias páginas também entra em cada uma, de propósito: custa até o limite a cada navegação, mas poupa, na
 *    primeira visita (a que o PageSpeed mede), um arquivo que trava a renderização;
 * 2) adiciona <link rel="preload"> para as fontes da primeira tela, logo depois do <meta charset>;
 * 3) minifica o HTML (CSS e JS o Vite já entrega minificados).
 * Respeita o `base` configurado no Vite, inclusive o relativo (`./`) em páginas dentro de subpastas.
 */
function performanceNoBuild() {
  let base = '/';
  return {
    name: 'performance-no-build',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      base = config.base || '/';
    },
    async generateBundle(_, bundle) {
      const paginas = Object.keys(bundle).filter((n) => n.endsWith('.html'));
      const estilos = Object.keys(bundle).filter((n) => n.endsWith('.css'));
      const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const kbComprimido = (t) => gzipSync(String(t)).length / 1024;
      const relativo = !/^(\/|[a-z]+:)/i.test(base);
      // Endereço de um arquivo do build visto a partir de uma página: com `base` relativo, depende da subpasta da página.
      const enderecoDe = (arquivo, pagina) => {
        if (!relativo) return `${base}${arquivo}`;
        const r = path.posix.relative(path.posix.dirname(pagina), arquivo);
        return r.startsWith('.') ? r : `./${r}`;
      };
      // Os url() relativos de um CSS partem da pasta dele; dentro do HTML, passam a partir da pasta da página.
      // Vale para url() e para os endereços entre aspas de image-set(), que o Vite deixa sem url().
      const ajustar = (url, arquivoCss, pagina) => {
        if (/^(data:|[a-z]+:|\/|#)/i.test(url)) return url;
        return enderecoDe(path.posix.normalize(path.posix.join(path.posix.dirname(arquivoCss), url)), pagina);
      };
      const reescreverUrls = (css, arquivoCss, pagina) => css
        .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, aspas, url) => `url(${aspas}${ajustar(url, arquivoCss, pagina)}${aspas})`)
        .replace(/((?:-webkit-)?image-set\()([^;{}]*?\))/g, (m, abre, resto) => abre + resto.replace(/(^|[\s,(])(['"])([^'"]+)\2/g, (mm, antes, aspas, url) => `${antes}${aspas}${ajustar(url, arquivoCss, pagina)}${aspas}`));

      const fontes = Object.keys(bundle).filter((n) => FONTES_PRIMEIRA_TELA.some((re) => re.test(n)));
      const usados = new Set();

      for (const pagina of paginas) {
        const html = bundle[pagina];
        let src = String(html.source);

        // Os CSS desta página entram juntos ou ficam todos de fora: o limite vale para a soma deles.
        const tagDe = (nome) => new RegExp(`<link\\b[^>]*href="[^"]*${escapar(nome)}"[^>]*>`, 'g');
        const daPagina = estilos.filter((nome) => (src.match(tagDe(nome)) || []).some((tag) => /rel="stylesheet"/.test(tag)));
        const kb = daPagina.reduce((s, nome) => s + kbComprimido(bundle[nome].source), 0);
        if (daPagina.length && kb <= LIMITE_CSS_INLINE_KB) {
          for (const nome of daPagina) {
            src = src.replace(tagDe(nome), (tag) => {
              if (!/rel="stylesheet"/.test(tag)) return tag;
              usados.add(nome);
              return `<style>${reescreverUrls(String(bundle[nome].source), nome, pagina)}</style>`;
            });
          }
        } else if (daPagina.length) {
          this.warn(`${pagina}: os CSS da página somam ${kb.toFixed(1)} kB comprimidos (acima de ${LIMITE_CSS_INLINE_KB} kB) e continuam como arquivos externos.`);
        }

        if (fontes.length) {
          const preloads = fontes.map((n) => `<link rel="preload" as="font" type="font/woff2" href="${enderecoDe(n, pagina)}" crossorigin>`).join('');
          // Logo depois do <meta charset>, ou no início do <head> se ele não existir.
          if (/<meta charset[^>]*>/i.test(src)) src = src.replace(/<meta charset[^>]*>/i, (m) => m + preloads);
          else src = src.replace(/<head[^>]*>/i, (m) => m + preloads);
        }

        html.source = await minify(src, {
          collapseWhitespace: true,
          conservativeCollapse: true,
          removeComments: true,
          minifyJS: true,
          sortAttributes: true,
        });
        const kbHtml = kbComprimido(html.source);
        if (kbHtml > AVISO_HTML_KB) this.warn(`${pagina} tem ${kbHtml.toFixed(1)} kB comprimidos (acima de ${AVISO_HTML_KB} kB): a primeira tela pode precisar de mais de uma ida e volta da conexão.`);
      }

      // O arquivo CSS só sai do build se foi colocado dentro de todas as páginas que o usavam e se não pertence a um chunk
      // que o JS carrega sozinho (um import() dinâmico pré-carrega o CSS do chunk pelo nome, e o arquivo apagado faria o
      // import falhar). Nessa hora o Vite ainda não escreveu esses nomes no JS; por isso vale o que ele registra em cada chunk.
      const cssDeChunks = new Set(Object.values(bundle).filter((c) => c.type === 'chunk' && !c.isEntry).flatMap((c) => [...(c.viteMetadata?.importedCss || [])]));
      for (const nome of usados) {
        const aindaReferenciado = paginas.some((p) => String(bundle[p].source).includes(nome)) || cssDeChunks.has(nome);
        if (!aindaReferenciado) delete bundle[nome];
      }
    },
  };
}

export default defineConfig({
  // Sem o fallback para o index.html, o preview e o servidor de desenvolvimento respondem 404 a caminhos inexistentes,
  // e um link interno quebrado aparece antes de publicar. Vale também para site de uma página só: sem esta linha, a
  // 404.html e um /robots.txt inexistente respondem 200 no preview (references/seo.md, item 12).
  appType: 'mpa',
  build: {
    rollupOptions: {
      // PERSONALIZE: liste todas as páginas do site (o Vite gera pasta/index.html para cada uma) e a 404.html.
      // Sem a 404.html nesta lista, o build não a gera, e o ErrorDocument do .htaccess aponta para um arquivo inexistente.
      input: { index: 'index.html', '404': '404.html' },
    },
  },
  plugins: [performanceNoBuild()],
});
