# Claude Code — como organizar construtores e avaliadores

Consulte ao montar os agentes no Claude Code. Trabalhe com as ferramentas e os parâmetros que a sessão realmente oferece; não suponha nomes nem versões.

## Coordenação

De preferência, conduza as rodadas por **um único agente coordenador**, ou por um Workflow quando a pessoa tiver pedido orquestração com vários agentes, que devolva à conversa principal **apenas o resumo de cada rodada**: tabela de vereditos, correções enviadas e situação atual. Sem isso, o relatório completo de cada subagente chega à conversa principal e ocupa o contexto do coordenador.

- Acione ao mesmo tempo, em segundo plano, os avaliadores que a rodada exige (quais entram em cada fase está no SKILL.md, seções “Normas da avaliação” e “Como e quando parar”), e **só encerre a rodada quando todos tiverem respondido**. Nenhuma correção vai para o construtor com veredito faltando.
- **Não crie agendamentos extras para retomar o trabalho.** O aviso de término de cada subagente já faz o coordenador seguir. Um agendamento esquecido pode disparar mais tarde com uma instrução desatualizada; se existir algum, cancele-o ao pausar ou ao mudar de fase.
- Alguns ambientes impedem sair da pasta da sessão com `cd`. Prefira caminhos absolutos, ou um subshell no formato `( cd … && … )`, e repasse essa orientação aos subagentes.

## Construtor

Cada bloco vai para um agente construtor, que recebe o objetivo, os documentos definidos no SKILL.md (seção “Quem constrói”), as correções da rodada e os **critérios próximos que não podem piorar**.

- Continuar conversando com o mesmo construtor (`SendMessage`) mantém o contexto, mas ele aumenta a cada rodada e pode chegar a centenas de milhares de tokens. **Troque de construtor a cada fase** (base, blocos de conteúdo, SEO, performance, fechamento), começando o novo com uma `passagem.md` ([modelo](documentos-das-rodadas.md)).
- Vários construtores ao mesmo tempo só quando cada um mexe em arquivos próprios (suas seções). Componentes comuns têm um único responsável.

## Avaliadores

Crie um agente novo para cada avaliador a cada rodada, sem acesso à conversa em que o site foi construído. Nada de fork com histórico, e nenhum avaliador de rodada anterior é reaproveitado. O que cada um recebe e julga está no SKILL.md (seção “Quem avalia”); o texto de cada prompt, o sorteio das letras do visual e o cálculo do veredito dele estão nos [prompts padronizados](prompts-avaliadores.md).

## Modelos

Mantenha os modelos e o nível de esforço definidos pela pessoa. Se nada foi escolhido, siga a configuração da sessão, e só ofereça outras opções quando a pessoa pedir.

## Ferramentas de apoio

Os scripts da skill são executados a partir da raiz do projeto e procuram as dependências de apoio em `.tmp/` (a instalação, com o navegador e o cache do npm também dentro de `.tmp/`, está em [Capturas e medição](capturas-e-medicao.md)). A regra dos temporários, com a organização das pastas e quando apagá-las, está no SKILL.md (seção “Arquivos temporários”); repasse-a a todos os subagentes.
