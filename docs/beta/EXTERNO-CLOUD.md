# Beta externo — estado de entrega

## Estado atual — 21/11/2026, 00:14 UTC (20/11, 21:14 em São Paulo)

O **Studoo 0.1.0 (3) está compilado, assinado, enviado e processado pela Apple**. O build está `VALID`, com estado externo `READY_FOR_BETA_SUBMISSION`. **Ainda não foi enviado à Beta App Review e não está disponível para testadores externos.**

Novas ações concluídas, com leitura de confirmação pela API:

- Nome, telefone e email do titular recuperados de duas assinaturas profissionais em fontes conectadas e salvos no contato de revisão. Esses dados pessoais não foram copiados para o Git.
- Email de feedback salvo em `pt-BR` e `en-US`; descrição, política e “O que testar” já estavam preenchidos.
- [Notas da revisão](conferencia-cloud/build-3-notas-revisao.txt) salvas. Conta demo marcada como necessária; suas credenciais ainda não foram preenchidas, porque precisam ser confirmadas no servidor real.
- [Estado atual sanitizado](conferencia-cloud/revisao-externa-3.json) e [preflight público repetido](conferencia-cloud/beta-externo-preflight.json). O único erro do preflight público é `apple_ativo`: Google está ligado, Apple continua desligada. Saúde, privacidade e suporte passaram; cadastro/recuperação desligados são avisos.
- [Comando de revisão preparado](ENVIAR-REVISAO-APPLE.md), com 22/22 testes do preflight e envio. A [execução autenticada em modo leitura](conferencia-cloud/revisao-apple-gate.json) confirmou vínculo app/build/bundle, processamento, contato e todas as localizações. Bloqueou exatamente por `demo_preenchida` e `preflight_publico` (`apple_ativo`). Nenhum POST de revisão foi feito; `--enviar` exige resolver esses bloqueios e impede repetição de revisão existente.
- [Diagnóstico final do CI nativo](QA-NATIVO-44833645289.md), com evidências e limites de cada falha. iPhone: login e 16/18 roteiros de telas passaram, geração e feedback de comunidade ficaram sem prova. Android: o emulador desapareceu durante o aceite. Não é uma validação completa do beta nem uma execução do IPA no TestFlight.

Faltam duas intervenções no servidor: **chave/configuração específica de Sign in with Apple e conta demo por senha**. A [operação mínima para o Dokploy](OPERACAO-SERVIDOR-EXTERNO.md) reúne os IDs reais, flags, notificações, provisionamento sintético e conferência web/mobile. A chave de equipe App Store Connect disponível não substitui a chave de login. A API oficial ASC não oferece criação/download dessa chave Sign in with Apple; essa etapa depende do portal Developer → Keys. Este Cloud não tem segredo/identidade Dokploy nem sessão Apple Developer no navegador. As buscas não localizaram esses acessos nas fontes disponíveis; isso não prova que não existam em outro ambiente.

Antes de declarar a entrega validada, ainda é necessário instalar o build 3 num iPhone e conferir logins reais, gerar/aceitar trilha, concluir a primeira lição, progresso salvo/retomada, avisos/protocolo/Desfazer da comunidade, exclusão/revogação e áudio no aparelho. A execução de simulador não substitui essa prova.

Depois de configurar o servidor e salvar a conta demo nos campos privados da Apple, repetir os gates e enviar **o build existente** à Beta App Review. Não repetir `eas submit` nem gerar outro IPA para uma alteração apenas no servidor/metadados. Nenhum testador interno foi adicionado; não houve convite para Julio ou alteração de papéis. Disponibilidade externa depende da aprovação da Apple.

Links: [TestFlight](https://appstoreconnect.apple.com/apps/6837508955/testflight/ios), [build EAS](https://expo.dev/accounts/miguelvzs/projects/studoo-mobile/builds/20b7bdac-da61-4ed8-8003-ccc98d3f35cb), [upload concluído](https://expo.dev/accounts/miguelvzs/projects/studoo-mobile/submissions/fcf8f42b-864a-4bcf-ad52-6598a981a194).

## Histórico da preparação

Os registros abaixo conservam o estado observado em cada etapa. As pendências já superadas de registro/assinatura/upload são históricas; para a situação vigente, usar o estado acima e o JSON sanitizado.

## Candidata preparada

Base recebida: `d1ed72f` em `release/testflight-cloud`. Ações separadas, todas na mesma release:

- `ceaafd9` — corrige o estado público do perfil respeitando a moderação. Web e mobile compartilham `perfilComLink` e `linksPublicosNoPerfil`; retirar, desfazer e encerrar link seguem a mesma regra. Os rótulos contam só links efetivamente públicos. Não altera a API, os payloads nem a moderação do servidor.
- `48ef632` — perfil explícito `submit.testflight`, resolvendo credenciais e Apple ID do app por variáveis; chave `.p8` ignorada pelo Git e mantida fora do repositório.
- `1ca4e4f` — preflight público `npm run beta:conferir`, com testes `npm run test:beta`.

Verificações na candidata preparada: regressões focadas 19/19, interface 288/288, paridade 5/5, typechecks web/mobile e build web passaram. Export de produção iOS passou, com bundle Hermes e assets. Prebuild iOS: zero erros e um aviso sobre o bundle `.dev` (deve ser exatamente o App ID Apple). O verificador dos fluxos nativos passou. Os onze testes do preflight passaram, sem rede.

Execução nativa iniciada no commit `1ca4e4f`, ainda sem resultado final no momento deste registro: [Capturas nativas — iPhone e Android](https://github.com/team-ponto-virgula/studoo-hack-brasil/actions/runs/44833645289). O iPhone usa simulador/Expo Go; não comprova login Apple do bundle assinado nem substitui a instalação do IPA no iPhone.

## Acesso Apple localizado

A pedido do dono, foram consultados os registros conectados e os metadados de credenciais do Expo. Uma chave de equipe App Store Connect existente foi encontrada na conta Expo dona do projeto, com papel ADMIN e time correspondente ao confirmado pela Apple. A chave privada foi recuperada pelo cliente EAS para arquivo privado em `/workspace/work/testflight-externo/apple/`, fora do checkout e com acesso restrito. Não há chave privada, senha, sessão ou JWT neste documento ou nos commits.

A chave da API do App Store Connect serve para consultar e preparar assinatura/submissão. Não é uma chave Sign in with Apple: o login do servidor continua dependendo da chave específica desse serviço. As buscas não localizaram cópia de chave Sign in with Apple no Drive, nos emails relevantes ou nos arquivos acessíveis deste workspace; isso não prova que ela inexista na conta Apple.

As consultas autenticadas à API oficial para listar o app e o Bundle ID retornaram HTTP 403, código `FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED`. O dono informou ter aceitado o contrato; o email oficial confirmou o aceite do **Apple Developer Program License Agreement** para o time correto. A consulta seguinte ainda retornou 403. Não presumir erro de chave nem solicitar outra chave por esse retorno; conferir novamente o estado dos contratos na conta antes de provisionar.

Não foi possível confirmar pela API o Apple ID numérico do Studoo enquanto esse bloqueio permanece. Não foi inventado um registro nem um número de app.

## Gate público do beta externo

```sh
npm run test:beta
npm run beta:conferir -- --json /workspace/work/testflight-externo/preflight.json
```

A [conferência executada](conferencia-cloud/beta-externo-preflight.json) bloqueou pelo login Apple desligado (`google: true`, `apple: false`). Saúde, páginas públicas, rota do nonce e IA DeepSeek passaram. Cadastro e recuperação desligados são avisos: não são motivo para bloquear se continuarem ocultos e não forem anunciados nas notas.

O gate não comprova login real, assinatura, funcionamento do IPA, moderação em dispositivo ou aprovação da Apple.

## Ordem para concluir

1. Confirmar que o aceite já liberou a API Apple e consultar/criar o registro correto do Studoo, preservando o bundle `com.studoo.mobile.dev`. Aceites legais ficam com o titular.
2. Provisionar Sign in with Apple no App ID, certificado e perfil de distribuição usando a chave de equipe existente, sem revogar certificados de outros apps.
3. Concluir com o operador do servidor a chave específica de Sign in with Apple, flags e notificações; conferir `apple: true` e executar os fluxos reais de entrada, reentrada e exclusão/revogação. Não usar a chave App Store Connect como chave de login.
4. Confirmar informações de revisão, conta demo, contato, política, suporte e declarações de privacidade/idade correspondentes aos recursos realmente habilitados. Não inventar contato, credenciais ou verificações.
5. Gerar o IPA da release, conferir o artefato assinado e submeter esse mesmo ID de build.
6. Acompanhar processamento, instalar e testar no iPhone, configurar grupo externo e enviar para Beta App Review. Publicar o app na App Store não faz parte desta entrega.

Variáveis privadas para o operador EAS: `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID` e `STUDOO_ASC_APP_ID`. As quatro primeiras já podem ser carregadas do arquivo privado de ambiente desta tarefa; a última depende da consulta ao app na Apple.

```sh
cd apps/mobile
npx eas-cli@latest build --platform ios --profile testflight
# Conferir o IPA desse build antes do envio.
npx eas-cli@latest submit --platform ios --profile testflight --id <ID_DO_BUILD_CONFERIDO> --no-auto-testflight-setup
```

O comando submit faz upload; não equivale a aprovação ou distribuição externa. Não usar `--latest` quando houver builds em paralelo. Não usar `--auto-submit` antes da conferência do IPA e da prontidão do servidor.

Até este registro não houve build iOS assinado, upload ao App Store Connect, envio à revisão beta ou teste de Apple real. Logs locais em `/workspace/work/testflight-externo/` e `/workspace/work/testflight/moderacao-*.log`; não publicar a pasta inteira.

## Primeiro IPA concluído — atualização em 20/11/2026

O aceite do contrato foi confirmado e a API da Apple passou a responder 200. A consulta filtrada pelo bundle ainda não encontrou um registro de app no App Store Connect. Esse registro inicial é criado pelo titular no site; a API oficial gerencia apps existentes, não cria o registro.

Recursos provisionados:

- Bundle ID `com.studoo.mobile.dev`, nome Studoo, recurso `56LH772ZWX`.
- Sign in with Apple habilitado como app principal pela API oficial e conferido por leitura: `APPLE_ID_AUTH`, configuração `APPLE_ID_AUTH_APP_CONSENT`, opção `PRIMARY_APP_CONSENT`.
- Certificado de distribuição válido do mesmo time reutilizado; nenhum certificado de outro app foi revogado.
- Novo perfil App Store do Studoo, ativo e com entitlement Apple.

O EAS CLI 27.11.0 tentou enviar o nome antigo `TIBURON_APP_CONSENT` e recebeu erro de validação da Apple. A configuração correta foi aplicada e conferida diretamente pela API; esta compilação usou `EXPO_NO_CAPABILITY_SYNC=1` apenas no comando local para impedir que o CLI sobrescrevesse a configuração correta. Não se retirou o entitlement do app. Antes de futuros builds com essa versão do CLI, reconferir a capability na Apple; atualizar o CLI quando a incompatibilidade estiver corrigida.

[Build EAS 20b7bdac-da61-4ed8-8003-ccc98d3f35cb](https://expo.dev/accounts/miguelvzs/projects/studoo-mobile/builds/20b7bdac-da61-4ed8-8003-ccc98d3f35cb): **FINISHED**, iOS **0.1.0 (3)**, perfil `testflight`, fonte `6c8b1d2664e595cae49ec4ca020742ec51b2eef3`. As tentativas de provisionamento anteriores consumiram os números remotos 1 e 2; não geraram outros IPAs.

O IPA foi baixado do artefato desse build (29.817.385 bytes) e passou no [auditor do pacote](conferencia-cloud/ipa-0.1.0-3.json): **0 erros, 0 avisos**. Foram conferidos Info.plist, manifesto e entitlement do perfil de provisionamento. Não foi feita validação `codesign` do executável em Mac nem instalação em iPhone. O arquivo permanece privado fora do Git em `/workspace/work/testflight-externo/studoo-0.1.0-3.ipa`.

Pendências atuais:

1. Criar o registro Studoo em App Store Connect com o bundle acima; consultar seu Apple ID e preencher `STUDOO_ASC_APP_ID`. O dono já recebeu os campos exatos.
2. Criar/configurar a chave específica de Sign in with Apple e ativar o servidor; o dono recebeu o caminho para disponibilizá-la pelo canal seguro do operador. A chave de equipe App Store Connect não substitui essa chave.
3. Completar conta demo e contato de revisão, conferir o IPA no iPhone e obter resultado da conferência nativa. O workflow ainda está executando; o Fluxo 1 do iPhone registrou falha e os logs finais ainda não estavam disponíveis. Não atribuir a causa ao app nem ao Expo Go sem esses logs.
4. Submeter esse ID de build, acompanhar o processamento e enviar para Beta App Review/grupo externo. Até esta atualização nenhum upload ou pedido de revisão beta foi feito.

A disponibilidade a testadores externos depende da aprovação da Apple; o objetivo do dono é concluir a entrega em 20/11, sem afirmar aprovação antes do resultado.

## Registro confirmado e upload concluído — atualização em 20/11/2026

O dono criou o registro pelo App Store Connect e viu o aviso “your user settings could not be saved”. A consulta autenticada confirmou que esse aviso **não impediu a criação do aplicativo**; não foi identificada a preferência específica que falhou.

- Apple ID do app: `6837508955`, nome Studoo, bundle `com.studoo.mobile.dev`, idioma `pt-BR`.
- O perfil `submit.testflight` agora contém os IDs reais do app e do time. No EAS CLI utilizado, só os campos `ascApiKeyPath`, `ascApiKeyId` e `ascApiKeyIssuerId` interpolam variáveis; IDs de app/time não são interpolados. A primeira tentativa parou na validação antes de agendar. O perfil foi corrigido em `3077f6d`.
- [Submissão EAS fcf8f42b-864a-4bcf-ad52-6598a981a194](https://expo.dev/accounts/miguelvzs/projects/studoo-mobile/submissions/fcf8f42b-864a-4bcf-ad52-6598a981a194) **FINISHED**: o upload do mesmo build `20b7bdac` foi concluído, sem submissão duplicada.
- A Apple confirmou o build `4eea9ee9-145e-4076-8ad1-e130af015d6c`, versão de build `3`, e o processamento passou a **VALID**. Isso não é aprovação do beta externo.
- Grupo **Studoo Beta Externo** criado (`34be86e5-92cb-4d59-9ffb-eafdd7d64a25`), sem link público habilitado, sem envio de convites e sem acesso automático a todos os builds.
- Descrições do beta e “O que testar” preparados em `pt-BR` e `en-US`, com a URL pública de privacidade. [Descrições](conferencia-cloud/beta-localizacoes.json), [O que testar](conferencia-cloud/build-3-o-que-testar.json), [estado sanitizado do upload](conferencia-cloud/upload-ios-3.json).

O fluxo externo **ainda não foi enviado à Beta App Review**. O gate público continua bloqueando pelo login Apple desligado no servidor. Os contatos de revisão do registro novo estavam vazios; o telefone real foi solicitado ao dono. A conta demo e a configuração específica de Sign in with Apple precisam estar prontas, sem inventar contato ou senha.

A conferência Android terminou em falha porque o dispositivo `emulator-5554` e o processo do emulador desapareceram durante o percurso. Entrada e login passaram e a proposta foi gerada; a interface da primeira lição e 46 das 54 capturas ficaram sem prova. A API registrou geração, aceite e leitura da primeira lição com HTTP 200. A causa raiz da morte do emulador é indeterminada, sem evidência para atribuí-la ao app ou descartá-lo. O iPhone passou pelo login sintético e segue nos fluxos de telas; a falha anterior do Fluxo 1 ainda aguarda os registros finais. Esse workflow não é uma execução do IPA no TestFlight e não constitui aprovação nativa completa.
