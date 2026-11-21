# Build Android para a demo

Há duas rotas para ter o app no celular. A rota A usa um build de desenvolvimento, com o JavaScript servido pelo notebook. A rota B usa um APK instalado que fala com o site publicado. Os perfis de build ficam em `apps/mobile/eas.json`:

| Perfil | Para quê | Saída |
| --- | --- | --- |
| `development` | Cliente de desenvolvimento (`expo-dev-client`, já é dependência). O JavaScript vem do Metro no notebook. | APK de debug |
| `preview` | App da demo, com o endereço do site publicado gravado no build. | APK instalável |
| `production` | Loja (Google Play), quando houver pacote e domínio de produção. | AAB |

Nenhuma rota exige dependência nativa nova. O pacote e o scheme continuam os de piloto (`com.studoo.mobile.dev`, `studoo-dev`).

## Rota A: build de desenvolvimento com Metro e `adb reverse`

### O que o dono precisa ter em mãos

- Notebook com Node 24, o repositório com `npm ci`, o `.env` da raiz e o banco local (`npm run db:local`), além do OpenSSL 3.
- Para compilar no notebook: JDK 17 e o SDK Android com `adb`. O Android Studio instala os dois.
- Celular Android com as opções do desenvolvedor e a depuração USB ligadas, e um **cabo USB de dados**. Um emulador também serve.
- Conta Expo: não precisa para compilar no notebook. Só precisa para a variante A2.

### A1. Tudo no notebook, com a API local em HTTPS

Siga [App Android em modo de desenvolvimento](RODAR-LOCALMENTE.md#app-android-em-modo-de-desenvolvimento). Em resumo:

1. Gere a CA local e o certificado de `127.0.0.1`.
2. Suba a API móvel em `https://127.0.0.1:3443`, com `STUDOO_SESSAO_MOBILE_PILOTO=1` e `STUDOO_ORIGEM=https://127.0.0.1:3443`.
3. Copie `apps/mobile/.env.example` para `apps/mobile/.env.local`. Ele já aponta `EXPO_PUBLIC_STUDOO_API_URL` para `https://127.0.0.1:3443`.
4. Com o celular no cabo:

```sh
export STUDOO_ANDROID_PILOTO_CA="$PWD/.studoo-local/tls/ca.crt"
adb reverse tcp:3443 tcp:3443
adb reverse tcp:8083 tcp:8083
npm exec --workspace apps/mobile -- expo prebuild --platform android --no-install
npm run android --workspace apps/mobile -- --port 8083
```

O plugin `with-android-piloto-ca.cjs` põe a CA local só no build de debug, para `127.0.0.1` e `localhost`. Sem `STUDOO_ANDROID_PILOTO_CA` no `prebuild`, o app não confia na API local. O `adb reverse` precisa ser refeito toda vez que o cabo sai.

### A2. Cliente de desenvolvimento do EAS, com o Metro no notebook

Não precisa de JDK nem do SDK completo, só do `adb` (platform-tools). O build na nuvem não tem a CA local, então a API precisa ser um HTTPS público: o site publicado, com o que a rota B exige no servidor.

```sh
cd apps/mobile
npx eas-cli@latest login            # ou EXPO_TOKEN no ambiente
npx eas-cli@latest init             # uma vez: grava o projectId no app.json (commitar)
npx eas-cli@latest build --profile development --platform android
```

Instale o APK pelo link ou QR do EAS. Depois, com o celular no cabo:

```sh
# apps/mobile/.env.local com EXPO_PUBLIC_STUDOO_API_URL=https://studoo-web-suqmqb-3a8f9c-187-53-116-195.sslip.io
adb reverse tcp:8083 tcp:8083
npx expo start --dev-client --port 8083
```

No build de desenvolvimento, o `EXPO_PUBLIC_*` vem do `.env.local` lido pelo Metro. O `env` do perfil `development` não chega ao JavaScript.

## Rota B: APK falando com o site publicado em HTTPS

O APK do perfil `preview` grava `EXPO_PUBLIC_STUDOO_API_URL=https://studoo-web-suqmqb-3a8f9c-187-53-116-195.sslip.io` no build. O certificado do site é público (Let's Encrypt, conferido em 18/11/2026), e o APK confia nele sem CA local. Não precisa de cabo nem de notebook ligado na hora da demo.

### O que o dono precisa ter em mãos

- Conta Expo e o login no `eas-cli`. Para rodar sem interação, use um token de acesso criado em expo.dev, na variável `EXPO_TOKEN`.
- Rodar `npx eas-cli@latest init` uma vez. Ele grava `extra.eas.projectId` no `app.json`, que deve ser commitado.
- Celular Android com internet e permissão para instalar apps de fora da loja.
- Uma conta de e-mail e senha no site publicado, a mesma da web.
- Acesso às variáveis do servidor publicado (Dokploy) e um deploy que inclua a correção do canal atrás de proxy, que já está na integração (`28d54d7`).

### Variáveis do servidor publicado

| Variável | Valor | Por quê |
| --- | --- | --- |
| `STUDOO_SESSAO_MOBILE_PILOTO` | `1` | Liga o login nativo (`/api/mobile/sessao`) e as chamadas com token. |
| `STUDOO_ORIGEM` | `https://studoo-web-suqmqb-3a8f9c-187-53-116-195.sslip.io` | O canal do app confere o host público contra esta origem. |
| `STUDOO_PROXY_HTTPS` | `1` | O Traefik termina o TLS. Com `1`, o servidor aceita `X-Forwarded-Proto: https` e `X-Forwarded-Host` do proxy. |
| `IA` e `OPENAI_API_KEY` | `openai` e a chave (ou `deepseek` com a chave da OpenAI: modo misto) | Só para voz (Explique e "Falar") e leitura real de material. No modo misto, a transcrição vai para a OpenAI e o texto para a DeepSeek. Com `IA=falsa`, o app mostra o aviso de voz indisponível, e o material de demonstração e o texto funcionam. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STUDOO_GOOGLE_MOBILE_REDIRECT_URI=studoo-dev://auth/google` | | Opcional. Sem elas, a entrada é por e-mail e senha. |

**Depende da correção do canal atrás de proxy:** sem `STUDOO_PROXY_HTTPS=1` no deploy com a correção, todo pedido do app ao site publicado volta `404 nao_encontrado`. Isso vale para o login e para todo pedido com token. A tela de entrada mostra erro mesmo com a senha certa.

Estado em 18/11/2026, por sondagem sem credenciais:
- `GET /api/auth/config` devolve `{"google":false,"recuperacao":false,"ia":"falsa"}`;
- `POST /api/mobile/sessao` devolve `404`.

O canal do app ainda está desligado no site.

### Variáveis do app (já no perfil `preview` do `eas.json`)

- `EXPO_PUBLIC_STUDOO_API_URL=https://studoo-web-suqmqb-3a8f9c-187-53-116-195.sslip.io`: só a origem HTTPS, sem caminho.
- `EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI=studoo-dev://auth/google`: igual ao `scheme` do `app.json` e a `STUDOO_GOOGLE_MOBILE_REDIRECT_URI` no servidor.

O `.env.local` não sobe para o EAS (está no `.gitignore`), então os valores do build vêm do `eas.json`. Trocar o endereço exige um novo build.

```sh
cd apps/mobile
npx eas-cli@latest build --profile preview --platform android
```

Antes de instalar, confira que o canal responde, por exemplo, com `POST /api/mobile/sessao` sem credenciais. Com o canal ligado, ele devolve `401` (`credenciais_invalidas`) e conta como uma tentativa falha para o e-mail vazio. Se ainda devolver `404`, o canal continua desligado no servidor.

**Sem conta Expo:** `npx expo run:android --variant release` no notebook, com JDK e SDK, gera um APK assinado com a chave de debug do template. Antes, ponha o endereço publicado em `apps/mobile/.env.local`.

## Lista de conferência no aparelho

Faça antes da demo, no aparelho da demo, com a rota escolhida.

- **Teclado:** no login, no pedido, na lacuna ou resposta aberta e no campo do Explique, o campo e o botão do rodapé (Começar, Verificar, Enviar minha explicação) ficam acima do teclado. Nada fica escondido.
- **Microfone:**
  - conceder: o Explique grava, as ondas seguem a voz e o texto volta para revisar, se `IA=openai` (ou `IA=deepseek` com `OPENAI_API_KEY`);
  - negar: aparece o aviso de como liberar;
  - negar para sempre: aparece o aviso dos ajustes do app;
  - o "Falar" segue as mesmas regras e corta em 8 s.
- **Câmera e arquivos:**
  - fotografar uma página e dar as três respostas: conceder, negar e "não perguntar de novo";
  - no seletor, PDF, foto e CSV aparecem habilitados.
- **TalkBack:**
  - percorrer Minhas trilhas, a trilha e a lição só por gestos;
  - todo botão tem nome;
  - o foco vai para o retorno depois de Verificar, volta ao exercício em "Tentar de novo", vai ao título do reforço em "Ver outro jeito de entender" e vai ao "Como foi?" quando o cronômetro acaba.
  - Opcional: o Accessibility Scanner não acusa alvo menor que 48 dp.
- **Segundo plano:**
  - ir para outro app no meio de uma gravação: a gravação para, nada é enviado e a volta não trava;
  - fechar e reabrir o app: a sessão continua por 8 h e a lição retoma de onde parou;
  - o progresso feito no celular aparece na web.
- **Rede:** em modo avião, conferir Minhas trilhas (selo de sem conexão), Verificar (aviso no alto, nada se perde) e o envio de material (aviso no cartão). Com a rede de volta, "Tentar novamente" funciona.
- **Sistema:**
  - o botão voltar do Android na lição pede para sair;
  - "Remover animações" ligado: a ponte vence sem animação;
  - fonte grande e tema escuro do sistema não cortam textos nem botões.

Os builds não foram feitos nesta máquina, que não tem SDK Android nem conta Expo. O guia e o `eas.json` precisam da primeira build real para confirmar a instalação das dependências do monorepo no EAS.
