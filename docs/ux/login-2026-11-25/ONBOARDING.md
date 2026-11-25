# Entrada e onboarding por conta — proposta

**25/11/2026 · escopo de design e plano de integração; ainda não ligado ao aplicativo.**

O pedido é uma entrada atrativa que apresente o Studoo e um onboarding em toda criação de conta. A organização do login já foi aprovada como base; não colocar novamente apresentação, marketing e autenticação em um formulário longo.

## Duas escolhas claras na entrada

- **Começar / Criar minha conta:** acolhimento e cadastro, depois orientação até a primeira lição concluída.
- **Já tenho conta / Entrar:** login e acesso direto aos estudos da conta existente. Reinstalação não reinicia onboarding.

Sessão válida de uma conta existente entra no produto. A decisão não depende de uma chave local de instalação. Google e Apple podem tanto entrar quanto criar uma conta: conta existente segue para estudos; uma conta realmente nova inicia onboarding, independentemente do botão usado para chegar ao provedor.

## Jornada completa proposta

| Momento | O que a pessoa vê ou faz | Resultado útil |
| --- | --- | --- |
| 1. Boas-vindas públicas | Três quadros manuais: seu assunto vira trilha; um erro tem outra explicação; progresso permite continuar. Um exemplo concreto por quadro, com Stu em tamanho expressivo. Entrar está sempre acessível. | Entender o produto antes de abrir conta, sem formulário ou promessa abstrata. |
| 2. Conta | Cadastro existente: e-mail → código → senha, ou provedor elegível. Login tem caminho separado. | Criar e confirmar a conta usando os contratos reais. |
| 3. Primeiro objetivo | “O que você quer aprender?” com assunto livre ou material próprio. Reaproveitar o pedido atual; escolhas só entram se forem usadas de fato. | Preparar um estudo relevante, sem questionário de perfil. |
| 4. Uso de IA | Consentimento contratual no momento de enviar dados, separado de boas-vindas e de termos de conta. | Decisão informada antes da geração. |
| 5. Trilha | Geração com retorno de andamento → prévia → aceitar ou ajustar pedido. | Uma trilha do assunto escolhido, não uma demonstração confundida com dado pessoal. |
| 6. Primeira lição | Conceito curto, exemplo, exercício e feedback; explicar com as próprias palavras quando essa etapa fizer parte da lição. Se errar, mostrar outra explicação e permitir tentar de novo; não forçar um erro como parte do tour. | Aprender o uso fazendo uma ação real e tornar a adaptação observável. |
| 7. Conclusão | Resultado real da lição, progresso confirmado no mapa e próximo passo. | Ver que o esforço foi salvo e saber como continuar. |
| 8. Voltar depois | Login comum abre os estudos; destaque para continuar a trilha. Orientações de funções adicionais aparecem só no contexto necessário. | Retomar sem repetir a apresentação inteira. |

O onboarding utiliza o percurso central do produto. Não adicionar perguntas de nome, idade, país ou nível sem uma consequência definida na experiência. A primeira entrada pode mostrar os benefícios em três quadros, mas não deve acrescentar outro tour repetindo tudo antes do primeiro estudo.

O fluxo de boas-vindas é uma proposta visual separada em [boas-vindas/index.html](boas-vindas/index.html). Seu cadastro é ilustrativo; ele não cria conta nem demonstra ainda a jornada autenticada. As telas reais de geração, lição e conclusão serão refinadas uma por vez, como combinado com o dono.

## Estado durável e comportamento de retorno

Guardar no servidor, por usuário, versão do roteiro, etapa/checkpoint e estado de conclusão. Usar o estado autenticado como fonte da verdade. Rascunho no aparelho pode ajudar em falhas, mas não decide se uma pessoa é nova.

| Caso | Comportamento necessário |
| --- | --- |
| Conta nova por e-mail | Inicializar onboarding na mesma transação de criação. Após confirmar acesso, abrir o primeiro objetivo. |
| Google/Apple criam conta | Inicializar o mesmo estado no servidor; não depender de ter clicado no botão “Criar conta”. |
| Login em conta existente | Entrar diretamente nos estudos, inclusive após reinstalar ou mudar de aparelho. |
| Conta com onboarding incompleto | Conservar checkpoint e oferecer “Continuar configuração” sem bloquear o login explícito. Voltar não refaz a conta. |
| Recuperação de senha | Recuperar acesso sem reiniciar onboarding. |
| Troca de conta | Carregar o estado da nova sessão; não reaproveitar o progresso de outra conta no mesmo aparelho. |
| Contas anteriores ao lançamento | Migração explícita; ausência de trilha ou flag local não significa conta nova. Não impor novo onboarding a todas as contas antigas. |
| Convite ou trilha compartilhada | Preservar destino até a pessoa entrar e concluir/adiar a orientação; não consumir a intenção no meio do caminho. |
| Falha ou offline | Conservar o checkpoint; estado desconhecido não é conta nova. Não afirmar salvamento antes da confirmação do servidor. |
| Visitante | Manter sessão temporária de 24h no aparelho. Não prometer que o progresso passa para uma conta: isso não existe hoje. |

Entrar, renderizar uma tela, pular uma explicação e concluir a primeira lição são eventos diferentes. Só marcar conclusão do onboarding depois de confirmar o marco definido no servidor. “Fazer depois” pode adiar orientação, mas não registrar aprendizagem que não aconteceu.

## O que a auditoria encontrou no Studoo atual

- Cadastro por e-mail autentica diretamente; a tela de criação não dispara um roteiro novo.
- Google/Apple podem criar contas, mas os clientes não recebem hoje um estado de onboarding.
- A escolha atual entre pedido e retomada usa a presença de trilhas. Isso não identifica conta nova.
- O tour existente usa `studoo.apresentacao`, uma chave por aparelho/navegador, inclusive ao pular. Não atende ao requisito por conta.
- Cadastro, recuperação, convites, visitante e consentimento têm contratos existentes que precisam continuar funcionando.

Fontes: `src/app/cadastro/cadastro.tsx`, `apps/mobile/src/sessao.tsx`, `src/servidor/acesso/google.ts`, `src/servidor/acesso/apple.ts`, `src/app/estudo.tsx`, `apps/mobile/src/estudo.tsx`, `apps/mobile/src/preferencias.ts`, `packages/contratos/src/aprendizado.ts` e `prisma/schema.prisma`.

## Implementação em ações separadas

1. Fechar a direção visual da entrada e do login, com estados e movimento reduzido.
2. Adicionar estado de onboarding por conta, migração de contas existentes e contrato de sessão, mantendo os três métodos de criação.
3. Conectar cadastro e autenticação à escolha de destino correta nos dois clientes; preservar convites e recuperação.
4. Reaproveitar e refinar o percurso real pedido → geração → lição → progresso. Confirmar checkpoints no servidor e retomar falhas sem criar trilhas duplicadas.
5. Conferir os casos de conta nova/existente, reinstalação, troca de conta, interrupção, visitante e OAuth; rodar os checks exigidos de paridade e capturar web/mobile em 390 e 360px.

## Critérios para revisar e medir

- Em cada tela, a ação principal é identificável e aparece sem rolar nas larguras alvo, exceto quando texto/teclado exigem rolagem natural.
- “Entrar” e “Criar conta” têm destinos distintos e previsíveis.
- Uma promessa por quadro; exemplos claramente identificados; informações de produto não se misturam ao formulário.
- A pessoa consegue alcançar a primeira lição usando um objetivo próprio, entender um erro, concluir e retomar o progresso confirmado.
- Texto ampliado, leitor de tela, movimento reduzido, teclado e retorno de foco preservam a tarefa. Teste HTML não substitui esses testes nativos.
- Medir abandono por etapa, tempo até primeira lição, primeira conclusão e retomada. Registrar apenas eventos mínimos; não incluir conteúdo do material, assunto, e-mail ou senha na telemetria.

A referência estudada demonstra uma forma de apresentar valor e conservar continuidade; não prova aumento de retenção. A eficácia do novo fluxo precisa ser medida após a implementação, sem notas visuais autodeclaradas.
