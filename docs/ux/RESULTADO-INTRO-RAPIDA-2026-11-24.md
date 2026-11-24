# Intro mobile v2 — Óculos em foco

Brief atualizado em **24/11/2026, antes da avaliação da v2**. O dono pediu movimento com participação dos óculos. A assinatura continua exclusiva dos apps **iOS e Android**; o site não recebe intro. React Native Web é prévia complementar do app.

**Estado da v2: Provisório; notas mobile `null`.** Ainda não há gravação nativa desta versão. Este registro define o que será avaliado; não declara que a integração, os checks, o filme ou a prévia v2 já foram aprovados. Os pesos do método e a meta mínima de **9,5** continuam iguais.

## Mudança de brief

O contrato visual é [`abertura-motion.json`, versão 2](../../packages/contratos/src/abertura-motion.json), direção **“Óculos em foco”**, com o ciclo em [`abertura.ts`](../../packages/contratos/src/abertura.ts).

- **Marca de 210 × 69 sobre branco.** A launch screen do sistema fica estática, igual aos quadros inicial e final da marca React.
- **Coreografia de até 560 ms no caminho com movimento permitido confirmado.** Antes do início, a duração é escolhida uma vez por `min(560, restante − 120 − 32)`, na faixa **360–560 ms**, conservando forma e marcos. Se não couberem 360 ms, dispensa por limite com PNG integral, antes do movimento; não começa uma coreografia incompleta. Os óculos se destacam, ampliam, fazem o gesto de foco/reflexo e retornam; palavra e sorriso se recolhem e recompõem a marca. Os marcos e transformações vêm do JSON.
- **Dissolve de 120 ms após duas condições:** sequência concluída e fontes/imagem/primeiro frame locais prontos, em qualquer ordem. Com recursos prontos e orçamento suficiente, a duração nominal padrão é **680 ms**; a compressão preserva os 120 ms de dissolve e reserva 32 ms para a passagem de frames, sem ampliar o deadline.
- **Deadline absoluto único: início do módulo JS + 900 ms.** Splash nativo e controlador React compartilham o prazo; a montagem recebe apenas o tempo restante, sem outros 900 ms. Não reinicia por ready, re-render ou saída, e pode cortar sequência/dissolve tardios. Boot anterior ao módulo é registrado separadamente.
- **Preferência pendente (`null`): PNG estático, sem coreografia.** Não é dispensa imediata apenas por estar pendente. Se os recursos locais ficarem prontos antes da resposta, `pronto(false)` encerra sem aguardar 560 ms; se continuarem pendentes, vale o mesmo deadline absoluto. Falha de consulta usa fallback reduzido e encerra.
- **Dispensas imediatas:** movimento reduzido conhecido, tecnologia assistiva, interação, falha, contexto/segundo plano e retornos não aguardam os 560 ms. Callback/link direto preserva o destino. Nenhuma API faz parte da saída; a abertura não se repete em rota ou foreground.

Esse pedido **substitui explicitamente a regra da v1 de “sem exposição mínima”** no caminho com movimento permitido confirmado. Nesse caminho, ready sozinho não antecipa a duração escolhida da coreografia depois de iniciada, e fim da sequência sozinho não ignora os recursos. Com preferência ainda pendente, ready encerra o PNG estático sem coreografia. A mudança foi registrada antes de pontuar; não é alteração de pesos ou redução da meta.

**Precisão de implementação em 24/11:** a revisão identificou que duas contagens independentes de 900 ms — módulo e montagem — poderiam estender o prazo. O contrato correto é um deadline absoluto compartilhado, passando somente o restante ao controlador. Também se distinguiu preferência pendente de movimento reduzido conhecido. Na rodada intermediária do prazo compartilhado, anterior ao timing único e à duração adaptativa, a execução independente às 15:45 UTC passou em 600/600 testes de interface e 14/14 de abertura, sem mudanças nos hashes durante a rodada; os 14 já integram os 600 e não são somados novamente. O [registro das rodadas](evidencias/oculos-em-foco-2026-11-24/checks.json) preserva a falha inicial de paleta. São provas automatizadas de código/controle, sem declarar integração ou gravação nativa validada.

**Refinamento de latência em 24/11:** uma medição exploratória do renderer, relatada pela coordenação, encontrou o dissolve cortado em 77 ms pelo cap no boot frio com a sequência inicial de 640 ms. O primeiro ajuste reduziu a sequência padrão para **560 ms**, nominal **680 ms**, sem mudar os marcos, a história, a curva ou o cap. Depois, o diagnóstico relatou somente 542 ms restantes no início frio; o contrato passou a escolher a duração antes do movimento, entre 360 e 560 ms, reservando dissolve e frames. Nesse exemplo, 390 + 120 deixam 32 ms de margem; se não couber o mínimo, dispensa antes de mover. Uma rodada intermediária natural 4/5 relatada pela coordenação não é aprovação e não é substituída por testes unitários. A candidata adaptativa requer sua própria conferência; nada disso comprova o nativo ou autoriza nota aprovada.

A execução também passou de uma sequência de timings para **um único timing com curva amostrada**, preservando forma e marcos e evitando callbacks JS entre os trechos. A mudança responde ao diagnóstico de boots sem a fase de saída; os novos testes e a rodada natural devem ser identificados pela candidata, sem reaproveitar aprovação intermediária.

**Checks da candidata adaptativa, 24/11 às 16:00 UTC:** a repetição independente passou em **603/603 de interface e 17/17 de abertura**, sem mudanças nos hashes durante a execução. Os 17 são subconjunto dos 603; as outras cinco suítes válidas não foram repetidas. O [registro de checks](evidencias/oculos-em-foco-2026-11-24/checks.json) preserva quatro rodadas, inclusive a falha inicial de paleta e a aprovação intermediária 600/14. Esses checks não substituem a rodada natural do renderer ou a gravação iOS/Android, e não atribuem nota nativa.

Os [óculos em alta resolução](../../apps/mobile/assets/marca/abertura-oculos-hd.png), derivados do ícone oficial de 1024 px, destinam-se a reduzir aliasing na ampliação de 2,15×. A marca completa original nos quadros de repouso continua em 210 px; o acabamento ainda depende da conferência do renderer.

## Evidências e seus nomes

A sequência de apresentação será **filme de conceito Python → prévia React Native Web → conferência nativa**. Cada artefato deve trazer versão/hash do contrato, candidata e origem; a lista não afirma que essas etapas já foram executadas.

| Evidência | O que permite conferir | Limite |
| --- | --- | --- |
| Filme de conceito gerado em Python | Direção visual e coreografia padrão de 560 ms a partir do JSON, com repouso didático de 500 ms. | Não executa o componente nem comprova timers, prontidão, foco ou integração. |
| Prévia do componente em React Native Web | Composição, estados e interações do código mobile no navegador. | É complementar; não valida launch screen, VoiceOver/TalkBack, boot ou desempenho do aparelho. |
| Gravação nativa identificada | Passagem launch screen → React, boot frio/quente, dispensas e destino no build/OS/dispositivo registrados. | Ainda pendente para a v2; não é substituída pelas duas mídias anteriores. |

**Nenhuma nota, captura ou contagem anterior aprova a v2.** Será preciso avaliar montagem tardia/deadline compartilhado, escolha adaptativa 360–560 ms e dispensa estática sem orçamento mínimo, recursos antes/depois da sequência, preferência pendente com e sem ready, sinais repetidos/tardios, dispensas, falhas, acessibilidade, retornos e não repetição, com resultados reais e gates por superfície.

O [método](METODO-AVALIACAO.md) e o [modelo de ficha](FICHA-AVALIACAO.modelo.json) mantêm dez critérios com pesos somando 100. iOS e Android são obrigatórios; RN Web é complementar; web é não aplicável a F01. Sem prova nativa, as notas desses alvos permanecem `null`, sem herdar 9,5 histórico.

## Histórico, sem aprovação automática da v2

- A implementação da intro web de 23/11 está arquivada no [resultado histórico](RESULTADO-INTRO-2026-11-23.md). Site sem intro continua sendo o escopo pedido; layout/proxy foram restaurados à base `281a3fe` na correção anterior.
- [GIF mobile anterior](evidencias/intro-mobile-2026-11-24/intro-mobile.gif), [MP4 anterior](evidencias/intro-mobile-2026-11-24/intro-mobile.mp4) e [metadados](evidencias/intro-mobile-2026-11-24/recorte.json) mostram a **v1**, com fontes atrasadas para revelar sua acomodação. Não mostram “Óculos em foco” nem são gravação nativa.
- Os [checks da correção anterior](evidencias/intro-mobile-2026-11-24/verificacoes.json) são históricos da v1. Seus resultados não comprovam a coreografia ou o ciclo novos.

O onboarding `Apresentacao` não faz parte desta mudança e recebe somente regressão adjacente. Não houve nesta atualização documental alteração de backend, contas, credenciais ou produção.

## Reabrir a prévia complementar

- Executar `QA_APP_PORT=8090 node scripts/qa/iniciar-previa-app.mjs`; confirmar candidata e versão do contrato antes de capturar. Não acrescentar web às plataformas publicadas do app.
- A integração da launch screen estática de 210 px exige um novo build mobile; Expo Go não comprova a tela de abertura nativa do Studoo.
- O site pode rodar na porta 3000 e deve abrir diretamente, sem assinatura.
- [Roteiros de QA existentes](../../scripts/qa/ABERTURA.md) precisam ser confrontados com o brief v2 antes de serem usados como aceite; passos antigos de liberação imediata por ready não aprovam este caminho novo.

## Mídia e execução desta candidata

A nova assinatura pode ser vista no [estudo em GIF](evidencias/oculos-em-foco-2026-11-24/oculos-em-foco.gif) ou no [MP4](evidencias/oculos-em-foco-2026-11-24/oculos-em-foco.mp4). O filme Python mostra o ritmo padrão e inclui 500 ms extras para apreciar a marca; não é captura nativa. [Direção, storyboard e renderização](MOTION-OCULOS.md).

Na prévia complementar do componente, o [roteiro de interface](evidencias/oculos-em-foco-2026-11-24/browser-app-preview.json) passou 10/10 na conferência anterior ao último ajuste exclusivamente de agendamento; a [rodada de movimento adaptativo](evidencias/oculos-em-foco-2026-11-24/browser-app-motion-independent.json) passou 5/5 na fonte final. O ciclo frio observado completou os estados em cerca de 577 ms de capa; recargas no contexto aquecido, 726/734 ms. São dados DOM do Expo DEV, não métricas de aparelho.

Duas tentativas de ritmo fixo que não completaram todos os estados na prévia foram preservadas: [tentativa concorrente 3/5](evidencias/oculos-em-foco-2026-11-24/browser-app-motion-tentativa-antes-driver-unico.json), [timing único fixo 4/5](evidencias/oculos-em-foco-2026-11-24/browser-app-motion-timing-fixo-tentativa.json). O [diagnóstico frio](evidencias/oculos-em-foco-2026-11-24/diagnostico-frio-timing-fixo.json) confirmou o término pelo prazo, e motivou escolher a duração antes de começar. Não houve aumento do cap nem relaxamento das assertivas.

[Parecer visual](PARECER-MOTION-OCULOS.md) e [parecer de fluxo](PARECER-FLUXO-OCULOS.md) identificam suas amostras e as limitações. As notas nativas permanecem `null` e a entrega completa continua Provisória.

O typecheck web e o export Hermes iOS foram repetidos na fonte final, após a adaptação, e passaram. O bundle exportado não é IPA nem execução nativa. O [manifesto da candidata](evidencias/oculos-em-foco-2026-11-24/manifesto.json) registra o commit de produto e hashes de fontes/mídias; as [capturas de repouso](evidencias/oculos-em-foco-2026-11-24/rnw-pixelcaps.json) confirmam igualdade pixel a pixel no renderer complementar.
