# Capturas e medição — o material que os avaliadores recebem

Consulte ao preparar o material de cada rodada. Os avaliadores julgam o site como ele aparece no navegador; nunca o código, nem o relato do construtor sobre o que tentou fazer.

## Preparação

Execute tudo **a partir da raiz do projeto**. As dependências de apoio (`playwright` e o navegador dele, `sharp`, `lighthouse`) são instaladas em `.tmp/`, e os scripts as procuram ali primeiro e, se não encontrarem, no próprio projeto. O cache do npm e o navegador baixado pelo Playwright também ficam em `.tmp/`; sem isso, os dois iriam para pastas globais do sistema, fora do projeto:

```bash
mkdir -p .tmp && printf '{"name":"tmp","private":true}' > .tmp/package.json
npm install --prefix .tmp --cache .tmp/npm-cache playwright
PLAYWRIGHT_BROWSERS_PATH=.tmp/navegadores .tmp/node_modules/.bin/playwright install chromium
```

Com o pacote de SEO, acrescente o `lighthouse`; com o pacote de performance, o `lighthouse` e o `sharp`:

```bash
npm install --prefix .tmp --cache .tmp/npm-cache lighthouse sharp
```

O `medir-lighthouse.mjs` usa o Chromium que o Playwright instalou. Esse Chromium é a versão de código aberto e não decodifica H.264 nem AAC: um vídeo que só tenha MP4 fica parado no `poster` nas capturas e nas medições, tanto na referência quanto no resultado. No resultado, o item 12 do checklist de performance pede WebM antes do MP4; na referência, um vídeo só em MP4 não aparece nas capturas, então o comportamento dele entra no `alvo-visual.md` como conferido no site real, e não nos quadros. O `html-minifier-terser` não é temporário: ele é usado pelo build do site (modelo de `vite.config.js`) e entra como dependência do projeto (`npm i -D html-minifier-terser`). O `source-map-js` já vem com o Vite; em outra stack, instale-o em `.tmp/`.

Os caminhos dos exemplos (`--out .tmp/…`, `--tokens src/…`) partem da raiz do projeto. A organização das pastas dentro de `.tmp/` e quando apagá-las estão no SKILL.md (seção “Arquivos temporários”).

## Scripts

### [`capturar-telas.mjs`](../scripts/capturar-telas.mjs)

Registra a referência e o resultado sempre da mesma forma: a primeira tela, uma sequência de quadros do carregamento e uma sequência de quadros da rolagem. Funciona em desktop (`1440×900`), em celular (`--mobile`, `390×844`) e em celular baixo (`--mobile --viewport 360x740`, que simula a área útil com a barra do navegador aparecendo). Com `--viewports 1440x900,390x844,360x740:primeira`, as três larguras são capturadas de uma vez, num único navegador, duas por vez (`--paralelo 2`, o padrão; use o mesmo valor em todas as rodadas), cada uma numa subpasta (`desktop-1440x900`, `celular-390x844`, `celular-360x740`). O sufixo `:primeira` numa largura grava só o carregamento e a primeira tela, sem rolagem nem estados: é o caso do celular baixo, em que o avaliador visual abre só a `primeira-tela.png` (as quebras de layout nessa largura quem detecta é o `inspecionar-pagina.mjs`, que continua medindo as três). Num site que já existe, `--from` e `--to` aceitam um valor por largura, na ordem de `--viewports` (`--from 0,0,0 --to 3200,5100,5400`), porque a posição do trecho muda com a largura; assim a captura do trecho continua numa execução só, com as mesmas subpastas. Para mais de uma página, passe `--url a,b,c`; cada página ganha uma subpasta. Com `--rotulos inicial,sobre,contato`, as subpastas recebem esses nomes em vez do caminho da URL; use os **mesmos rótulos** na referência e no resultado, para que os nomes das pastas não revelem qual versão é qual. As sequências de quadros são montadas pelo próprio navegador do Playwright, sem nenhuma outra instalação. Os quadros do carregamento não esperam as fontes, para mostrar a troca de fontes; a primeira tela e a rolagem só começam depois do carregamento completo da página (até 30 s). Uma página que não abre é registrada como falha, e as demais continuam.

Com `--estados`, o script também registra **interações**: hover (só nas larguras de desktop, porque tela de toque não tem hover), clique (toque, no celular) e foco. Cada estado parte da página recém-carregada e gera o estado final (`estado-<nome>.png`) e uma sequência curta da transição (`sequencia-estado-<nome>.png`, com o quadro de antes da ação e ~80 ms entre os seguintes). Os estados ficam em dois arquivos versionados na pasta `design/`, um para a referência e outro para o resultado, com os **mesmos nomes de estado** e seletores próprios de cada site:

```json
[
  { "nome": "botao-principal-hover", "acao": "hover", "seletor": ".hero .btn-primario" },
  { "nome": "menu-aberto", "acao": "click", "seletor": "button.menu" },
  { "nome": "foco-primeiro-link", "acao": "focus", "seletor": "nav a" }
]
```

O campo opcional `pagina` (por exemplo, `"/sobre"`) restringe o estado a uma página. Um seletor que não é encontrado não interrompe a captura: o estado aparece como falha no `sobre-a-captura.txt` e na saída do script, e precisa ser corrigido antes de a rodada seguir.

### [`inspecionar-pagina.mjs`](../scripts/inspecionar-pagina.mjs)

Mede, em todas as páginas informadas:

- o contraste de cada texto visível contra o fundo que realmente aparece atrás dele, incluindo granulado, sobreposições e fotos;
- cores de texto que não pertencem à paleta (com `--tokens`, com as cores em hex, `rgb()`, `hsl()`, `oklch()`, `oklab()`, `lab()`, `lch()` ou `color()`; o próprio navegador converte tudo para sRGB, inclusive a paleta padrão do Tailwind v4, que é em `oklch()`);
- os tamanhos de fonte e os raios de canto em uso (com `--tokens`, os raios que não batem com nenhum token `--radius-*`, `--raio-*`, `--rounded-*` ou `--corner-*` são marcados);
- o foco por teclado;
- o comportamento com movimento reduzido (texto que segue escondido, animações e transições que continuam rodando e laços de `requestAnimationFrame` com a página parada);
- **textos que se sobrepõem** (blocos distintos cujas letras se cruzam sem um fundo entre eles);
- rolagem horizontal indevida;
- erros no console.

As larguras padrão são `1440×900`, `390×844` e `360×740`, medidas três de cada vez (`--paralelo 3`, o padrão, que cobre as três larguras de uma página numa leva só; use o mesmo valor em todas as rodadas, para os números serem comparáveis, e não passe disso, porque a disputa de CPU pode mudar o momento das animações). Sites que nunca deixam a rede ociosa (vídeo, análise, conexões abertas) não travam a medição: o script espera no máximo 5 s e registra o aviso no relatório. Cada texto com contraste insuficiente aparece uma vez só, com o pior valor e as posições em que falhou. Uma combinação de página e largura que não pode ser medida aparece no relatório com o motivo, e as demais continuam. A tela baixa merece atenção: é nela que primeiro quebram os layouts que posicionam um elemento centralizado por cima do conteúdo, como um rodapé que passa num celular alto e sobrepõe textos num celular baixo.

O relatório (`inspecao.md` e `inspecao.json`) é usado pelo construtor antes de entregar, pelos avaliadores de pedido e de sistema, que o interpretam, e pelo coordenador, na regra da piora demonstrada.

## Escopo das capturas

Em sites com várias páginas, informe **todas** as que o pedido envolve, e não apenas a inicial. Se houver áreas que exigem login, prepare uma sessão autenticada antes ou restrinja o escopo às páginas públicas, e registre a escolha em `acordos.md`.

## Estados e interações

- Referência e resultado são capturados com as mesmas larguras de tela e em estados comparáveis.
- Explore as interações que importam na referência: hover, menus, acordeões, formulários, transições durante a rolagem. Toda interação que fizer parte do alvo visual precisa ter um estado correspondente em `design/estados-referencia.json` e `design/estados-resultado.json`, para que o avaliador visual possa vê-la. Para julgar movimento, use as sequências montadas (os quadros avulsos da pasta `f/` servem só para conferir um detalhe, o que evita abrir centenas de imagens por rodada); os intervalos entre quadros estão no `sobre-a-captura.txt` de cada pasta.
- Elementos fixos, sticky, canvas e vídeo costumam sair errados em capturas da página inteira. Por isso os scripts capturam uma tela de cada vez; mesmo assim, confira se a captura corresponde ao que o navegador mostra. Um erro de captura não é um defeito do site.

## Assets

Antes de cada rodada, verifique se o material mudou, por exemplo fotos definitivas no lugar de substitutos (pelas datas dos arquivos ou pela lista de substitutos). Não mencione a situação dos assets no prompt do avaliador. Quando as imagens definitivas chegarem, faça uma revisão visual exclusiva para elas.

## Comparação às cegas

A cada rodada, o coordenador sorteia as letras e copia para `avaliacao/A/` e `avaliacao/B/` da rodada as capturas definitivas da referência (`.tmp/referencia/`) e as do resultado (`capturas/` da rodada), só das páginas do escopo, e guarda o sorteio fora da pasta de avaliação. Nenhuma pista pode indicar qual é qual: as subpastas das páginas usam os mesmos rótulos neutros (`--rotulos`) nas duas versões, e nada no nome dos arquivos indica a origem. O que o avaliador visual faz e como o coordenador transforma a comparação em veredito estão nos [prompts padronizados](prompts-avaliadores.md).

Se não for possível renderizar o site, informe qual avaliador fica impossibilitado de julgar.
