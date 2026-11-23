# Assinatura de abertura — resultado da rodada

23/11/2026 · branch `feat/intro-avaliacao-ux` · candidata de produto `048ae11`.

**Implementação encerrada nesta rodada; aprovação multiplataforma provisória.** A marca oficial abre sobre branco, faz uma acomodação discreta e dissolve assim que os recursos locais estão prontos. Sessão e tela montam em paralelo; a intro não aguarda a API, não tem duração mínima e pode ser dispensada. O tutorial existente permanece separado. Não declaramos “intro perfeita” nem a meta global de 9,5 atingida sem a evidência restante.

## Critérios e pareceres

O [método reutilizável](METODO-AVALIACAO.md) fixa dez critérios de 0–10, pesos que somam 100, seis gates sem compensação pela média, âncoras observáveis, inventário de 23 famílias de fluxos e três revisões independentes. O [modelo de ficha](FICHA-AVALIACAO.modelo.json) começa sem notas. A referência para qualquer novo fluxo é tarefa + estados + recuperação, com provas próprias por superfície.

Pareceres desta rodada, fechados separadamente: [visual e movimento](PARECER-VISUAL-INTRO.md), [fluxo e acessibilidade](PARECER-FLUXO-INTRO.md), [engenharia e QA](PARECER-QA-INTRO.md). As notas parciais de 9,5 usam a âncora do método no escopo observado; não são pesquisa com pessoas nem nota do Studoo inteiro. A consolidação mantém lacunas como `null`, sem arredondá-las para cima.

## Consolidação

| Superfície | Notas sustentadas | Nota final / estado |
| --- | --- | --- |
| Web local de produção | C1–C9: **9,5**; cobertura de 94% dos pesos. C10 permanece `null`: falta completar a equivalência do caminho normal do app. | **`null` · Provisório**. A média não ignora o critério que falta. |
| Prévia React Native Web | C3/C4/C5: **9,5**; cobertura de 30% dos pesos. Outros critérios sem nota final nesta revisão. | **`null` · Provisório**. |
| iOS / Android nativos | Sem execução observada; todos os critérios `null`. | **`null` · Provisório**. |

[Consolidação legível por máquina](evidencias/intro-2026-11-23/avaliacao-consolidada.json). O consolidador confirmou as notas altas pelas provas canônicas e pelas reproduções adicionais independentes; não alterou a falta de prova em C10. Não há novo defeito web reproduzido nos casos executados. A lacuna é de integração/evidência, não uma nota artificialmente baixa ou alta.

## Verificações executadas

| Prova | Resultado / limite |
| --- | --- |
| Web de produção, Chromium local | [25/25 cenários](evidencias/intro-2026-11-23/browser-web.json). Cinco larguras, prontidão sem espera mínima, teto controlado, toque, Tab/Escape, interação durante dissolve, movimento reduzido/troca de preferência, visibilidade simulada, sem JS, query/hash/rota direta, imagem/fonte com falha, API lenta, recarga/retorno na mesma aba e texto ampliado no destino. |
| Prévia React Native Web, Expo DEV | [10/10 cenários](evidencias/intro-2026-11-23/browser-app-preview.json). Marca, caixas, árvore acessível da raiz Studoo, dispensa, teclado/foco, redução de movimento, query, timeout e gravação. O destino é erro de API/armazenamento: **não comprova entrega à entrada normal**. Sem shims que finjam serviços nativos. |
| Revisão independente de movimento RNWeb | [5/5 cenários](evidencias/intro-2026-11-23/browser-app-motion-independent.json). Uma abertura e duas recargas no contexto aquecido; camada observada em 231,9 / 181,6 / 211,4 ms; dissolve DOM 110,9 / 116,0 / 127,9 ms (configurado 120 ms, variação de amostragem de aproximadamente um frame). Segundo plano e retorno de consulta simulados não repetiram a marca. Não mede pronta do React com exatidão nem desempenho nativo. |
| Reprodução independente web | [Registro](evidencias/intro-2026-11-23/qa-independente-web.json): seis contextos novos, tempos reais, bypass e falhas, sem erro JS não tratado nos casos registrados. |
| Regressão automatizada | Typecheck web e mobile, build Next de produção, paridade, movimento, visitante, interface, formatos, domínio e controlador. Contagens/commits no [parecer QA](PARECER-QA-INTRO.md) e JSONs de checks. Casos dedicados de abertura também integram a suíte interface; não somar como testes exclusivos. |
| Export iOS | Bundle Hermes final de `048ae11` exportado com sucesso (~6 MB); não é compilação nativa nem IPA. Configuração do plugin foi introspectada: storyboard `SplashScreen`, imagem central 180, `contain`, branco. |
| iOS/Android nativos, leitor real, pessoas | **Não executados nesta rodada.** Linux sem simulador iOS/emulador Android disponível. Sem nota transferida da prévia, sem novo build EAS/TestFlight e sem estudo com pessoas. |

As capturas estáticas seguram fontes e congelam somente a transformação da marca para medir o quadro base. Não medem tempo. Os vídeos usam execução natural. Scripts e dependências: [roteiro reproduzível](../../scripts/qa/ABERTURA.md).

## Comparação visual

| Tamanho | Web | Prévia do app |
| --- | --- | --- |
| 390×844 | [PNG](evidencias/intro-2026-11-23/web-390x844.png) | [PNG](evidencias/intro-2026-11-23/app-preview-390x844.png) |
| 360×800 | [PNG](evidencias/intro-2026-11-23/web-360x800.png) | [PNG](evidencias/intro-2026-11-23/app-preview-360x800.png) |
| 390×667 | [PNG](evidencias/intro-2026-11-23/web-390x667.png) | [PNG](evidencias/intro-2026-11-23/app-preview-390x667.png) |

A caixa medida é a mesma: **180×59,140625 px**, centralizada, asset idêntico byte a byte e fundo branco. A prévia usa rasterização de background-image do RNWeb e a web usa img: há pequenas diferenças subpixel, sem diferença nas caixas. Não são capturas de aparelho.

Vídeos: [web de produção](evidencias/intro-2026-11-23/web-abertura.mp4) · [prévia RNWeb](evidencias/intro-2026-11-23/app-preview-abertura.mp4). O segundo tem boot inicial de Expo DEV antes da marca; esse tempo não é atribuído ao controlador de 900 ms. O destino indisponível permanece visível no vídeo.

## Reabrir

O servidor desta tarefa está em `http://localhost:3000/login`. Abra em **nova aba/contexto** para ver a assinatura: o consumo por aba evita repetições em recarga e retorno do login. Com movimento reduzido, ela é dispensada. A aplicação de produção segue servida na porta 3000 enquanto a instância estiver ativa.

Se a máquina reiniciar, siga o roteiro de QA: `npm ci`, banco local/migrations/seed com `.env` sintética, `npm run build` e `npm run start -- --port 3000`. A prévia do app é complementar na porta 8082 e exige configuração temporária web, descrita no roteiro; não é um binário nativo. Os arquivos deste relatório e os commits não dependem dos processos vivos.

## O que falta para aprovação do app

Gerar novo build com `expo-splash-screen` (uma atualização JS/Expo Go não basta) e observar abertura fria/quente, passagem LaunchScreen→React, fontes, retorno de OAuth, Android Back, segundo plano e VoiceOver/TalkBack em iPhone/Android ou simulador/emulador identificado. Confirmar que a entrada normal recebe a pessoa e que preferências e sessão continuam corretas. Atualizar os gates e as notas somente com essas provas.

A implementação da intro fica congelada para essa conferência. A proposta visual da próxima etapa é um artefato de estudo separado: não substitui essa aprovação nem autoriza trocar a interface de produção inteira.
