# Envio de Julio ao TestFlight

Julio já é **Developer** da organização Expo `@studoo` e do App Store Connect, com acesso Apple limitado ao Studoo (`6837508955`). Em 23/11/2026 foi habilitada a permissão **Generate Individual API Keys**; o acesso a outros apps e ao provisionamento continua desligado. [Conferência da permissão](conferencia-cloud/julio-chave-individual.json).

O perfil **`submit.testflight-individual`** usa a chave individual do usuário que envia. Para esse tipo de chave são necessários **o arquivo `.p8` e o Key ID**; **não se usa Issuer ID**. A chave herda os apps e as permissões do próprio Julio.

É uma chave API do App Store Connect para upload. A chave Sign in with Apple pertence à configuração do login no servidor.

## 1. Julio gera a própria chave, uma vez

Na conta dele em [App Store Connect](https://appstoreconnect.apple.com/):

1. Abrir o próprio nome, no canto superior direito, e **Edit Profile**.
2. Ir a **Individual API Key → Generate Key**.
3. Anotar o **Key ID** e usar **Download** para baixar o `.p8`.
4. Guardar o arquivo fora do repositório, em um segredo local/Cloud. O download só é permitido uma vez; se já existir uma chave individual ativa, usar a cópia guardada e não revogá-la por antecipação.

Em português, a seção pode aparecer como **Chave de API Individual → Gerar Chave de API → Baixar Chave de API**. Esse passo precisa da sessão do próprio Julio; a permissão concedida pelo titular não gera nem baixa a chave em nome dele.

## 2. Configurar o envio no ambiente dele

Atualizar a branch `release/testflight-cloud` e disponibilizar estas duas variáveis no terminal ou nos segredos de CI:

```sh
export EXPO_ASC_INDIVIDUAL_KEY_PATH='/caminho/privado/AuthKey_DA_CHAVE_INDIVIDUAL.p8'
export EXPO_ASC_INDIVIDUAL_KEY_ID='KEY_ID_DA_CHAVE_INDIVIDUAL'
unset EXPO_APPLE_APP_SPECIFIC_PASSWORD
```

O caminho e o Key ID identificam a chave individual do Julio. O perfil não lê as variáveis da chave de equipe do titular. Uma senha específica de app presente no ambiente teria precedência no EAS CLI, por isso ela é removida desse processo de envio.

Entrar na Expo com a conta dele e conferir o projeto:

```sh
cd apps/mobile
npx eas-cli@27.11.0 login
npx eas-cli@27.11.0 project:info
```

O resultado esperado é **`@studoo/studoo-mobile`**, UUID `81f67b49-67e1-4807-bf88-16f187169dfd`. A versão mínima do CLI foi atualizada para a versão conferida com chaves individuais.

## 3. Enviar o build conferido

Depois de gerar e conferir um **novo build ainda não enviado**, usar seu ID EAS explícito:

```sh
npx eas-cli@27.11.0 submit \
  --platform ios \
  --profile testflight-individual \
  --id <ID_DO_NOVO_BUILD_EAS_CONFERIDO> \
  --non-interactive \
  --no-auto-testflight-setup \
  --wait
```

O build **0.1.0 (3)** já foi enviado; não repetir seu upload. O perfil mantém o bundle `com.studoo.mobile.dev`, Apple Team `PYZ6U56AMV` e app `6837508955`.

`--no-auto-testflight-setup` evita a etapa adicional do CLI que tenta preparar grupos usando outra autenticação. O comando acima faz upload do build; processamento, associação a grupos e Beta App Review são etapas separadas. [Estado do beta externo](EXTERNO-CLOUD.md).

## Verificação desta preparação

A permissão na Apple foi confirmada por leitura autenticada. O perfil foi conferido pelo schema/resolvedor do EAS e pelas classes do CLI com credenciais sintéticas, sem chave real de Julio e sem chamadas de upload. As 22 verificações de `npm run test:beta` passaram. [Registro da validação local](conferencia-cloud/julio-submit-validacao.json). A autenticação Apple de Julio e o envio real ainda dependem da chave que ele gerar; não foram declarados aprovados por essa validação local.

O perfil anterior `submit.testflight`, usado pelo operador Cloud, permanece disponível. O envio individual não requer a chave de equipe com acesso Admin do titular. Para CI, a autenticação Expo também precisa de um token próprio com acesso adequado à organização; no login interativo, Julio usa a própria conta.

Fontes: [gerar chave individual — Apple](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/#generate-api-keys-for-individual-use), [autorização para upload de builds — Apple](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [autenticação e chaves individuais — Apple](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api), [seleção da chave no EAS CLI](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/submit/ios/AscApiKeySource.ts).
