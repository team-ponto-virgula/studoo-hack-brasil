# Parecer independente — visual e movimento da abertura

Revisor: agente `revisao_ios`, sem autoria do renderizador. Escopo: **assinatura de abertura**, C3/C4/C5 e comparação visual entre web e prévia React Native Web. Referência: [método de avaliação](METODO-AVALIACAO.md). Revisão fechada em **23/11/2026, 20:46 UTC**; validação empírica com pessoas não realizada.

**Candidata final:** `048ae114622c73bd1ea138c597efc528cfac11c8`. As imagens e os vídeos compartilhados foram inicialmente coletados em `f0c2b6d`; as correções seguintes `2e18c38` (semântica decorativa da prévia) e `048ae11` (bypass na passagem para login) não alteram a composição visual. A medição incremental independente abaixo executou a candidata final. A configuração temporária local que habilita Expo Web não integra a configuração publicada do app.

## Até três achados prioritários

1. **Paridade da marca — verificada no escopo observado.** Os pares em 390×844 e 360×800 mostram a mesma marca, proporção e fundo branco, sem corte ou deslocamento perceptível. As caixas são **180×59,140625 px**, centradas geometricamente nas duas superfícies. As medições adicionais de 390×667 e da web em 768×1024/1440×900 mantêm essa composição. Não encontrei dívida visual média/alta na assinatura examinada; pequenas diferenças de rasterização do navegador não mudam a caixa nem a leitura.
2. **Movimento e passagem — verificados na web e na prévia, com medidas distintas de pintura.** O código compartilha os limites de 320/120/900 ms; a acomodação é opcional e pode ser interrompida pela prontidão. A curva por metade da animação é equivalente nos dois renderizadores. Os quadros dos vídeos mostram transição discreta, sem salto grande de escala. A prova incremental da prévia registrou as três fases por DOM, saída na prontidão local, interrupção de segundo plano simulada e ausência de repetição no retorno. Os números de DOM não são duração exata de pixels pintados nem tempo nativo.
3. **Limites de destino e plataforma — continuam abertos.** O vídeo da prévia tem cerca de um segundo branco antes da marca; a nova medição distingue o tempo anterior à montagem da vida curta da camada, sem explicar todo o boot do Expo dev. O destino exibido é o aviso de endereço HTTPS do servidor ausente, não o login normal. Nenhuma dessas observações comprova defeito no launch screen nativo. Splash do sistema → React, áreas seguras reais, VoiceOver/TalkBack, suspensão do processo e desempenho em aparelho continuam sem execução. Não transferir as notas da prévia para iOS/Android.

## Evidências examinadas e executadas

- **WEB-24, compartilhada:** [browser-web.json](evidencias/intro-2026-11-23/browser-web.json), 24/24 casos; código e roteiro de reprodução examinados. Prontidão, fontes/imagem com falha, redução de movimento, interrupções, consultas/fragmentos, ausência de JavaScript, interação e não repetição têm seus limites descritos no resultado. A simulação de retorno não autentica em provedor OAuth real.
- **PARES:** [web 390×844](evidencias/intro-2026-11-23/web-390x844.png), [prévia 390×844](evidencias/intro-2026-11-23/app-preview-390x844.png), [web 360×800](evidencias/intro-2026-11-23/web-360x800.png) e [prévia 360×800](evidencias/intro-2026-11-23/app-preview-360x800.png). Inspecionei diretamente esses arquivos. As capturas mantêm fontes pendentes e desabilitam a transformação para medir o quadro base; não são prova da animação.
- **VÍDEOS:** [web natural](evidencias/intro-2026-11-23/web-abertura.webm) e [prévia natural](evidencias/intro-2026-11-23/app-preview-abertura.webm), ambos 390×844 a 25 fps. Examinei quadros extraídos com ffmpeg, inclusive a passagem ao destino. Os vídeos não usam o relógio virtual das capturas estáticas. A animação mínima de até 2 px/1,015 não recebe alegação de medição subpixel a partir desses vídeos.
- **APP-10, compartilhada:** [browser-app-preview.json](evidencias/intro-2026-11-23/browser-app-preview.json). Confere caixas, limite com relógio controlado, toque, Escape, Tab, movimento reduzido e bypass de consulta. O teste do limite verifica ausência da camada após 932 ms controlados; isoladamente não mede a duração exata desde a montagem.
- **APP-MOV-05, execução independente:** [browser-app-motion-independent.json](evidencias/intro-2026-11-23/browser-app-motion-independent.json), **5/5 cenários**, na candidata `048ae11`. Chromium headless, Expo local em desenvolvimento, sem limitação artificial de CPU/rede, viewport 390×844. O [roteiro reutilizável](../../scripts/qa/abertura-movimento-app.cjs) não instrumenta produção nem autentica ou altera dados.

### Cronologia independente da prévia

O `MutationObserver` observa `visivel` pela presença da camada, `saindo` pela mudança de `pointer-events` para `none` e `concluida` pela remoção. Os tempos abaixo são relativos à navegação do documento; não ao início do processo nativo.

| Execução | Inserção visível | Início da saída | Remoção | Vida da camada | Saída até remoção |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contexto novo | 1515,7 ms | 1636,7 ms | 1747,6 ms | **231,9 ms** | 110,9 ms |
| Recarga 1, mesmo contexto | 627,5 ms | 693,1 ms | 809,1 ms | **181,6 ms** | 116,0 ms |
| Recarga 2, mesmo contexto | 559,9 ms | 643,4 ms | 771,3 ms | **211,4 ms** | 127,9 ms |

O dissolve é **configurado em 120 ms**. Os intervalos observados de 110,9–127,9 ms incluem a publicação das fases e os commits no DOM; não afirmam precisão de pintura ao milissegundo. As três vidas observadas ficaram abaixo do teto de 900 ms. O teto do controlador também tem teste determinístico; não inferir que qualquer execução futura em hardware diferente já foi medida.

Nas três partidas, o roteiro registrou imagem carregada, duas fontes carregadas e dois `requestAnimationFrame` posteriores. Isso é uma **estimativa externa da prontidão local**, não leitura da prop `pronta` ou do instante interno de `useFonts`. O primeiro `document.fonts.ready` resolveu antes de existirem fontes do app e foi preservado no log justamente para não ser confundido com prontidão.

O contexto inicial é novo; as outras duas partidas são recargas no mesmo contexto aquecido. O Expo dev ainda transferiu assets/fontes; não há alegação de cache hit, boot quente nativo ou desempenho de distribuição.

- **Segundo plano/retorno simulado:** com fontes retidas, o roteiro substituiu temporariamente `document.hidden`/`visibilityState` e disparou `visibilitychange`. A camada foi removida **19,2 ms** após o evento, sem fase de dissolve; permaneceu ausente após o retorno. Isso verifica a integração com o evento no browser, não uma suspensão real pelo sistema operacional.
- **Continuidade no mesmo documento:** `History.pushState` e `popstate` mudaram a consulta e retornaram à raiz sem alterar `performance.timeOrigin`; houve uma única inserção da camada e nenhuma repetição. Não é navegação nativa nem login OAuth real, tampouco percurso completo entre telas de estudo.

Para repetir a medição, com Expo Web já disponível e dependências de QA preparadas conforme [ABERTURA.md](../../scripts/qa/ABERTURA.md):

```sh
QA_APP_BASE=http://localhost:8082 QA_OUT=.studoo-local/abertura-app node scripts/qa/abertura-movimento-app.cjs
```

## Notas parciais sustentadas

| Critério | Web | Prévia React Native Web | Justificativa |
| --- | ---: | ---: | --- |
| C3 · Hierarquia e adaptação | **9,5** | **9,5** | Marca sem corte, sobreposição ou rolagem; medidas e centro correspondem nas larguras declaradas. O escopo é a assinatura, não o formulário ou a navegação inteira. |
| C4 · Identidade e acabamento | **9,5** | **9,5** | Mesmo asset oficial, fundo, proporção e escala; PNGs e quadros naturais não mostram distorção ou mudança brusca. A rasterização residual não altera a leitura. |
| C5 · Movimento e controle | **9,5** | **9,5** | Contrato comum, saída sem espera mínima ou dependência de API, redução/interrupção e limite cobertos por código/testes. A web tem o registro natural e os casos compartilhados; a prévia ganhou cronologia independente e provas delimitadas de retorno. Não foi observado efeito sonoro disparado pela assinatura. |

As notas da prévia eram provisórias para C5 até a medição incremental; o valor acima substitui o `null` anterior **somente nesse escopo de browser declarado**. Notas altas ainda exigem a confirmação independente do consolidador prevista no método. Não atribuo nota aos demais critérios neste parecer nem calculo média a partir destes três.

**iOS e Android nativos: C3/C4/C5 = `null`.** Sem prova de integração nativa, a entrega multiplataforma completa permanece **Provisória**. O parecer é favorável aos três critérios no escopo web/prévia observado, não uma aprovação consolidada da intro nem uma nota do Studoo inteiro. A próxima etapa visual não foi iniciada nesta revisão.
