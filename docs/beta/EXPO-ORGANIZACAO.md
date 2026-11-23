# Organização Expo do Studoo

Conferência de 23/11/2026, 14:28 UTC. [Estado sanitizado](conferencia-cloud/expo-organizacao.json).

## Concluído

- Organização **[@studoo](https://expo.dev/accounts/studoo)** criada, nome Studoo, ID `006e5145-dd10-4fca-b745-147fc7cf53ef`.
- `miguelvzs` confirmado como **Owner**.
- Convite enviado ao email exato de Julio informado nesta tarefa, com papel **Developer**: permissões `PUBLISH`, `RUN` e `VIEW`. O aceite do convite da **Expo** permanece pendente; é separado do acesso Apple/TestFlight já configurado.
- Conferência da assinatura existente e cópia privada de recuperação concluídas antes da tentativa de transferência. Material privado fica fora do Git.

## Transferência pendente de reautenticação na Expo

O projeto ainda é **`@miguelvzs/studoo-mobile`**, ID `81f67b49-67e1-4807-bf88-16f187169dfd`. A nova organização está sem projetos enquanto essa etapa não termina.

A chamada autenticada `me.transferApp` foi recusada pela Expo com **“This method can only be called when in sudo mode”**. A leitura seguinte confirmou que o proprietário continuava `miguelvzs`. O EAS CLI oficial exige reconfirmar a senha e, se habilitado, o segundo fator para elevar uma sessão; isso não é outra permissão do projeto ou um pedido de Admin para Julio.

O titular pode concluir diretamente no site da Expo:

1. Abrir [as configurações do projeto existente](https://expo.dev/accounts/miguelvzs/projects/studoo-mobile/settings), usando sua conta de titular.
2. Em **General → Transfer project**, escolher **studoo** como destino.
3. Confirmar a transferência e a reautenticação solicitada no próprio site.

## Continuidade após o painel confirmar

Primeiro consultar novamente o projeto pelo UUID acima e exigir `ownerAccount.name = studoo`. Então aplicar o [patch de um campo](conferencia-cloud/expo-owner-studoo.patch):

```sh
git apply --check docs/beta/conferencia-cloud/expo-owner-studoo.patch
git apply docs/beta/conferencia-cloud/expo-owner-studoo.patch
npm run test:beta
cd apps/mobile
npx eas-cli@latest project:info
```

O patch está preparado e validado, **ainda não aplicado**, porque a transferência remota não terminou. Ele troca somente `expo.owner`; conserva UUID, slug `studoo-mobile`, scheme `studoo-dev`, bundle `com.studoo.mobile.dev`, IDs Apple e perfis EAS. Não criar outro projeto nem executar `eas init` para essa operação.

Conferir depois da transferência:

- Mesmo projectId, novo endereço `@studoo/studoo-mobile`, histórico do [build `20b7bdac`](https://expo.dev/accounts/miguelvzs/projects/studoo-mobile/builds/20b7bdac-da61-4ed8-8003-ccc98d3f35cb) e numeração remota preservados.
- Certificado e perfil de assinatura do Studoo disponíveis, comparando os metadados com a cópia privada. Não revogar ou regenerar certificados de outros apps por antecipação.
- Convite/membro de Julio com o conjunto exato de permissões Developer.
- Configuração local resolvida com owner `studoo` e `npm run test:beta` aprovado.

A conferência anterior à transferência encontrou **zero canais EAS Update, zero variáveis do projeto e zero variáveis da conta de origem**. Não havia proteção de canal para reaplicar nesta candidata. O repositório também não configura `expo-updates` ou um token Expo no CI. Ainda assim, credenciais e recursos de conta devem ser conferidos no destino: a transferência não equivale à conversão de toda a conta pessoal.

As associações de chave App Store Connect para builds/submissões estavam vazias no projeto. O perfil de submissão atual usa um arquivo privado fornecido pelo operador. As próximas submissões continuam dependendo desse acesso; o convite Expo, por si só, não fornece uma chave Apple ao Julio.

O registro Apple `6837508955`, o build TestFlight **0.1.0 (3)** e seus grupos são recursos separados. Nenhum novo IPA ou upload foi criado nesta ação. [Estado do beta](EXTERNO-CLOUD.md).

Fontes: [contas e transferência Expo](https://docs.expo.dev/accounts/account-types/), [identidade permanente do projeto](https://github.com/expo/fyi/blob/main/eas-project-id.md), [mapeamento oficial de papéis](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/user/roles.ts).
