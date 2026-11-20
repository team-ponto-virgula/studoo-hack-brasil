# Preparação do beta externo — Codex Cloud, 20/11/2026

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
