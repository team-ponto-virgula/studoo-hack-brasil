# Onboarding e primeira vez (revisão de UX com o Duolingo como régua)

**Estado:** revisão do Designer de 22/11, a pedido do dono: "revisar o Studoo, web, app Android e iPhone, a parte de UX: se tem um onboarding bom, se está conciso, se está tudo certo. Leve como inspiração o Duolingo." Só documentação, nada implementado.
- **Prazos:** o app congela na noite de 25/11 (build 4); a web publica na hora.
- **Escopo:** a jornada de quem nunca viu o Studoo (entrada, tour, Nova trilha, aceite de IA, geração, proposta, primeira lição, primeiro erro, conclusão, volta ao mapa) e a de quem volta.
- **Complementa a spec 16** (auditoria de telas). Itens que já estão lá são citados pelo número, sem repetir a regra.

**O Duolingo como régua:**
- **Fonte lida:** o teardown da Appcues, https://goodux.appcues.com/blog/duolingo-user-onboarding. Ele diz que:
  - a primeira lição vem antes do cadastro, que é opcional e aparece de novo ao terminar lições;
  - antes da lição há boas-vindas do mascote, um objetivo, a pergunta "por que você está aprendendo?" e o nível;
  - quem já sabe algo pode fazer um teste de nível;
  - o texto é "claro e sucinto";
  - a conclusão tem círculo de progresso cheio e elementos de jogo.
- **Fonte que não abriu:** o teardown da UserOnboard (https://www.useronboard.com/how-duolingo-onboards-new-users/).
- **De memória** (não conferido numa fonte): a meta diária em minutos com sequência de dias, o pedido de notificação depois da primeira lição e as dicas na tela de carregamento. O que vem de memória está marcado assim no texto.
- Não copiamos a marca, o mascote nem o tom de culpa: aqui só o Stu, encorajador (spec 13).

## 0. Resumo da medição

Contagem do Designer nas capturas; o Mobile & QA mede tempo e toques no aparelho. Visitante na web, do zero até:
- **começar a primeira lição: 5 toques**
  1. "Experimentar sem conta";
  2. uma ideia;
  3. "Montar minha trilha";
  4. "Permitir e continuar";
  5. "Começar a lição 1".
  São 4 telas, um cartão e a espera da geração (de 15 a 25 s com a IA real).
- **o primeiro acerto: 9 toques**, somando "Avançar" no conceito, "Avançar" no exemplo, a escolha e "Verificar".

**Comparação:** o Duolingo faz pelo menos quatro telas de perguntas antes da primeira lição (Appcues). O Studoo faz uma só ("O que você quer aprender?"). Em número de passos, o Studoo já é mais enxuto. O ponto fraco é o que a pessoa vê e lê no caminho:
- a espera vazia da geração;
- palavras de dentro do produto ("proposta", "ponte", "cartões objetivos", "Modo demonstração");
- o visitante, que nunca é convidado a guardar o que fez.

## 1. Tabela da jornada

Palavras visíveis por tela, aproximadas, sem contar o rodapé de abas.

| # | Tela (captura) | O que mostra | Palavras | Toques | Problema | Como o Duolingo faria | Nossa proposta |
|---|---|---|---|---|---|---|---|
| J1 | Entrada (web `00-entrada-390`; iPhone `01`) | Título, frase, "Ver como funciona", "Experimentar sem conta" em destaque, Google, e-mail e senha | ~70 | 0 | P1: sem o Stu no celular (spec 16, item 10). O resto está certo: valor antes da conta, uma ação principal | Mascote acenando e um botão principal grande, com "Já tenho conta" embaixo (de memória) | Manter a ordem. Entrar o `stu-acolhida` de 72 (item 10) |
| J2 | Tour "Ver como funciona", 4 passos (web `01-tour-1` a `4`) | Uma arte e um texto por passo, "Pular", "Passo n de 4" | 22 a 64 | 4 | P1: os textos descrevem recursos com palavras de dentro ("citação do trecho original", "ponte", "quatro cartões objetivos"). P1 (defeito B1): o selo "Modo demonstração" na arte | Mostra o valor fazendo, não explicando; texto curto | Textos da mudança 2. Sem o selo (B1) |
| J3 | Nova trilha (web `02-nova-trilha-390`; iPhone `90`) | "O que você quer aprender?", campo, "Montar minha trilha", "Tenho um material", ideias | ~40 | 2 | Nenhum: uma pergunta, uma ação, ideias de um toque, e o Stu reage ao texto ("Isso! Conte um pouco mais…") | Várias perguntas (motivo, nível, objetivo) antes da lição | Manter. Não acrescentar perguntas (seção 4) |
| J4 | Aceite de IA, primeira vez | "Usar a IA para montar e corrigir seus estudos?", texto e dois botões | ~60 | 1 | P1: o texto é longo para o meio do primeiro caminho. Ele é obrigatório (regra 5.1.2 da Apple) | Não tem | Texto da mudança 5, mais curto e com o mesmo conteúdo legal |
| J5 | Geração, de 15 a 25 s (iPhone `91`; web local `a4`) | "Montando sua trilha", um nó vazio, o Stu, "Cancelar" | ~8 | 0 | **P0:** de 15 a 25 s de tela quase vazia, no momento de maior dúvida. As dicas da geração existem no contrato (`geracao.dicas`) e não aparecem em nenhum lado | Dicas e animação do mascote no carregamento (de memória) | Mudança 1 |
| J6 | Proposta pronta (produção `criacao-pronta-390`; iPhone `92`) | "Proposta pronta: 10 lições em 3 partes.", o mapa, "Começar a lição 1", "Ajustar pedido" | ~20 | 1 | P1: "Proposta" é palavra de dentro. P1: o aviso de música cobre "Ver o fim da trilha" (spec 16, item 14, decidido e ainda não publicado) | "Sua lição está pronta!" com um botão só (de memória) | Mudança 2: "Sua trilha está pronta: 10 lições curtas em 3 partes." |
| J7 | Lição 1, conceito (iPhone `93`) | Selo, título, objetivo, o balão "O Stu explica" com cerca de 60 palavras e uma figura | ~75 | 1 | P1: é a tela mais longa do primeiro caminho. A regra de até 3 frases no balão já existe (spec 04, banca §7), mas a IA nem sempre a segue | Ensina fazendo, com o primeiro exercício logo (de memória) | Mudança 6 |
| J8 | Lição 1, exemplo (iPhone `70`) | O cartão do exemplo | ~30 | 1 | P1: a tela vazia embaixo (spec 16, item 4) | — | Item 4 da spec 16 |
| J9 | Primeiro exercício e acerto (iPhone `95` e `97`) | Pergunta, opções, "Verificar"; o painel verde "Isso aí!", com o Stu e o som | ~25 | 2 | Nenhum: retorno na hora, com celebração | Retorno na hora, som e celebração | Manter |
| J10 | Primeiro erro e ponte (iPhone `96`; web `b2` a `b6`) | "Não foi dessa vez", "Ver outro jeito de entender" e a ponte em 3 passos | ~35 | 3 a 5 | Nenhum: a ponte foi redesenhada (spec 05, "Ponte clara") | Mostra a resposta certa e segue | Manter. É um diferencial, não um problema |
| J11 | Conclusão (web local `d1`) | "Lição concluída!", o Stu, tempo, "de primeira", etapas, "Ir para a próxima lição" | ~45 | 1 | P1: o visitante não sabe que o progresso some em 24 h nem como guardar | Pede o cadastro ao terminar lições (Appcues) | Mudança 3 |
| J12 | Volta ao mapa (iPhone `94`; produção `mapa-topo-390`) | Placa "Continue de onde parou…", nó atual com "Começar" | ~25 | 0 | Nenhum | Caminho com o próximo passo em destaque | Manter |
| J13 | Pessoa que volta: Minhas trilhas (iPhone `20`; web `03` vazio) | "Seu próximo passo" com "Continuar"; no vazio, o Stu e "Criar minha primeira trilha" | ~30 | 1 | Nenhum | Abre direto no caminho, com o próximo passo | Manter |
| J14 | Perfil do visitante (spec 16, item 22) | "Conta temporária: para ter um perfil… entre com uma conta." | ~15 | — | P1: beco sem saída: diz o que fazer e não dá o botão | — | Mudança 3 |

## 2. Mudanças de maior retorno, em ordem

### Mudança 1 (P0): a espera da geração ensina o produto
- **Antes:** de 15 a 25 s com "Montando sua trilha", um nó vazio e o Stu (iPhone `91`). Nada para ler.
- **Depois:**
  - a placa do alto da geração mostra "Montando sua trilha" (`geracao.montandoTitulo`, como hoje) por 3 s;
  - depois, ela passa a trocar a cada 5 s entre quatro frases, com o efeito de aparecer e sumir em 300 ms (com movimento reduzido, a troca é imediata);
  - a linha tem 15/20 600 `#0B1B5C`, fica centralizada e cabe em 2 linhas em 320;
  - as frases, nesta ordem e em laço, verdadeiras para conta e visitante, sem número nem promessa que não medimos:
    1. "Lições curtas, com exercício e retorno na hora."
    2. "Errou? O Stu explica de outro jeito."
    3. "Você confere a trilha antes de começar."
    4. "Cada lição concluída fica marcada no mapa."
  - A frase 4 não diz "salvo", porque para o visitante o progresso dura 24 horas neste aparelho;
  - a regra de hoje para a espera longa (`geracao.aguardandoLicao`) não muda;
  - quando a trilha fica pronta, a placa mostra a faixa da proposta (mudança 2), como hoje;
  - o leitor de tela anuncia só "Montando sua trilha" e a proposta pronta, sem anunciar cada troca de frase.
- **Contrato** (`packages/contratos/src/experiencia.ts`, bloco `geracao`, linha 1054 em `6547126`): as quatro frases substituem o vetor `geracao.dicas`, que hoje não é usado em nenhuma tela. A frase 1 entra no lugar da antiga dica "lições curtas cabem em qualquer intervalo do dia".
- **Onde a placa é desenhada:** na web, em `src/app/previa-trilha.tsx` (const `placa`, linha 80); no app, em `apps/mobile/src/estudo.tsx` (const `texto`, linha 1777). As duas escolhem hoje entre `propostaPronta`, `aguardandoLicao` e `montandoTitulo`; a troca das frases entra no ramo do `montandoTitulo`.
- **Onde:** web e app, iguais.

### Mudança 2 (P1): textos do primeiro caminho sem palavras de dentro
- **Faixa da proposta** (`geracao.propostaPronta(licoes, partes)`, em `experiencia.ts`, linha 1036; também vai para o anúncio do leitor de tela do app, `estudo.tsx`, linha 1401):
  - antes: "Proposta pronta: N lições em M partes.";
  - depois: "Sua trilha está pronta: N lições curtas em M partes.";
  - com uma parte só: "Sua trilha está pronta: N lições curtas.";
  - com uma lição só: "Sua trilha está pronta: 1 lição curta."
- **Tour "Ver como funciona"** (`apresentacao.passos[0..3]`, campos `titulo` e `texto`, em `experiencia.ts`, linhas 292 a 312; o título fica acima e o texto embaixo):
  1. "Seu material vira lição" / "Mande um PDF ou uma foto. O Stu monta lições e mostra de onde tirou cada ideia."
  2. "Errou? Tem outro jeito" / "O Stu explica a mesma ideia por outro caminho, em 3 passos curtos, e você tenta de novo."
  3. "Explique do seu jeito" / "Conte ao Stu o que entendeu. Ele mostra o que fez sentido e o que revisar."
  4. **Proposta, à espera do Lead antes do Web & API mexer:** "Seu caminho fica no mapa" / "Cada lição concluída fica marcada, e você continua de onde parou."
     - O texto de hoje ("Seu progresso fica salvo" / "Continue de onde parou, no computador ou no celular.") engana o visitante, que também vê o tour: para ele, o progresso dura 24 horas neste aparelho e não passa para outro.
     - O novo é verdadeiro para conta e visitante, tem o mesmo tamanho e combina com a frase 4 da espera (mudança 1).
     - Contrato: `apresentacao.passos[3]`.
  5. Só com sessão, sem mudança: "O que te interessa?".
- **Leitor de tela:** acompanha os textos novos.
- **Onde:** web e app.

### Mudança 3 (adiada por decisão do dono): o visitante sabe como guardar o que fez
- **Antes:** o visitante só lê "Conta temporária…" na entrada e no Perfil, sem saída.
- **Depois:**
  - na conclusão da lição, só para o visitante, depois dos números e antes dos botões, entra uma linha em 14/20 `#5E6A85`: "Seu progresso fica 24 horas neste aparelho." e o botão secundário "Guardar meu progresso", que abre a entrada com o Google em destaque;
  - no Perfil do visitante, o cartão "Conta temporária…" ganha o mesmo botão (spec 16, item 22);
  - a conta não aparece na tela de pedido, nem antes da primeira lição.
- **Condição:** só vale se entrar com o Google levar o progresso do visitante para a conta. O Web & API confirma. Se não levar, a linha fica sem o botão (só informa), e o botão espera essa mudança no servidor.
- **Regra do dono:** é um convite depois dos dados, dentro da conclusão, e não um cartão antes do conteúdo. O dono decide se aceita.
- **Onde:** web e app.

### Mudança 4 (P1): o tour sem selo de demonstração (defeito B1)
- **Antes:** "Modo demonstração" na arte dos passos 1 e 2.
- **Depois:** sem o selo. A arte é uma ilustração e não precisa de aviso (spec 04, banca §2).
  - Na web, os selos estão em `src/app/apresentacao.tsx`, linhas 166 e 179 (`estudio-selo` com `estudio.simulado`).
  - No app, em `apps/mobile/src/apresentacao.tsx`, linha 223: a referência de exemplo tem `leitura: 'demonstracao'`, que desenha o selo.
  - Na arte do passo 3, a linha "Retorno automático: o Stu procura…" também sai (`simulado: true`, linha 250 no app). Ela explica a correção real e não serve à ilustração.
- **Onde:** web e app.

### Mudança 5 (adiada por decisão do dono): aceite de IA mais curto, com o mesmo conteúdo
- **Antes** (cerca de 45 palavras): "Para montar trilhas, ler materiais, ouvir sua voz e comentar suas respostas, o Studoo envia esses dados a um serviço de IA de outra empresa. Nada é enviado sem a sua permissão."
- **Depois** (cerca de 30 palavras): "Para montar trilhas, ler seus materiais, ouvir sua voz e corrigir respostas, o Studoo usa uma IA de outra empresa. Nada vai para ela sem a sua permissão."
- Título, botões e a linha "Sem permitir…" não mudam.
- **Atenção:** é texto de privacidade (regra 5.1.2 da Apple). O Lead confirma com quem cuida da política antes de trocar. O conteúdo legal (o que vai, para quem, e só com permissão) continua.
- **Onde:** web e app.

### Mudança 6 (P1): o primeiro conceito é curto
- **Regra para a IA** (Web & API, no pedido ao gerador da lição e no validador do conteúdo):
  - o balão "O Stu explica" tem até 3 frases e cerca de 50 palavras em todas as lições, como a spec 04 já pede;
  - na lição 1 de cada trilha, até 2 frases;
  - o resto vai para "Continuar lendo".
- **Na tela:** acima de 3 frases, o cliente mostra as 3 primeiras e "Continuar lendo" (`continuarLendo`, `experiencia.ts`, linha 1102), que já existe.
- **Onde:** o servidor, para web e app.

### Mudanças já decididas na spec 16 que pesam no primeiro contato

O item 1 (a proposta pronta mostra a lição 1), o item 10 (o Stu na entrada do celular), o item 14 (o aviso de música nunca cobre o que se toca) e o item 34 (o cabeçalho da proposta com o nome da trilha) entram aqui sem mudança. Eles são da mesma jornada e têm a mesma prioridade.

## 3. O que entra quando

**Decisão do dono (22/11):** implementar as mudanças 1, 2, 4 e 6, na web na hora e no app no build 4. As mudanças 3 e 5 ficam para depois.
- **A 3 ("Guardar meu progresso") não funciona hoje:** o servidor não tem caminho que leve o progresso do visitante para uma conta. Entrar com o Google cria outra conta, e o progresso do visitante se perde, então o botão enganaria a pessoa. Ela volta quando esse caminho existir no servidor.
- **A 5 (aceite de IA mais curto) é texto de privacidade** da regra 5.1.2 da Apple e não se mexe perto da revisão.

| Quando | O quê |
|---|---|
| Web, agora | Mudanças 1, 2, 4 e 6 (a 6 é do servidor e vale para todos) |
| Build 4 do app (até 25/11) | Mudanças 1, 2 e 4, com os textos vindos do contrato; a 6 já chega pelo servidor |
| Depois do hackathon | Mudança 3, quando o servidor levar o progresso do visitante para a conta; mudança 5, depois da revisão da Apple; teste de nível para quem já sabe o assunto; lembrete de volta (notificação) depois da primeira lição concluída; meta diária leve, se o dono quiser (seção 4) |

## 4. O que não vale mudar, e por quê

**Regra geral para os textos do produto** (vale daqui para frente): nenhum texto afirma número, prazo ou promessa que não medimos ou garantimos ("leva 3 minutos", "fica salvo para sempre"). O que depende de conta ou de visitante é dito de um jeito verdadeiro para os dois, ou separado por estado.


- **Perguntas antes da primeira lição** (motivo, nível, meta diária, como o Duolingo faz): o Studoo pergunta uma coisa só e chega à lição em 5 toques. Cada pergunta a mais atrasa o valor, e a regra do dono pede a tela direto no conteúdo.
- **Sequência de dias e meta diária agora** (de memória, no Duolingo): é pressão de compromisso, e não há tempo para fazer direito até 30/11. A conclusão já diz "Vale rever esta lição amanhã", que é o compromisso leve. Fica para depois, se o dono quiser.
- **Pedido de notificação:** o app não pede, e não deve pedir antes de mostrar valor. Não entra neste ciclo.
- **Tom de culpa do mascote** (Appcues chama a coruja de "guilt-tripping"): o Stu fica encorajador (spec 13).
- **O tour obrigatório:** fica opcional ("Ver como funciona" e "Pular"). Quem quer começar já começa.
- **O aceite de IA:** não sai nem vai para depois da primeira trilha, porque a trilha já usa a IA (regra 5.1.2 da Apple). Só fica mais curto (mudança 5).
- **A ponte e o "Explique com suas palavras":** são os diferenciais da demo e já foram refinados. Mexer agora traz risco sem retorno.

## 5. Defeitos (não são questão de gosto)

**B1. O tour mostra o selo "Modo demonstração"** (web, produção; app não conferido)
1. Abra o site.
2. Toque em "Ver como funciona".
3. Nos passos 1 e 2, a arte tem o selo "Modo demonstração", e a spec 04, banca §2, diz que o tour não tem esse selo.

**B2. O aviso de música cobre o que se toca** (web, produção)
1. Abra o site e toque em "Experimentar sem conta".
2. O aviso "Música de fundo ligada." aparece embaixo e cobre "Ver trilhas da comunidade". Na proposta pronta, ele cobre "Ver o fim da trilha".
Já decidido na spec 16, item 14, e ainda não publicado.

**A confirmar** (pode ser intenção, não defeito): durante a geração no iPhone (`91`), o alto mostra "Minhas trilhas" e "Perfil" como links, no estilo da web, e não a barra de abas. "Minhas trilhas" como saída da geração é intencional. O Mobile 2 diz se o "Perfil" ali também é.

## 6. Capturas e origem

| Captura | Origem |
|---|---|
| `00-entrada-390`, `01-tour-1` a `4`, `02-nova-trilha-390`, `03-minhas-trilhas-vazio-390` | Navegador (Chromium), site publicado, visitante, 390 × 844, captura do Designer em 22/11 (pasta temporária, apagada) |
| `criacao-pronta-390`, `mapa-topo-390`, `depois-de-entrar-390` | Navegador, site publicado, capturas do Lead (`producao-8a6ba14`) |
| `01`, `20`, `70`, `90` a `97` | Simulador iPhone 17 Pro, iOS 26.5, Expo Go, execução 45053145066 (`iphone-investigacao/nativa-45053145066`); não é aparelho |
| `a4`, `b2` a `b6`, `d1` | Navegador, servidor local com IA de demonstração (`banca-21-11/momentos/web-390`, Mobile & QA); não é o site publicado |
| Android | Não há captura nativa nova. Nenhuma afirmação deste documento vale para o aparelho Android; o que foi visto do app é a prévia web do app (spec 16) |

Acessibilidade: na banca do Mobile & QA, o primeiro contato no site publicado com texto a 150% e 200%, nos 3 motores e nas 3 larguras, não sai da tela. Os textos novos das mudanças 1 e 2 cabem em 2 linhas a 390 e precisam ser conferidos a 200%. O anúncio da espera (mudança 1) foi pensado para não repetir a cada troca.
