# Roteiro de QA do acesso no beta do iPhone (TestFlight externo)

Mobile & QA, 20/11/2026. Base: contrato `@studoo/contratos/autenticacao` (`1f52e92`) e servidor em
`agentes/studoolead/apple-acesso-web` (`fb1a616`), descritos em `docs/ACESSO-APPLE-CADASTRO.md`. Complementa
`docs/BUILD-IOS-TESTFLIGHT.md`.

## Antes do build (bloqueia o roteiro)

| Item | Onde | Situação |
| --- | --- | --- |
| `ios.usesAppleSignIn: true` | `apps/mobile/app.json` | Falta |
| Plugin e dependência `expo-apple-authentication` | `apps/mobile/package.json`, `app.json` | Falta |
| Botão "Iniciar sessão com a Apple" (estilo da Apple, `AppleAuthenticationButton`) só quando `config.apple` e `isAvailableAsync()` | `apps/mobile/src/sessao.tsx` | Falta |
| Tela "Criar conta" (e-mail → código de 6 dígitos → senha) quando `config.cadastro` | `apps/mobile/src/` | Falta |
| "Excluir conta" no app (`DELETE /api/conta`), exigido pela 5.1.1(v) | Perfil/Configurações do app | Falta |
| Mensagens dos erros novos em `mensagens.ts` | `apps/mobile/src/mensagens.ts` | Falta |
| Capability "Sign in with Apple" no App ID `com.studoo.mobile.dev` | Apple Developer (dono da conta) | Pendente |
| `APPLE_BUNDLE_IDS` contendo `com.studoo.mobile.dev` | servidor publicado | Pendente |
| `STUDOO_APPLE=1`, `STUDOO_SESSAO_MOBILE_PILOTO=1`, `STUDOO_ORIGEM` em HTTPS, chave `.p8` | servidor publicado | Pendente |
| `STUDOO_CADASTRO=1` com Resend pronto (`EMAIL=resend`, domínio verificado) | servidor publicado | Pendente |
| `STUDOO_DOMINIO_EMAIL` e `STUDOO_EMAILS_PERMITIDOS` vazios (revisor da Apple e "Ocultar meu e-mail") | servidor publicado | Pendente |
| Endpoint de notificações `${STUDOO_ORIGEM}/api/auth/apple/notificacoes` | Apple Developer | Pendente |
| Conta de demonstração com senha nas informações de teste | App Store Connect | Pendente |

Com o perfil `testflight`, o Google segue desligado no aparelho (`EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO=desligado`). Com a Apple
pronta, a regra 4.8 deixa de exigir isso; religar é decisão à parte, depois deste roteiro passar.

## Automático (antes de cada build)

- `npm run typecheck` na raiz e em `apps/mobile`.
- `npm run test:acesso`, `test:google-mobile`, `test:visitante-mobile` e `tests/acesso-cadastro-apple.test.mjs`,
  `tests/privacidade.test.mjs`.
- Testes de fonte do app (a escrever junto com as telas): o botão da Apple só aparece com `config.apple`; o app manda
  `sha256Hex(nonce)` à Apple e o nonce bruto ao servidor; nenhuma chave da Apple em `EXPO_PUBLIC_`; a tela de cadastro
  aceita só 6 dígitos e senha de 8 a 256; os erros novos têm mensagem.

## Manual no iPhone (build do TestFlight)

Para cada caso: resultado esperado, captura, e o registro do servidor sem código, token nem e-mail em claro.

### Criar conta por e-mail

| # | Passos | Esperado |
| --- | --- | --- |
| C1 | Pedir código para e-mail novo | "Enviamos um código" (`{ enviado: true }`); e-mail chega com 6 dígitos |
| C2 | Pedir código para e-mail já cadastrado | Mesma tela e mesma resposta de C1; o e-mail recebido é só um aviso para entrar ou recuperar, sem código |
| C3 | Código certo + senha de 8+ caracteres | Conta criada (201), entra direto na Home; sessão sobrevive a fechar e abrir o app |
| C4 | Código errado 5 vezes | Mensagens de código inválido; na 5ª o código é invalidado e precisa pedir outro (o certo também falha) |
| C5 | Código vencido (pedir, esperar 15 min) | Recusa como vencido; pedir de novo funciona |
| C6 | Reusar o código de C3 | Recusa (uso único) |
| C7 | Pedir 4 códigos em 15 min para o mesmo e-mail | 4º recebe `limite_cadastro` (429) com mensagem de tentar mais tarde |
| C8 | E-mail de uma conta criada pelo Google | Fluxo de C2 (só aviso); confirmar não vincula nem troca a senha da conta Google |
| C9 | Senha com 7 caracteres | Recusa no app antes de enviar |
| C10 | Servidor com `STUDOO_CADASTRO` desligado | "Criar conta" não aparece; nada apagado na tela |
| C11 | Servidor com `STUDOO_DOMINIO_EMAIL` definido e e-mail de fora | `email_nao_permitido` (403) com mensagem clara |

### Iniciar sessão com a Apple

| # | Passos | Esperado |
| --- | --- | --- |
| A1 | Primeiro acesso, compartilhando o e-mail | Folha nativa da Apple; entra; conta nova com o e-mail real |
| A2 | Primeiro acesso com "Ocultar meu e-mail" | Entra; conta com `@privaterelay.appleid.com`; nada quebra no Perfil |
| A3 | Sair e entrar de novo com a Apple (a Apple não manda mais o e-mail) | Mesma conta de A1/A2 (mesmas trilhas e perfil) |
| A4 | Cancelar a folha da Apple | Volta à tela de entrada sem erro vermelho |
| A5 | Apple com o mesmo e-mail de uma conta de senha ou Google | `apple_conta_existente` (409) com mensagem para entrar do jeito antigo; nada vinculado |
| A6 | Servidor com `STUDOO_APPLE` desligado | Botão não aparece |
| A7 | `APPLE_BUNDLE_IDS` sem o bundle do build | `apple_invalido` (400); serve para conferir a configuração antes da revisão |
| A8 | Ajustes > ID Apple > Iniciar sessão com a Apple > Studoo > Parar de usar | Notificação `consent-revoked`: sessões caem; próximo acesso pede a Apple de novo |

### Excluir conta e voltar

| # | Passos | Esperado |
| --- | --- | --- |
| E1 | Conta Apple: Excluir conta no app | Dados apagados, sessão encerrada, volta à entrada; o Studoo some de "Iniciar sessão com a Apple" nos Ajustes (revogado) |
| E2 | Entrar de novo com a Apple depois de E1 | Conta nova e vazia, folha da Apple pede nome e e-mail outra vez |
| E3 | Conta de senha: Excluir conta | Dados apagados; login com a senha antiga falha; e-mail pode criar conta nova por C1 |
| E4 | Excluir pelo site e abrir o app logado | App cai para a entrada na próxima chamada, sem travar |

### Esqueci minha senha e Google (regressão)

| # | Passos | Esperado |
| --- | --- | --- |
| R1 | Esqueci minha senha → código → nova senha | Entra com a nova; a antiga falha |
| R2 | Build `testflight` | Botão do Google não aparece; `studoo-dev://auth/google` recusado |
| R3 | Build `preview` no Android | Google segue funcionando como antes |

### Revisão da Apple

- Conta de demonstração com senha entra sem código e sem domínio restrito.
- Dados declarados no rótulo de privacidade batem com o que o cadastro e a Apple coletam (e-mail; o nome da Apple não é
  guardado).
