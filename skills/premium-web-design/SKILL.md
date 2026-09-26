---
name: premium-web-design
description: >-
  Constrói ou refina sites (páginas institucionais, landing pages, one-pages, telas de apps web) de qualquer segmento, tomando como parâmetro um site real escolhido como referência. Um agente constrói e até cinco avaliadores isolados julgam, rodada após rodada, até o resultado atender ao pedido, respeitar o sistema de design, superar a referência numa comparação lado a lado e, se a pessoa quiser, bater as metas de SEO e de performance. Use quando pedirem um site premium, um site com acabamento de alto nível, rodadas de avaliação ou iterações até alcançar o nível de um site de referência, seja partindo do zero, seja num site que já existe. Não se aplica a vídeos, documentos ou apresentações, a um retoque isolado de acabamento, nem a um site simples que não peça acabamento premium nem tome um site como referência.
license: MIT
metadata:
  author: Marcelo Bom Jardim Villasanin
  version: "1.0.0"
---

# Premium Web Design

Método para **sites** de qualquer segmento: empresa, prestador de serviço, produto, loja virtual, portfólio, evento, SaaS ou aplicação web. O processo é o mesmo em todos; o que diferencia um projeto do outro é o pedido, o site de referência e o material que a pessoa fornece.

O trabalho passa por quatro etapas: **conversa inicial**, **checagem do ambiente**, **análise da referência** e **rodadas de construção e avaliação**. Nenhuma linha de código é escrita antes de três coisas estarem prontas: o objetivo compreendido, a referência aberta e examinada, e critérios de avaliação **que não se contradizem**. Reaproveite tudo o que a conversa ou o projeto já oferecem (respostas, arquivos, permissões). Quando o site já existe, as rodadas cuidam apenas das melhorias pedidas: o alvo visual e o escopo de cada avaliação se limitam às partes que serão melhoradas, e a comparação com a referência é feita só nos trechos equivalentes a elas (use `--from`, `--to`, `--url` e os estados de interação de `capturar-telas.mjs` para capturar apenas esses trechos). O que está fora do escopo não é avaliado, mas também não pode piorar.

## Etapa 1 — Conversa inicial

Faça as perguntas de uma vez só, e apenas as que ainda não têm resposta.

1. Do que se trata o site (negócio, público, objetivo) e qual a sua extensão: uma página, um conjunto de páginas (quais) ou partes de uma aplicação? Existe uma stack definida ou preferida?
2. Qual site já resolve isso com excelência? Preciso de um endereço que eu consiga abrir. Se não houver nenhum em mente, responda “pular”.
3. Existe material de partida? Sistema de design, identidade visual, textos, imagens ou uma versão atual do site.
4. Deseja incluir o **pacote de SEO** (encontrabilidade em buscadores e compartilhamento em redes sociais)? É opcional e ativa o avaliador de SEO. Se o site precisa ranquear, vale lembrar que os Core Web Vitals entram no ranking do Google, e eles são cobertos pelo pacote de performance.
5. Deseja incluir o **pacote de performance** (velocidade e entrega)? É opcional e ativa o avaliador de performance.

Se o pedido já respondeu às perguntas 4 e 5, não pergunte outra vez.

Referência genérica (“algo como o site da Apple”) pede uma única solicitação do endereço exato. Diante de “pular”, sugira três referências, cada uma com uma frase de justificativa; se a pessoa não escolher, adote a mais ambiciosa que faça sentido para o objetivo e comunique a escolha.

**Pedido mais ambicioso que a referência:** se a pessoa quer algo que a referência não tem (animações sofisticadas diante de um site estático, por exemplo), peça uma **referência complementar** só para esse ponto. Sem ela, o alvo fica abaixo do pedido e o avaliador aprova antes da hora.

**Material que a pessoa ainda vai criar** (fotos, vídeos, textos): recomende que fique pronto antes das rodadas, ou use substitutos de licença livre enquanto isso. Com substitutos, a avaliação visual vale apenas como provisória.

**Limite de rodadas:** o limite vale **por fase** da Etapa 4. Sugira os valores padrão, ajustáveis pela pessoa: base 3, blocos de conteúdo 3 (todos avaliados juntos, na mesma rodada), SEO 2, performance 3 e fechamento 2. Uma rodada é uma avaliação: as medições que o construtor faz sozinho antes de chamar os avaliadores não contam. Fases de pacotes não escolhidos não contam. Mantenha os modelos e o nível de esforço que já foram definidos; não transforme a escolha de modelos em questionário.

## Etapa 2 — Checagem do ambiente

Aqui só se confirma o que funciona; não é uma nova rodada de perguntas. Apresente tudo num único relato:

- Primeiro, prepare as ferramentas, com os scripts executados a partir da raiz do projeto e as dependências de apoio instaladas em `.tmp/` (detalhes em [Capturas e medição](references/capturas-e-medicao.md)). Num site que já existe, garanta que ele pode ser servido localmente (servidor de desenvolvimento ou preview) e medido com [`scripts/inspecionar-pagina.mjs`](scripts/inspecionar-pagina.mjs). Num site novo, que ainda não tem o que servir, confirme só que as ferramentas funcionam, com um teste curto do `inspecionar-pagina.mjs` na referência (`--viewports 1440x900 --stops 2 --tabs 5`, gravando em `.tmp/ambiente/`; a captura completa da referência, no item seguinte, já prova o resto) e, com algum pacote escolhido, um teste do `medir-lighthouse.mjs --categoria seo --perfis celular` também na referência, gravando em `.tmp/ambiente/` (6 s), para uma falha do Lighthouse, que exige o Node mais recente, aparecer aqui e não na primeira entrega; a checagem do próprio site passa para a primeira entrega da base.
- Com as ferramentas prontas, abra a referência e registre-a de fato com [`scripts/capturar-telas.mjs`](scripts/capturar-telas.mjs), em desktop e em dois celulares, um alto e um baixo, numa única execução (`--viewports 1440x900,390x844,360x740:primeira`; o sufixo `:primeira` captura no celular baixo só o carregamento e a primeira tela, que é tudo o que o avaliador visual abre nessa largura), gravando em `.tmp/ambiente/`. Essas capturas servem à análise da Etapa 3; as usadas na comparação A/B são feitas no fim dela. Se o site não abrir, arranje outro; nunca descreva a referência de memória.
- Liste as ferramentas de geração que o projeto vai exigir e verifique se estão disponíveis.
- Revise o material recebido e a **situação dos assets** (definitivos ou substitutos).
- Com qualquer um dos pacotes: descubra **em que servidor o site vai ao ar** (Apache, Nginx ou outro); os redirecionamentos, a página 404 e o cache longo são configurados nele, e o modelo de `.htaccess` da skill só serve ao Apache.
- Com o pacote de SEO: confirme **o domínio definitivo** (endereços canônicos, sitemap e compartilhamento dependem dele), o tipo de negócio (para os dados estruturados) e se todas as páginas devem aparecer nos buscadores.
- Com o pacote de performance: descubra quem vai rodar o PageSpeed. Só o cache longo precisa do servidor real para ser verificado: o preview local já comprime com gzip, então uma falha de compressão medida nele é real (o Brotli, se houver, só aparece no servidor).

Informe o que está pronto, o que falta e **qual avaliador não terá como julgar**.

## Etapa 3 — Análise da referência

**Numere os itens** dos documentos que servem de régua, para que possam ser citados nas reprovações: P1, P2… no `pedido.md`; C1 a C7 no `alvo-visual.md`; S1, S2… no `sistema-de-design.md`; SEO1, SEO2… no `metas-de-seo.md`; PF1, PF2… no `metas-de-performance.md`.

Os documentos do projeto (`pedido.md`, `alvo-visual.md`, `sistema-de-design.md`, `acordos.md`, `andamento.md`, `passagem.md` e as metas dos pacotes) ficam na pasta **`design/`**, na raiz do projeto do site, e são versionados com ele; se o projeto já tiver uma documentação de design, reaproveite-a.

Examine a referência e registre em `alvo-visual.md` de **5 a 7 comportamentos observáveis**: descrições do que o site faz, e não adjetivos (orientações em [Alvo visual](references/alvo-visual.md)). Se o projeto já tem um alvo visual, use-o. Comportamentos de interação (hover, menus, foco) ganham um estado nomeado, para que as capturas os mostrem: escreva agora o `design/estados-referencia.json`; o `design/estados-resultado.json`, com os mesmos nomes e os seletores do nosso site, é escrito pelo construtor quando ele constrói essas interações.

Produza também o `pedido.md` (o que a pessoa quer e as decisões já tomadas) e, caso ainda não exista, o `sistema-de-design.md`. O sistema de design já começa com:

- **regras de medição**: contraste de texto sobre imagem medido por percentil, quais momentos da rolagem contam: **em repouso** ou também **em transição** (elemento entrando ou saindo de cena), que são as duas categorias que `inspecionar-pagina.mjs` separa no relatório, cor do anel de foco definida pelo fundo em que ele aparece, e efeitos globais (granulado, sobreposições, modos de mesclagem) **considerados** na medição;
- **exceções já esperadas** (imagens que vão até a borda sem cantos arredondados, ícones redondos e similares);
- uma paleta **conferida com os efeitos aplicados**, e não apenas com as cores isoladas;
- o comportamento com **movimento reduzido**: o que deixa de se mover (rolagem suave, parallax, reprodução automática) e como aparece o que era revelado por animação.

### Conferência entre documentos (sempre)

Antes de acionar o primeiro construtor, leia em conjunto os documentos que servem de régua (`pedido.md`, `alvo-visual.md`, `sistema-de-design.md` e, se houver, as metas dos pacotes) e aponte onde eles se contradizem. Cada conflito se resolve pela ordem de prioridade **pedido > alvo visual > sistema de design > metas de SEO e de performance**: o que a pessoa pediu prevalece sobre a estética da referência, o alvo visual prevalece sobre o sistema, e as metas dos pacotes nunca prejudicam o design. Um pedido que vai além da referência vira um comportamento próprio no alvo visual desde já, e não uma exceção aberta depois de uma reprovação. Uma meta que só pode ser cumprida prejudicando o alvo visual ou o sistema contradiz um documento de prioridade maior: é um critério incorreto, e não apenas difícil. Ela é ajustada em `acordos.md`, com o número medido e o aviso à pessoa, como qualquer exceção.

### Pacote de performance (opcional)

Existe apenas se a pessoa o escolheu na conversa inicial. Fica em `metas-de-performance.md`, com metas **em números, que possam ser conferidas**, e com as condições de medição (build de produção, servidor, desktop e celular). O pacote nunca pode prejudicar o alvo visual nem o sistema de design: se performance e experiência entrarem em conflito, vale a ordem de prioridade acima, e a decisão fica registrada. É por esse documento que o avaliador de performance julga, e só pelas metas numeradas: o checklist orienta o construtor, e um item dele só é cobrado se virar meta própria. Checklist, orçamento, modelos prontos e método de medição estão em [Performance](references/performance.md).

### Pacote de SEO (opcional)

Existe apenas se a pessoa o escolheu na conversa inicial. Fica em `metas-de-seo.md`, com o domínio definitivo, o tipo de negócio, as páginas que devem ser indexadas e as metas numeradas: a nota mínima de SEO no Lighthouse e os itens do checklist que se aplicam ao projeto. Assim como a performance, o SEO nunca pode prejudicar o alvo visual nem o sistema de design; um conflito se resolve pela ordem de prioridade acima e fica registrado. É por esse documento que o avaliador de SEO julga. Checklist e método de medição estão em [SEO](references/seo.md).

Anote as resoluções e as interpretações em `acordos.md` ([modelo](references/documentos-das-rodadas.md)). Apresente o alvo visual e os acordos à pessoa antes de começar a construir.

### Captura definitiva da referência

Com o alvo visual, os estados e as páginas definidos, capture a referência que vai para a comparação A/B, em `.tmp/referencia/`: a mesma `--viewports` da Etapa 2, inclusive o `:primeira` do celular baixo (sem ele, uma das versões teria rolagem e estados nessa largura e a outra não, e isso revelaria qual é qual), as páginas do escopo com `--rotulos` neutros (os mesmos que o resultado vai usar), `--estados design/estados-referencia.json` e, num site que já existe, só os trechos equivalentes às partes que serão melhoradas (`--from` e `--to` com um valor por largura, na ordem de `--viewports`, por exemplo `--from 0,0,0 --to 3200,5100,5400`, porque a posição do trecho em pixels muda com a largura; tudo numa execução só, para que as subpastas por largura saiam iguais às do resultado, que é capturado do mesmo jeito). Ela é reaproveitada em todas as rodadas e só é refeita se a referência, o escopo ou os estados mudarem. Como a referência carrega pela internet e o resultado, localmente, registre em `acordos.md` que a sequência de carregamento compara a coreografia de entrada, e não a velocidade, sem dizer qual versão carrega de onde: o `acordos.md` vai para o avaliador visual, e isso revelaria qual versão é qual.

## Etapa 4 — Rodadas de construção e avaliação

### Blocos de trabalho

Separe o trabalho **em camadas**. Primeiro vem a **base** (tokens, componentes comuns, navegação, foco, sistema de animação), que precisa ser aprovada e então **travada**. Depois vêm os blocos de conteúdo, que apenas usam a base. Quem constrói conteúdo não cria tokens nem mexe em componentes comuns; se precisar, pede a quem cuida da base. Evite passar de três ou quatro blocos de conteúdo (a base não conta).

**Como a base é avaliada.** A base é a primeira fase e tem avaliação própria: os avaliadores de pedido e de sistema julgam apenas os itens que a base cobre (o escopo informado no prompt); o visual julga **só os comportamentos do alvo visual que a base cobre** (navegação, foco, movimento), comparando com os trechos equivalentes da referência, e não a página inteira. Na base, empate conta como aprovação: basta cumprir esses comportamentos e não perder para a referência. A partir dos blocos de conteúdo, vale a regra completa (cumprir o alvo visual e ser apontada como claramente melhor).

### Quem constrói

- Recebe sempre os mesmos documentos: `pedido.md`, `alvo-visual.md`, `sistema-de-design.md` e `acordos.md`. Se os pacotes foram escolhidos, recebe também, **desde a primeira rodada**, o `metas-de-seo.md` e o `metas-de-performance.md`, com a orientação de construir sem violar essas metas, deixando a otimização para a fase própria. Com o pacote de performance, respeita desde a base o **orçamento** de [Performance](references/performance.md), porque há escolhas que a otimização não desfaz depois (bibliotecas pesadas, muitas fontes). Um orçamento estourado vai para a pessoa antes de a base ser travada ou de o bloco ser aprovado, e a decisão fica em `acordos.md`. Assim se evita retrabalho depois que o visual aprova.
- Recebe também as correções da rodada, **acompanhadas dos critérios próximos que não podem piorar**. Assim se evita o vaivém em que atender um avaliador desfaz o que outro exigiu.
- **Só entrega depois de medir e capturar o resultado:** roda [`scripts/inspecionar-pagina.mjs`](scripts/inspecionar-pagina.mjs) e, quando ele termina, [`scripts/capturar-telas.mjs`](scripts/capturar-telas.mjs), gravando na pasta da rodada. Nenhuma medição ao mesmo tempo de outra (nem o Lighthouse nem o `medir-interacoes.mjs` junto com as capturas): a referência foi capturada sozinha, e as capturas do resultado precisam das mesmas condições para a comparação ser justa. As capturas usam a mesma `--viewports` da referência (com o `:primeira`), os mesmos `--rotulos` e o `design/estados-resultado.json`. A referência não é recapturada a cada rodada: o coordenador monta o par A/B por cópia, com as capturas definitivas da Etapa 3.
- **Mede só o que a rodada tocou:** nas rodadas de blocos, inspeção e capturas cobrem apenas as páginas dos blocos em correção. O site inteiro é medido sempre que a rodada inclui todos os blocos ainda pendentes (é a que pode encerrar a fase), no fechamento e sempre que uma mudança atingir a base (que é comum a todas as páginas).
- **Responde curto:** devolve ao coordenador os caminhos do relatório e das capturas e uma tabela de no máximo 10 linhas, com o antes e o depois do que corrigiu e dos critérios próximos (e, com o pacote de performance, o orçamento). Os números completos ficam no relatório, e não na conversa.
- É **substituído a cada fase**: ao passar de uma fase para a outra (base → blocos de conteúdo → SEO → performance → fechamento), abra um construtor novo com uma `passagem.md` enxuta, em vez de continuar com o mesmo agente sem fim.

### Quem avalia

Três avaliadores fixos e dois opcionais, todos isolados e sempre com contexto limpo. Os três fixos julgam cada bloco; os de SEO e de performance só existem se a pessoa escolheu o pacote correspondente na conversa inicial. Use os [prompts padronizados](references/prompts-avaliadores.md), preenchendo apenas os campos descritos na tabela de campos desse arquivo. **Nenhum critério extra entra no prompt.**

- **Pedido:** confere apenas se o `pedido.md` foi atendido. Recebe as capturas, o relatório de `inspecionar-pagina.mjs` e o site em funcionamento; não refaz o que o relatório já mede (foco, larguras, movimento reduzido) e usa o site como visitante só para o que nenhum relatório cobre, como conteúdo, formulários e fluxos. Não opina sobre estética.
- **Sistema:** confere apenas o `sistema-de-design.md`, **lendo o relatório de `inspecionar-pagina.mjs`**, sem medir de novo o que ele já mede. O que o relatório não cobre (raios, espaçamentos, grade, componentes, exceções) ele confere no site renderizado e nas capturas, sem abrir o código.
- **Visual:** confere apenas o `alvo-visual.md` e o site renderizado, lado a lado com a referência e sem saber qual é qual: julga as duas versões, aponta a melhor e não dá veredito. É o coordenador, que guarda o sorteio das letras, quem calcula o veredito: APROVADO só se a nossa versão cumprir o alvo visual e for apontada como a melhor. Não abre código. O prompt não comenta a situação dos assets.
- **SEO (opcional):** confere apenas as metas de `metas-de-seo.md`, **lendo o relatório de SEO do Lighthouse** e conferindo no site renderizado o que o relatório não cobre (metadados, dados estruturados, `sitemap.xml`, `robots.txt`, títulos, textos alternativos), sem abrir o código-fonte. Julga o site inteiro, na fase de SEO e no fechamento (veja a seção “Como e quando parar”).
- **Performance (opcional):** confere apenas as metas de `metas-de-performance.md`, **lendo os relatórios do Lighthouse e do PageSpeed** do build de produção, sem medir tudo de novo. Julga o site inteiro, e não bloco a bloco, na fase de performance e no fechamento (veja a seção “Como e quando parar”).

Todos recebem `acordos.md`, mas nenhum recebe os vereditos anteriores.

### Normas da avaliação

- Avaliadores são exigentes; elogio não ajuda em nada.
- O veredito é sempre **APROVADO ou REPROVADO**, sem nota.
- Cada reprovação **cita o item** do documento descumprido: o número do item e o trecho exato (por exemplo, “C4: …”). Sem esse trecho, o problema conta como **observação** e não impede a aprovação.
- O que já foi aprovado só volta a ser reprovado diante de **piora demonstrada**. Quem aplica essa regra é o coordenador, porque os avaliadores não conhecem o histórico: quando um impeditivo atinge algo já aprovado, ele compara com as capturas e a inspeção da rodada em que aquilo foi aprovado. Com piora comprovada (um número pior, uma diferença visível), o impeditivo vale; sem ela, vira observação, e a decisão fica registrada em `andamento.md`.
- **Visual:** marca, para cada versão, todos os comportamentos que não cumpre e aponta o principal problema. O construtor recebe **todos** os comportamentos que a nossa versão não cumpre, em ordem de gravidade e com o principal primeiro; os demais são corrigidos desde que não conflitem com o principal.
- **Pedido, sistema, SEO e performance:** apontam **todos os problemas**, divididos entre impeditivos e observações.
- **Destino dos problemas:** nas rodadas normais, o construtor recebe **todos os impeditivos** e todos os comportamentos visuais não cumpridos de uma vez. As observações de todos os avaliadores (no visual, só as da nossa versão) são acumuladas pelo coordenador em `andamento.md`, sem repetição, e só vão ao construtor no fechamento.
- **Avaliação em arquivo:** cada avaliador grava a avaliação completa na pasta `vereditos/` da rodada, sem limite de tamanho, e devolve ao coordenador só o veredito, as contagens e o caminho do arquivo. O construtor recebe os caminhos, e não listas copiadas; assim nenhum impeditivo se perde por falta de espaço, e o contexto do coordenador não cresce a cada rodada.
- Os avaliadores da rodada são acionados juntos, depois da entrega do construtor e da montagem do par A/B.
- A rodada termina, e as correções são enviadas, **só quando todos os vereditos chegaram**.
- **Rodada única para todos os blocos:** tudo o que está pendente é avaliado sobre o mesmo build. Um avaliador que já aprovou só é chamado de novo se a mudança atingir o que ele avaliou.
- A cada rodada, verifique se o material de entrada mudou (datas dos arquivos, lista de substitutos). Quando chegarem as imagens definitivas, faça uma **revisão visual só para elas**.

Mantenha um `andamento.md` com a **situação atual no início** (em andamento, pausado, esperando decisão ou finalizado, mais a tabela de vereditos), atualizado a cada rodada, e o histórico logo abaixo.

## Como e quando parar

- **Limite:** o combinado na conversa inicial, contado **por fase**. Ao chegar no limite de uma fase, mostre o que continua reprovado e quantas rodadas foram feitas, e peça permissão para continuar.
- **Travamento:** se o mesmo problema voltar duas vezes depois de corrigido, se as falhas medidas não diminuírem ou se surgir o vaivém entre avaliadores, interrompa e consulte a pessoa.
- **Ordem das fases:** a Etapa 4 se divide em fases: base → blocos de conteúdo → SEO (se escolhido) → performance (se escolhida) → fechamento. “Etapa” se refere só às quatro etapas do método; “fase”, a essas divisões da Etapa 4. O SEO vem antes porque mexe no HTML e nos metadados; a performance otimiza o HTML já definitivo.
- **Fim da fase de blocos:** quando os três avaliadores fixos aprovam todos os blocos. Se o limite chegar antes, a pessoa decide; o que ela aceitar deixar reprovado vira pendência do fechamento.
- **SEO (se escolhido):** começa **só depois do fim da fase de blocos**. O construtor aplica o checklist de SEO e confere sozinho com o [`medir-lighthouse.mjs`](scripts/medir-lighthouse.mjs) até a nota mínima passar; só então o avaliador de SEO julga contra `metas-de-seo.md`. Uma reprovação devolve os impeditivos ao construtor numa nova rodada, dentro do limite da fase. Após cada rodada, o coordenador confere se o design continua intacto (veja “Design intacto nas fases de SEO e performance”).
- **Performance (se escolhida):** começa **depois do SEO** (ou, sem SEO, depois do fim da fase de blocos), para não otimizar o que ainda pode mudar. O construtor itera **sozinho**, sem abrir avaliador, com o [`medir-lighthouse.mjs`](scripts/medir-lighthouse.mjs) (uma execução por perfil) e os limites das metas, até todos passarem localmente; a medição que vai ao avaliador tem três execuções por perfil. Com o site publicado no servidor real e o PageSpeed rodado, o avaliador de performance julga contra as metas de `metas-de-performance.md`, e o veredito é **definitivo**. Se ainda não houver como publicar, ele julga com os números locais, e o veredito é **provisório**: o fechamento pode começar, mas o trabalho só termina com uma rodada definitiva depois da publicação (contada no limite desta fase) ou com a decisão da pessoa, registrada em `andamento.md`, de encerrar com o provisório. Uma reprovação devolve os impeditivos ao construtor numa nova rodada, dentro do limite da fase. Após cada rodada, o coordenador confere se o design continua intacto; se piorar, a otimização é desfeita, e não o design.
- **Design intacto nas fases de SEO e performance:** nessas fases não roda o avaliador visual, então quem vigia é o coordenador. A cada rodada, ele compara a inspeção e as capturas com as da última rodada aprovada pelo visual, pela regra da piora demonstrada. Com piora comprovada (contraste menor, texto sobreposto, diferença visível), a mudança que a causou é desfeita e vira impeditivo para o construtor. O fechamento, com o visual avaliando o site inteiro, dá a confirmação final.
- **Fechamento:** depois da última fase escolhida (SEO e/ou performance) ou, sem elas, logo depois do fim da fase de blocos. Sem nenhum pacote escolhido, se a rodada que encerrou os blocos avaliou o site inteiro e não deixou pendência nem observação acumulada, ela já é o fechamento: o build é o mesmo, aprovado pelos três avaliadores, e uma rodada a mais só repetiria a anterior. Nos demais casos, junte **todas as pendências** numa rodada única para um construtor, junto com as observações acumuladas, que ele corrige se não conflitarem com o que já foi aprovado; faça uma avaliação do **site completo**. O **visual sempre** avalia, porque é a confirmação final de que SEO e performance não mexeram no design. Os demais só são chamados de novo se a rodada consolidada mexer no que eles julgam: pedido (conteúdo e funcionalidades), sistema (estilos e componentes), SEO (HTML e metadados) e performance (scripts, estilos, imagens e fontes); caso contrário, vale a última aprovação deles. O trabalho **só termina quando todos aprovam** (na performance, com veredito definitivo ou com o provisório aceito pela pessoa): se algum reprovar, os impeditivos voltam ao construtor numa nova rodada de fechamento, que continua sujeita ao limite combinado e à interrupção por travamento. Com tudo aprovado, as observações restantes são entregues em forma de lista.
- **Pausa:** afeta **só o que foi citado**. Se houver dúvida, pergunte numa linha: “pauso apenas X ou tudo?”.
- Não crie agendamentos extras só para retomar o trabalho; o aviso de término de cada subagente já basta para o coordenador seguir. Se algum agendamento existir, cancele-o ao pausar ou ao mudar de fase.
- **Preserve as pastas das rodadas** até a pessoa confirmar que o trabalho terminou, porque a regra da piora demonstrada compara com a rodada em que algo foi aprovado; depois disso, apague `.tmp/`. Se o espaço pesar, apague só as rodadas que não são a atual nem a última aprovada de algum bloco ou fase.

## Arquivos temporários

Tudo o que é temporário fica em **`.tmp/`, na raiz do projeto**, e em nenhum outro lugar: instalações de apoio (`playwright`, `lighthouse`, `sharp`), capturas, relatórios de inspeção, de SEO e de performance, pares A/B, scripts avulsos e downloads. Nunca use `/tmp`, pastas temporárias do sistema, `os.tmpdir()` ou diretórios fora do projeto. Repasse essa regra a todos os construtores e avaliadores. Mantenha `.tmp/` fora do controle de versão (`.gitignore`) e apague a pasta assim que ela deixar de ser necessária. A organização é sempre a mesma:

- `.tmp/ambiente/`: as capturas e os testes da Etapa 2;
- `.tmp/referencia/`: as capturas definitivas da referência, feitas no fim da Etapa 3;
- `.tmp/{fase}/r{n}/`: uma pasta por rodada, numerada dentro da fase (`base`, `blocos`, `seo`, `performance`, `fechamento`), com `inspecao/`, `capturas/`, `medicoes/` (Lighthouse, PageSpeed e interações, em `medicoes/seo/`, `medicoes/performance/` e `medicoes/orcamento/`, porque cada medição substitui a anterior da mesma pasta), `avaliacao/` (o par A/B), `vereditos/` (uma avaliação por avaliador) e `avaliadores/` (os temporários de cada avaliador).

## Exceções

As exceções esperadas são definidas na etapa 3. Uma exceção surgida depois de uma reprovação só é aceita com um registro em `acordos.md` que diga o que muda, por que o critério original estava **incorreto** (e não só difícil de cumprir) e com o **aviso à pessoa** na mesma mensagem. “Para aprovar” não é justificativa.

## Recursos e limites

Não estime custo em tokens. Informe rodadas feitas, blocos concluídos, **subagentes abertos, duração de cada rodada e tamanho do contexto dos construtores**. De preferência, conduza as rodadas por um único agente coordenador (ou por um workflow, se a pessoa tiver pedido orquestração com vários agentes) que devolva à conversa apenas o resumo de cada rodada (veja [Claude Code](references/claude-code.md)). Atingir um limite não converte reprovação em aprovação. As rodadas não aumentam o escopo nem autorizam gastos ou ações externas além do que foi combinado.

## Erros que comprometem o método

- Referência imprecisa, analisada superficialmente ou abaixo do nível do pedido.
- Critérios que se contradizem, sem conferência entre documentos nem ordem de prioridade.
- Coordenador que inclui critérios nos prompts ou dita valores incorretos.
- Um problema por rodada quando as falhas medidas poderiam ser corrigidas de uma vez.
- Avaliadores sem documento fixo, que mudam de critério a cada rodada, ou medições refeitas pela IA a cada rodada.
- Construtor que entrega sem medir ou que acumula contexto sem parar.
- Rodadas sem limite e sem interrupção por travamento.
- Rebaixar o alvo visual para aprovar, ou abrir exceções com pressa.
- Excesso de instruções: cada regra desnecessária reduz a margem de julgamento.

## Material de apoio (consulte só quando precisar)

- Agentes e modelos: [Claude Code](references/claude-code.md) ou [Codex](references/codex.md).
- Prompts dos avaliadores: [Prompts padronizados](references/prompts-avaliadores.md).
- Documentos das rodadas: [acordos, andamento e passagem](references/documentos-das-rodadas.md).
- Como montar o alvo visual: [Alvo visual](references/alvo-visual.md).
- SEO (opcional): [SEO](references/seo.md).
- Medição e resumo do Lighthouse e do PageSpeed (SEO e performance): [`medir-lighthouse.mjs`](scripts/medir-lighthouse.mjs) e [`resumir-lighthouse.mjs`](scripts/resumir-lighthouse.mjs). INP e CLS em laboratório: [`medir-interacoes.mjs`](scripts/medir-interacoes.mjs).
- Performance (opcional): [Performance](references/performance.md), [`gerar-variantes.mjs`](scripts/gerar-variantes.mjs), [`dimensionar-imagens.mjs`](scripts/dimensionar-imagens.mjs), [`localizar-reflow.mjs`](scripts/localizar-reflow.mjs) e os modelos em `assets/performance/`.
- Captura, comparação e medição: [Capturas e medição](references/capturas-e-medicao.md), [`capturar-telas.mjs`](scripts/capturar-telas.mjs) e [`inspecionar-pagina.mjs`](scripts/inspecionar-pagina.mjs).
- Créditos e licença: [Créditos](CREDITOS.md) e [LICENSE](LICENSE).
