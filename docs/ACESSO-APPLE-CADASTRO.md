# Criar conta, Esqueci minha senha, Google e Iniciar sessão com a Apple

Contrato em `packages/contratos/src/autenticacao.ts` (`@studoo/contratos/autenticacao`). Tudo começa desligado; o
`GET /api/auth/config` diz ao web e ao app o que mostrar (`google`, `recuperacao`, `cadastro`, `apple`).

## Regras comuns

- Nenhuma conta é vinculada a outro provedor só porque o e-mail é igual. E-mail já usado por outra forma de entrar
  responde `google_conta_existente` ou `apple_conta_existente` (409).
- `STUDOO_DOMINIO_EMAIL` / `STUDOO_EMAILS_PERMITIDOS` valem para senha, cadastro, recuperação, Google e Apple. Para o
  App Review (revisor com e-mail próprio, "Ocultar meu e-mail" da Apple) o domínio precisa estar vazio.
- Chaves só no servidor. Nunca `EXPO_PUBLIC_` nem `NEXT_PUBLIC_`.

## Criar conta por e-mail (`STUDOO_CADASTRO=1`)

Exige o envio de e-mail pronto (o mesmo da recuperação): `EMAIL=resend`, `RESEND_API_KEY` e `EMAIL_FROM` com domínio
verificado no Resend. `EMAIL=falso` só funciona em origem loopback. Sem e-mail, `cadastro` fica `false`.

1. `POST /api/cadastro/codigo` (web) ou `/api/mobile/cadastro/codigo` (app) com `{ email }` → sempre `{ enviado: true }`.
   Se o e-mail já tem conta, chega só um aviso para entrar ou recuperar a senha, sem código.
2. `POST /api/cadastro` (web: 201 + cookie) ou `/api/mobile/cadastro` (app: 201 + `SessaoNativa`) com
   `{ email, codigo, senha }`.

Código de 6 dígitos, 15 minutos, uso único, 5 tentativas. Limites (429 `limite_cadastro`): 3 códigos por e-mail e 10
por rede a cada 15 min, 200 por hora no total, 10 confirmações por e-mail a cada 15 min. O código não volta na API nem
vai para os logs.

## Iniciar sessão com a Apple no iPhone (`STUDOO_APPLE=1`)

Exige também `STUDOO_SESSAO_MOBILE_PILOTO=1` e `STUDOO_ORIGEM` em HTTPS.

| Variável | O que é |
| --- | --- |
| `APPLE_TEAM_ID` | Team ID da conta de desenvolvedor (10 caracteres) |
| `APPLE_KEY_ID` | Key ID da chave "Sign in with Apple" (10 caracteres) |
| `APPLE_PRIVATE_KEY` | Conteúdo do `.p8` em PEM, com as quebras escritas como `\n` |
| `APPLE_BUNDLE_IDS` | Bundle IDs do app aceitos no token, separados por vírgula |

No Apple Developer:

1. Ative "Sign in with Apple" no App ID do app (o app precisa de `ios.usesAppleSignIn: true` no `app.json`).
2. Crie uma chave com "Sign in with Apple" ligada a esse App ID e guarde o `.p8` só no servidor.
3. Em "Server-to-Server Notification Endpoint", informe `${STUDOO_ORIGEM}/api/auth/apple/notificacoes`.

Fluxo do app:

1. `POST /api/mobile/apple/nonce` → `{ nonce, expiraEm }` (uso único, 10 min; 30 por rede a cada 10 min).
2. O app chama a Apple com `nonce: sha256Hex(nonce)` e pede `FULL_NAME` e `EMAIL`.
3. `POST /api/mobile/apple` com `{ identityToken, authorizationCode, nonce }` → `SessaoNativa`.

O servidor confere assinatura (JWKS da Apple), `iss`, `aud` em `APPLE_BUNDLE_IDS`, expiração e o hash do nonce; troca o
`authorizationCode` em `/auth/token` com um `client_secret` ES256 e guarda o token de renovação cifrado (AES-256-GCM,
chave derivada de `STUDOO_CHAVE_ASSINATURA`). A conta é achada pelo `sub`. Se a Apple não mandar o e-mail (segundo
acesso ou e-mail não compartilhado), a conta continua a mesma; conta nova sem e-mail recebe um endereço interno que
nunca recebe mensagem. O nome não é guardado.

Exclusão (TN3194): `DELETE /api/conta` revoga o token na Apple (`/auth/revoke`) depois de apagar os dados. Se a Apple
falhar, a exclusão segue e o log registra só `apple_revogacao_falhou`. Notificações: `consent-revoked` encerra as
sessões e esquece o token; `account-deleted` exclui a conta. A revogação e as notificações de contas anteriores continuam funcionando quando a entrada Apple é desligada, desde que as credenciais permaneçam configuradas. [Eventos da Apple](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts).

## Esqueci minha senha e Google

Seguem como antes: `/api/senha/recuperar` e `/api/senha/redefinir` (e `/api/mobile/senha/...`), e o Google com
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e o redirecionamento `${STUDOO_ORIGEM}/api/auth/google/retorno`.
