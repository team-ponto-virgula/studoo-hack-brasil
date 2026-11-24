# Intro mobile — Óculos em foco, ritmo suave

Atualização de **24/11/2026**, após o pedido do dono: “mais suave e pouco menos rápido”. A assinatura é exclusiva de iOS/Android. O site abre diretamente; React Native Web continua sendo prévia complementar.

**Estado de validação nativa: Provisório; notas `null`.** O refinamento não herda a aprovação, os tempos ou as capturas do ritmo anterior. Os dez critérios, pesos e meta 9,5 permanecem no [método](METODO-AVALIACAO.md).

## Contrato atual — v3, correção do boot

- Marca original de **210 × 69** sobre branco, igual na launch screen estática e nos quadros de repouso. Geometria e assets preservados.
- Movimento padrão de **880 ms**, dissolve de **160 ms**: **1.040 ms nominais**, com recursos prontos e orçamento suficiente.
- Entrada alongada até o marco 0,26 (229 ms nominais), curva simétrica `0.42, 0, 0.58, 1`, inclinação menor: −5° e +2°. O reflexo permanece dentro das lentes.
- Antes de mover, escolher `min(880, restante − 160 − 48)` na faixa **680–880 ms**. Se faltar o mínimo, dispensar com o PNG inteiro. A duração escolhida não muda durante o gesto.
- Prazo visual de **1.400 ms**, iniciado uma única vez depois do primeiro `active`, layout/imagens prontos, splash liberado e respostas reais de movimento reduzido/leitor de tela confirmadas como `false`. Preparação da camada React limitada a **2.000 ms**; a launch screen mantém uma guarda independente de **5.000 ms** desde a importação, para falha anterior à raiz. Ready/re-render não reiniciam o prazo visual.
- Um único timing com driver nativo. O retorno do bitmap integral acompanha o penúltimo marco do contrato, sem número duplicado no componente.
- Preferência/leitor pendentes mantêm a marca estática dentro da guarda de preparação; ready não transforma `null` em dispensa. `inactive`/`unknown`/null no boot aguardam o primeiro `active`. Movimento reduzido verdadeiro, leitor, toque, voltar, falha, background e saída de foreground após ativação continuam dispensando. A sessão monta em paralelo; nenhuma API condiciona a abertura.

Fonte: [contrato JSON](../../packages/contratos/src/abertura-motion.json), [controle](../../packages/contratos/src/abertura.ts) e [componente mobile](../../apps/mobile/src/abertura.tsx).

## Verificações históricas do ritmo suave v2

Estes resultados são anteriores ao hotfix de cold start e não o aprovam. Interface **604/604**, incluindo **18/18 de abertura**; paridade **5/5**, movimento **4/4** e typechecks web/mobile passaram. Os 18 casos já integram os 604. Os checks conferem orçamento, latch, prazo compartilhado, curva, dispensas e regressões; não medem fluidez em aparelho. [Relatório](evidencias/oculos-em-foco-suave-2026-11-24/checks.json).

A prévia complementar RNWeb passou **10/10 de interface e 5/5 de movimento**; capas observadas de 1.071–1.120 ms e dissolves de 153–159 ms. Os repousos são idênticos pixel a pixel (bounding box da diferença `null` significa ausência de diferença). O export Hermes iOS em produção com ambiente do perfil TestFlight passou. São resultados **anteriores ao novo piloto de UI**, identificados em [manifesto](evidencias/oculos-em-foco-suave-2026-11-24/manifesto.json).

O [estudo de movimento](MOTION-OCULOS.md) usa os tempos atuais sem pausa extra de leitura. É filme Python, não gravação nativa. Nenhum resultado anterior é reapresentado como execução deste ajuste.

## Relato do build 6 e correção em andamento

O dono relatou que a animação não aparece ao abrir o app no build instalado. A auditoria encontrou dispensas prematuras no boot: estado inicial inactive/null era convertido em movimento reduzido; ready com preferência desconhecida encerrava o controlador; a importação consumia o orçamento visual antes do primeiro frame elegível. O [hotfix v3](HOTFIX-INTRO-BOOT.md) separa esses estados e preserva a assinatura suave. A nova compilação e a validação instalada precisam de registro próprio; ativação interna do build 6 não prova que o motion foi visto.

## Distribuição e histórico

O PR #92 foi integrado à release em `4523a2e`. O build **0.1.0 (5)** com o ritmo anterior compilou e passou no auditor do IPA, mas sua submissão EAS `a35b0260-5607-45b7-963d-f145f816df91` foi **cancelada enquanto ainda estava IN_QUEUE**, após o pedido de suavização. Não foi associado a grupo de teste e não é apresentado como a versão suave.

O **build 0.1.0 (6)** reúne o ritmo suave e o piloto Clareza e está disponível no **Studoo Beta Interno**, com `VALID` + `IN_BETA_TESTING` confirmados em 24/11, 19:25 UTC, e leitura independente às 19:26 UTC. A intro já está ativa sem flag remota. Atualizar pelo TestFlight, fechar totalmente o app e reabrir permite conferir a assinatura, que aparece uma vez por processo. [Fonte, proveniência, auditoria e ativação](../beta/BUILD-6-INTRO-CLAREZA.md) têm identificação própria; a distribuição não substitui a conferência instalada.

- [Resultado completo do ritmo anterior](RESULTADO-INTRO-RAPIDA-2026-11-24.md), com seus próprios checks e mídias.
- [Primeira rodada de intro](RESULTADO-INTRO-2026-11-23.md).
- [Referências do novo Stu caderno](REFERENCIAS-DO-STU.md), preservadas para a repaginação.

## Reabrir a prévia

Na raiz: `QA_APP_PORT=8090 node scripts/qa/iniciar-previa-app.mjs`. Confirmar a porta livre e o contrato atual antes de capturar. O wrapper é somente de QA; não acrescentar web às plataformas publicadas do app. [Roteiro](../../scripts/qa/ABERTURA.md).

A passagem launch screen → React, o caminho normal, VoiceOver/TalkBack e a fluidez em iPhone/Android ainda exigem o build instalado e uma gravação identificada. Upload, exportação e auditoria de pacote não substituem essa prova.
