# Passo a passo para subir o Studoo ao TestFlight (Apple Developer, App Store Connect e EAS)

Página única para quem gera e envia o build do iPhone. Ela não repete o histórico. Para a preparação atual do beta externo no Cloud, veja [EXTERNO-CLOUD.md](EXTERNO-CLOUD.md), incluindo o acesso Apple encontrado e o bloqueio de contrato. Detalhes estão em:
- `docs/beta/CONFERENCIA-CLOUD-TESTFLIGHT.md`: o que já foi conferido e o estado do servidor;
- `docs/ACESSO-APPLE-CADASTRO.md`: o login com a Apple no servidor;
- `docs/QA-REVISAO-APPLE.md`: o QA.

Nada aqui pede senha no chat. Chaves e arquivos `.p8` vão pelo canal seguro combinado com o Lead, que grava no Dokploy.

## 0. O que já está pronto no código (ramo `main`)

Para preparar o próximo build a partir da `main`, siga o [guia de build do TestFlight](../BUILD-IOS-TESTFLIGHT.md).

| Item | Valor | Onde |
|---|---|---|
| Bundle ID | `com.studoo.mobile.dev`, definitivo: o App ID e o app no App Store Connect têm de usar este, e ele não muda depois de criado | `apps/mobile/app.json` |
| Versão / build | 0.1.0; o número do build é remoto e sobe sozinho (`autoIncrement`) | `app.json`, `eas.json` (`appVersionSource: remote`) |
| Projeto EAS | vinculado (`extra.eas.projectId` e `owner` do `app.json`) | `apps/mobile/app.json` |
| Perfil de build | `testflight`: distribuição `store`, Node 24.22.3, API em HTTPS, retorno do Google `studoo-dev://auth/google` | `apps/mobile/eas.json` |
| Sign in with Apple | entitlement `com.apple.developer.applesignin` + plugin `expo-apple-authentication` | `app.json` |
| Criptografia | `ITSAppUsesNonExemptEncryption = false` (o TestFlight não pergunta de novo) | `app.json` → Info.plist |
| Manifesto de privacidade | `PrivacyInfo.xcprivacy`: sem rastreamento; razões de UserDefaults, FileTimestamp, SystemBootTime, DiskSpace | `app.json` (`privacyManifests`) |
| Permissões | câmera, fotos e microfone com textos em português; sem Face ID; a rede local do cliente de desenvolvimento sai do build de loja | `app.json`; conferido com `node apps/mobile/scripts/conferir-artefato-ios.mjs --prebuild testflight` (0 erros) |

Antes do build, confira que `EXPO_PUBLIC_STUDOO_API_URL` no perfil `testflight` é a origem publicada certa. Ela fica embutida no app.

## 1. Apple Developer (developer.apple.com → Certificates, Identifiers & Profiles)

1. **Identifiers → App IDs → +** (ou deixe o EAS criar no primeiro build, e depois confira):
   - tipo App, Bundle ID explícito `com.studoo.mobile.dev`;
   - capability **Sign in with Apple** ligada, como "Enable as a primary App ID".
2. **Sign in with Apple → Server-to-Server Notification Endpoint** (na configuração da capability do App ID): `https://<origem publicada>/api/auth/apple/notificacoes`. A origem é a do perfil `testflight`.
3. **Keys → +**:
   - marque **Sign in with Apple** e configure com o App ID acima;
   - baixe o `.p8` (só se baixa uma vez) e anote o **Key ID**;
   - o **Team ID** aparece em Membership.
   - Entregue ao Lead pelo canal seguro, para o Dokploy:
     - `STUDOO_APPLE=1`;
     - `APPLE_TEAM_ID`;
     - `APPLE_KEY_ID`;
     - `APPLE_PRIVATE_KEY` (o PEM do `.p8`, com as quebras como `\n`);
     - `APPLE_BUNDLE_IDS=com.studoo.mobile.dev`.
4. Certificado de distribuição e perfil de provisionamento: deixe o EAS gerenciar (passo 3). Não é preciso criar à mão.

## 2. App Store Connect (appstoreconnect.apple.com)

1. **Apps → + → Novo app**:
   - plataforma iOS;
   - nome à escolha, desde que disponível;
   - idioma principal Português (Brasil);
   - Bundle ID `com.studoo.mobile.dev`;
   - SKU livre (por exemplo `studoo-ios`);
   - acesso total.
   - Anote o **Apple ID** numérico do app: o `eas submit` pede.
2. **Privacidade do app**:
   - URL da política: `https://<origem publicada>/privacidade`;
   - responda com a tabela da seção 4;
   - URL de suporte: `https://<origem publicada>/suporte`.
3. **TestFlight → Teste interno**: crie um grupo e adicione as pessoas da equipe (contas do App Store Connect). O build entra sem revisão da Apple.
4. **TestFlight → Teste externo** (só depois da seção 5): informações da revisão beta.
   - **Contato.**
   - **Conta de demonstração:** e-mail e senha de uma conta sintética do servidor publicado, nunca a de alguém da equipe. A entrada também tem "Experimentar sem conta".
   - **Notas:** o texto "o que testar" de `docs/beta/NOTAS-TESTFLIGHT.md`.

## 3. EAS (na máquina de quem tem a conta Expo do projeto)

```bash
cd apps/mobile
npx eas-cli@latest login            # conta Expo dona do projeto (owner do app.json)
npx eas-cli@latest build -p ios --profile testflight
#   Na primeira vez, aceite que o EAS gerencie as credenciais (login Apple no próprio CLI, ou uma chave da API do App Store
#   Connect). Ele cria ou usa o App ID, o certificado de distribuição e o perfil de provisionamento.
npx eas-cli@latest submit -p ios --profile testflight --id <ID_DO_BUILD_CONFERIDO> --no-auto-testflight-setup
#   Pede o Apple ID do app (passo 2.1) ou usa a chave da API do App Store Connect. Para não perguntar de novo, dá para
#   o registro do Studoo já está em `submit.testflight` (`ascAppId: 6837508955`); somente os campos da chave são resolvidos pelas variáveis do ambiente.
```

Depois do upload, acompanhe o processamento no App Store Connect. O tempo varia; upload concluído não comprova que o build já esteja disponível. Para o beta externo, configure o grupo e envie o build à revisão beta quando os requisitos abaixo estiverem atendidos.

## 4. Rótulo de privacidade (App Store Connect → Privacidade do app), tirado do código

Coleta de dados: **sim**. Rastreamento: **não**, para todos os tipos. Não há SDK de anúncio, de análise nem de relatório de falhas no app (`apps/mobile/package.json`), não há IDFA e nada é cruzado com dados de outras empresas. Para cada tipo marcado abaixo:
- **vinculado à identidade:** sim;
- **usado para rastrear:** não;
- **finalidade:** Funcionalidade do app.

| Tipo no App Store Connect | Marcar? | De onde vem no Studoo |
|---|---|---|
| Informações de contato → **Endereço de e-mail** | Sim | Conta por e-mail, Google ou Apple (pode ser o e-mail de retransmissão da Apple); códigos de cadastro e de recuperação. O visitante não tem e-mail. |
| Informações de contato → **Nome** | Sim | Nome do perfil, opcional e público quando a pessoa compartilha. |
| Conteúdo do usuário → **Fotos ou vídeos** | Sim | Foto do perfil e capa da trilha (guardadas no servidor) e fotos de material de estudo (lidas para montar a trilha, guardadas por até 24 h e enviadas ao provedor de IA). |
| Conteúdo do usuário → **Dados de áudio** | Sim | "Explique em voz alta": a gravação é enviada para transcrição pela OpenAI. O Studoo não guarda o áudio, mas um terceiro o recebe. |
| Conteúdo do usuário → **Outro conteúdo do usuário** | Sim | Objetivos de estudo, respostas, trilhas, legendas, resumo e interesses do perfil, materiais (PDF, DOCX, CSV), denúncias e mensagens ao suporte. |
| Identificadores → **ID do usuário** | Sim | ID da conta e ID público do perfil. |
| Dados de uso → **Interação com o produto** | Sim | Progresso nas lições (onde a pessoa parou, acertos), usado para retomar a trilha. |
| Localização, Contatos, Saúde e condicionamento, Financeiro, Histórico de navegação, Histórico de pesquisa, Informações sensíveis, Compras, Diagnóstico, Outros dados | Não | Não coletados. O endereço IP só entra como chave assinada dos limites de uso, sem ficar guardado em claro nem vinculado à conta. |

Terceiros que recebem dados para a funcionalidade, para conferir com a política em `/privacidade`:
- a OpenAI, que lê pedidos, materiais, respostas e áudio;
- o envio de e-mail (Resend), que recebe os códigos;
- Google e Apple, no login.

O consentimento de IA aparece no app antes do primeiro envio. A exclusão de conta fica no Perfil (5.1.1(v)).

## 5. Antes de pedir revisão externa (ou de mandar a um testador de fora da equipe)

- **Regra 4.8:** com o servidor anunciando `google: true` e `apple: false`, o iPhone mostra o Google sem a Apple. Para o teste interno não importa; para revisão externa, ligue a Apple no servidor antes (seção 1, item 3).
- **Cadastro e recuperação de senha** estão desligados no servidor publicado (`cadastro: false`, `recuperacao: false`) até o e-mail real (Resend) ser configurado. O revisor entra com a conta de demonstração ou como visitante.
- **E-mail de retransmissão da Apple:** confira que `STUDOO_DOMINIO_EMAIL` não restringe domínios; o domínio `privaterelay.appleid.com` precisa entrar.
- **Confira o servidor de novo** com `GET /api/auth/config`: `apple: true` depois das chaves; `/privacidade` e `/suporte` com 200.

## 6. Conferência no iPhone, depois de instalar pelo TestFlight

1. Entrada: "Continuar com a Apple" ao lado de "Continuar com o Google" (só com a Apple ligada no servidor); entrar com cada um e sair.
2. Perfil:
   - Privacidade e dados: revogar a IA e ver o cartão de consentimento voltar antes do próximo envio;
   - "Excluir conta" com uma conta descartável, depois tentar entrar de novo.
3. Comunidade:
   - denunciar uma trilha pelo "•••" (aviso com protocolo);
   - bloquear e desfazer;
   - Ajuda → "Falar com o suporte".
4. Música: o Lo-fi segue tocando ao trocar de tela.
5. Anote o aparelho, a versão do iOS e o número do build em cada resultado.
