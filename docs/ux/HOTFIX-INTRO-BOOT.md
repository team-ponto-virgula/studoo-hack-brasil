# Hotfix v3 — assinatura ausente no cold start

24/11/2026 · relato do dono após instalar o build 0.1.0 (6): a animação não aparecia ao abrir o app. Esta correção mantém a direção Óculos em foco, a geometria de 210×69 e o ritmo de 880 ms + dissolve de 160 ms. Não altera telas de estudo, dados ou APIs.

## Causas identificadas por código e reprodução de bancada

1. `useMovimentoReduzido` é um hook de suspensão decorativa: retorna `true` quando o app não está ativo. O estado inicial iOS `inactive`/null era tratado como uma escolha de acessibilidade e dispensava a intro antes do primeiro `active`.
2. A prontidão dos recursos, com preferência ainda `null`, chamava `pronto(false)`. A conclusão era irreversível mesmo quando a consulta nativa respondia `false` logo depois.
3. O teto de 1.400 ms era contado desde a importação. Depois de reservar 680 ms mínimos de movimento, 160 ms de dissolve e 48 ms de margem, restavam só 512 ms para importação/montagem, imagens, splash e frames. Inicialização mais demorada dispensava o movimento.

## Contrato corrigido

- Um hook separado lê a preferência real. O hook decorativo continua pausando as demais animações em segundo plano.
- Antes do primeiro `active`, `inactive`/`unknown`/null aguardam; background ou saída de foreground depois da ativação dispensam. Reduzir Movimento e leitor de tela confirmados como `true` continuam dispensando.
- A sequência só começa com app ativo, layout e imagens prontos, splash liberado e ambas as consultas de acessibilidade confirmadas como `false`. Estado desconhecido não é permissão nem dispensa antecipada por ready.
- A preparação React tem guarda de 2.000 ms, sem API. A launch screen tem proteção independente de 5.000 ms desde a importação, caso a raiz falhe.
- O orçamento visual de 1.400 ms começa uma única vez no primeiro instante elegível. Ready/re-render não o renovam. O ritmo e a curva da coreografia permanecem iguais.
- Toque, voltar, falha, links/callbacks, preferência verdadeira e retorno do app preservam suas dispensas. A assinatura continua uma vez por processo e exclusiva mobile.

## Evidência e limites

Na candidata, tipos web/mobile, interface **622/622**, movimento **6/6**, paridade **5/5**, visitante **6/6**, formatos **271/271** e domínio **18/18** passaram. Os **15 testes do componente** e **21 de contrato** já integram a interface. O mesmo teste de componente sobre a fonte antiga `e5bb84c` reproduz **5 falhas em 15**; na fonte corrigida, os 15 passam. [Hashes e comandos](evidencias/hotfix-intro-boot-2026-11-24/checks.json).

Os testes de contrato e do store exercitam os estados iniciais, preferência pendente/verdadeira, contexto e janela visual sem relógio real. O roteiro de componente usa o TSX real com mocks das APIs nativas e identifica essa origem. Tipos, interface e exportação têm resultados próprios na entrega.

Esta máquina não executou o app em iPhone/Android. Reprodução com mocks, export Hermes, auditoria de IPA e disponibilidade no TestFlight não são uma gravação instalada da passagem launch screen → React. A validação nativa e as notas completas continuam `null` até essa prova. Os resultados v2 foram preservados como históricos.

## Distribuição confirmada

O hotfix v3 da fonte `0a96649e44c56feefa92a59daec950d4484756f0` está disponível como **Studoo 0.1.0 (7)** no **Studoo Beta Interno**. `VALID` + `IN_BETA_TESTING` foram confirmados às 20:32 UTC de 24/11, com leitura independente às 20:33 UTC. [Registro do build, auditoria, checksums e ativação](../beta/BUILD-7-INTRO-BOOT.md).

Atualizar pelo TestFlight para o build 7, fechar totalmente e reabrir permite conferir a correção. A distribuição não equivale a execução física nesta máquina e não altera as notas nativas `null`.
