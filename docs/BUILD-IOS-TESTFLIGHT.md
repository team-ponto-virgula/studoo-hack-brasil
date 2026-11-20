# Beta do iPhone pelo TestFlight externo

Revisão de 20/11/2026 (Mobile & QA), sobre `feat/hackathon-integracao` em `d9be93c`. O que está aqui foi conferido no repositório, no
`expo config --type introspect` e no template do SDK 58 (`expo-template-bare-minimum@58.0.35`). Nada foi enviado à Apple nem ao EAS: o que só
o build, o App Store Connect ou a revisão Beta confirmam está marcado como pendente.

## Como gerar e enviar (quem tem a conta Expo e a conta Apple)

```sh
cd apps/mobile
npx eas-cli@latest login                 # ou EXPO_TOKEN no ambiente
npx eas-cli@latest init                  # uma vez: grava owner e extra.eas.projectId no app.json (commitar)
npx eas-cli@latest build --platform ios --profile testflight
npx eas-cli@latest submit --platform ios --latest   # envia ao App Store Connect; o TestFlight externo é ligado lá
```

O perfil `testflight` (`eas.json`) é de loja (`distribution: store`), aumenta o número do build sozinho (`appVersionSource: remote` +
`autoIncrement`), aponta para a API publicada em HTTPS e leva o Google ao lado da Apple (ver abaixo). Na primeira vez, o EAS pede o login da Apple para criar o App ID `com.studoo.mobile.dev`, o certificado de distribuição e o perfil de
provisionamento; o registro do app no App Store Connect também é criado no primeiro `submit`.

## O que foi auditado

| Item | Situação | Evidência |
| --- | --- | --- |
| Projeto EAS vinculado | **Falta.** `app.json` não tem `owner` nem `extra.eas.projectId` | `app.json`; `eas init` grava os dois |
| Bundle ID | `com.studoo.mobile.dev` (o mesmo do Android). Vale para a loja; trocar depois de criado no App Store Connect não dá | `app.json` |
| Xcode e SDK aceitos | A Apple exige Xcode 26+ com SDK do iOS 26 desde 28/04/2026. O perfil usa `image: auto`, que no SDK 58 é `macos-tahoe-26.6-xcode-27.1` (Xcode 27.1 RC) | docs.expo.dev/build-reference/infrastructure, developer.apple.com/news/upcoming-requirements |
| Ciclo de vida por cena (Xcode 27 / iOS 27) | O template do SDK 58 já traz `SceneDelegate.swift` e `UIApplicationSceneManifest` | `expo-template-bare-minimum@58.0.35` |
| Ícone | `icone-ios-1024.png`: 1024×1024, PNG RGB sem canal alfa | leitura do cabeçalho PNG |
| Criptografia | `ITSAppUsesNonExemptEncryption = false` está certo: só HTTPS e Keychain do sistema e `expo-crypto` para SHA-256 e bytes aleatórios do PKCE; nenhum algoritmo próprio de cifra | `app.json`, `google-nativo.ts`, busca por AES/cipher no app |
| ATS | O template do SDK 58 grava `NSAllowsArbitraryLoads = false` e `NSAllowsLocalNetworking = true`; a API é HTTPS (Let's Encrypt) e não há `http://` no app. Nada a justificar | template; o `introspect` mostra um modelo genérico com `true`, que não é o do prebuild |
| Áudio em segundo plano | **Corrigido.** O `expo-audio` liga `UIBackgroundModes: audio` por padrão (`enableBackgroundPlayback = true`), mas o app não toca nem grava fora da tela: a gravação é descartada quando o app sai (`aula-formatos.tsx`) e o som de fundo vai a 0 (`sons.ts`). A revisão recusa modo de fundo sem uso (2.5.4). Agora `enableBackgroundPlayback` e `enableBackgroundRecording` são `false` (no Android, saem o serviço e as permissões de primeiro plano) | `expo-audio/plugin/build/withAudio.js` |
| Textos de permissão | **Ajustados.** Câmera, fotos e microfone eram perguntas ("Permitir que o Studoo…?"); viraram o uso concreto (material de estudo, foto do perfil e da capa, gravar a explicação) | `app.json`; usos em `recorte.tsx`, `estudio-adaptativo.tsx`, `aula-formatos.tsx` |
| Manifesto de privacidade | **Adicionado** em `ios.privacyManifests`. O template do SDK 58 não traz `PrivacyInfo.xcprivacy`, e a Expo avisa que a Apple não lê bem os manifestos das dependências estáticas do CocoaPods; por isso o app declara a soma deles | docs.expo.dev/guides/apple-privacy; manifestos em `node_modules` |
| Face ID | O `expo-secure-store` grava `NSFaceIDUsageDescription` com o texto padrão em inglês; o app não usa `requireAuthentication`, então o pedido nunca aparece. Ficou como está | `withSecureStore.js` |
| Rede local | `NSLocalNetworkUsageDescription` e `NSBonjourServices` vêm do `expo-dev-client`; o lançador só entra no build Debug (`:configurations => :debug`), então o pedido não aparece no build de loja | `expo-dev-client.podspec` |
| Orientação | `app.json` não fixa `orientation`; o iPhone aceita retrato e paisagem. Não foi conferido em paisagem | `introspect` |

### Motivos declarados no manifesto

| Categoria | Códigos | De onde vem |
| --- | --- | --- |
| UserDefaults | `CA92.1` | React Native (`React/Resources`), `expo-constants` |
| FileTimestamp | `C617.1`, `0A2A.1`, `3B52.1` | React Native, Folly, glog, boost (`C617.1`); `expo-file-system` (`0A2A.1`, `3B52.1`); `expo-document-picker` lê a data do arquivo que a pessoa escolheu (`3B52.1`) |
| SystemBootTime | `35F9.1` | React Native (`ReactCommon/react/timing`), boost |
| DiskSpace | `E174.1`, `85F4.1` | `expo-file-system` |

`NSPrivacyTracking = false` e nenhum domínio de rastreamento: não há SDK de anúncio, IDFA nem `AppTrackingTransparency`. `expo-dev-menu` e
`expo-dev-launcher` usam UserDefaults, mas só entram no Debug. Se a Apple mandar e-mail de "missing API declaration" depois do envio, o código
pedido entra aqui.

Os tipos de dado coletados (rótulo de privacidade do App Store Connect) não estão no manifesto: são preenchidos no App Store Connect por quem
cuida de política e consentimento (Web & API e Mobile 2). Pelo código do app, a conta coleta e-mail, nome e foto do perfil, as fotos e arquivos
de material, as gravações de voz para transcrição e o texto das respostas, ligados à conta e usados para o funcionamento do app.

## Google e Apple no beta (regra 4.8)

Decisão do Julio (20/11), revisão `revisao/testflight-2026-11-20`: o build `testflight` leva "Continuar com a Apple" ao lado de "Continuar
com Google", o cadastro por e-mail (código de 6 dígitos) e "Esqueci minha senha", com o aceite de IA de terceiros e "Excluir conta" no
Perfil. Com a Apple no mesmo build, a 4.8 está atendida e o perfil não desliga mais o Google (`EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO` ficou só
como chave de emergência, sem uso em nenhum perfil); a exceção P27 antiga saiu da spec 07. Os dois mudam juntos: build com Google e sem Apple
é recusado na revisão. No app: `ios.usesAppleSignIn`, o plugin `expo-apple-authentication`, `apps/mobile/src/apple-nativo.ts`,
`cadastro.tsx`, `privacidade.tsx` e `consentimento-ia.tsx`. O roteiro de QA e o que depende do servidor e da conta Apple estão em
`docs/QA-TESTFLIGHT-ACESSO.md`.

A entrada Apple de verdade só fecha no build com `com.studoo.mobile.dev`: no Expo Go o token chega com `aud = host.exp.Exponent` e a troca é
recusada. A revisão Beta da Apple pede uma conta de demonstração com senha nas informações de teste.

## Fica para quem tem as contas

1. `eas init` e commitar `owner` e `extra.eas.projectId`.
2. Primeiro `eas build --profile testflight --platform ios` (credenciais da Apple pelo EAS).
3. `eas submit`, depois, no App Store Connect: grupo de teste externo, informações de teste com a conta de demonstração, rótulo de privacidade.
4. No servidor publicado e na conta Apple: os itens "Pendente" de `docs/QA-TESTFLIGHT-ACESSO.md` (capacidade Sign in with Apple no App ID,
   `APPLE_BUNDLE_IDS`, `STUDOO_APPLE`, `STUDOO_CADASTRO` com Resend, notificações da Apple e conta de demonstração).
