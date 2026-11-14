# Acesso com Google e recuperação de senha

A web e o app Android oferecem **Continuar com Google** e **Esqueci minha senha**. O login existente por e-mail e senha continua disponível. O servidor informa quais provedores estão configurados por `/api/auth/config`; sem credenciais Google, a interface explica a indisponibilidade.

## Configuração do servidor

Use os campos de `.env.example` em seu ambiente privado. O bootstrap local continua usando `.env` com `IA=falsa` e `EMAIL=falso`; para configurar provedores no Next local, use `.env.local`. Nunca publique chaves ou senhas.

1. Instale as dependências com `npm ci`, gere o cliente com `npm run db:generate` e aplique `npm run db:migrate` ao banco de destino. A migração mantém usuários e planos existentes e acrescenta os registros temporários de autenticação.
2. Configure `STUDOO_ORIGEM` com a origem pública HTTPS exata, sem caminho. Para aceitar Gmail e outros domínios, deixe `STUDOO_DOMINIO_EMAIL=` vazio. Um valor preenchido restringe todos os métodos de entrada ao domínio escolhido.
3. No Google Cloud, configure a tela de consentimento e um cliente OAuth **Aplicativo da Web**. Cadastre a URI exata `https://SEU-DOMINIO/api/auth/google/retorno`. No desenvolvimento web, cadastre também a origem loopback usada, por exemplo `http://localhost:3100/api/auth/google/retorno`. Se o consentimento estiver em teste, inclua as contas de teste no Google.
4. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` somente no servidor. O mesmo cliente atende web e Android: o servidor recebe o callback do Google e depois entrega ao app um código temporário próprio.
5. Configure `EMAIL=resend`, `RESEND_API_KEY` e `EMAIL_FROM` no servidor. Verifique seu domínio no painel do Resend e use um remetente desse domínio, como `Studoo <acesso@seu-dominio.com>`. Crie uma chave com permissão de envio. Não coloque essa chave nas variáveis públicas da web ou do Expo. O envio usa a API HTTPS do Resend, com limite de 10 segundos por pedido. As antigas variáveis `SMTP_*` não são usadas.
6. Reinicie o servidor após alterar as variáveis. Verifique uma entrada Google e o recebimento do e-mail em uma conta de teste antes de liberar o ambiente.

## Android

No servidor, habilite `STUDOO_SESSAO_MOBILE_PILOTO=1` e use HTTPS. Configure `STUDOO_GOOGLE_MOBILE_REDIRECT_URI=studoo-dev://auth/google`.

No app, `EXPO_PUBLIC_STUDOO_API_URL` aponta para essa API e `EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI=studoo-dev://auth/google` deve corresponder ao servidor e ao `scheme` de `app.json`. São endereços públicos, nunca credenciais. Para outro identificador do app, altere o scheme e os dois retornos juntos.

Reconstrua o app de desenvolvimento após instalar as dependências: esta entrega adiciona `expo-web-browser`, `expo-crypto` e o plugin do navegador. O fluxo abre o navegador do sistema e retorna ao app; Expo Go não substitui esse build. O token de sessão fica no SecureStore, inclusive quando o sistema recria o app durante o retorno.

## Comportamento e proteção

- O Google valida assinatura, emissor, audiência, validade, e-mail verificado e nonce. State e PKCE vinculam a autorização ao navegador que iniciou o pedido.
- Uma conta Google nova é criada no primeiro acesso. Se já existir uma conta com senha usando o mesmo e-mail, ela não é vinculada automaticamente: a tela orienta entrar com senha ou recuperá-la. Vincular provedores dentro de uma conta autenticada não faz parte desta entrega.
- No Android, o deep link carrega somente um código de uso único, com validade de dois minutos, vinculado ao verificador PKCE guardado no aparelho. O token de sessão não aparece na URL.
- A recuperação sempre responde de forma neutra, exista ou não a conta. O código de seis dígitos expira em 15 minutos; um novo pedido substitui o anterior. Há limites de três pedidos e cinco verificações por e-mail a cada 15 minutos. O reenvio na interface aguarda 60 segundos.
- A nova senha deve ter de 8 a 256 caracteres. A troca consome o código atomicamente e encerra as sessões web e mobile anteriores. A pessoa entra novamente após a confirmação.
- Com `EMAIL=falso` e origem loopback, os e-mails ficam em `.studoo-local/emails/`, fora do Git, com permissão restrita. Isso permite testar o código real sem envio externo. Códigos não aparecem nos logs nem na resposta HTTP. Esse modo é recusado em origens públicas.

## Validação

`npm run test:acesso` usa o banco local migrado, cria e remove somente suas contas sintéticas e testa recuperação, expiração, concorrência, revogação, OAuth, JWT e isolamento de canais. Não exige credenciais externas. `npm run test:email` verifica o contrato HTTP do Resend e suas falhas com respostas simuladas, sem enviar mensagens reais. `npm run test:google-mobile` testa PKCE, retorno após recriação do app, cancelamento e falhas de armazenamento com módulos nativos simulados. `npm run test:paridade` verifica também os textos de acesso.

A revisão visual mobile usa React Native Web com API simulada. A recuperação web é verificada com a API e o banco locais. Login Google real, entrega real pelo Resend e retorno em aparelho Android exigem validação no ambiente configurado; testes simulados não comprovam esses serviços.

Referências: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/), [API de envio do Resend](https://resend.com/docs/api-reference/emails/send-email) e [domínios verificados](https://resend.com/docs/dashboard/domains/introduction).
