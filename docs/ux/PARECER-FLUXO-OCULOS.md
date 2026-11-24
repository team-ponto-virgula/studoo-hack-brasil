# Parecer independente — fluxo e ciclo de vida de “Óculos em foco”

Revisor: agente `revisao_cli`, sem autoria do controlador ou do componente. Revisão fechada em **24/11/2026, 15:45 UTC**, conforme o [método 1.2](METODO-AVALIACAO.md). Não reutilizei notas ou aprovação da v1.

**Estado:** favorável ao controlador e às correções examinadas; **entrega mobile Provisória, notas iOS/Android `null`**. Não foi executado um binário nativo desta v2 nesta revisão. A prévia React Native Web é complementar e seu destino de entrada completo continua sem validação.

## Candidata e escopo

A base do checkout era `8fa75505e71bbc63732db4dc745a59432dfb5782`, com a candidata v2 ainda não commitada. Os arquivos examinados ficam identificados pelos hashes abaixo, sem atribuir ao commit-base alterações posteriores:

| Arquivo | SHA-256 |
| --- | --- |
| `packages/contratos/src/abertura.ts` | `7791ba1ae599d1ca238e44b4cba84104fe1d1b5d17da79f1a755a401297c7620` |
| `packages/contratos/src/abertura-motion.json` | `1bdf6b883a830f00f7dd3b178cd15dec06c7f0a343cc2f4fb3f4811780cafb67` |
| `apps/mobile/src/abertura.tsx` | `d45aa1b53f4db6ae117443abfb4c20c483c33d4380e9872bf72b0765b5648ed4` |
| `tests/abertura.test.mjs` | `57c905e505d31fc99638dba2520aec8cf95186442ca7414472aca79204b0a671` |

O brief vigente autoriza coreografia mobile de **560 ms**, dissolve de **120 ms**, nominal de **680 ms**, com dispensa e deadline absoluto de **900 ms desde o início do módulo JS**. A exposição intencional substitui a regra da v1 de liberação imediata apenas por prontidão. O site não tem intro, por instrução do dono e exceção P33; não é superfície faltante de F01.

Examinei contrato, testes, componente, hook de movimento e integração no layout. Executei novamente os testes do controlador e um ensaio independente de eventos. Fiz uma reprodução de teclado/árvore de acessibilidade na prévia local. Não pontuo direção visual, acabamento do filme, desempenho nativo ou experiência de leitor de tela por essas provas.

## Três achados prioritários

1. **Latche de prontidão/coreografia — favorável no código e nos ensaios.** `pronto(true)` e `animacaoConcluida()` funcionam em qualquer ordem e não reiniciam sequência ou saída. `pronto(false)` dispensa mesmo durante o dissolve. Interrupção, fim e destruição impedem nova publicação por sinais tardios. No componente, callbacks capturam o controlador correspondente, verificam a flag de vida e `finished`; a limpeza invalida callbacks antes de parar as animações. A prontidão não é dependência do efeito da coreografia, e o grafo de interpolações é memorizado, evitando reinício por atualização de recursos. A análise de StrictMode é de código; não equivale a um ensaio nativo sob StrictMode.
2. **Dois relógios independentes — achado médio corrigido.** A versão intermediária agendava 900 ms para o splash desde o módulo e outros 900 ms para React ao montar; uma montagem tardia podia ganhar prazo extra. A candidata final usa `inicioDaAbertura`/`prazoDaAbertura` comuns e passa apenas o restante ao controlador. Montagem após o prazo já inicia concluída; zero, negativo, `NaN` e infinito dispensam sincronamente, e um parâmetro de 2000 não aumenta o máximo. O cap pode cortar uma sequência ou dissolve tardios, sem se reiniciar. Essa correção foi conferida por inspeção e testes; o gate de temporização iOS/Android continua pendente de medição própria.
3. **Dispensas e acesso assistivo — salvaguardas presentes, prova de plataforma incompleta.** Preferência `null` inicial mantém a marca estática e limitada; recursos prontos antes da resposta provocam `pronto(false)`. Falha da consulta assume redução; redução conhecida, leitor de tela conhecido/ativado, falha, contexto e interação dispensam. Durante a capa opaca, conteúdo e marca decorativa ficam fora da leitura/toque; na saída, controles revelados voltam a aceitar interação. Os filhos permanecem montados, restaurando sessão em paralelo. Esses caminhos não dependem de API. A árvore e o Tab foram observados no RN Web; VoiceOver, TalkBack, gesto de borda, BackHandler e a passagem real do splash do sistema ainda não foram executados nesta revisão.

Não identifiquei outro defeito médio/alto reproduzível no controlador dentro dos ensaios descritos. Isso não aprova estados nativos não observados.

## O que executei de fato

### CONTROLADOR-14

`npm run test:abertura`: **14/14 passaram** na candidata final. Incluem as duas ordens de sinais; nominal 560+120; dispensas antes/depois de ready; repetição; callbacks tardios; destruição; teto com sinais ausentes; corrida aos 899 ms; orçamento restante de 700; dispensa síncrona com prazo esgotado/inválido; e teto não ampliável por 2000.

### EVENTOS-30000 — ensaio independente

Executei **1000 sequências determinísticas de 30 eventos**, seed inicial `2400560`, usando o controlador real com agendador simulado. Orçamentos: `-20, 0, 1, 70, 700, 899, 900, 2000, NaN, Infinity`. Eventos: prontidão com/sem movimento, fim da animação, interação, preferência, destruição e avanço do relógio.

Para reproduzir a sequência: o gerador é `seed = (Math.imul(1664525, seed) + 1013904223) >>> 0`; os orçamentos percorrem a lista ciclicamente por cenário. Cada evento usa `random() % 7`, na ordem `pronto(true)`, `pronto(false)`, `animacaoConcluida()`, `pular('interacao')`, `pular('preferencia')`, `destruir()` e `avancar(random() % 180)`. O agendador ordena por instante e depois por ID de criação; após os 30 eventos, avança outros 2000 ms. Todas as asserções rodam a cada evento, sem temporizador real.

Passaram as propriedades verificadas: no máximo uma publicação de saída e uma de conclusão; nenhuma reabertura após conclusão; nenhuma publicação após destruir; nenhuma publicação além do orçamento normalizado; e nenhuma tarefa pendente após conclusão/destruição. O hash de `abertura.ts` permaneceu igual antes/depois do ensaio. É teste do controlador, sem medição de frames, bridge ou relógio nativo.

### PREVIA-AX-TAB-V2 — reprodução independente

Chromium headless em Linux, Expo dev local em `http://localhost:8090`, viewport **390×844**, relógio controlado e fontes retidas, sem alterar o código de produção. A árvore de acessibilidade do contêiner do app durante a capa era **vazia** (`""`), sem expor a imagem decorativa ou ações ocultas. O primeiro Tab retirou a capa e focou um **botão visível**, “Tentar novamente”.

O destino exibido foi:

> Aprenda qualquer coisa, um passo de cada vez. — O app precisa do endereço HTTPS do servidor do piloto. — Tentar novamente.

Isso comprova dispensa, semântica e acesso ao estado de recuperação **nessa prévia**. **Não comprova chegada à entrada funcional, autenticação, sessão ou operação com API configurada.** Não suprimi a proteção HTTPS, não injetei sessão e não fiz chamadas de login. Por esse limite concreto, não atribuo uma nota de fluxo completo à prévia.

### PRAZO-COMPARTILHADO — evidência complementar examinada

Examinei `/workspace/work/oculos-mobile/hd560/prova-prazo.json`: ensaio RN Web com fontes retidas e relógio controlado; métricas obtidas por injeção somente na cópia de teste do bundle, sem modificar a fonte de produção. A origem registrada foi 5 ms e a conclusão foi observada em 906 ms. A coordenação registrou a capa presente aos 899 ms e removida na amostragem aos 901 ms relativos à origem.

Essa janela de observação de 2 ms **não mede o instante exato da remoção** e não permite declarar temporização nativa ou precisão física de 900 ms. Os testes puros sustentam o deadline lógico; um novo binário precisa fornecer a prova de execução real. A gravação anterior do renderer e sua contagem “5/5” não são reaproveitadas aqui como validação da origem de deadline corrigida.

## Gates, notas e limites

| Superfície | Resultado deste parecer |
| --- | --- |
| `ios_nativo` | G1–G6 **pendentes**, notas **`null`**: sem execução identificada da v2 neste parecer. |
| `android_nativo` | G1–G6 **pendentes**, notas **`null`**: sem execução identificada da v2 neste parecer. |
| `app_previa_web` | Evidência parcial favorável ao controlador, dispensa e AX/Tab. **G1 pendente** para chegada à entrada funcional; não há nota de fluxo completo. Não substitui os gates nativos. |
| `web` | **Não aplicável** à assinatura mobile pedida. Nenhuma nota histórica da intro web entra na v2. |

C1/C2/C6/C9 recebem somente as observações qualitativas acima; suas **notas nativas permanecem `null`**. Não transformo teste verde, filme de conceito ou inspeção de código em nota 9,5. O controlador não grava progresso, preferência de onboarding ou credenciais; não observei a continuidade real de uma conta em aparelho.

Próxima prova necessária: build nativo identificado, vídeo da passagem launch screen → primeiro quadro React → coreografia → tela de destino, com a origem JS e o prazo; dispensas em vários marcos; leitor de tela real; retorno de contexto/callback e ausência de repetição. A latência anterior do sistema deve ficar separada. Não iniciar repaginação das demais jornadas como parte desta revisão.

**Conclusão:** as correções de latche e deadline estão sustentadas no código e no controlador ensaiado. A entrega mobile permanece **Provisória**, com prova nativa e destino funcional da prévia pendentes. **Validação empírica com pessoas não realizada.**


Nota da coordenação após o parecer: a coreografia passou a usar um timing único e a escolher o ritmo no início (360–560 ms), sem mudar o controlador de prontidão/dispensa/deadline examinado. A função adicional tem testes de monotonicidade/marcos e de orçamento. As novas execuções e seus hashes constam do registro de checks; esta nota não atribui uma revisão nativa ou numérica ao autor do parecer.
