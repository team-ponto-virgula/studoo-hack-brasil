# Parecer independente de Engenharia e QA — abertura da marca

23/11/2026 · candidata final **048ae11** · revisor `checks_release` · [método de avaliação](METODO-AVALIACAO.md).

**C7 e C8 da web: 9,5 no escopo especializado verificado. C10 completo: sem nota (`null`).** A assinatura do app foi observada na prévia React Native Web, mas sua entrega ao caminho normal continua pendente: o destino exibido é a tela de indisponibilidade de API/armazenamento. Nenhuma nota da prévia é transferida a iOS/Android; a entrega multiplataforma permanece **Provisória**, com nota completa `null`.

## Evidência usada

- [Web, 25 casos de browser](evidencias/intro-2026-11-23/browser-web.json): Next em produção local, Chromium headless. Inclui geometria, prontidão sem mínimo, teto, interação, foco, redução de movimento, segundo plano simulado, sem JS, bypass, falhas e independência da API; o caso final confirma preservação da consulta no redirecionamento de `/` para login.
- [Reprodução independente, 8 verificações](evidencias/intro-2026-11-23/qa-independente-web.json): seis contextos novos com relógio real, bypass por consulta sem JS, rota direta sem JS, hash com bundles bloqueados, falhas de fonte/imagem, movimento reduzido antes da hidratação e captura de erros JavaScript não tratados. Todas passaram; nenhum erro JavaScript não tratado foi observado nesses casos. A execução foi em f0c2b6d: renderizador web, CSS e layout são idênticos byte a byte em 048ae11, com hashes registrados. O delta do proxy tem prova própria nos checks e nos 25 casos finais.
- [Prévia do app, 10 casos](evidencias/intro-2026-11-23/browser-app-preview.json): Expo dev/React Native Web; dimensões, limite com relógio controlado, dispensa por toque/teclas, foco, movimento reduzido, consulta e gravação. Isso não comprova boot ou integração nativos, nem acesso normal ao estudo.
- [Movimento independente da prévia, 5 casos](evidencias/intro-2026-11-23/browser-app-motion-independent.json): contexto novo e duas recargas, prontidão estimada por assets/frames, retorno por consulta no mesmo documento e interrupção por visibilidade simulada. Candidata 048ae11, relógio real em Expo dev. Os três ciclos visíveis medidos foram **231,9, 181,6 e 211,4 ms**; o boot frio até remoção levou cerca de 1748 ms incluindo entrega/inicialização do bundle dev. Essas duas medidas não são intercambiáveis. O destino permanece a tela de indisponibilidade.
- [Checks repetidos em 048ae11](evidencias/intro-2026-11-23/checks-048ae11.json): resultados, horários, hashes e caminhos dos logs sanitizados. Nenhum arquivo monitorado mudou durante a repetição.

Os JSONs de browser foram lidos junto dos scripts que produziram os resultados; os oito casos independentes foram executados por este revisor. As capturas de geometria seguram fontes/relógio para tornar o quadro reproduzível; não são medições de duração real. Não houve login em provedor OAuth real, uso de credenciais de produção, execução nativa ou estudo com pessoas nesta revisão.

## Checks e alcance da regressão

| Repetido na candidata final | Passaram | Falharam |
| --- | ---: | ---: |
| `test:estudio:interface` | 596 | 0 |
| `test:paridade` | 5 | 0 |
| `test:movimento` | 4 | 0 |
| `test:abertura` | 10 | 0 |

Sem cancelados, pulados ou TODO. Os dez casos dedicados de abertura também estão dentro de `estudio:interface`; as contagens não representam testes exclusivos somáveis. São nove cenários do controlador e um caso do proxy que preserva a consulta no redirecionamento.

As execuções anteriores de visitante (6), formatos (271) e domínio (18) continuam como evidência de regressão das regras não alteradas. Não foram executadas novamente após as correções da abertura. O typecheck web anterior passou; a compilação de produção final foi feita pelo responsável principal, separadamente. O componente, os layouts, o proxy e as dependências de splash mudaram desde a primeira rodada: a prova atual da abertura vem dos checks repetidos, do browser e da leitura desses arquivos, não da simples reutilização dos resultados antigos.

## Notas dos critérios atribuídos ao QA

| Critério | Web | Prévia do app | Fundamentação e limite |
| --- | ---: | ---: | --- |
| C7 · Resposta e espera | **9,5** | `null` | Web: pronto controlado inicia saída antes dos 320 ms; o limite foi conferido em 900 ms e a assinatura terminou com API ainda pendente. Na reprodução independente, seis ciclos visíveis mediram **291,5–437,8 ms**; da navegação à conclusão, **368,5–522,7 ms**, todos abaixo do teto. Contextos novos não limpam caches de SO/servidor; amostra local sem throttle não é p95 de produção. No app, há agora prova de dispensa/timeout e três ciclos reais curtos da assinatura; a prontidão React é estimada externamente e o destino normal até a entrada não foi validado. Não usar esse resultado parcial como nota do caminho normal do app. |
| C8 · Feedback, erros e recuperação | **9,5** | `null` | Web: fonte/imagem abortadas encerraram com motivo `falha` e formulário seguinte visível, inclusive na reprodução independente. Sem JS, CSS libera a página; consulta/rota direta fazem bypass no SSR e hash não depende do bundle da aplicação. Interação dispensa a marca sem iniciar áudio ou acionar conteúdo ainda encoberto; ação já visível durante a saída funciona no primeiro clique. A nota cobre a assinatura e suas saídas, não recuperação de conta ou disponibilidade de servidor. No app, só algumas dispenses e a tela de erro foram executadas; não há prova equivalente de todos os casos de falha do renderizador. |
| C10 · Paridade e integração | **`null`** | **`null`** | Geometria aprovada: pares em 390×844 e 360×800 têm marca de 180×59,140625, centrada nas mesmas coordenadas; 390×667 também coincide. Asset e contrato são compartilhados. Dispensas, AX decorativa vazia no root e ciclos reais da assinatura da prévia somam prova positiva. Mantenho o critério comparativo completo sem nota por faltar equivalência executada da prontidão/destino normal da prévia; não o reduzir após conhecer as evidências. A ausência nativa é pendência própria, não motivo para rebaixar as notas comprovadas da web. |

As notas 9,5 são pareceres especializados da web no ambiente identificado, com duas fontes de execução independentes. Não são nota global da intro nem comprovação universal de UX. Não atribuo 10: não há caracterização de desempenho sob carga/CPU limitada, outros navegadores ou produção; ampliar o escopo exigiria novas evidências. iOS e Android permanecem **`null` em todos os critérios desta revisão**.

## Gates e achados

| Gate | Web no escopo da assinatura | Prévia/app nativo |
| --- | --- | --- |
| G1 · Acesso | Aprovado: assinatura chega ao formulário e não impede a tela seguinte nos casos verificados. Não é validação de login real. | Caminho normal da prévia pendente; nativo pendente. A tela de erro não é substituída por shim para simular sucesso. |
| G2 · Movimento | Aprovado nos casos de redução, troca de preferência e evento de visibilidade simulado. | Redução/dispensa, três ciclos reais e interrupção/retorno sintético sem repetição observados na prévia; integração nativa pendente. |
| G3 · Latência | Aprovado no cenário local medido e nos casos com relógio controlado, distinguindo as duas origens. | Prévia removida após avanço controlado de 932 ms totais do roteiro: prova remoção nesse ponto, não medição exata de 900 ms nem boot real. Nativo pendente. |
| G4 · Foco/acesso assistivo | Tab, Escape, conteúdo oculto e texto ampliado têm evidência positiva; o fechamento integral cabe ao parecer de fluxo/acessibilidade. | Foco da prévia chegou a “Tentar novamente”, não à entrada normal. VoiceOver/TalkBack reais pendentes. |
| G5 · Erros/integridade | Aprovado para os casos de falha/saída executados; zero erros JS não tratados na reprodução independente. | Dispensas controladas funcionaram; recuperação completa e execução nativa pendentes. |
| G6 · Paridade | Geometria e contrato aprovados como subverificações; gate completo pendente. | Destino normal/ready equivalentes e integração nativa não comprovados. |

Os três achados da rodada anterior foram tratados:

1. Guarda nativa de 1400 ms passou a usar os **900 ms do contrato**. Confirmado no código; não confundir com medição do splash em aparelho.
2. Falha de fonte agora é sinal próprio no app e é detectada na web. O browser independente confirmou motivo `falha` na web; a ligação nativa está corrigida por leitura, sem prova em dispositivo.
3. Consulta/rota elegível é decidida no SSR pelo proxy, com cabeçalhos internos sobrescritos pelo servidor; bootstrap com nonce cobre hash/retorno na mesma aba. Query sem JS e hash com bundles bloqueados passaram também na reprodução independente. O delta final preserva a consulta ao redirecionar `/` para `/login`, confirmado pelo novo teste e pelo caso 25 do browser.

Não reproduzi novo defeito da assinatura nos casos web executados. As lacunas de prévia/nativo permanecem lacunas explícitas, sem desconto arbitrário nem nota fabricada. Este parecer permite consolidar os critérios comprovados da web e concluir a implementação com seus limites registrados; não aprova produção nem fecha a nota completa multiplataforma.
