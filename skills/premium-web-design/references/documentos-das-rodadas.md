# Documentos das rodadas — modelos

Todos ficam na pasta `design/`, na raiz do projeto do site, junto com os arquivos de estados de interação (`estados-referencia.json` e `estados-resultado.json`), quando houver. Três documentos acompanham as rodadas, além do `pedido.md`, do `alvo-visual.md`, do `sistema-de-design.md` e, se houver, do `metas-de-seo.md` e do `metas-de-performance.md`.

## `acordos.md`

Entregue a todos os avaliadores. Guarda o que já foi decidido; **nunca** os vereditos.

```markdown
# Acordos

## Ordem de prioridade
pedido > alvo visual > sistema de design > metas de SEO e de performance.

## Contradições resolvidas na conferência entre documentos
- {contradição} → {como foi resolvida} (motivo).

## Como ler o alvo visual neste projeto
- C{n}: {interpretação deste comportamento}.

## Exceções
| Quando | Mudança | Motivo pelo qual o critério estava incorreto | A pessoa foi avisada? |
|---|---|---|---|
```

## `andamento.md`

A situação atual fica sempre no início e é reescrita a cada rodada; o histórico vem logo abaixo.

```markdown
# Andamento

> **SITUAÇÃO:** {em andamento | pausado (o quê) | esperando decisão | finalizado}
> Fase: {base | blocos de conteúdo | SEO | performance | fechamento} · rodada {n} de {limite da fase} · subagentes abertos: {n} · duração da última rodada: {min} · contexto do construtor: {tamanho aproximado}

| Fase | Limite | Rodadas feitas |
|---|---|---|

| Bloco | Pedido | Sistema | Visual | Próximo passo |
|---|---|---|---|---|

| Site inteiro | SEO | Performance (definitivo ou provisório) | Próximo passo |
|---|---|---|---|

## Observações acumuladas
- {avaliador} · {bloco}: {observação} (vai ao construtor só no fechamento).

## Rodadas anteriores
- R{n} · {bloco}: {vereditos}; correções enviadas: {resumo}.
```

Os avaliadores de SEO e de performance julgam o site inteiro, por isso ficam numa tabela à parte, usada só quando a pessoa escolheu o pacote correspondente. A evolução das notas de SEO e de performance entra em “Rodadas anteriores”.

## `passagem.md`

Usado ao trocar de construtor na mudança de fase (base, blocos de conteúdo, SEO, performance, fechamento), para que o novo agente comece com o essencial em vez de herdar um contexto enorme.

```markdown
# Passagem — {projeto}

- Stack e comandos: {build, servidor de desenvolvimento, testes, servidor de preview com porta fixa (`npx vite preview --strictPort`; a porta faz parte das condições de medição e é a mesma dos comandos prontos)}.
- Comandos de medição prontos: {as linhas completas de inspecionar-pagina.mjs, capturar-telas.mjs e, com os pacotes, medir-lighthouse.mjs e medir-interacoes.mjs, com caminho absoluto dos scripts, --viewports, --rotulos, --tokens, --estados e --limites já preenchidos; --url e --out ficam como {paginas_da_rodada} e {pasta_da_rodada}/…, porque mudam a cada rodada, e o coordenador os preenche ao montar `{comandos_de_medicao}` do prompt de correções}.
- Organização: {pastas e função de cada uma; onde ficam os tokens e os componentes comuns}.
- Decisões que não podem ser revertidas: {lista}.
- Critérios aprovados que não podem piorar: {lista}.
- Pendências: {lista}.
```
