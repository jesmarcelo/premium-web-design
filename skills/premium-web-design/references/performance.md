# Performance — pacote opcional de velocidade e entrega

Vale apenas quando a pessoa escolheu o pacote de performance na conversa inicial. Durante o trabalho, as metas são medidas com o Lighthouse local sobre o build de produção (nunca sobre o servidor de desenvolvimento), no celular e no desktop, e dão um veredito provisório; a conferência definitiva é a do build publicado no servidor real, com o PageSpeed Insights. Otimização alguma pode prejudicar o alvo visual nem o sistema de design: na ordem de prioridade, as metas vêm por último. As metas do projeto ficam em `metas-de-performance.md`, que é o documento usado pelo avaliador de performance.

Os comandos e modelos partem de um projeto Vite (build em `dist/`, preview em `http://localhost:4173/`, arquivos com hash em `/assets/`). Em outra stack, use os equivalentes dela (comando de build, servidor local do build de produção, pasta dos arquivos com hash) e registre-os na `passagem.md`.

## O que vai em `metas-de-performance.md`

Metas numéricas, com o perfil e a ferramenta de cada uma, e as condições de medição. Valores padrão, que a pessoa pode ajustar:

| Meta | Padrão | Onde se mede |
| --- | --- | --- |
| PF1. Nota de performance | celular ≥ 90; desktop ≥ 95 | Lighthouse local (mediana de 3 execuções) e PageSpeed |
| PF2. LCP (maior elemento da primeira tela) | ≤ 2,5 s | Lighthouse e PageSpeed |
| PF3. CLS (deslocamento de layout) | ≤ 0,1 | PageSpeed (ou, antes da publicação, Lighthouse) e `medir-interacoes.mjs`; precisa passar nos dois, porque o segundo também mede a rolagem |
| PF4. INP (resposta às interações) | ≤ 200 ms na pior interação medida | `medir-interacoes.mjs` (em laboratório) e dados de campo do PageSpeed; quando os dados de campo existirem, valem eles |
| PF5. TBT (tempo de bloqueio) | ≤ 200 ms | Lighthouse (aproximação do INP no carregamento) |

Os limites de LCP, CLS e INP são os das Core Web Vitals do Google (percentil 75 dos visitantes reais). Um site novo não tem dados de campo no PageSpeed, por isso o INP é medido em laboratório, com as interações reais do site.

O checklist abaixo orienta o construtor; o avaliador julga só as metas numeradas. Para que um item do checklist seja cobrado (por exemplo, cache e compressão no servidor real), inclua-o como meta própria, de PF6 em diante, dizendo como ele é conferido.

## Orçamento desde a base

Algumas escolhas de design não se desfazem na fase de performance: uma biblioteca 3D, seis pesos de fonte. Por isso, com o pacote escolhido, o construtor confere a cada entrega das fases de base e de blocos um orçamento, com uma execução de `medir-lighthouse.mjs` no celular, sobre o build de produção (`--perfis celular --limites js=100,fontes=3`, gravando em `medicoes/orcamento/` da rodada):

- JavaScript transferido no carregamento: até cerca de 100 KiB comprimidos (o que fica abaixo da primeira tela é carregado sob demanda, item 11);
- arquivos de fonte no carregamento: até 3 (item 13).

Imagens e vídeos ficam fora do orçamento porque se otimizam depois sem mudar o design (larguras sob medida, compressão, `poster`; itens 3, 4 e 12). O orçamento não é meta, e o avaliador não o julga. Estourá-lo leva a escolha à pessoa antes de a base ser travada ou de o bloco ser aprovado, e a decisão (inclusive valores diferentes) fica em `acordos.md`.

## Modelos e scripts disponíveis

- [`assets/performance/htaccess`](../assets/performance/htaccess): regras de cache e compressão para Apache, mais a seção de endereço único (redirecionamento 301 para uma versão só, `index.html` para a pasta e página 404), que o pacote de SEO usa. Copie para `public/.htaccess` e troque o domínio de exemplo.
- [`assets/performance/vite.config.js`](../assets/performance/vite.config.js): plugin do Vite que, em todas as páginas HTML do build, coloca dentro do `<head>` os CSS de cada página (só se a soma deles tiver até 10 kB comprimidos; acima disso, mantém os arquivos externos e avisa), pré-carrega as fontes da primeira tela logo depois do `<meta charset>`, minifica o HTML e avisa quando uma página passa de 14 kB comprimidos. Um CSS usado por várias páginas também entra no HTML de cada uma: isso custa até 10 kB por navegação, mas poupa, na primeira visita (a que o PageSpeed mede), um arquivo que trava a renderização. Respeita o `base` do Vite, inclusive o relativo (`./`) em páginas dentro de subpastas. Troque a lista de fontes pelas do projeto; em sites de várias páginas, mantenha o seu `build.rollupOptions.input`.
- [`scripts/dimensionar-imagens.mjs`](../scripts/dimensionar-imagens.mjs): calcula quanto espaço cada imagem ocupa nas telas do PageSpeed e de aparelhos populares (inclusive um notebook de densidade 2, que o PageSpeed não mede, mas que é o público comum de um site premium), verifica o atributo `sizes` (inclusive a falta dele, que faz o navegador usar 100vw) e salva as larguras ideais.
- [`scripts/gerar-variantes.mjs`](../scripts/gerar-variantes.mjs): cria as versões WebP em cada largura e mostra o `srcset` pronto de cada imagem.
- [`scripts/medir-lighthouse.mjs`](../scripts/medir-lighthouse.mjs): roda o Lighthouse em todas as páginas e perfis, uma execução de cada vez num único Chrome (pela API, sem relançar o navegador a cada execução), e gera o resumo.
- [`scripts/resumir-lighthouse.mjs`](../scripts/resumir-lighthouse.mjs): junta as execuções de uma rodada (e os relatórios do PageSpeed) num resumo curto, com medianas, bytes transferidos, o elemento de LCP, as auditorias que falharam com os itens que mais pesam, os dados de campo do PageSpeed (quando existem), o `benchmarkIndex` da máquina e a checagem dos limites.
- [`scripts/medir-interacoes.mjs`](../scripts/medir-interacoes.mjs): mede INP e CLS em laboratório, executando as interações do arquivo de estados (cliques, teclado) e a rolagem da página.
- [`scripts/localizar-reflow.mjs`](../scripts/localizar-reflow.mjs): converte as posições do JS minificado apontadas pelo PageSpeed no arquivo e na linha correspondentes do código-fonte.

## Checklist

1. **Cache de acordo com o nome do arquivo.** O que o build gera com hash no nome (no Vite, a pasta `/assets/`) fica um ano em cache, com `immutable`: cada versão nova tem nome novo e nunca reaproveita o cache da anterior. O que vem de `public/` (inclusive as variantes de imagem de `gerar-variantes.mjs`) **não** tem hash: fica um dia em cache e depois é revalidado, para que uma imagem trocada com o mesmo nome apareça em até 24 horas. O HTML é sempre revalidado. A revalidação usa a data de modificação, e não o ETag, que o Apache altera ao comprimir (`-gzip`, `-br`) e muitas versões deixam de reconhecer, devolvendo o arquivo inteiro em vez de “não mudou”. No Apache, tudo isso está no modelo de `.htaccess` (coloque em `public/`; o Vite copia para `dist/`).
2. **CSS que não trava a renderização.** Com CSS enxuto (até cerca de 10 kB comprimidos, somando os de cada página), coloque todo o CSS dentro do `<head>` no momento do build, com o plugin do modelo. Acima desse tamanho, o arquivo externo com cache longo costuma ser melhor, e o plugin já faz essa escolha sozinho, página a página. Evite o recurso `media="print" onload`: com ele, a página aparece por um momento sem nenhum estilo, o que não combina com um site premium.
3. **Imagens responsivas com larguras sob medida.** Uma lista fixa de larguras (480, 768, 1024…) sempre desperdiça bytes em algum aparelho. Exemplo: no celular do PageSpeed (412 px com densidade 1,75), uma imagem precisava de 571 px, mas o navegador baixou a versão de 768, e o relatório acusou 13 KiB de sobra.
   - Rode, a partir da raiz do projeto, `node <skill>/scripts/dimensionar-imagens.mjs --url http://localhost:4173/ --json .tmp/larguras.json`, que calcula cada imagem exatamente nas telas do PageSpeed (celular com 412×823 e densidade 1,75; desktop com 1350×940 e densidade 1) e em aparelhos populares, verifica o `sizes` e define as larguras dos arquivos.
   - Resolva todos os avisos de `sizes` impreciso antes de gerar as imagens, porque o navegador escolhe o arquivo pelo `sizes`, e não pelo tamanho exibido.
   - Gere os arquivos com `node <skill>/scripts/gerar-variantes.mjs --in imagens-originais --out public/images --larguras-json .tmp/larguras.json` (ou com o script de imagens do próprio projeto, lendo o mesmo JSON).
   - Fotos com `object-fit: cover` que ocupam a tela inteira precisam de largura proporcional ao formato: se a foto for 3:2, o valor fica `sizes="(max-aspect-ratio: 3/2) 150vh, 100vw"`.
   - Acrescente a ampliação do parallax ou do zoom (um `scale(1.18)` significa 118% da largura).
   - A imagem da primeira tela que já está no HTML (`<img>` ou `<picture>`) **não** leva `<link rel="preload">`: o navegador a encontra sozinho, e o `fetchpriority="high"` (item 6) já lhe dá prioridade. Num `<picture>` com AVIF, um preload feito com o `srcset` do `<img>` baixa o WebP enquanto a página usa o AVIF, e a imagem desce duas vezes, porque o preload não passa pela escolha do `<source>`. O preload só serve para a imagem que o HTML não revela (fundo em CSS, imagem inserida por JavaScript), com `imagesrcset` e `imagesizes` iguais aos da imagem e, se ela for AVIF, `type="image/avif"`.
   - Em imagens com `loading="lazy"`, `sizes="auto"` deixa o navegador calcular a largura pelo layout real (já suportado no Chromium; mantenha um valor de reserva, como `sizes="auto, 100vw"`).
   - Imagens que aparecem só em alguns tamanhos de tela são ignoradas pelo `dimensionar-imagens.mjs` onde não aparecem; imagens de fundo feitas em CSS não são medidas e precisam de `image-set()` e media queries próprias.
4. **Compressão das imagens.** Use WebP com qualidade em torno de 76 e `effort: 6`; quando a qualidade passa de 80, é comum o PageSpeed indicar que ainda há o que economizar. Na imagem da primeira tela, considere também AVIF num `<picture>` (`gerar-variantes.mjs --avif`), que costuma ser menor, sem preload (item 3).
5. **Nada de reflow forçado.** Não leia medidas de layout (`getBoundingClientRect`, `offsetWidth`, `offsetTop`) logo após alterar estilos ou o DOM.
   - Leituras repetidas a cada quadro acontecem no **começo do quadro**, antes que Lenis e ScrollTrigger façam suas alterações (`gsap.ticker.add(fn, false, true)`), e apenas enquanto o elemento aparece na tela (`IntersectionObserver`).
   - Efeitos que seguem o mouse medem o elemento quando o cursor entra e depois de cada rolagem, e não a cada movimento.
   - Ao dividir textos em linhas, agrupe o trabalho: primeiro todas as alterações, depois uma única leitura, e por fim as alterações finais.
   - Não chame `ScrollTrigger.refresh()` no evento `load`, porque ele já faz esse recálculo sozinho. Só vale um recálculo extra se as fontes terminarem de carregar depois do `load`. Cada recálculo repetido custa um reflow completo; num caso real, eliminar dois deles reduziu o TBT de 230 para 100 ms.
   - O custo que resta dentro do ScrollTrigger ao montar as seções fixadas é o preço das camadas presas. Registre isso como limite e não sacrifique a transição para melhorar o número; o PageSpeed trata esse item como “sem efeito na pontuação”.

   O PageSpeed mostra apenas posições no JS minificado (`index-XXXX.js:1:97647`, com a linha a partir de 1 e a coluna a partir de 0, do jeito que o `resumo.md` também as lista). Use `localizar-reflow.mjs` para descobrir qual linha do projeto causou cada reflow e corrija primeiro o código do projeto.
6. **Cadeias de carregamento curtas.**
   - Com o CSS dentro do HTML, a sequência HTML → CSS → fonte passa a ser HTML → fonte.
   - Pré-carregue somente as fontes da primeira tela (`<link rel="preload" as="font" crossorigin>`), limitando-se a duas ou três.
   - Se a primeira tela depender de outra origem que não dá para evitar (vídeo numa CDN, mapa, player embutido), um único `<link rel="preconnect" href="…" crossorigin>` no `<head>` poupa a conexão antes do primeiro byte; nunca mais que dois ou três, porque cada um abre conexões que podem ficar sem uso.
   - Na imagem da primeira tela, use `fetchpriority="high"`. Use `loading="lazy"` só nas imagens que ficam fora da primeira tela em todos os perfis (celular e desktop); o Lighthouse aponta a imagem de LCP carregada com `lazy`.
7. **Texto comprimido.**
   - Reduza HTML, CSS e JS durante o build (minificação). CSS e JS o Vite já resolve; o HTML fica a cargo do `html-minifier-terser`, dentro do mesmo plugin.
   - Ligue Brotli ou Gzip no servidor (módulos `mod_brotli` e `mod_deflate`, configurados pelo `.htaccess`).

8. **Primeira tela visível sem depender de JavaScript (LCP).** O maior elemento da primeira tela (título ou imagem principal) precisa estar visível no HTML e no CSS iniciais. Se ele entra com opacidade zero e é revelado por GSAP ou outra biblioteca, o LCP passa a ser o fim da animação somado ao tempo de carregar o JavaScript. Anime só `transform` (ou parta de uma opacidade maior que zero) no elemento principal, e deixe as revelações por JavaScript para o que está abaixo da primeira tela. Se isso conflitar com o alvo visual, vale a ordem de prioridade, com o registro em `acordos.md`.
9. **Sem deslocamentos de layout (CLS).**
   - Toda imagem e todo vídeo têm `width` e `height` (ou `aspect-ratio`) para reservar o espaço antes de carregar.
   - Fontes web usam `font-display: swap` com uma fonte de reserva ajustada (`size-adjust`, `ascent-override`, `descent-override`) para que a troca não empurre o texto.
   - Conteúdo inserido depois (banners, avisos de cookies, incorporações) tem espaço reservado ou aparece por cima, sem empurrar a página.
10. **Resposta rápida às interações (INP).** Nenhum clique, toque ou tecla pode travar a tela: divida tarefas longas, adie o que não é urgente (`requestIdleCallback`, `scheduler.yield()` onde houver) e evite recalcular layout inteiro em cada interação. Meça com `medir-interacoes.mjs` usando as interações do arquivo de estados.
11. **JavaScript só quando necessário.**
    - Divida o código e carregue sob demanda o que fica abaixo da primeira tela (bibliotecas 3D, carrosséis, mapas).
    - Remova o JavaScript não usado e evite bibliotecas inteiras para funções pequenas.
    - Scripts de terceiros (análise, chat, pixels) entram com `defer`, depois da primeira interação ou quando o navegador estiver ocioso.
    - Incorporações (vídeo do YouTube ou do Vimeo, mapa, player) entram por uma fachada: uma imagem de capa leve com o botão, e o `<iframe>` só é criado no clique; fora da primeira tela, todo `<iframe>` leva `loading="lazy"`. O `<iframe>` direto carrega centenas de KiB de JavaScript que nem o `defer` nem a carga sob demanda alcançam, e que pesam no TBT e no orçamento.
12. **Vídeo.** Vídeos têm `poster`, dimensões corretas e dois arquivos comprimidos, na ordem `<source type="video/webm">` (VP9 ou AV1) e depois `<source type="video/mp4">` (H.264, para os navegadores que não tocam WebM): o Chromium que a skill instala para medir e capturar não decodifica H.264 nem AAC (licenciamento), então um vídeo só em MP4 fica parado no `poster` em todas as medições e capturas, e o LCP, o INP e o CLS saem sem o custo dele; fora da primeira tela, também `preload="none"` ou `preload="metadata"`. Na primeira tela, o vídeo que é o maior elemento é o LCP, medido pelo que aparece primeiro: o `poster` ou o primeiro quadro. Por isso o `poster` é leve, tem as dimensões do vídeo e é pré-carregado (`<link rel="preload" as="image" fetchpriority="high">`). Com `autoplay`, o navegador ignora o `preload` do vídeo e começa a baixá-lo logo.
13. **Fontes.** Hospede as fontes no próprio site, em `woff2`, só com os pesos e os caracteres usados (`unicode-range` e subconjuntos). Evite carregar fontes do Google Fonts por outro domínio, que acrescenta conexões antes do texto aparecer.
14. **Volta instantânea (bfcache).** A página não pode impedir o cache de ida e volta do navegador: nada de `unload`, e conexões abertas (WebSocket) são fechadas em `pagehide`. O PageSpeed aponta quando a página impede esse cache.
15. **Animações baratas.**
    - Anime só `transform` e `opacity`; animar medidas e posições (`width`, `top`, `margin`) ou efeitos pesados de pintura (`box-shadow`, `filter` grande) refaz o quadro inteiro.
    - Use `will-change` só durante a animação e em poucos elementos.
    - `backdrop-filter` em elementos fixos custa caro no celular: use raio pequeno ou, no celular, um fundo opaco no lugar.
    - Pause animações, vídeos e `canvas` fora da tela (`IntersectionObserver`) e mantenha um único laço de `requestAnimationFrame` (Lenis ligado ao ticker do GSAP, por exemplo).
    - Com movimento reduzido, os laços contínuos param; o relatório de `inspecionar-pagina.mjs` mostra os que continuam.
16. **Recursos modernos e baratos.**
    - `content-visibility: auto`, com `contain-intrinsic-size`, nas seções longas abaixo da primeira tela, exceto nas seções fixadas ou animadas pela rolagem, porque ele muda as medidas que o ScrollTrigger usa.
    - Em sites de várias páginas, `<script type="speculationrules">` para pré-carregar a próxima página provável.

## Medição

- **Lighthouse local**, que usa o mesmo motor do PageSpeed, rodando sobre o build de produção em execução (no Vite, `npm run build && npx vite preview --strictPort`; com `--strictPort`, o preview falha em vez de subir em outra porta quando a 4173 está ocupada, e os comandos prontos nunca medem outro site), o que permite iterar sem publicar a cada tentativa. Com `playwright` e `lighthouse` instalados em `.tmp/` (veja [Capturas e medição](capturas-e-medicao.md)), a partir da raiz do projeto, informando todas as páginas do site e os limites de `metas-de-performance.md`:

  ```bash
  R=.tmp/performance/r1/medicoes/performance   # a pasta medicoes/performance/ da rodada
  node <skill>/scripts/medir-lighthouse.mjs --url http://localhost:4173/,http://localhost:4173/sobre/ --rotulos inicial,sobre --out $R --execucoes 1 --limites nota-celular=90,nota-desktop=95,lcp=2500,cls=0.1,tbt=200
  ```

  O script mede cada página no celular e no desktop, uma execução de cada vez (em paralelo, os números se distorcem), grava um JSON por execução e gera o `resumo.md` com `resumir-lighthouse.mjs`, terminando com erro se alguma execução ou algum limite falhar. O construtor repete o ciclo (mudar, medir) com uma execução por perfil até tudo passar, sem abrir avaliador. A medição que vai ao avaliador usa `--execucoes 3`, porque vale a mediana: uma execução isolada varia. O `vite preview` comprime com gzip, mas responde tudo com `Cache-Control: no-cache`, inclusive os arquivos com hash: as auditorias de cache reprovam sempre no preview (não é o seu build que manda isso), por isso o resumo as marca para conferência no servidor real, onde o `.htaccess` manda o cabeçalho certo; uma falha de compressão medida no preview é real.
- **Desaceleração de CPU calibrada.** O Lighthouse simula o celular deixando a CPU 4× mais lenta, e esse fator só representa um celular intermediário numa máquina com `benchmarkIndex` entre 1500 e 2000. Numa máquina mais rápida (comum em computadores recentes), o celular simulado fica rápido demais, e TBT e INP saem otimistas. O resumo mostra o índice da máquina e avisa quando ele sai da faixa. Nesse caso, calcule o fator na [calculadora do Lighthouse](https://lighthouse-cpu-throttling-calculator.vercel.app/), passe-o com `--cpu` ao `medir-lighthouse.mjs` e ao `medir-interacoes.mjs` (no celular) e registre-o nas condições de medição de `metas-de-performance.md`, para que todas as rodadas usem o mesmo.
- **INP e CLS em laboratório**, com as interações reais do site (as do arquivo de estados) e as mesmas telas e a mesma desaceleração de CPU do Lighthouse (com `--cpu`, o mesmo fator calibrado):

  ```bash
  node <skill>/scripts/medir-interacoes.mjs --url http://localhost:4173/,http://localhost:4173/sobre/ --estados design/estados-resultado.json --out $R --limites inp=200,cls=0.1
  node <skill>/scripts/medir-interacoes.mjs --url http://localhost:4173/,http://localhost:4173/sobre/ --estados design/estados-resultado.json --out $R/desktop --perfil desktop --limites inp=200,cls=0.1
  ```

  O perfil celular é o que decide, porque mede com a CPU 4× mais lenta e é ele que domina os limites de campo. A segunda linha, com `--perfil desktop`, é opcional: rode-a quando alguma interação existir só no desktop (mega-menu, carrossel de tela larga, estados com `pagina` ou seletor exclusivos) ou quando o celular passar por pouco, e registre a escolha nas condições de medição de `metas-de-performance.md`, para que todas as rodadas façam igual. O script grava `interacoes.md` na pasta indicada, com a duração de cada interação e o CLS, e também termina com erro se algum limite falhar. O navegador só registra interações a partir de 16 ms; uma interação mais rápida aparece como “< 16 ms”. Um clique que troca de página fica sem medida: meça a página de destino à parte.
- **Ferramentas diferentes, resultados diferentes.** Algumas versões do Lighthouse local avaliam imagens sem considerar a densidade da tela, enquanto o PageSpeed usa densidade 1,75 no celular. Se os dois discordarem, vale o PageSpeed; nunca entregue imagens de densidade 1 ao celular só para zerar o aviso local.
- **Reflow e camadas andam juntos.** Depois de mudar a ordem de inicialização ou os recálculos, teste os cliques nas seções fixadas. Uma camada transparente presa (inclusive o `.pin-spacer` criado pelo ScrollTrigger) pode começar a interceptar os cliques da seção de baixo; aplique `pointer-events: none` nela e `auto` apenas na área visível.
- **No servidor real.** Publique o build de produção (`npm run build`), porque os cabeçalhos de cache (e o Brotli, se houver) só aparecem ali; a compressão em si o preview já mostra.
- **Confira o que está publicado.** Antes de medir, ou de pôr a culpa no cache, compare o nome do JS (`index-XXXX.js`) citado no HTML que está no ar com o nome gerado em `dist/`. Nomes diferentes significam que o HTML novo não foi publicado, e aí esvaziar o cache não resolve. Programas de FTP às vezes ignoram arquivos que consideram iguais, e alguns servidores (LiteSpeed, por exemplo) têm cache próprio; apagar e enviar de novo resolve.
- **PageSpeed no celular e no desktop.** Salve os resultados de cada página na pasta `medicoes/performance/` da rodada, como `pagespeed-celular-<rótulo>-exec<n>.json` e `pagespeed-desktop-<rótulo>-exec<n>.json`, com três chamadas por página e perfil (`-exec1`, `-exec2`, `-exec3`: o PageSpeed roda o mesmo Lighthouse e varia do mesmo jeito, e o `resumir-lighthouse.mjs` tira a mediana das três, como faz com o local), e gere o resumo de novo com `resumir-lighthouse.mjs --pasta` e os mesmos limites, mais `inp=200`. Um arquivo exportado pela página do PageSpeed, sem `-exec<n>`, conta como execução única. Os dados de campo (visitantes reais) só vêm no JSON da API (`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<endereço>&strategy=mobile`, ou `strategy=desktop`), e não no relatório exportado da página. O resumo os mostra numa tabela própria, com LCP, INP e CLS conferidos contra os limites; sem visitas suficientes, o Google não tem esses dados, e vale o laboratório.
- **Onde fica cada coisa.** O `metas-de-performance.md` guarda **apenas** as metas e as condições de medição: é a régua do avaliador e não muda a cada rodada. Os relatórios de cada rodada ficam em `medicoes/performance/` da pasta da rodada (`.tmp/performance/r{n}/` ou, no fechamento, `.tmp/fechamento/r{n}/`), que é a `{pasta_performance}` entregue ao avaliador. A evolução das notas (antes e depois de cada rodada) vai para o histórico do `andamento.md`, que o avaliador não recebe.
- Durante a iteração, repita só o `medir-lighthouse.mjs`. Antes de entregar a rodada (e não a cada ajuste), rode de novo [`inspecionar-pagina.mjs`](../scripts/inspecionar-pagina.mjs) e as capturas nas páginas que mudaram, para que o coordenador confira que a otimização não prejudicou o design; capturas intermediárias não têm quem as leia.
