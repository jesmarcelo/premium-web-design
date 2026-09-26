# Codex — como organizar construtores e avaliadores

Guia para montar os agentes e a comparação visual quando o trabalho roda no Codex. Nada aqui adiciona perguntas à conversa inicial ou limita o número de rodadas.

## Subagentes

Entregue cada bloco a um agente construtor com o objetivo, os documentos definidos no SKILL.md (seção “Quem constrói”) e, quando for uma correção, o prompt padronizado de correções ([prompts padronizados](prompts-avaliadores.md)). Espere a construção terminar e o site ser renderizado.

Em seguida, crie um agente separado para cada avaliador, sem o histórico da conversa. Quando existir a opção `fork_turns`, defina `"none"`. Não reutilize o construtor, nem qualquer avaliador que já tenha visto o histórico da construção.

O que cada avaliador recebe e julga está no SKILL.md (seção “Quem avalia”), e quais entram em cada fase, nas seções “Normas da avaliação” e “Como e quando parar”. O sorteio das letras do visual e o cálculo do veredito dele estão nos prompts padronizados. Acione em paralelo os avaliadores que a rodada exige e espere todos antes de encerrar a rodada.

O coordenador organiza construção e avaliação; a construção em si é sempre delegada. Se a pessoa escolheu outro modelo para construir, respeite a escolha.

## Modelos

Mantenha os modelos e o nível de esforço já escolhidos pela pessoa. Sem uma escolha explícita, use a configuração da sessão; a escolha de modelo não é uma etapa do processo. Quando pedirem alternativas, verifique quais modelos estão realmente disponíveis. Para a melhor qualidade, priorize a capacidade de julgamento visual; para economizar, explique o que se perde ao reduzir essa capacidade. Não fixe nomes nem versões de modelo neste guia.

## Processo separado, quando não houver subagentes

Se a sessão não oferecer subagentes com contexto isolado, use um processo separado, se a versão instalada da CLI e as permissões da sessão deixarem. Rode `codex exec --help` antes, para confirmar as opções disponíveis.

Se a sua versão aceitar as opções abaixo (todos os caminhos dentro de `.tmp/` do projeto):

```bash
codex exec -s workspace-write --skip-git-repo-check --ephemeral -C /caminho/do/projeto/.tmp/blocos/r3/avaliacao -o /caminho/do/projeto/.tmp/blocos/r3/resposta-visual.md - < /caminho/do/projeto/.tmp/blocos/r3/instrucoes-visual.md
```

Use `-m` apenas com um modelo disponível que corresponda ao que foi combinado. Com `workspace-write`, o avaliador só grava dentro da pasta de avaliação, e por isso tudo o que ele lê ou grava fica ali. O coordenador **copia para dentro dela** os documentos que o prompt manda ler (no visual, `alvo-visual.md` e `acordos.md`) e preenche `{caminho}` e `{pasta_ab}` com essa pasta, `{arquivo_veredito}` com `…/avaliacao/veredito.md` e `{pasta_do_avaliador}` com `blocos/r3/avaliacao/temporarios`. Terminada a avaliação, o coordenador move o veredito para `vereditos/visual.md` da rodada; o `-o` guarda só a resposta final, de duas linhas. O avaliador abre as imagens de `A/` e `B/` pela pasta; se a sua versão não deixar abrir imagens locais, anexe com `-i` as que o prompt manda abrir. O arquivo de instruções é o prompt padronizado preenchido, sem versão especial para o Codex. Guarde a relação entre A/B e as versões, e o código, fora da pasta de avaliação.

Os demais avaliadores (pedido, sistema e, se escolhidos, SEO e performance) rodam do mesmo jeito, cada um com `-C` na sua pasta da rodada (por exemplo, `…/.tmp/blocos/r3/avaliadores/sistema`), que é onde ele pode gravar. Como no visual, o veredito e os temporários ficam em lugares diferentes, porque o prompt manda apagar `{pasta_do_avaliador}` ao terminar: `{arquivo_veredito}` é `…/avaliadores/sistema/veredito.md` e `{pasta_do_avaliador}` é a subpasta `blocos/r3/avaliadores/sistema/temporarios`. No fim, o coordenador move o veredito para `vereditos/sistema.md` e apaga `avaliadores/sistema`. Os documentos e relatórios que o prompt manda ler ficam onde estão, porque a leitura não é restrita. Os que abrem o site em funcionamento (pedido, sistema e SEO) precisam de acesso à rede, que o `workspace-write` bloqueia por padrão: libere-o com `-c sandbox_workspace_write.network_access=true`, se a sua versão aceitar, e, se não aceitar, entregue a eles as capturas e os relatórios e registre a limitação.

Se não for possível isolar o avaliador, informe a limitação; nunca troque os avaliadores independentes por autoavaliações.

Use as ferramentas de navegador e de captura que a sessão permitir. Nenhuma preferência deste guia por uma CLI ou ferramenta passa por cima das regras do ambiente.
