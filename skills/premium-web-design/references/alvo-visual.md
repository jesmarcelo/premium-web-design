# Alvo visual — como descrever o que faz a referência funcionar

Use este guia quando for difícil transformar a impressão causada pela referência em critérios que um avaliador consiga verificar. O resultado vai para `alvo-visual.md`; se o projeto já tiver esse documento, parta dele.

## Comportamento, não adjetivo

Um adjetivo diz como o site parece; um comportamento diz o que o site faz para parecer assim. Busque as relações que produzem o efeito: proporção entre elementos, contraste, densidade de informação, cadência entre seções, continuidade da rolagem, resposta a interações. Contar fontes ou cores ajuda pouco se não explicar por que a experiência funciona.

| Impressão | Comportamento que pode explicá-la (se for isso mesmo que a referência faz) |
| --- | --- |
| Leitura clara | Na primeira tela, o título ocupa o maior peso visual, o texto de apoio fica em segundo plano e existe um único botão principal. |
| Profundidade | Camadas se deslocam em velocidades diferentes durante a rolagem, e objetos mantêm volume quando giram. |
| Rolagem marcante | Um mesmo elemento se desmonta e se remonta ao longo da rolagem, costurando dois trechos da página. |
| Passagem suave entre seções | A seção nova sobe por cima da anterior, que se afasta; não há cortes secos. |
| Página fácil de percorrer | Cada seção tem uma cor de fundo própria, em alternância, com o mesmo espaçamento vertical entre elas. |
| Menu que não atrapalha | O menu fica preso ao topo, semitransparente, presente em toda a rolagem e sem esconder conteúdo. |
| Chamada à ação evidente | Uma única cor de destaque, reservada aos botões de ação. |

A tabela mostra o tipo de observação esperado; não é uma lista de regras. Não imponha “uma cor de destaque”, “dois pesos de fonte” ou “animações de 400 ms” a uma referência que não trabalha assim.

## Como examinar a referência

Use o site de verdade: role do início ao fim no desktop e no celular, passe o mouse sobre os elementos, abra menus e acordeões, navegue só pelo teclado. Quando o que importa é a continuidade da rolagem, registre um trecho longo o bastante para julgá-la, como a sequência de quadros gerada por `capturar-telas.mjs`.

## Como escrever

- Registre de cinco a sete comportamentos, cada um de um aspecto diferente (hierarquia, ritmo, movimento, navegação, cor, interação), numerados de C1 a C7 para que os avaliadores possam citá-los.
- Para cada comportamento, diga o efeito que se vê e em que estado ou trecho da página ele pode ser conferido. Se o comportamento depende de uma interação (hover, menu aberto, foco), dê um nome ao estado e registre-o em `design/estados-referencia.json`; o construtor cria o equivalente, com o mesmo nome, em `design/estados-resultado.json` quando constrói a interação (veja [Capturas e medição](capturas-e-medicao.md)); sem estado capturado, o avaliador visual não tem como julgá-lo.
- Só use números quando eles puderem ser medidos. Não invente durações, proporções ou curvas de animação.
- Em um site que já existe, o alvo visual cobre só as partes que serão melhoradas; comportamentos de trechos fora do escopo não entram.
- Se o pedido vai além da referência, o comportamento pedido entra no alvo visual desde o início, de preferência tirado de uma referência complementar.

## O que o alvo visual não faz

Ele não substitui o pedido: o `pedido.md` define o que o site precisa entregar, o `sistema-de-design.md` garante a consistência e o alvo visual define o nível de qualidade. Também não se reescreve o alvo depois de uma reprovação para facilitar a aprovação. Uma troca real de escopo ou de referência é registrada em `acordos.md`.
