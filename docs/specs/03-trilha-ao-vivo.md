# Trilha gerada ao vivo

**Estado:** aprovada para implementação (12/11/2026). Foco do Hack Brasil: a interface e a experiência da trilha.

## Problema

Hoje o Studoo aceita apenas objetivos de SQL e devolve uma proposta pronta, de uma só vez. A pessoa espera sem ver nada e não pode estudar outro assunto. Queremos uma trilha no estilo do Duolingo: a pessoa escreve o que quer aprender e vê a trilha se formar na tela, nó por nó, enquanto a IA a gera.

## Experiência

1. **Pedido.** Um campo grande, com o Stu, pergunta "O que você quer aprender?". Há sugestões tocáveis, como "SQL para a prova", "Frações" e "Inglês para entrevista". O botão **Gerar trilha** só fica ativo com o texto preenchido.
2. **Geração ao vivo.** A tela troca para a trilha vazia. O título do plano aparece primeiro e, em seguida, cada lição como um nó do caminho, à medida que os eventos chegam. O Stu indica que está montando a trilha. A pessoa pode cancelar.
3. **Aceite.** Ao terminar, a trilha completa fica na tela, com **Começar** e **Ajustar pedido**. A trilha só entra na área de estudo quando a pessoa aceita, como já acontece hoje.
4. **Trilha.** É um caminho único e contínuo, do primeiro ao último nó, com nós que alternam de lado. A trilha **não agrupa lições por assunto**: não há cartões nem cabeçalhos como "Consultas" ou "Junções". A faixa do topo mostra o título do plano e o progresso total. Entre um trecho e outro do caminho aparece só um marco discreto, sem nome de assunto. O nó atual se destaca com movimento suave e o rótulo **Começar**. As lições concluídas mostram que estão feitas. Um nó futuro, quando tocado, explica o que falta para liberá-lo. Ao concluir uma lição, o nó seguinte é liberado com uma animação curta.
5. **Lição.** Mantém a aula por etapas da [spec 02](02-aula-web.md). O conteúdo de uma lição gerada pode ser criado na primeira vez que ela é aberta. Enquanto isso, a tela mostra um estado de carregamento próprio.

**Referência, não cópia.** Usamos as ideias de interação do caminho do Duolingo: caminho linear, nó atual em destaque e marcos. A cara é do Studoo, com a paleta, a tipografia, o Stu e os componentes do `DESIGN.md`. Não usamos a coruja, as cores, os ícones nem os textos do Duolingo. Também não usamos XP, sequência de dias, ranking ou moeda, porque a gamificação segue aberta em D16.

## Ordem da trilha

A IA decide a ordem das lições pensando em como a pessoa aprende melhor, não em agrupar por assunto:

- pré-requisitos antes do que depende deles;
- dificuldade crescente, com um conceito novo por lição;
- assuntos intercalados quando isso ajuda a fixar (por exemplo, uma junção simples logo depois dos filtros, antes de filtros mais difíceis);
- de tempos em tempos, uma lição de revisão que mistura o que já foi visto.

O contrato e o banco não mudam: `fluxo` continua existindo, mas passa a significar um **trecho** da trilha na ordem de aprendizado, e não um assunto. A interface não mostra o título do trecho como grupo; ele serve só para posicionar os marcos. A ordem da trilha é a ordem dos trechos e, dentro de cada um, a ordem das lições.

## Contrato

`POST /api/aprendizado/propostas/ao-vivo` com o corpo `{ "objetivo": string }`, de 3 a 500 caracteres, numa rota privada.

- Um erro antes da geração começar responde com JSON e o status de sempre (`invalido`, `nao_autenticado`, `ia_indisponivel`).
- Quando a geração começa, responde `200` com `Content-Type: application/x-ndjson`: um `EventoGeracao` por linha, na ordem `plano`, depois `fluxo` e as suas `licao`, e por fim `pronto` ou `erro`.
- O evento `pronto` traz a `PropostaPlano` completa, que já existe, com o `token` usado em `POST /api/aprendizado/planos`. O aceite não muda.
- A resposta não guarda nada no banco até o aceite. Se a pessoa cancelar, o servidor interrompe a geração.

Os tipos ficam em `packages/contratos/src/aprendizado.ts`: `EventoGeracao`, `interpretarEventoGeracao` e `LIMITES_GERACAO`.

## Como a API entrega

- `fluxo` e `licao` em `EventoGeracao` são índices a partir de 0. `licao` é a posição dentro do fluxo.
- Os eventos vão numa linha cada, com `Cache-Control: no-store`. A geração só avança quando o cliente lê, e para quando a conexão cai ou o pedido é cancelado.
- Um problema depois do início vira o evento `erro` (`falha` ou `ia_indisponivel`) e a resposta termina. Um erro antes do início continua em JSON.
- O token do `pronto` é assinado, vale por 30 minutos e é ligado à pessoa. Ele carrega o esqueleto do plano (títulos), então o servidor não guarda nada até o aceite. No aceite, o servidor pede ao gerador o conteúdo de cada lição e grava o plano com os mesmos fluxos e lições mostrados.
- `POST /api/aprendizado/propostas` (sem `ao-vivo`) segue devolvendo a proposta de uma vez, agora para qualquer objetivo. Os dois contam no mesmo teto de gerações.
- O objetivo tem de 3 a 500 caracteres (`LIMITES_GERACAO`), já sem espaços nas pontas.
- Passado o teto de gerações, a rota responde `429` em JSON com o código `limite_geracoes`, antes de abrir o fluxo. A tela deve ter uma mensagem para esse código.
- Nas lições de completar, a resposta não diferencia maiúsculas de minúsculas.

## IA

- `IA=falsa` (padrão, testes e CI): o adaptador falso emite os eventos com pequenas pausas, para a tela mostrar a geração ao vivo. Para SQL, devolve o plano de demonstração com as mesmas lições, reorganizado numa sequência única de aprendizado. Para qualquer outro objetivo, gera uma trilha genérica e determinística de 3 trechos com 3 lições cada, já na ordem de aprendizado e com uma revisão, com conteúdo e exercícios simulados.
- A IA real fica atrás da mesma interface e entra depois que o dono escolher o provedor (D5). Nenhum teste chama a IA real.
- O limite de gerações por pessoa é provisório e configurável por variável (`STUDOO_LIMITE_GERACOES`, `STUDOO_JANELA_GERACOES_MIN`; veja [Rodar localmente](../RODAR-LOCALMENTE.md#ia-falsa-e-teto-de-gerações)). O teto definitivo segue aberto em D7.
- A pausa do adaptador falso vem de `STUDOO_IA_FALSA_PAUSA_MS` (padrão 450 ms; 0 nos testes).

## Critérios de aceite

1. Com `IA=falsa`, um objetivo qualquer ("Frações") gera uma trilha. Na tela, o título e os nós aparecem em sequência, não de uma só vez, num caminho único, sem grupos por assunto.
2. O objetivo de SQL continua gerando o plano de demonstração, e o percurso de `tests/marco-local.test.mjs` continua passando.
3. A rota responde em NDJSON válido e cada linha passa por `interpretarEventoGeracao`. Os erros antes do início seguem o JSON de erro atual.
4. Cancelar no meio não cria plano. Aceitar no final cria o plano com as mesmas lições, na mesma ordem mostrada.
5. A trilha funciona com teclado, leitor de tela (cada nó tem nome acessível com o estado) e `prefers-reduced-motion` (sem animação, com a mesma informação).
6. A tela segue as faixas responsivas do `DESIGN.md §11`, do celular de 360 px à tela larga.
7. `npm run typecheck` passa na raiz e em `apps/mobile`.
