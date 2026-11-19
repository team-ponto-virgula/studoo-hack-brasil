# Trilha gerada ao vivo

**Estado:** aprovada para implementação (12/11/2026). Foco do Hack Brasil: a interface e a experiência da trilha.

## Problema

Hoje o Studoo aceita apenas objetivos de SQL e devolve uma proposta pronta, de uma só vez. A pessoa espera sem ver nada e não pode estudar outro assunto. Queremos uma trilha no estilo do Duolingo: a pessoa escreve o que quer aprender e vê a trilha se formar na tela, nó por nó, enquanto a IA a gera.

## Experiência

1. **Pedido.** Um campo grande, com o Stu, pergunta "O que você quer aprender?". Há sugestões tocáveis, como "SQL para a prova", "Frações" e "Inglês para entrevista". O botão **Gerar trilha** só fica ativo com o texto preenchido.
2. **Geração ao vivo.** A tela troca para a trilha vazia. O título do plano aparece primeiro e, em seguida, cada lição como um nó do caminho, à medida que os eventos chegam. O Stu indica que está montando a trilha. A pessoa pode cancelar.
3. **Aceite.** Ao terminar, a trilha completa fica na tela, com **Começar** e **Ajustar pedido**. Tocar numa lição da prévia abre um balão que diz o que ela ensina (o `resumo` que o evento da lição traz: o objetivo, nas trilhas prontas, ou uma frase escrita pela IA) e que ela abre quando a pessoa começar a trilha; no app, o resumo aparece embaixo do nome de cada lição. O resumo vai também na proposta e sai dela se a trilha ficar grande demais para o comprovante. A trilha só entra na área de estudo quando a pessoa aceita, como já acontece hoje.
4. **Trilha.** É um caminho único e contínuo, do primeiro ao último nó, com nós que alternam de lado. A trilha **não agrupa lições por assunto**: não há cartões nem cabeçalhos como "Consultas" ou "Junções". A faixa do topo mostra o título do plano e o progresso total. Entre um trecho e outro do caminho aparece só um marco discreto, sem nome de assunto. O nó atual se destaca com movimento suave e o rótulo **Começar**. As lições concluídas mostram que estão feitas. Um nó futuro, quando tocado, explica o que falta para liberá-lo. Ao concluir uma lição, o nó seguinte é liberado com uma animação curta.
5. **Lição.** Mantém a aula por etapas da [spec 02](02-aula-web.md). O conteúdo de uma lição gerada pode ser criado na primeira vez que ela é aberta. Enquanto isso, a tela mostra um estado de carregamento próprio.

## A tela acompanha a geração (lote 2 do dono, 19/11; web e app)

Palavras do dono: "quando for gerando a trilha ter animações e a tela ir acompanhando até a última trilha". Ele gerou uma trilha no iPhone, e a tela ficou parada no alto enquanto as lições apareciam embaixo.

**Antes.** Na web e no app, a tela só puxava o nó novo para a vista quando a pessoa já estava vendo o último nó (na web, `scrollIntoView` com `block: 'nearest'`; no app, a mesma regra). Quem estava no alto, onde a tela abre, ficava parado ali. No aceite, uma tela à parte ("Escrevendo suas lições") ficava de 12 a 22 s na frente da trilha, com a IA real, e a primeira lição abria sozinha.

**Agora**, igual nas duas plataformas (os números ficam em `ACOMPANHAR_GERACAO`, em `packages/contratos/src/acompanhar.ts`):

1. **Acompanhar.** Enquanto os nós chegam, a tela rola suave para o nó mais novo ficar à vista com o nome: o centro dele (lente e nome) fica a 58% da parte visível, um pouco abaixo do meio, e o fim do nome fica pelo menos 24 acima do rodapé ou da barra. Segue assim até o último nó; quando a proposta termina, a chegada (o troféu) entra junto com o último nó.
2. **A pessoa manda.** Se a pessoa rolar ou tocar no mapa durante a geração ou o aceite, o acompanhamento para na hora (a rolagem da própria tela é cancelada). Aparece um botão pequeno, "Acompanhar", centrado logo acima do rodapé, que volta a seguir e leva ao nó mais novo. A tela nunca briga com o dedo: a rolagem que a tela começa é marcada (até onde e até quando), e qualquer outra é da pessoa.
3. **Cada nó novo.** O trecho do caminho até ele se desenha (240 ms), o nó entra (a mola de sempre, 320 ms depois do desenho) e o nome aparece por último (200 ms depois). O Stu sai do alto (fica só o balão com as dicas) e vai para perto do nó mais novo. Nós que chegam juntos entram em fila, um a cada 450 ms, para dar para ver a sequência.
4. **Aceite.** O aceite é um pedido só: o servidor não avisa lição por lição. Por isso o estado é o honesto, sem barra de progresso inventada: todos os nós mostram um lápis que balança ("escrevendo"; o leitor de tela ouve "<lição>, sendo escrita"), o rodapé diz "Escrevendo suas lições", e a tela passeia pela trilha, um nó a cada 1,6 s, até o último. Se um dia o servidor mandar o andamento por lição, cada lápis vira visto quando a lição dele terminar, com o mesmo acompanhamento.
5. **Fim.** Com as lições prontas, o lápis de cada nó vira o visto verde (em sequência), o rodapé diz "Lições prontas!" por 1,4 s e a tela volta devagar (1,1 s) até a primeira lição. Então abre o mapa da trilha salva, com a primeira lição atual e o "Começar": a pessoa abre a lição quando quiser. Se ela assumiu a rolagem, a tela não volta sozinha: o mapa abre direto.
6. **Movimento reduzido.** Sem animação e sem rolagem suave: os nós aparecem prontos, o rodapé mostra o texto fixo "N lições até agora" (no aceite, "Escrevendo suas lições"), e a tela só se posiciona no fim (no último nó, quando a proposta termina; na primeira lição, depois do aceite).
7. **Leitor de tela.** O progresso é anunciado de vez em quando, a cada três nós ("6 lições até agora"), e no começo e no fim do aceite. O foco não sai de onde a pessoa está.
8. **No aparelho.** As animações dos nós, do trecho, do lápis e do visto usam o driver nativo; seguir os nós e o passeio usam a rolagem suave do próprio sistema. Só a volta devagar ao começo é desenhada quadro a quadro (1,1 s, sem mais nada acontecendo na tela).

| Constante | Valor | Para quê |
|---|---|---|
| `intervaloEntreNosMs` | 450 | fila dos nós que chegam juntos |
| `posicaoDoNo` | 0,58 | onde fica o centro do nó mais novo na parte visível |
| `folgaDoRodape` | 24 | do fim do nome até o rodapé ou a barra |
| `rolagemMs` | 520 | rolagem suave até o nó (na web; no app, a do sistema) |
| `desenhoMs`, `entradaMs`, `nomeAtrasoMs` | 240, 320, 200 | trecho, nó e nome do nó novo |
| `stuMs` | 420 | o Stu indo para perto do nó mais novo |
| `passeioPorNoMs` | 1600 | passeio pela trilha no aceite |
| `escrevendoCicloMs` | 900 | ida e volta do lápis |
| `prontaMs`, `voltaMs` | 1400, 1100 | "Lições prontas!" e a volta devagar à primeira lição |
| `anunciarACada` | 3 | anúncio do progresso ao leitor de tela |

Feito no app; a web vem pelo Studoo Web & API, com as mesmas constantes. Com a IA real, quem confere é o dono, no aparelho.

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
- As regras de ordenação da seção anterior ficam registradas em `src/servidor/ia/ordem.ts` (`REGRAS_ORDEM_DA_TRILHA`, `instrucoesDeOrdem`) e entram no prompt de sistema dos adaptadores reais (OpenAI e DeepSeek).
- `IA=openai` (D5: OpenAI, pela Responses API): o adaptador `src/servidor/ia/openai.ts` fica atrás da mesma interface. A estrutura vem por streaming, uma linha JSON por evento, e cada linha completa vira um evento na hora; o servidor calcula os índices e só emite um trecho junto com a primeira lição dele, então nunca há trecho vazio. O conteúdo de cada lição é pedido no aceite, com Structured Outputs (JSON Schema estrito), e passa pela mesma validação da IA falsa, com uma segunda tentativa se vier fora do formato. Sem chave, ou se a OpenAI falhar antes do primeiro evento, a IA falsa entra de reserva (`STUDOO_IA_RESERVA`). Configuração em [Rodar localmente](../RODAR-LOCALMENTE.md#ia-da-openai).
- `IA=deepseek` (DeepSeek, via `POST /chat/completions`): o adaptador `src/servidor/ia/deepseek.ts` implementa a mesma interface `GeradorTrilha`, com streaming SSE (`data: [DONE]`) na estrutura e `response_format: { type: "json_object" }` com exemplo JSON no prompt nas lições (1 tentativa extra se vier vazio ou JSON inválido), `thinking: { type: "disabled" }` por padrão, origem `"IA da DeepSeek (<modelo>)"` e gerador `"deepseek-v1"`. Sem chave ou em falha antes do primeiro evento, vale `STUDOO_IA_RESERVA`. Configuração em [Rodar localmente](../RODAR-LOCALMENTE.md#ia-da-deepseek).
- Com a IA real, o aceite leva alguns segundos: as lições são escritas em paralelo, com até 75 s no servidor, e o app espera até 90 s por esse pedido. Enquanto isso, a tela mostra as lições sendo escritas ([spec 04](04-experiencia-ilustrada.md)). Um segundo aceite da mesma proposta, enquanto o primeiro corre, espera o mesmo resultado, sem pedir as lições de novo ao provedor.
- Nenhum teste chama a IA real: `npm run test:ia` usa servidores locais que imitam a Responses API da OpenAI e a Chat Completions da DeepSeek.
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
