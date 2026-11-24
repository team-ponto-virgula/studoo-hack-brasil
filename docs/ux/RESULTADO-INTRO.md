# Intro do Studoo — somente mobile

Atualização de **24/11/2026**: o dono esclareceu que a assinatura de abertura é exclusiva do aplicativo **iOS e Android**. A web não recebe a intro. Esta instrução prevalece sobre a aplicação geral de paridade entre site e app; a exceção está registrada na spec 07.

## Correção de escopo

- Removidos o componente/CSS de abertura do site, o bootstrap no layout, os cabeçalhos de elegibilidade e a mudança de redirecionamento que existia somente para essa abertura web. O layout e o proxy voltam à base `281a3fe`.
- A implementação React Native, o ciclo de abertura, a montagem paralela da sessão, as dispensas e o plugin `expo-splash-screen` permanecem no app.
- O teste específico do proxy web foi removido; os nove casos do controlador continuam cobrindo o ciclo usado no mobile.
- As notas e capturas web de 23/11 ficam somente como [histórico](RESULTADO-INTRO-2026-11-23.md). Não são notas do app e não entram na aprovação atual.

## O que está implementado no app

Logo oficial centralizada, fundo branco, acomodação discreta de até 320 ms, dissolve configurado de 120 ms quando os recursos locais estão prontos e limite da camada React de 900 ms desde a montagem. Não há espera mínima nem dependência da API para liberar a tela. Movimento reduzido, acessibilidade, contexto, interação e falhas podem dispensar a marca. A guarda nativa conta desde o módulo JS; não mede o tempo anterior de boot do sistema operacional.

A tela do sistema é estática e depende de um novo binário com o plugin. Expo Go e a prévia React Native Web não comprovam a passagem LaunchScreen → React do Studoo.

## Evidência e aprovação

**A nota mobile continua `null`, com estado Provisório.** Não houve captura em iPhone/Android nesta rodada. Nenhuma nota histórica 9,5 da web é transferida ao app. É necessário observar o caminho normal, abertura fria/quente, passagem da tela do sistema, retorno de autenticação, segundo plano, voltar e VoiceOver/TalkBack no ambiente nativo identificado.

A prévia do componente mobile pode ser exibida em mídia direta para conferir composição e movimento; quando capturada no navegador, é identificada como prévia, nunca como gravação nativa ou medição de latência do aparelho. O player HTML anterior mostrado no chat não abriu no cliente do dono e não será usado como entrega principal.

O [método](METODO-AVALIACAO.md) continua reutilizável para outras jornadas web/app. Para F01, as superfícies obrigatórias agora são iOS e Android; RNWeb é só complementar e a web é não aplicável.

## Prévia direta e checks da correção

- [Movimento mobile em GIF](evidencias/intro-mobile-2026-11-24/intro-mobile.gif) · [MP4](evidencias/intro-mobile-2026-11-24/intro-mobile.mp4).
- São quadros reais do componente React Native renderizado pela prévia RNWeb, com resposta das fontes atrasada 600 ms para tornar a acomodação visível. Recorte de 0,64 s da marca, em repetição na mídia; não inclui o destino nem mede boot do aparelho. [Metadados](evidencias/intro-mobile-2026-11-24/recorte.json).
- A entrega principal usa imagem/vídeo direto, sem o player HTML que falhou no chat. Ainda não é captura nativa.
- [Checks da correção](evidencias/intro-mobile-2026-11-24/verificacoes.json): interface 595, controlador 9, paridade 5 e movimento 4 passaram; typecheck mobile e build web passaram. Código mobile preservado e layout/proxy web idênticos à base `281a3fe`.

## Conferir e reabrir

- Produto mobile: seguir os comandos do Expo do repositório; a integração de splash precisa de novo build de desenvolvimento/distribuição.
- Prévia complementar: `QA_APP_PORT=8090 node scripts/qa/iniciar-previa-app.mjs`. A porta 8090 evita portas reservadas do desktop Cloud. Não acrescentar web às plataformas publicadas do app.
- O site pode rodar na porta 3000 e deve abrir diretamente, sem a assinatura de abertura.
- [Roteiros e limites da conferência](../../scripts/qa/ABERTURA.md).
