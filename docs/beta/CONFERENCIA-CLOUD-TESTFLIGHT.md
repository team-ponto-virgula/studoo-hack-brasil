# Conferência para o TestFlight — Codex Cloud, 20/11/2026

## Candidata e ações

A `main` remota continua em `b8b138c`. A candidata atual de integração para iPhone está em `origin/integracao/testflight-2026-11-20`, revisão `4a60291dfde722b0488f128066b883eefb43ec83`. Esta preparação usa a branch `release/testflight-cloud`, checkout `/workspace/studoo-testflight`; o checkout anterior em `/workspace/studoo` foi preservado.

O app atual usa Expo SDK 58, React Native 0.88.1, versão 0.1.0 e bundle `com.studoo.mobile.dev`. Já contém o Stu caderno, a barra de navegação nativa, Apple/Google, cadastro com código por email, exclusão de conta, consentimento de IA, denúncias/bloqueio e suporte. Os últimos ajustes integrados incluem a ponte de reforço em três passos, o enquadramento da próxima lição e a barra de Salvar do Perfil.

Ações separadas em Conventional Commits:

- `55f9c3f`: vínculo ao projeto EAS `@miguelvzs/studoo-mobile`, ID `81f67b49-67e1-4807-bf88-16f187169dfd`. Confirmado com `eas project:info`. O login foi autorizado pelo dono pelo fluxo oficial de dispositivo, sem senha no chat.
- `9c3b93b`: testes de reabertura do reforço atualizados. Os testes anteriores exigiam por regex estados retirados do componente antigo. A cobertura executa os handlers reais do componente atual: passos, erro, nova tentativa, acerto, feedback preservado e releitura sem reavaliar. Nenhuma mudança de runtime para satisfazer teste.

## O que passou de fato

Dependências instaladas pelo lockfile com `npm ci`. Banco PostgreSQL local separado em `.studoo-local` deste checkout, migrado, com conta sintética, `IA=falsa` e `EMAIL=falso`. Não se usaram credenciais do banco publicado.

| Comando / verificação | Resultado |
| --- | --- |
| `npm run typecheck` | passou |
| `npm run typecheck --workspace apps/mobile` | passou |
| `npm run build` | passou |
| `test:paridade` | 5/5 |
| `test:movimento` | 4/4 |
| `test:visitante-mobile` | 6/6 |
| `test:google-mobile` | 15/15 (inclui visitante-mobile) |
| `test:estudio:interface` | 263/263, repetidos após a correção do teste |
| `test:formatos` | 44/44 |
| `test:dominio` | 18/18 após corrigir os dois testes obsoletos |
| Apple + consentimento mobile, execução direta | 20/20 (também cobertos por interface) |
| `test:cadastro-apple` | 13/13, Apple e email simulados |
| `test:privacidade` | 4/4 |
| `test:acesso` | 20/20 |
| `test:marco` | 6/6, inclui SQL, conclusão e retomada |
| `test:trilha` | 26/26 |
| Export de produção Expo para iOS | passou, bundle Hermes e assets gerados |
| Auditor oficial `conferir-artefato-ios.mjs --prebuild testflight` | 0 erros, 1 aviso: o bundle termina em `.dev`, portanto esse precisa ser o App ID da Apple |
| `GET /privacidade`, `GET /suporte` na web local de produção | 200 / 200 |
| `GET /api/mobile/apple/nonce` local | 405: rota POST presente |

O [resultado do prebuild](conferencia-cloud/prebuild-ios.json) confere o entitlement Apple, ATS, esquema de retorno do Google, manifesto de privacidade, permissões e ausência de texto Face ID. A conferência ocorreu antes do vínculo EAS; o vínculo não altera esses campos nativos. A configuração Expo vinculada também foi resolvida e conferida depois.

Limites: export JS e prebuild não são uma compilação Xcode assinada. Esta máquina é Linux, não tem simulador iOS. Não foi gerado IPA, não houve upload ao App Store Connect e não houve validação em iPhone/TestFlight. Nenhuma revisão Beta foi solicitada. Apple real, Resend, revogação na Apple e Google real não foram exercitados.

## Servidor publicado: bloqueio confirmado

Origem usada pelo perfil `testflight`: `https://studoo-web-suqmqb-3a8f9c-187-53-116-195.sslip.io`.

A [sondagem pública](conferencia-cloud/api-publicada.json) registrou:

- Saúde 200.
- `/api/auth/config` anuncia Google, DeepSeek e comunidade; recuperação `false`; campos Apple e cadastro ausentes.
- `/privacidade` e `/suporte`: 404.
- `GET /api/mobile/apple/nonce`: 404 (na candidata atual, a rota POST existe e o mesmo GET recebe 405).

Portanto, a candidata local atual não está inteiramente publicada nessa origem. O botão Apple depende da configuração do servidor; o entitlement sozinho não habilita o login na interface. Não emitir um beta externo afirmando que Apple/cadastro/suporte estão prontos.

### Atualização necessária no Dokploy

É necessário acesso ao painel/implantação ou ao operador atual. Nenhuma credencial desse serviço foi fornecida à máquina; não foi alterado o servidor remoto.

1. Conferir que a origem acima ainda é a correta. Se mudou, ajustar `EXPO_PUBLIC_STUDOO_API_URL` no perfil antes de gerar o build; a URL fica incorporada ao bundle.
2. Publicar a candidata integrada com as migrações atuais de `prisma/migrations`. Preservar o banco e `STUDOO_CHAVE_ASSINATURA`; não substituir configuração real pelo `.env` sintético deste checkout.
3. Conferir HTTPS e canal nativo atrás do proxy: `STUDOO_ORIGEM`, `STUDOO_SESSAO_MOBILE_PILOTO=1` e `STUDOO_PROXY_HTTPS=1`, conforme [o guia de build](../BUILD-ANDROID.md).
4. Configurar Apple e email reais conforme [Acesso Apple/cadastro](../ACESSO-APPLE-CADASTRO.md): App ID com Sign in with Apple, `STUDOO_APPLE=1`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` e `APPLE_BUNDLE_IDS=com.studoo.mobile.dev`; `STUDOO_CADASTRO=1`, `EMAIL=resend`, remetente/domínio verificados. Não habilitar flags sem os provedores prontos.
5. Conferir Google, callback HTTPS, notificações Apple e ausência de restrição de domínio/email que bloqueie o revisor e o Hide My Email. Definir contato de privacidade, equipe que atende o suporte e conta demo por senha nas informações privadas de teste.
6. Repetir a sondagem; exigir páginas públicas 200 e flags de Apple, Google, cadastro e recuperação corretas. Conferir os fluxos reais de acesso antes de declarar prontos.

## Servidor publicado: atualizado em 20/11/2026, 21:55 UTC (Studoo Lead, OpenBot)

O bloqueio acima foi resolvido em parte, com autorização do dono e pelo acesso ao Dokploy que o Lead já tinha.

Feito e conferido:

- A origem acima passou a servir `4a60291dfde722b0488f128066b883eefb43ec83` (deployment `M9bpVaHYMcT5IxbdYTsFW`, concluído às 21:53:38 UTC). Antes servia `0491ed7`.
- Migrações de 14 para 17 aplicadas com `prisma migrate deploy` no contêiner novo, sem pendência. Antes da troca foi feita a cópia `studoo_bkp_20261120_antes_da_troca` no mesmo PostgreSQL, com as mesmas contagens do original (9 contas, 37 trilhas, 10 links, 185 lições).
- O conteúdo de demonstração foi reaprovado com `npm run comunidade:demo` (6 perfis, 10 trilhas). Não havia publicação de pessoa real para ficar pendente.
- [Sondagem nova](conferencia-cloud/api-publicada-depois-da-troca.json): saúde 200; `/privacidade` 200; `/suporte` 200; `GET /api/mobile/apple/nonce` 405 (rota POST presente); `/api/auth/config` anuncia `google: true`, `apple: false`, `cadastro: false`, `recuperacao: false`.
- Percurso logado `studoo-verificar` dentro do contêiner, iniciado depois do deployment: `login`, `consentimento_ia`, `proposta`, `criar_trilha`, `errar_exercicio`, `criar_ponte`, `acertar_ponte` e `apagar_trilha`, todos HTTP 200, com a IA real.
- Variáveis acrescentadas: `STUDOO_EQUIPE_EMAILS` (o e-mail do dono, que modera) e `STUDOO_CONTATO_PRIVACIDADE` (a página `/suporte`). O Google já estava ligado, com cliente OAuth Web do projeto do dono e retorno em `/api/auth/google/retorno`; o login completo pelo Google foi provado na web com a conta do dono.

Continua pendente (itens 4 e 5 da lista acima):

- Apple: `STUDOO_APPLE`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` e `APPLE_BUNDLE_IDS` esperam a chave "Sign in with Apple" da conta que vai assinar o app. Enquanto isso o servidor anuncia `apple: false` e o botão não aparece.
- Cadastro e recuperação por e-mail: desligados, porque não há domínio de envio verificado.
- Restrição de acesso: `STUDOO_DOMINIO_EMAIL=example.test` com um Gmail liberado. Bloqueia revisor, jurado e "Ocultar meu e-mail"; abrir é decisão do dono.
- Notificações da Apple (`/api/auth/apple/notificacoes`) e a conta de demonstração nas informações de teste: dependem da conta Apple.

As chaves da Apple entram pelo formulário seguro do OpenBot, para o Studoo Lead gravar no Dokploy sem expor valor. Nada de chave em chat, commit ou `app.json`.

## Próximo envio

O dono informou já ter Apple Developer. Ainda é necessário configurar o acesso de assinatura/submissão (certificado/perfil no EAS ou API key de equipe App Store Connect; o `.p8` de Sign in with Apple no servidor é uma chave diferente). Não gravar chaves em app.json, eas.json, EXPO_PUBLIC_ ou commits.

Após corrigir o servidor e as credenciais:

```sh
cd /workspace/studoo-testflight/apps/mobile
npx eas-cli@latest project:info
npx eas-cli@latest build --platform ios --profile testflight
```

Baixar o IPA desse build e conferir com `apps/mobile/scripts/conferir-artefato-ios.mjs --app <ipa> --temp <pasta>` antes do envio. Usar o ID desse build específico para submeter (`eas submit --platform ios --id <id>`), evitando escolher outro build por `--latest` se houver trabalhos em paralelo. Depois acompanhar processamento no App Store Connect, conta demo, grupo TestFlight e eventual revisão externa. App Store público não faz parte desta ação.

Logs locais em `/workspace/work/testflight/`. O login Expo e o `.env` ficam fora do Git. Não publicar a pasta de trabalho inteira, que também contém dados sintéticos e arquivos temporários privados.
