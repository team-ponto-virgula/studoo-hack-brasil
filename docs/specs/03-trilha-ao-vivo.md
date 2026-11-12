# Trilha gerada ao vivo

**Estado:** aprovada para implementação (12/11/2026). Foco do Hack Brasil: a interface e a experiência da trilha.

## Problema

Hoje o Studoo aceita apenas objetivos de SQL e devolve uma proposta pronta, de uma só vez. A pessoa espera sem ver nada e não pode estudar outro assunto. Queremos uma trilha no estilo do Duolingo: a pessoa escreve o que quer aprender e vê a trilha se formar na tela, nó por nó, enquanto a IA a gera.

## Experiência

1. **Pedido.** Um campo grande, com o Stu, pergunta "O que você quer aprender?". Há sugestões tocáveis, como "SQL para a prova", "Frações" e "Inglês para entrevista". O botão **Gerar trilha** só fica ativo com o texto preenchido.
2. **Geração ao vivo.** A tela troca para a trilha vazia. O título do plano aparece primeiro, depois cada fluxo como uma faixa de unidade e, em seguida, cada lição como um nó do caminho, à medida que os eventos chegam. O Stu indica que está montando a trilha. A pessoa pode cancelar.
3. **Aceite.** Ao terminar, a trilha completa fica na tela, com **Começar** e **Ajustar pedido**. A trilha só entra na área de estudo quando a pessoa aceita, como já acontece hoje.
4. **Trilha.** O caminho vertical tem nós que alternam de lado. Cada fluxo abre com a faixa da unidade. O nó atual se destaca com movimento suave e o rótulo **Começar**. As lições concluídas mostram que estão feitas. Um nó futuro, quando tocado, explica o que falta para liberá-lo. Ao concluir uma lição, o nó seguinte é liberado com uma animação curta.
5. **Lição.** Mantém a aula por etapas da [spec 02](02-aula-web.md). O conteúdo de uma lição gerada pode ser criado na primeira vez que ela é aberta. Enquanto isso, a tela mostra um estado de carregamento próprio.

**Referência, não cópia.** Usamos as ideias de interação do caminho do Duolingo: caminho linear, nó atual em destaque, unidades e marcos. A cara é do Studoo, com a paleta, a tipografia, o Stu e os componentes do `DESIGN.md`. Não usamos a coruja, as cores, os ícones nem os textos do Duolingo. Também não usamos XP, sequência de dias, ranking ou moeda, porque a gamificação segue aberta em D16.

## Contrato

`POST /api/aprendizado/propostas/ao-vivo` com o corpo `{ "objetivo": string }`, de 3 a 500 caracteres, numa rota privada.

- Um erro antes da geração começar responde com JSON e o status de sempre (`invalido`, `nao_autenticado`, `ia_indisponivel`).
- Quando a geração começa, responde `200` com `Content-Type: application/x-ndjson`: um `EventoGeracao` por linha, na ordem `plano`, depois `fluxo` e as suas `licao`, e por fim `pronto` ou `erro`.
- O evento `pronto` traz a `PropostaPlano` completa, que já existe, com o `token` usado em `POST /api/aprendizado/planos`. O aceite não muda.
- A resposta não guarda nada no banco até o aceite. Se a pessoa cancelar, o servidor interrompe a geração.

Os tipos ficam em `packages/contratos/src/aprendizado.ts`: `EventoGeracao`, `interpretarEventoGeracao` e `LIMITES_GERACAO`.

## IA

- `IA=falsa` (padrão, testes e CI): o adaptador falso emite os eventos com pequenas pausas, para a tela mostrar a geração ao vivo. Para SQL, continua devolvendo o plano de demonstração atual. Para qualquer outro objetivo, gera uma trilha genérica e determinística de 3 fluxos com 3 lições cada, com conteúdo e exercícios simulados.
- A IA real fica atrás da mesma interface e entra depois que o dono escolher o provedor (D5). Nenhum teste chama a IA real.
- O limite de gerações por pessoa é provisório e configurável por variável. O teto definitivo segue aberto em D7.

## Critérios de aceite

1. Com `IA=falsa`, um objetivo qualquer ("Frações") gera uma trilha. Na tela, o título, os fluxos e os nós aparecem em sequência, não de uma só vez.
2. O objetivo de SQL continua gerando o plano de demonstração, e o percurso de `tests/marco-local.test.mjs` continua passando.
3. A rota responde em NDJSON válido e cada linha passa por `interpretarEventoGeracao`. Os erros antes do início seguem o JSON de erro atual.
4. Cancelar no meio não cria plano. Aceitar no final cria o plano com os mesmos fluxos e lições mostrados.
5. A trilha funciona com teclado, leitor de tela (cada nó tem nome acessível com o estado) e `prefers-reduced-motion` (sem animação, com a mesma informação).
6. A tela segue as faixas responsivas do `DESIGN.md §11`, do celular de 360 px à tela larga.
7. `npm run typecheck` passa na raiz e em `apps/mobile`.
