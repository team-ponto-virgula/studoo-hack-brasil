# Conferência da assinatura de abertura

A bancada usa Node 24, Chromium e Playwright. As dependências de teste podem ficar fora dos manifestos de produção:

```sh
npm install --prefix .studoo-local/navegador-qa --no-fund --no-audit --ignore-scripts --no-package-lock playwright-core@1.59.1
```

Aponte `STUDOO_CHROMIUM` para seu Chromium; o padrão é `/usr/bin/chromium`. Para os vídeos, o cache do Playwright precisa de FFmpeg (`npx --prefix .studoo-local/navegador-qa playwright-core install ffmpeg`).

Na raiz do repositório, inicie o banco (`npm run db:local`) e o servidor de produção (`npm run build` e `npm run start -- --port 3000`). A `.env` deve ter banco local, `IA=falsa`, `EMAIL=falso`, `STUDOO_ORIGEM=http://localhost:3000` e login sintético criado pelo seed. O ensaio da API lenta usa esse login somente em localhost; não salva tokens ou senha nos resultados.

```sh
QA_BASE=http://localhost:3000 QA_OUT=.studoo-local/abertura-web node scripts/qa/abertura-web.mjs
```

O roteiro combina verificações em relógio virtual com execuções naturais. As capturas estáticas mantêm fontes pendentes e desabilitam somente a transformação da marca para medir o quadro base. O vídeo natural registra o comportamento sem esse ajuste. Sem JS, verifica visibilidade do HTML, não funcionamento do aplicativo inteiro. A simulação de segundo plano dispara o evento de visibilidade: não é teste de suspensão do processo pelo sistema. A prova de não repetição em retorno usa navegação de documentos na mesma aba; não autentica em um provedor OAuth real.

## Prévia complementar React Native Web

O app publicado oferece iOS e Android. Para conferir o renderizador no browser, rode `node scripts/qa/iniciar-previa-app.mjs` em um terminal separado. O script habilita `web` em configuração temporária local, executa Expo na porta 8082 e remove a configuração ao terminar com Ctrl+C. Se o processo for morto sem cleanup, confira e remova somente o symlink `apps/mobile/app.config.js` criado por esse roteiro antes de repetir. Não publique nem acrescente `web` a `app.json` por causa deste ensaio. A prévia não fornece SecureStore e não passa pelo canal nativo de autenticação; o destino de erro é uma limitação identificada, não prova de login.

```sh
QA_APP_BASE=http://localhost:8082 QA_OUT=.studoo-local/abertura-app node scripts/qa/abertura-app-previa.mjs
```

O roteiro verifica a assinatura real sem substituir serviços nativos por implementações fictícias. O snapshot acessível fica na raiz Studoo, pois a toolbar DEV do Expo é externa ao aplicativo. A captura via CDP não espera fontes que foram deliberadamente retidas. Os vídeos não usam relógio virtual. A prévia não comprova splash do sistema, VoiceOver/TalkBack, armazenamento, permissões, gestos ou desempenho nativos. A integração do plugin exige um novo build de desenvolvimento ou distribuição; Expo Go não comprova sua launch screen.

Para repetir a medição DOM independente de movimento da prévia (três boots, visibilidade e consulta), rode `QA_APP_BASE=http://localhost:8082 QA_OUT=.studoo-local/abertura-app node scripts/qa/abertura-movimento-app.cjs`. A estimativa externa de recursos prontos não é o instante exato de prontidão React.
