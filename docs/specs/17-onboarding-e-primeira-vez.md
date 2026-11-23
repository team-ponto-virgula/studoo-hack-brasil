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

Medição do Mobile & QA em 22/11, no site publicado, como visitante, com a IA real, em 390 (`evidencias/onboarding`, do Mobile & QA). A estimativa anterior do Designer (5 toques) estava errada.
- **Até a lição 1 aberta: 9 toques e 32,9 s.**
  - O cartão de consentimento aparece aos 14,2 s, depois de 7 toques.
  - A geração da proposta leva só 3,1 s depois de "Montar minha trilha".
  - **A espera longa vem depois de "Começar a lição 1": 15,2 s e 18,1 s** (duas trilhas), até a lição abrir. As lições seguintes abrem em 0,1 s.
- **Até o primeiro acerto: 13 toques e 38,4 s.**
- Na prévia web do app, com IA falsa, os números de tempo não são comparáveis.

**Comparação:** o Duolingo faz pelo menos quatro telas de perguntas antes da primeira lição (Appcues). O Studoo faz uma só ("O que você quer aprender?"). Em número de passos, o Studoo já é mais enxuto. O ponto fraco é o que a pessoa vê e lê no caminho:
- a espera de 15 a 18 s depois de "Começar a lição 1", sem nada para ler, e os 3 s da geração;
- palavras de dentro do produto ("proposta", "ponte", "cartões objetivos", "Modo demonstração");
- o visitante, que nunca é convidado a guardar o que fez.

## 1. Tabela da jornada

Palavras visíveis por tela, aproximadas, sem contar o rodapé de abas.

| # | Tela (captura) | O que mostra | Palavras | Toques | Problema | Como o Duolingo faria | Nossa proposta |
|---|---|---|---|---|---|---|---|
| J1 | Entrada (web `00-entrada-390`; iPhone `01`) | Título, frase, "Ver como funciona", "Experimentar sem conta" em destaque, Google, e-mail e senha | ~70 | 0 | P1: sem o Stu no celular (spec 16, item 10). O resto está certo: valor antes da conta, uma ação principal | Mascote acenando e um botão principal grande, com "Já tenho conta" embaixo (de memória) | Manter a ordem. Entrar o `stu-acolhida` de 72 (item 10) |
| J2 | Tour "Ver como funciona", 4 passos (web `01-tour-1` a `4`) | Uma arte e um texto por passo, "Pular", "Passo n de 4" | 22 a 64 | 4 | P1: os textos descrevem recursos com palavras de dentro ("citação do trecho original", "ponte", "quatro cartões objetivos"). P1 (defeito B1): o selo "Modo demonstração" na arte | Mostra o valor fazendo, não explicando; texto curto | Textos da mudança 2. Sem o selo (B1) |
| J3 | Nova trilha (web `02-nova-trilha-390`; iPhone `90`) | "O que você quer aprender?", campo, "Montar minha trilha", "Tenho um material", ideias | ~40 | 2 | Nenhum: uma pergunta, uma ação, ideias de um toque, e o Stu reage ao texto ("Isso! Conte um pouco mais…") | Várias perguntas (motivo, nível, objetivo) antes da lição | Manter. Não acrescentar perguntas (seção 4) |
| J4 | Aceite de IA, primeira vez (site `consentimento-ia`, Mobile & QA) | "Usar a IA para montar e corrigir seus estudos?", texto, a lista de quem recebe e dois botões | 138 (medido) | 1 | P1: é a tela mais longa do primeiro caminho. Ela é obrigatória (regra 5.1.2 da Apple). Em 390, abre rolada e corta o título (defeito B3) | Não tem | Mudança 5 (adiada) e defeito B3 |
| J5 | Geração da proposta, de 2,5 a 3,6 s (iPhone `91`; site `geracao-02s`, Mobile & QA) | "Montando sua trilha", o título e as lições surgindo uma a uma | 5 a 56 (medido) | 0 | Nenhum: é rápida e mostra as lições nascendo | — | Manter, sem frases (mudança 1) |
| J5b | Criação da trilha, depois de "Começar a lição 1", de 12,8 a 21,4 s (medição do Mobile & QA e do Lead; sem captura) | O botão afundado com o giro "Criando sua trilha…" e, aos 1,5 s, "Escrevendo suas lições…" | ~5 | 0 | **P0:** a espera mais longa do primeiro caminho, sem nada para ler | Dicas e animação do mascote no carregamento (de memória) | Mudança 1 |
| J6 | Proposta pronta (produção `criacao-pronta-390`; iPhone `92`) | "Proposta pronta: 10 lições em 3 partes.", o mapa, "Começar a lição 1", "Ajustar pedido" | ~20 | 1 | P1: "Proposta" é palavra de dentro. P1: o aviso de música cobre "Ver o fim da trilha" (spec 16, item 14, decidido e ainda não publicado) | "Sua lição está pronta!" com um botão só (de memória) | Mudança 2: "Sua trilha está pronta: 10 lições curtas em 3 partes." |
| J7 | Lição 1, conceito (iPhone `93`; site `a-licao-1-aberta`) | Selo, título, objetivo, o balão "O Stu explica" e uma figura | 88 (medido) | 1 | P1: é a tela mais longa do primeiro caminho. A regra de até 3 frases no balão já existe (spec 04, banca §7), mas a IA nem sempre a segue | Ensina fazendo, com o primeiro exercício logo (de memória) | Mudança 6 |
| J8 | Lição 1, exemplo (iPhone `70`) | O cartão do exemplo | ~30 | 1 | P1: a tela vazia embaixo (spec 16, item 4) | — | Item 4 da spec 16 |
| J9 | Primeiro exercício e acerto (iPhone `95` e `97`) | Pergunta, opções, "Verificar"; o painel verde "Isso aí!", com o Stu e o som | ~25 | 2 | Nenhum: retorno na hora, com celebração | Retorno na hora, som e celebração | Manter |
| J10 | Primeiro erro e ponte (iPhone `96`; web `b2` a `b6`) | "Não foi dessa vez", "Ver outro jeito de entender" e a ponte em 3 passos | ~35 | 3 a 5 | Nenhum: a ponte foi redesenhada (spec 05, "Ponte clara") | Mostra a resposta certa e segue | Manter. É um diferencial, não um problema |
| J11 | Conclusão (web local `d1`) | "Lição concluída!", o Stu, tempo, "de primeira", etapas, "Ir para a próxima lição" | ~45 | 1 | P1: o visitante não sabe que o progresso some em 24 h nem como guardar | Pede o cadastro ao terminar lições (Appcues) | Mudança 3 |
| J12 | Volta ao mapa (iPhone `94`; produção `mapa-topo-390`) | Placa "Continue de onde parou…", nó atual com "Começar" | ~25 | 0 | Nenhum | Caminho com o próximo passo em destaque | Manter |
| J13 | Pessoa que volta: Minhas trilhas (iPhone `20`; web `03` vazio) | "Seu próximo passo" com "Continuar"; no vazio, o Stu e "Criar minha primeira trilha" | ~30 | 1 | Nenhum | Abre direto no caminho, com o próximo passo | Manter |
| J14 | Perfil do visitante (spec 16, item 22) | "Conta temporária: para ter um perfil… entre com uma conta." | ~15 | — | P1: beco sem saída: diz o que fazer e não dá o botão | — | Mudança 3 |

## 2. Mudanças de maior retorno, em ordem

### Mudança 1 (P0): a espera da criação da trilha ensina o produto
Revista em 23/11 com a medição do Mobile & QA e do Lead (IA real): a proposta fica pronta em 2,5 a 3,6 s, e a criação da trilha, depois de "Começar a lição 1", leva de 12,8 a 21,4 s.
- **Antes:**
  - no toque em "Começar a lição 1", o botão afunda com o giro e "Criando sua trilha…" (`geracao.criandoTrilha`);
  - depois de 1,5 s, entra embaixo dele a linha "Escrevendo suas lições…" (`geracao.escrevendoLicoes`, na `.previa-espera` da web e no equivalente do app);
  - fica assim de 15 a 18 s, sem mais nada.
- **Depois** (o relógio começa no toque em "Começar a lição 1"):
  - **de 0 a 1,5 s**, como hoje: o botão afundado, com o giro e "Criando sua trilha…". O botão fica assim até a lição abrir, e o giro não sai;
  - **aos 1,5 s**, como hoje: entra a linha "Escrevendo suas lições…" no lugar de sempre, logo abaixo do botão;
  - **aos 4,5 s** (a linha ficou 3 s), a mesma linha troca para a frase 1. Depois troca a cada 5 s, em laço, entre três frases:
    1. "Lições curtas, com exercício e retorno na hora."
    2. "Errou? O Stu explica de outro jeito."
    3. "Cada lição concluída fica marcada no mapa."
    A frase "Você confere a trilha antes de começar." sai, porque nesse momento a pessoa já conferiu e deixaria de ser verdadeira.
  - **Espera curta** (12 s): a pessoa vê "Escrevendo suas lições…", a frase 1 e o começo da 2.
  - **Espera longa** (25 s): as três frases e a 1 de novo.
  - **Quando a lição abre**, a linha sai junto com a troca de tela, sem frase de "pronto".
  - **Erro:** a linha dá lugar ao erro de hoje (`geracao.erroCriacao`), e as frases param.
  - **Desenho da linha:** o lugar e o estilo da `.previa-espera` de hoje, centralizada, até 2 linhas em 320. Troca com aparecer e sumir em 300 ms.
  - **Movimento reduzido:** a troca é imediata, sem efeito.
  - **Leitor de tela:**
    - o botão fica com `aria-busy` (web) ou `busy` (app), como hoje;
    - "Criando sua trilha." (`geracao.anuncioCriando`) é anunciado uma vez;
    - as frases não são anunciadas, porque são decorativas e repetir a cada 5 s atrapalha;
    - quando a lição abre, vale o anúncio de hoje.
- **Relógio:** o `ESPERA_DA_GERACAO` do contrato ({ abertura 3000, troca 5000, efeito 300 }) e o `dicaDaEspera` servem como estão, com o início no aparecimento da linha "Escrevendo suas lições…" (1,5 s depois do toque). Os 3 s de abertura continuam certos: a pessoa lê a linha de hoje antes da primeira frase, e mesmo a espera mais curta medida (12,8 s) mostra pelo menos uma frase inteira.
- **Na placa "Montando sua trilha" (a geração da proposta), as frases não entram:** a geração leva uns 3 s, e a abertura de 3 s faria a primeira frase quase nunca aparecer. Numa geração lenta, já existe "Ainda montando a próxima lição…" (`geracao.aguardandoLicao`) depois de 12 s sem lição nova. A placa fica como antes da mudança: "Montando sua trilha", "Ainda montando…" e a faixa da proposta (mudança 2).
- **Contrato** (`packages/contratos/src/experiencia.ts`, bloco `geracao`):
  - o vetor `geracao.dicas` (linha 1054 em `6547126`) passa a ter as três frases acima;
  - `criandoTrilha`, `escrevendoLicoes` e `anuncioCriando` continuam;
  - o texto de `escrevendoLicoes` hoje é "Escrevendo as lições da trilha. Com a IA, leva alguns segundos.", e "alguns segundos" não bate com os 12 a 21 s medidos. Passa a "Escrevendo suas lições…", que é o que a tela já mostra.
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

**Textos que ainda dizem "demonstração" para quem usa o site publicado** (revisão de 23/11, contrato `experiencia.ts` em `feat/refino-web`). O conteúdo de vitrine se chama "Exemplo" (spec 16, item 9):
- `compartilhar.demonstracaoAviso` passa a "Esta trilha é um exemplo do Studoo e aparece no Explorar com o rótulo “Exemplo”."
- `comunidade.demonstracaoDica` passa a "Trilha de exemplo do Studoo."
- `compartilhar.perfilDemo` passa a "Perfil de exemplo".

**Ficam como estão:**
- `estudio.simulado` ("Modo demonstração") e o ramo de `privacidadePorProvedor` para a IA falsa só aparecem quando o servidor roda sem IA real. Lá, dizer "modo demonstração" é o aviso honesto de que nada vai para a IA.
- `licao.demonstracao` ("Demonstração") é o nome pedagógico da etapa em que o Stu mostra como se faz, e não o modo do servidor.

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


- **Perguntas antes da primeira lição** (motivo, nível, meta diária, como o Duolingo faz): o Studoo pergunta uma coisa só e abre a primeira lição em 9 toques (medido). Cada pergunta a mais atrasa o valor, e a regra do dono pede a tela direto no conteúdo.
- **Sequência de dias e meta diária agora** (de memória, no Duolingo): é pressão de compromisso, e não há tempo para fazer direito até 30/11. A conclusão já diz "Vale rever esta lição amanhã", que é o compromisso leve. Fica para depois, se o dono quiser.
- **Pedido de notificação:** o app não pede, e não deve pedir antes de mostrar valor. Não entra neste ciclo.
- **Tom de culpa do mascote** (Appcues chama a coruja de "guilt-tripping"): o Stu fica encorajador (spec 13).
- **Retomar a lição pelo mapa em 2 toques** (o nó e depois "Continuar" no balão): é o balão decidido para todos os nós (spec 01). Ele mostra o que a lição é antes de abrir e evita abrir uma lição por um toque sem querer.
- **O tour obrigatório:** fica opcional ("Ver como funciona" e "Pular"). Quem quer começar já começa.
- **O aceite de IA:** não sai nem vai para depois da primeira trilha, porque a trilha já usa a IA (regra 5.1.2 da Apple). Só fica mais curto (mudança 5).
- **A ponte e o "Explique com suas palavras":** são os diferenciais da demo e já foram refinados. Mexer agora traz risco sem retorno.

## 5. Defeitos (não são questão de gosto)

**B1 (P1; mudança 4). O tour mostra o selo "Modo demonstração"** (web, produção; app não conferido)
1. Abra o site.
2. Toque em "Ver como funciona".
3. Nos passos 1 e 2, a arte tem o selo "Modo demonstração", e a spec 04, banca §2, diz que o tour não tem esse selo.

**B2 (P1; spec 16, item 14). O aviso de música cobre o que se toca** (web, produção)
1. Abra o site e toque em "Experimentar sem conta".
2. O aviso "Música de fundo ligada." aparece embaixo e cobre "Ver trilhas da comunidade". Na proposta pronta, ele cobre "Ver o fim da trilha".
Já decidido na spec 16, item 14, e ainda não publicado.

**B3 (P1). O cartão de consentimento de IA abre rolado até o fim em 390, com o título cortado** (web, produção; medição do Mobile & QA; a spec 16 não cobre)
1. Entre como visitante em 390 × 844.
2. Escreva um pedido e toque em "Montar minha trilha".
3. O cartão abre com "Permitir e continuar" à vista e o título fora da tela.
- **Correção:** o cartão abre no topo, com o foco no título (spec 11). Os botões ficam presos embaixo do cartão, e o texto rola no meio.
- O texto não muda (decisão do dono sobre a mudança 5).

**B4 (P1). "Agora não" no consentimento leva a um beco sem saída** (web, produção; a spec 16 não cobre)
1. Os mesmos passos do B3.
2. Toque em "Agora não".
3. O pedido volta com "Não deu para gerar agora" e "Para continuar, permita o uso de IA.", sem botão para permitir.
- **Correção:** a mensagem ganha o botão secundário "Permitir o uso de IA" (`privacidade.permitirAgora`, que já existe), que reabre o mesmo cartão. Nenhum texto novo.

**B5 (P1). No exercício de lacuna, a dica depois do erro mostra a resposta** (web, produção; por exemplo "6 sobre 10"; a spec 16 não cobre)
- **Correção** (Web & API, no gerador e no validador): a dica aponta o caminho, nunca o valor da resposta, como a regra da frase do "Sua vez" (spec 15).
- O exercício também não mostrou "Pular por agora". Isso não é regra pedagógica: depois de um erro, todo tipo de exercício oferece "Pular por agora" (`licao.pular`), como a múltipla escolha já faz (iPhone `96`). Na lacuna, ele tem de aparecer.

**B2, ampliado (P1; a spec 16, item 14, já cobre):** em 390, o aviso de música também cobre o rodapé e o botão principal dos passos 1 e 2 do tour (medição do Mobile & QA). É a mesma correção da spec 16, item 14.

**A confirmar** (pode ser intenção, não defeito): durante a geração no iPhone (`91`), o alto mostra "Minhas trilhas" e "Perfil" como links, no estilo da web, e não a barra de abas. "Minhas trilhas" como saída da geração é intencional. O Mobile 2 diz se o "Perfil" ali também é.

## 6. Capturas e origem

| Captura | Origem |
|---|---|
| `00-entrada-390`, `01-tour-1` a `4`, `02-nova-trilha-390`, `03-minhas-trilhas-vazio-390` | Navegador (Chromium), site publicado, visitante, 390 × 844, captura do Designer em 22/11 (pasta temporária, apagada) |
| `criacao-pronta-390`, `mapa-topo-390`, `depois-de-entrar-390` | Navegador, site publicado, capturas do Lead (`producao-8a6ba14`) |
| `01`, `20`, `70`, `90` a `97` | Simulador iPhone 17 Pro, iOS 26.5, Expo Go, execução 45053145066 (`iphone-investigacao/nativa-45053145066`); não é aparelho |
| `a4`, `b2` a `b6`, `d1` | Navegador, servidor local com IA de demonstração (`banca-21-11/momentos/web-390`, Mobile & QA); não é o site publicado |
| Android | Não há captura nativa nova. Nenhuma afirmação deste documento vale para o aparelho Android; o que foi visto do app é a prévia web do app (spec 16) |

**Conferência da espera nova (23/11).** No site publicado, a versão `09f6590` está no navegador a 390, com conta de teste e IA real, nas capturas do Lead em `producao-09f6590/espera` (`espera-02s`, `05s`, `09s`, `14s`, `proposta-pronta`, `depois-da-espera` e o tour). No app, a prévia web do app em `feat/refino-app`, com IA falsa, a 320 e a 390, nas capturas do Mobile 2 em `espera-nova/depois`; não é o aparelho.
- **Bate com a mudança 1:**
  - a linha fica embaixo do botão com o giro "Criando sua trilha…";
  - "Escrevendo suas lições…" entra perto de 1,5 s, a frase 1 perto de 4,5 s e a 2 perto de 9,5 s;
  - a nota "Com a IA, leva alguns segundos" saiu;
  - a linha cabe numa só linha a 390 e em 2 a 320, centralizada, em `#5E6A85` sobre branco (acima de 4,5:1).
  A espera medida foi de 15 s, então a frase 3 (perto de 14,5 s) só aparece nas esperas longas. Isso é o esperado; a frase não perde sentido quando aparece, porque o mapa está atrás.
- **Movimento reduzido:** não aparece nas capturas e não foi conferido. Fica para a próxima rodada.
- **O Stu da criação e o giro:** o Stu com o notebook ao lado do nó 1 e o giro no botão combinam com "Escrevendo suas lições…". Nada muda.
- **A faixa "Sua trilha está pronta…" continua à vista durante a criação:** a proposta está pronta; quem está sendo escrito são as lições. As duas coisas são verdadeiras ao mesmo tempo, e nada muda.
- **Diferença a corrigir no app:** na prévia web do app, a pílula "Ver o fim da trilha" continua à vista durante a criação, por cima do mapa; no site ela some. Durante a criação, ela some também no app, porque a pessoa já escolheu começar e a pílula disputa com o botão afundado (spec 04, C5).
- **O tour no site:** os passos estão sem selo (mudança 4). O passo 4 já tem o texto novo ("Seu caminho fica no mapa"). O aviso de música fica no alto e não cobre nada que se toque (`cobre: 0` no relatório do Lead), como pede a spec 16, item 14.

Acessibilidade: na banca do Mobile & QA, o primeiro contato no site publicado com texto a 150% e 200%, nos 3 motores e nas 3 larguras, não sai da tela. Os textos novos das mudanças 1 e 2 cabem em 2 linhas a 390 e precisam ser conferidos a 200%. O anúncio da espera (mudança 1) foi pensado para não repetir a cada troca.
