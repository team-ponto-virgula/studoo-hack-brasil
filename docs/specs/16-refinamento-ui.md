# Refinamento de UI e UX: auditoria do Designer

**Estado:** lote 1, de 21/11, sobre o site publicado (`2bab6aa`). Pedido do dono: passar pela UI e UX inteiras e deixar tudo muito refinado, nas três plataformas.

**Fontes:**
- telas nativas do iPhone (simulador, 47 telas) e do Android (8 telas) em `evidencias/nativa-2bab6aa` do Lead;
- capturas da web do Web & API;
- o site publicado em 390 e 1440.

O Mobile & QA faz, em paralelo, a banca de defeitos (bugs, textos crus, paridade). Este documento é o olhar de design: hierarquia, espaço, toque, retorno e o que ainda parece protótipo.

**Regras que valem em todos os itens:**
- web, Android e iPhone iguais na mesma largura; a diferença só entra quando a plataforma obriga, e aí vai para a spec 07;
- nada de janela nativa;
- só o Stu novo;
- o iPhone segue o iOS atual (Liquid Glass, Dynamic Island, áreas seguras).

As mudanças de tela do app congelam na noite de 25/11: P0 e P1 cabem até lá, e P2 fica para depois do build.

## Lote 1: primeiro contato, criação da trilha, aula e exercícios

### P0

**1. A trilha pronta mostra o fim, não a lição 1** (iPhone `92-criacao-pronta` e Android `92-criacao-pronta`; criação, spec 04)
- **Hoje:** quando a proposta fica pronta, a tela fica parada no troféu ("Fim da trilha"), com o Stu ao lado dele, e mostra as últimas lições ("Revisão: explique uma soma de frações"). Enquanto isso, o botão diz "Começar a lição 1". O primeiro contato termina olhando para o lugar errado.
- **Regra:**
  - ao ficar pronta, a tela rola em 600 ms (saída suave) até o nó 1 ficar no centro da área livre, entre o alto e o rodapé;
  - o Stu (`stu-feliz`) passa para o lado do nó 1;
  - o troféu continua a uma rolagem de distância;
  - com movimento reduzido, a tela vai direto ao nó 1.
- **Onde:** as três plataformas.

**2. Texto sobre a ilustração na entrada larga** (web, 1440, página inicial)
- **Hoje:** "Seu material vira prática. O erro abre outro caminho." e o texto embaixo ficam em cima do telhado laranja e das árvores verdes. O cinza sobre o verde e o laranja não chega a 4,5:1, e a primeira tela do computador parece montada às pressas.
- **Regra:**
  - o título e o texto vão para um cartão no alto à esquerda do painel da ilustração, com fundo `rgba(255, 255, 255, 0.92)`, raio 24, respiro de 24 e largura máxima de 480 px;
  - o título fica em `#0B1B5C` e o texto em `#5E6A85`;
  - a ilustração continua inteira atrás.
  - O Stu da acolhida fica com a base no alto da colina, inteiro na primeira dobra (spec 13: 26cqw). Hoje só a cabeça aparece no pé da tela.
- **Onde:** web a partir de 1024 px. O app não tem essa tela larga.

**3. O cabeçalho do mapa no Android deixa o mapa aparecer por trás do título** (Android `05-depois-de-entrar`)
- **Hoje:** o rótulo "Cumprimentar e se apresentar" passa por trás de "Inglês para viagem". O título fica ilegível na primeira tela depois de entrar.
- **Regra:**
  - no Android, onde não há vidro, o cabeçalho preso do mapa tem fundo `#FFFFFF` a 94% e uma linha de 1 px `#E1E7FA` embaixo quando o mapa rola sob ele;
  - no iPhone continua o Liquid Glass;
  - na web, o fundo branco a 94%, como no Android.
- **Onde:** é uma diferença forçada pela plataforma (sem vidro no Android e na web), registrada na spec 07.

### P1

**4. Exemplo curto com a tela vazia** (iPhone `70-exemplo-curto-etapa-2`; aula)
- **Hoje:** o cartão do exemplo ocupa um terço da tela, e o resto fica em branco até o botão.
- **Regra:** nas etapas Conceito e Exemplo, quando o conteúdo cabe sem rolar e sobram 40% ou mais da área livre:
  - o Stu (`stu-feliz`, 72) entra acima do cartão;
  - o conjunto (Stu e cartão) fica centralizado na vertical, entre o alto da aula e o rodapé;
  - com conteúdo maior, tudo continua alinhado em cima, como hoje.
  - O Stu é decorativo para o leitor de tela.
- **Onde:** as três plataformas.

**5. A dica "use as teclas de A a C" em tela de toque** (web em 390 e app)
- **Regra:** a dica aparece só com teclado e ponteiro fino (`hover: hover` e `pointer: fine`, na web) e nunca no app. Isso vale para todas as lições: é uma mudança global pequena e sem risco.
- **Onde:** as três plataformas.

**6. A letra da opção (A, B, C) apertada com texto ampliado** (iPhone, texto a 200%)
- **Regra:**
  - o quadrinho da letra cresce com o texto: lado de 1,75 × o tamanho da letra, no mínimo 30 px, sempre quadrado;
  - a letra fica centralizada e o raio é de 9 px;
  - o texto da opção ocupa o resto da largura e quebra em linhas, sem nunca passar por baixo do quadrinho.
- **Onde:** as três plataformas.

**7. No gráfico do seno, o ponto P (π, 0) cobre o "π" do eixo** (spec 15)
- **Regra:** vale a regra da seção 12 da spec 15 também para a `funcao`: quando a bolinha de um ponto cobre um número do eixo, só aquele número sai, e o rótulo do ponto ("P (π, 0)") já o diz.
- **Onde:** é do motor, igual nas três plataformas.

**8. A contagem de letras da resposta aberta antes de escrever** (iPhone `35-exercicio-aberta`)
- **Hoje:** "Faltam 40 letras" aparece em laranja no cartão antes de qualquer letra, e repete o "Escreva mais um pouco: faltam 40 letras." do rodapé. Parece bronca antes de começar.
- **Regra:** antes da primeira letra, só o texto do rodapé orienta. A contagem dentro do cartão aparece a partir da primeira letra, em `#5E6A85`, e some quando o mínimo é atingido. O laranja não entra.
- **Onde:** as três plataformas.

**9. "Demonstração" no Explorar** (iPhone `40-explorar`)
- **Hoje:** o selo "Demonstração" aparece em todo cartão, e um parágrafo no alto explica o que ele é. A vitrine parece um protótipo.
- **Regra:**
  - o selo passa a "Exemplo", no selo neutro da spec 10;
  - o parágrafo do alto sai;
  - o nome do selo para o leitor de tela fica "Exemplo criado pelo Studoo para mostrar o app";
  - o texto muda no contrato (`comunidade`), para web e app.
  - A honestidade continua, porque o conteúdo sintético segue marcado.
- **Onde:** as três plataformas.

**10. A entrada no celular sem o Stu** (web em 390 e app `01-entrada-em-repouso`)
- **Hoje:** a spec 13 pede o `stu-acolhida` na faixa da entrada no celular, mas as duas plataformas abrem sem nenhum Stu. O primeiro contato fica sem o mascote.
- **Regra:**
  - o `stu-acolhida` de 72, acenando (spec 13), fica à direita do título "Aprenda qualquer coisa, um passo de cada vez.", alinhado ao topo do título;
  - o título encolhe para dar lugar a ele, sem passar de 3 linhas em 360;
  - com movimento reduzido, o Stu fica parado.
- **Onde:** web até 767 px e app.

### P2 (depois do build)

**11. O retorno de erro denso** (iPhone `96-resposta-errada`)
- **Hoje:** "Se pular, este exercício volta no fim da lição." vem em negrito centralizado, antes dos botões, e disputa com o título.
- **Regra:** a frase passa para baixo da fileira de botões, em 13/18 regular `#5E6A85`, alinhada com "Pular por agora".

**12. O nome da trilha no alto da criação** (iPhone e Android `91` e `92`)
- **Hoje:** "Entender, comparar e somar frações." aparece em letra pequena, como rodapé.
- **Regra:** 15/20 800 `#0B1B5C`, numa linha, com reticências.

## O que já está refinado (mantém)

- o envelope da aula: X, andamento, etapa, som, "Etapa anterior", selo, cartão e rodapé com o estado — igual em todos os tipos de exercício;
- o Minhas trilhas, com o cartão em destaque, "Seu próximo passo" e o menu de quatro itens;
- as confirmações vermelhas (apagar, bloquear, excluir conta com "EXCLUIR");
- o retorno de acerto verde com o Stu;
- o pedido com "Tenho um material" e a fileira de ideias;
- Perfil, Privacidade e Configurações da trilha.

**Próximo lote:** os quatro momentos da demo (material e citação, erro e ponte, "Ensine ao Stu", sincronia), Explorar, Perfil na web e matemática nova no aparelho.
