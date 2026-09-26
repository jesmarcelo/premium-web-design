# Créditos

## Autoria

Premium Web Design é mantida por Marcelo Bom Jardim Villasanin e distribuída sob a licença MIT.

## Inspiração

A ideia de fazer um agente construir e colocar avaliadores independentes para comparar o resultado com uma referência, às cegas, até o resultado vencer vem do **Gauntlet Loop**, de Matt Shumer.

- Apresentação do método: <https://x.com/mattshumer_/status/2081830214384886228>
- Uso além de jogos: <https://x.com/mattshumer_/status/2081857631254372509>
- Prompt original (repositório MIT): <https://github.com/mshumer/Claude-of-Duty/blob/main/prompt.md>
- Texto do método: <https://somethingbig.ai/gauntlet-loop>

## Trabalho derivado

Esta skill nasceu da skill [**Loop de Design**](https://github.com/Felpborges/loop-de-design) (versão 3.1), versão em português do Gauntlet Loop feita por Felipe Borges e distribuída sob a licença MIT. Dela vem a base do método: conversa inicial, análise da referência em comportamentos observáveis, construção delegada e avaliadores independentes com comparação às cegas. Todo o texto foi reescrito. O aviso de copyright do trabalho original é mantido no arquivo `LICENSE` desta pasta, que acompanha a skill em qualquer forma de instalação (e também na raiz do repositório).

## Contribuições de Marcelo Bom Jardim Villasanin

A partir do uso real da skill na criação de um site, Marcelo Bom Jardim Villasanin fez melhorias e acrescentou partes que não existiam no original:

- **Correção de todos os problemas de uma vez.** No original, cada rodada devolvia ao construtor um único problema, e o ciclo virava um loop quase infinito, corrigindo erro por erro. Agora todos os avaliadores entregam a lista completa do que falhou (impeditivos, e no visual todos os comportamentos não cumpridos, com o principal primeiro), e o construtor corrige tudo na mesma rodada. No fechamento, todas as pendências também vão juntas para um único construtor. A mudança reduz muito o número de rodadas, o consumo de tokens e o tempo de desenvolvimento.
- **Pacote de SEO** e o avaliador, opcional, de SEO: metas de encontrabilidade e compartilhamento, checklist (metadados, estrutura de títulos, dados estruturados, sitemap, robots, Open Graph) e medição com o Lighthouse.
- **Pacote de performance** e o avaliador, opcional, de performance: metas de velocidade e entrega, checklist, medição com Lighthouse e PageSpeed e os modelos em `assets/performance/`.
- **Scripts** em `scripts/`: captura padronizada de telas, inspeção automática das páginas (contraste, paleta, fontes, foco, movimento reduzido e textos sobrepostos), medição e resumo do Lighthouse e do PageSpeed, medição de INP e CLS em laboratório, dimensionamento de imagens, geração de variantes WebP e localização de reflows.
- **Prompts padronizados** dos avaliadores e os **documentos das rodadas** (acordos, andamento e passagem).
- Regras que vieram da prática: conferência entre documentos com ordem de prioridade, referência complementar quando o pedido supera a referência, citação obrigatória do documento descumprido, construtor que só entrega depois de medir e é trocado a cada fase, divisão em camadas com a base travada, limite de rodadas, interrupção por travamento, fechamento e controle de pausa.
- Adaptação para sites de qualquer segmento e distribuição como plugin do Claude Code.
