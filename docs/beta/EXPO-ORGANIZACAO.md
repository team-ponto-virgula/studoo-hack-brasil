# Organização Expo do Studoo

Conferência de **23/11/2026, 14:45 UTC**. [Estado sanitizado](conferencia-cloud/expo-organizacao.json).

## Configuração concluída

- Organização **[@studoo](https://expo.dev/accounts/studoo)**, nome Studoo, ID `006e5145-dd10-4fca-b745-147fc7cf53ef`.
- `miguelvzs` permanece **Owner**.
- Julio aceitou o convite e já é membro **Developer**, com o conjunto exato `PUBLISH`, `RUN`, `VIEW`.
- Projeto existente transferido para **[@studoo/studoo-mobile](https://expo.dev/accounts/studoo/projects/studoo-mobile)**.
- `apps/mobile/app.json` atualizado para `expo.owner: studoo`. O UUID continua `81f67b49-67e1-4807-bf88-16f187169dfd`; slug, scheme, bundle e IDs Apple foram preservados.

## Foto da organização

A foto foi atualizada com a versão quadrada do logo já usada no ícone do app: fundo azul, os dois “o” como óculos brancos e o sorriso do Studoo. A API confirmou a mudança; a imagem processada pela Expo respondeu 200 e foi inspecionada visualmente. [Imagem conferida](conferencia-cloud/expo-avatar-verificado.jpg) e [registro do upload](conferencia-cloud/expo-avatar.json).

## O que foi conferido de fato

| Verificação | Resultado |
| --- | --- |
| Organização, projeto e associação de Julio pela API Expo | Owner e Developer confirmados; aceite concluído; um projeto na organização |
| Configuração resolvida pelo SDK Expo | Owner `studoo`; UUID, slug, scheme e identificadores nativos preservados |
| `eas project:info` em `apps/mobile` | `@studoo/studoo-mobile`, mesmo projectId |
| [Build EAS existente `20b7bdac`](https://expo.dev/accounts/studoo/projects/studoo-mobile/builds/20b7bdac-da61-4ed8-8003-ccc98d3f35cb) | `FINISHED`, iOS 0.1.0 (3), fonte `6c8b1d2664e595cae49ec4ca020742ec51b2eef3` |
| `eas build:version:get --platform ios --profile testflight` | Numeração remota preservada em `3` |
| [Assinatura no destino](conferencia-cloud/expo-assinatura-escopo.json) | Certificado e perfil pertencem a `studoo` e estão disponíveis; serial e UUID do perfil preservados |
| `npm run test:beta` | 22/22 passaram |
| `git diff --check` | Passou |

Não houve nova compilação ou upload para a Apple nesta mudança. O registro Apple `6837508955`, o build TestFlight **0.1.0 (3)** e os grupos internos permanecem recursos separados. Os testes de identidade e configuração não substituem QA no aparelho.

## Como Julio trabalha

Julio usa o próprio login Expo com acesso Developer à organização. Para gerar builds de distribuição, prepare a `main` atualizada e sem alterações locais conforme o [guia do TestFlight](../BUILD-IOS-TESTFLIGHT.md#como-gerar-e-enviar-quem-tem-a-conta-expo-e-a-conta-apple).

```sh
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest build --platform ios --profile testflight
```

Para automações/CI, pode usar um token pessoal limitado à organização e ao papel Developer, disponibilizado como `EXPO_TOKEN`. O login interativo não exige um token fornecido pelo titular.

**Para Julio enviar ao TestFlight**, foi preparado o perfil `submit.testflight-individual`, com a chave individual dele: arquivo `.p8` e Key ID, sem Issuer ID. A permissão de geração dessa chave já foi habilitada no App Store Connect, mantendo acesso somente ao Studoo. [Geração e comando de envio](ENVIO-JULIO-TESTFLIGHT.md).

O perfil `submit.testflight`, com as três variáveis privadas da chave de equipe, continua disponível ao operador Cloud. A organização não possui chave App Store Connect armazenada; a função Developer na Expo não fornece uma chave Apple por si só.

A organização tem proteção de credenciais e variáveis desligada, conforme a configuração conferida. Os certificados/perfis de assinatura compartilhados estão disponíveis para os builds. Foram encontrados zero canais EAS Update e zero variáveis de projeto/conta a migrar nesta candidata.

## Histórico da transferência

A organização foi criada e o convite Developer foi enviado nesta tarefa. A primeira tentativa de `me.transferApp` foi recusada por exigir **sudo mode**. Em conferência posterior, a transferência e o aceite de Julio já estavam concluídos. O [patch de owner preparado](conferencia-cloud/expo-owner-studoo.patch) foi então aplicado. Essa etapa está concluída.

Metadados e verificações estão nos arquivos vinculados acima. Material privado de recuperação da assinatura, chaves e respostas com URLs assinadas permanecem fora do Git. [Estado do beta](EXTERNO-CLOUD.md).

Fontes: [contas e transferência Expo](https://docs.expo.dev/accounts/account-types/), [identidade permanente do projeto](https://github.com/expo/fyi/blob/main/eas-project-id.md), [mapeamento oficial de papéis](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/user/roles.ts).
