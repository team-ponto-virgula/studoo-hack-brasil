# Conferência da intro mobile

**Escopo atual (24/11): somente iOS e Android.** A intro foi removida do site por instrução do dono. `abertura-web.mjs` e os vídeos web são roteiros/provas históricos da candidata `048ae11`, não checks atuais e não aprovação do app. Para reproduzir a comparação antiga, use aquela revisão; não executar esse roteiro contra o site atual.

O controlador usado no mobile é conferido por `npm run test:abertura`. O typecheck do app é `npm run typecheck --workspace=@studoo/mobile`.

## Prévia complementar React Native Web

O app publicado oferece iOS e Android. Para conferir o renderizador no browser, rode `QA_APP_PORT=8090 node scripts/qa/iniciar-previa-app.mjs` em um terminal separado. O script habilita `web` em configuração temporária local, executa Expo na porta 8090 e remove a configuração ao terminar com Ctrl+C. Se o processo for morto sem cleanup, confira e remova somente o symlink `apps/mobile/app.config.js` criado por esse roteiro antes de repetir. Não publique nem acrescente `web` a `app.json` por causa deste ensaio. A prévia não fornece SecureStore e não passa pelo canal nativo de autenticação; o destino de erro é uma limitação identificada, não prova de login.

```sh
QA_APP_BASE=http://localhost:8090 QA_OUT=.studoo-local/abertura-app node scripts/qa/abertura-app-previa.mjs
```

O roteiro verifica a assinatura real sem substituir serviços nativos por implementações fictícias. O snapshot acessível fica na raiz Studoo, pois a toolbar DEV do Expo é externa ao aplicativo. A captura via CDP não espera fontes que foram deliberadamente retidas. Os vídeos não usam relógio virtual. A prévia não comprova splash do sistema, VoiceOver/TalkBack, armazenamento, permissões, gestos ou desempenho nativos. A integração do plugin exige um novo build de desenvolvimento ou distribuição; Expo Go não comprova sua launch screen.

Para repetir a medição DOM independente de movimento da prévia (três boots, visibilidade e consulta), rode `QA_APP_BASE=http://localhost:8090 QA_OUT=.studoo-local/abertura-app node scripts/qa/abertura-movimento-app.cjs`. A estimativa externa de recursos prontos não é o instante exato de prontidão React.

A prévia depende de Chromium/Playwright, que podem ficar em `.studoo-local/navegador-qa` sem mudar os manifestos: `npm install --prefix .studoo-local/navegador-qa --no-fund --no-audit --ignore-scripts --no-package-lock playwright-core@1.59.1`. Use `STUDOO_CHROMIUM` para apontar o executável, se necessário.
