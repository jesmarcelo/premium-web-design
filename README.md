# Premium Web Design

**Uma skill para Claude Code (e Codex) que constrói ou refina sites de qualquer segmento até eles alcançarem o nível de um site de referência real.**

Você indica um site que já resolve muito bem o que você quer. A skill transforma essa referência em critérios que podem ser conferidos só de olhar, constrói a sua versão e coloca avaliadores independentes para julgar cada rodada. O trabalho só termina quando todos aprovam, ou quando você decide parar.

Serve para qualquer nicho: empresas, prestadores de serviço, produtos, lojas virtuais, portfólios, eventos, SaaS e aplicações web. Funciona para criar um site do zero ou para melhorar um que já existe.

A skill é um conjunto de instruções e scripts em português. Ela não inclui modelo nem serviço pago: usa o agente e as ferramentas que você já tem.

## Como funciona

1. **Conversa inicial.** Cinco perguntas, feitas de uma vez: do que se trata o site, qual é a referência, que material já existe e se você quer os pacotes opcionais de SEO e de performance. O agente aproveita o que já foi dito e só pergunta o que falta.
2. **Checagem do ambiente.** O agente abre a referência, captura as telas de verdade, confirma que consegue rodar e medir o seu site (num site novo, que as ferramentas de medição funcionam) e avisa se algum avaliador vai ficar sem condições de julgar.
3. **Análise da referência.** A referência vira de 5 a 7 comportamentos observáveis no `alvo-visual.md`. Junto nascem o `pedido.md`, o `sistema-de-design.md` e o `acordos.md`, conferidos entre si para não se contradizerem.
4. **Rodadas de construção e avaliação.** Um agente constrói; avaliadores isolados julgam. As correções voltam para o construtor até a aprovação.

| Avaliador | Julga | Não opina sobre |
| --- | --- | --- |
| **Pedido** | se o site entrega o que você pediu | estética |
| **Sistema** | se o site segue o seu sistema de design, com base em medições automáticas | se ficou bonito |
| **Visual** | se o site cumpre o alvo visual e vence a referência numa comparação às cegas | se cumpre o pedido |
| **SEO** (opcional) | se o site atinge as metas de encontrabilidade e compartilhamento: metadados, dados estruturados, sitemap e Open Graph (Lighthouse e conferência no site) | design |
| **Performance** (opcional) | se o site atinge as metas de velocidade e entrega (Lighthouse e PageSpeed) | design |

Algumas regras sustentam o método:

- **Contexto limpo.** Cada avaliador é um agente novo, que vê apenas o resultado. Ele não lê o código nem sabe o que o construtor tentou fazer.
- **Veredito binário.** Aprovado ou reprovado, sem nota.
- **Tudo corrigido de uma vez.** Todos os avaliadores entregam a lista completa do que falhou (no visual, todos os comportamentos não cumpridos, com o principal primeiro), e o construtor corrige tudo na mesma rodada, em vez de um erro por vez. Isso economiza rodadas, tokens e tempo.
- **Toda reprovação cita o documento.** Sem citar o trecho descumprido, o problema vira apenas uma observação.
- **Comparação às cegas.** O avaliador visual recebe as duas versões como A e B, sem saber qual é a referência e qual é o seu site, e aponta a melhor. Só quem conhece o sorteio (o coordenador) transforma isso em veredito: o seu site só é aprovado se cumprir o alvo visual e tiver sido apontado como claramente melhor (na primeira fase, a base, basta empatar).
- **Limite e travamento.** Há um limite de rodadas combinado com você, e o trabalho para se o mesmo problema voltar duas vezes depois de corrigido, se as falhas não diminuírem ou se as correções começarem a se desfazer.

## Instalação no Claude Code

### Pelo marketplace (recomendado)

Dentro de uma sessão do Claude Code:

```text
/plugin marketplace add jesmarcelo/premium-web-design
/plugin install premium-web-design@premium-web-design
```

Ou pelo terminal:

```bash
claude plugin marketplace add jesmarcelo/premium-web-design
claude plugin install premium-web-design@premium-web-design
```

Para instalar apenas no projeto atual, acrescente `--scope project` aos dois comandos do terminal.

Depois de instalar, abra uma sessão nova. A skill aparece como `/premium-web-design:premium-web-design` e também é acionada sozinha quando você pede um site no nível de uma referência.

Para atualizar para a versão mais recente:

```text
/plugin marketplace update premium-web-design
```

Para fixar uma versão específica, adicione o marketplace apontando para a tag dela:

```text
/plugin marketplace add https://github.com/jesmarcelo/premium-web-design.git#v1.0.0
```

### Manualmente

Copie a pasta `skills/premium-web-design` deste repositório para a pasta de skills do seu projeto:

```bash
git clone https://github.com/jesmarcelo/premium-web-design.git
mkdir -p SEU-PROJETO/.claude/skills
cp -R premium-web-design/skills/premium-web-design SEU-PROJETO/.claude/skills/
```

Nesse caso, a skill aparece como `/premium-web-design`.

Se preferir não clonar, baixe o arquivo `premium-web-design-vX.Y.Z.zip` da [release mais recente](https://github.com/jesmarcelo/premium-web-design/releases/latest) e extraia-o dentro de `SEU-PROJETO/.claude/skills/`.

## Instalação no Codex

Peça ao Codex:

```text
$skill-installer

Instale a skill deste repositório:
https://github.com/jesmarcelo/premium-web-design/tree/main/skills/premium-web-design
```

Para uma versão específica, troque `main` pela tag no endereço, por exemplo `.../tree/v1.0.0/skills/premium-web-design`.

Ou copie a pasta `skills/premium-web-design` (ou o conteúdo do `.zip` da release) para a pasta de skills do Codex. Depois, chame a skill com `$premium-web-design`.

## Primeiro pedido

```text
Quero a landing page da minha clínica de estética no nível de https://exemplo.com/pagina-especifica. A identidade visual está em docs/marca.md.
```

Quanto mais específica a referência, melhor. “O site da Apple” é vago; o endereço de uma página é uma referência. Uma referência vaga é o principal motivo de o método falhar, porque o avaliador visual acaba comparando o seu site com uma lembrança.

## Requisitos

- **Node.js** 22.19 ou mais recente (exigência do Lighthouse 13; o Playwright pede 20 ou mais).
- **Playwright**, para capturar telas e medir as páginas. A skill instala na pasta `.tmp/` do seu projeto quando precisar.
- Com o pacote de SEO: **Lighthouse**.
- Com o pacote de performance: **Lighthouse**, **sharp** (variações de imagem), **source-map-js** (já vem com o Vite) e **html-minifier-terser** (modelo de `vite.config.js`).

Todo arquivo temporário (instalações, capturas, relatórios) fica em `.tmp/`, dentro do seu projeto, e é apagado quando o trabalho termina. Nada é gravado fora do projeto.

## O que vem no pacote

```text
.claude-plugin/
├── marketplace.json              catálogo para instalação pelo marketplace
└── plugin.json                   dados do plugin
skills/premium-web-design/
├── SKILL.md                      o método
├── CREDITOS.md                   autoria, inspiração e origem
├── LICENSE                       licença MIT, que acompanha a skill em qualquer instalação
├── agents/openai.yaml            nome e atalho da skill no Codex
├── references/
│   ├── alvo-visual.md            como transformar a referência em critérios verificáveis
│   ├── capturas-e-medicao.md     como capturar, medir e montar a comparação às cegas
│   ├── claude-code.md            como organizar construtores e avaliadores no Claude Code
│   ├── codex.md                  como organizar construtores e avaliadores no Codex
│   ├── documentos-das-rodadas.md modelos de acordos, andamento e passagem
│   ├── performance.md            pacote opcional de velocidade e entrega
│   ├── prompts-avaliadores.md    prompts padronizados dos avaliadores
│   └── seo.md                    pacote opcional de SEO: metadados, dados estruturados, sitemap e compartilhamento
├── scripts/
│   ├── capturar-telas.mjs        capturas padronizadas da referência e do resultado
│   ├── inspecionar-pagina.mjs    contraste, paleta, fontes, foco, movimento e sobreposições
│   ├── dimensionar-imagens.mjs   larguras ideais de cada imagem
│   ├── gerar-variantes.mjs       versões WebP (e AVIF) para o srcset
│   ├── medir-lighthouse.mjs      Lighthouse em todas as páginas e perfis, uma execução por vez
│   ├── resumir-lighthouse.mjs    medianas e falhas do Lighthouse e do PageSpeed num resumo curto
│   ├── medir-interacoes.mjs      INP e CLS em laboratório, com as interações reais do site
│   └── localizar-reflow.mjs      origem dos reflows apontados pelo PageSpeed
└── assets/performance/
    ├── htaccess                  cache, compressão, endereço único e 404 para Apache
    └── vite.config.js            CSS no HTML, pré-carga de fontes e HTML minificado
```

## Versões

Cada versão é publicada como uma tag `vX.Y.Z` e uma [release no GitHub](https://github.com/jesmarcelo/premium-web-design/releases), com as notas da versão e a skill empacotada em `.zip`. A numeração segue o Versionamento Semântico, e o que mudou em cada versão está no [CHANGELOG.md](CHANGELOG.md).

Para publicar uma nova versão:

1. Registre as mudanças na seção `[Não lançado]` do `CHANGELOG.md` e, na hora de lançar, renomeie-a para `[X.Y.Z] - AAAA-MM-DD`, abrindo uma nova `[Não lançado]` acima e atualizando os links no fim do arquivo.
2. Atualize a versão em `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` e no `metadata.version` do `skills/premium-web-design/SKILL.md`.
3. Faça o commit, crie a tag e envie: `git tag vX.Y.Z && git push origin main vX.Y.Z`.

O workflow [release.yml](.github/workflows/release.yml) confere se a tag bate com a versão dos três arquivos e com uma seção do `CHANGELOG.md`, e só então cria a release com as notas e o `.zip`.

## Créditos

A ideia central (um agente constrói, avaliadores independentes comparam o resultado com uma referência, às cegas, até ele vencer) vem do **Gauntlet Loop**, de [Matt Shumer](https://x.com/mattshumer_/status/2081830214384886228). Esta skill nasceu a partir do [Loop de Design](https://github.com/Felpborges/loop-de-design), de Felipe Borges, e foi reescrita e ampliada por Marcelo Bom Jardim Villasanin, que fez o construtor corrigir todos os problemas de uma rodada de uma só vez (e não um por um, como no original), acrescentou os pacotes e os avaliadores de SEO e de performance, os scripts de captura e medição, os prompts padronizados e as regras que vieram do uso real. Os detalhes estão em [CREDITOS.md](skills/premium-web-design/CREDITOS.md).

## Licença

MIT. Pode usar, adaptar e compartilhar, desde que mantenha o aviso de copyright e a licença. O texto oficial, em inglês, está em [LICENSE](LICENSE).
