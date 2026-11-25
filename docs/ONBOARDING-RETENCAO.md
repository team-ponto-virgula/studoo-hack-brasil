# Onboarding aplicado e base de retenção

Revisão de 25/11/2026, na integração `feat/onboarding-retencao`, a partir de `release/testflight-cloud` em `03a47be`. A release posterior `675226c` foi integrada em `22e8329`, preservando proteção de trilhas, novas tentativas e prazos de geração da equipe.

O pedido explícito do dono passou a ser um fluxo aplicado, do cadastro à primeira lição, com uma base de retenção. Esta revisão substitui o adiamento de meta diária e o estado “só documentação” da [spec 17](specs/17-onboarding-e-primeira-vez.md), preservando o histórico daquela análise.

## Percurso e regra de entrada

Boas-vindas públicas → criar conta → objetivo ou material → meta diária → preparação da trilha → consentimento de IA quando necessário → geração e aceite → lição real → conclusão confirmada → próximo passo e retomada.

“Já tenho conta” abre o login. A conta existente entra diretamente nos estudos, inclusive depois de reinstalar ou mudar de aparelho. Uma orientação pendente pode ser retomada voluntariamente. A apresentação manual antiga não decide quem é novo.

| Caso | Comportamento |
| --- | --- |
| Cadastro por e-mail | Cria conta, `OnboardingConta` e sessão inicial na mesma transação. Mantém prova de posse por código. |
| Primeiro acesso Google ou Apple que cria conta | Cria o mesmo estado por conta e marca somente a sessão inicial. Google web redireciona a `/onboarding`; o código PKCE nativo conserva o marcador até emitir a sessão. |
| Novo login em conta existente | Nova sessão sem marcador; não reinicia o roteiro. Não vincula provedores só por coincidência de e-mail. |
| Conta anterior à migração | Sem linha de onboarding; não é classificada como nova pela ausência de trilhas ou de preferências no aparelho. Pode definir meta sem ser inscrita no onboarding. |
| Sessão restaurada | O servidor decide a elegibilidade. A instalação não é fonte da verdade. |
| Visitante | Permanece temporário, sem onboarding por conta ou meta persistida. Não há migração de progresso para uma conta. |
| Convite ou trilha compartilhada | O destino fica pendente durante a orientação e é entregue ao adiar ou pela ação de retorno. Não aceitar destinos arbitrários vindos da query. |

O objetivo e a meta têm efeito: alimentam o estudo e o indicador diário. O modo `assunto` retoma a preparação por pedido; `material` retoma o envio de material. Não há questionário de perfil sem uso definido.

## Contrato e persistência

Fonte compartilhada: [`@studoo/contratos/onboarding`](../packages/contratos/src/onboarding.ts).

`GET /api/onboarding` e `POST /api/onboarding` usam os mesmos guardas privados do produto: cookie e origem da web ou Bearer do canal nativo. A rota não confia em um `usuarioId` recebido no corpo. Respostas privadas não são cacheadas.

O retorno contém:

- `onboarding`: etapa, versão, objetivo, modo, meta, trilha e datas privadas; `null` em conta antiga e visitante.
- `iniciarAutomaticamente`: verdadeiro somente para a sessão emitida junto da criação de uma conta elegível.
- `retencao`: meta, primeiras conclusões do dia, meta atingida, total de conclusões, dias de estudo, sequência informativa, última conclusão e próxima lição recuperável.

O cliente compartilhado `criarClienteOnboarding(transporte)` oferece `obterOnboarding()` e `atualizarOnboarding(acao)` com a mesma conversão de erro nos dois clientes. Ações:

| Ação | Efeito |
| --- | --- |
| `iniciar` | Reconhece a apresentação inicial e consome o marcador dessa sessão; é idempotente. |
| `preparar` | Guarda objetivo válido, modo e meta de 1, 2 ou 3 lições; pode receber fuso válido. Trocar objetivo ou modo inicia outra preparação, sem reassociar uma trilha anterior. |
| `vincular-plano` | Confere dono e marco da preparação antes de guardar a trilha aceita. |
| `adiar` / `retomar` | Guarda ou remove o adiamento, conservando objetivo, modo e checkpoint. |
| `definir-meta` | Atualiza a meta privada da conta. Não cria onboarding para contas antigas. |

Não existe ação HTTP para alegar conclusão do onboarding. O servidor reconcilia uma primeira conclusão real em `RegistroEstudo`, da própria conta e da trilha elegível. Abrir uma lição, responder, ver uma tela ou afirmar `concluido: true` não basta. Se a resposta do vínculo se perder, a leitura pode recuperar a trilha criada depois da preparação; a data `preparadoEm` impede recuperar a trilha de um objetivo anterior. Uma trilha apagada antes da conclusão retorna a um ponto útil do preparo.

O estado mora em `OnboardingConta`, com exclusão em cascata ao excluir a conta. `Usuario.metaLicoesDia` guarda a preferência, inclusive em contas antigas. `Sessao.onboardingInicial` e `CodigoGoogleMobile.onboardingInicial` identificam o contexto de criação sem depender de armazenamento da instalação.

## Retenção que já tem comportamento definido

- A primeira vitória é a primeira lição confirmada, sem progresso simulado ou afirmação de aprendizagem medida.
- A meta conta primeiras conclusões distintas no dia local da conta, a partir de `RegistroEstudo.concluidoEm`. Refazer uma lição preserva a primeira data e não duplica a contagem.
- `DiaDeEstudo` sustenta dias e sequência; uma linha por dia não é uma contagem de lições.
- Durante uma jornada incompleta, a próxima ação pode priorizar sua trilha. Após concluir, a retomada acompanha a atividade real mais recente e procura uma lição pendente.
- A meta pode ser alterada. O tom é encorajador; não há ranking, culpa por perda de sequência ou pedido antecipado de notificação.
- O aceite de IA continua antes do envio ao provedor. Login e preparação não alteram a preferência de som da pessoa para silenciar essas áreas.

Esses mecanismos criam continuidade entre primeiro uso e retorno. Não comprovam aumento de retenção ou aprendizagem; não há promessa de resultado ou prazo.

## Ordem de implantação

1. Fazer o procedimento de backup adotado pelo ambiente e aplicar as migrações com `npm run db:migrate` no servidor alvo. Nesta tarefa, foram aplicadas apenas ao PostgreSQL local isolado.
2. Gerar o cliente Prisma e publicar o servidor/API compatível antes dos clientes novos.
3. Publicar a web e depois distribuir o app com o contrato novo. Os endpoints de autenticação existentes mantêm seus corpos; o estado de onboarding usa uma rota adicional.
4. Conferir conta nova, conta antiga, recuperação, visitante, Google/Apple e convites no ambiente alvo. Não classificar uma instalação nova como conta nova.

Migrações aditivas, nessa ordem:

- `20261129090000_onboarding_retencao`: tabela, meta e marcadores de sessão; contas existentes não ganham linha de onboarding.
- `20261129091000_onboarding_preparacao`: corte da última preparação para recuperação de trilha.
- `20261129092000_onboarding_modo`: retomada de assunto ou material.

Não editar migrações já aplicadas. Um rollback de cliente não exige apagar os dados privados novos; um rollback de servidor precisa ser coordenado porque os clientes novos consultam a rota adicional. Estas instruções não afirmam publicação ou envio ao TestFlight.

## Verificação e evidências

Ambiente de desenvolvimento com PostgreSQL isolado, contas sintéticas, `IA=falsa` e `EMAIL=falso`. O envio falso guarda o código somente no diretório local do servidor; não expor códigos, tokens, senhas ou `.env` nas evidências. Google/Apple nos testes usam provedores e chaves sintéticos, sem autenticação real de terceiros.

| Conferência | Resultado registrado nesta etapa |
| --- | --- |
| `npm run test:onboarding` | **40/40 passaram**, após integrar a release: 13 de onboarding e 27 de autenticação/recuperação/cadastro/Apple. Cadastro real, contexto por sessão, três formas de criação, retorno, conta legada/visitante, dono da trilha, conclusão real, refazer, fuso, falha de vínculo, trilha apagada, troca de objetivo/modo, próxima atividade e guardas dos canais. Provedores externos são simulados. O comando agora integra o CI depois das migrações. |
| Typecheck web e mobile | **Passaram** em `22e8329`: `npm run typecheck` e `npm run typecheck --workspace @studoo/mobile`. |
| Paridade, movimento, visitante, interface, formatos e domínio | **Passaram** em `22e8329`: `test:paridade` 5/5; `test:movimento` 6/6; `test:visitante-mobile` 8/8; `test:estudio:interface` 703/703; `test:formatos` 271/271; `test:dominio` 18/18. Parte da suíte de interface verifica contratos de código; não substitui a conferência visual e os percursos abaixo. `test:privacidade` também passou, 4/4. |
| Fluxo completo na web com servidor e banco | **Passou em 390×844 e 360×800**, sobre `22e8329`: cadastro por código de e-mail, objetivo, meta 2, SQL, aceitar trilha, primeiro erro e acerto, Ensine ao Stu por texto, concluir, progresso 1/5, meta 1/2 e recarregar sem repetir onboarding. [24 capturas e relatórios](ux/onboarding-aplicado-2026-11-25/README.md). |
| Prévia React Native Web | **16 verificações passaram**, com 46 capturas em 390×844 e 360×800, sobre o mesmo runtime `22e8329` (`56ace2d` acrescenta apenas CI). Cadastro pelo canal MOBILE, SQL, erro/acerto, Ensine ao Stu por texto, primeira conclusão 1/5 e meta 1/2; falha de rede sem salvamento falso, retry de meta 3, meta 1 atingida, próxima lição real, recarregar, login com armazenamento limpo, retomada de checkpoint e troca de contas sem misturar dados. [Relatório consolidado e limites](ux/onboarding-aplicado-2026-11-25/rnweb-final-comprovado.json). |
| Aparelho/emulador iOS ou Android, teclado e leitor de tela | **Não executado**. Este ambiente não oferece emulador/SDK Android nem iOS. Zoom de fonte no navegador não comprova Dynamic Type nativo; não houve teste de teclado nativo, VoiceOver ou TalkBack. |
| Build e export | **Build web de produção passou**, em checkout isolado de `22e8329`. `expo export --platform all` passou para iOS e Android, com bytecode Hermes e fontes/assets, sem alterar `app.json` para incluir web. Export não é IPA/APK nem execução nativa. |
| TestFlight e produção | **Não publicados nesta entrega**. Primeiro implantar servidor e migrações; depois distribuir os clientes novos. |

Comando que reproduz a verificação de backend e autenticação:

```sh
npm run test:onboarding
```

Também foram exercitados login existente em contexto sem armazenamento anterior, retomada voluntária de jornada interrompida, falha de rede ao mudar a meta e tentativa posterior sem perder a preferência salva. O diagnóstico por perguntas foi executado com Equação, suportado pelo adaptador falso; o caminho SQL usou a ação legítima de pular as perguntas. A simulação não permite afirmar qualidade ou latência da IA real.

A prova React Native Web usa os componentes do app e a API MOBILE real local, com adaptadores exclusivos do roteiro para SecureStore → localStorage, foco nativo sem implementação e encaminhamento HTTPS sintético → HTTP local. Não altera o produto nem valida Keychain, TLS, teclado, microfone ou acessibilidade de aparelho. O relatório consolidado preserva a composição de duas execuções na mesma conta: o primeiro roteiro completou a lição, mas parou depois por esperar a frase de erro da web no canal mobile. O segundo repetiu a etapa com o alerta correto e validou a retenção; os relatos brutos não foram reclassificados como aprovados. A confirmação legítima para sair também foi respeitada no roteiro final.

A revisão visual encontrou um aviso de música cobrindo o Stu na primeira vitória. A correção reutiliza a altura reservada pelo mecanismo existente, sem alterar a preferência de som. O reteste confirmou título, Stu e ação acessíveis. Outra prova reteve um GET antigo, salvou a meta 3 pelo POST e só então entregou a leitura velha: a interface manteve a meta 3, nas duas revisões verificadas, incluindo `22e8329`.

## Reabrir neste ambiente

O PostgreSQL sintético e a web estão preparados no checkout `/workspace/work/studoo-onboarding`. A web atende em `0.0.0.0:3000`. Se o processo parar, execute `npm run db:local` e, em outro terminal desse checkout, `npx next dev --hostname 0.0.0.0 --port 3000`. Os dados e a configuração local ficam fora do Git.

Esta tarefa não tem um HTTP Preview configurado: `localhost:3000` pertence à máquina cloud. Para abrir no celular, adicione a porta **3000** em **Edit Environment → HTTP Previews** e aplique ao chat. Use a URL retornada pelo ambiente. Não é necessário ligar o PC. As capturas e relatórios acima continuam disponíveis no repositório mesmo sem a prévia.

## Medição futura

Esta entrega não afirma um pipeline novo de analytics, cálculo de coortes D1/D7 ou notificações implantados. Para medir a hipótese de retenção, definir antes os denominadores e a janela: contas criadas, primeira lição concluída e retorno com uma ação de estudo confirmada em D1/D7. Separar ambiente sintético, contas de teste e visitantes de contas reais.

Registrar somente eventos mínimos necessários, vinculados a identificadores internos, com política de acesso e retenção definida. Não incluir e-mail, senha, códigos, texto de respostas, áudio, material enviado ou assunto sensível em payload de evento. Usar dados agregados para encontrar abandono por etapa e testar mudanças; número de telas, testes automatizados e dados sintéticos não são evidência de retenção real.
