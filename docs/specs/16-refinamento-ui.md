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

## Lote 2 (parcial): Explorar, Perfil e mapa na web; matemática no aparelho

**Fontes:**
- iPhone nativo (`40`, `41`, `50` a `63`);
- o site publicado em 390 e 1440, entrando como visitante;
- as capturas do mapa na web do Web & API, com servidor local.

Os quatro momentos da demo ficam para o lote 3, com as capturas do Mobile & QA.

### P0

**13. Cenário gigante atrás do caminho no mapa da web em 390** (capturas do Web & API, `explorar-1` e `explorar-2`, servidor local)
- **Hoje:** uma árvore enorme e círculos vermelhos e brancos ocupam a coluna inteira atrás dos nós. No app, os enfeites são árvores pequenas dos lados do caminho (iPhone `10`).
- **Regra:** os enfeites do mapa na web têm o tamanho e o lugar do app (spec 04, `--tam-enfeite` e `--tam-miudo`), sempre dos lados do caminho e nunca atrás dos nós. O fundo da região continua só a cor dela.
- **Confirmar no site publicado**, porque a captura é do servidor local.
- **Onde:** web, para igualar o app.

### P1

**14. O aviso de música cobre o botão do balão no mapa** (web `explorar-2`)
- **Regra:** o aviso "Música de fundo ligada." da primeira vez nunca cobre o balão nem a ação do rodapé. No mapa, ele fica no alto, 8 px abaixo do cabeçalho preso, como na entrada (spec 12).
- **Onde:** as três plataformas.

**15. Dois cabeçalhos empilhados no mapa da web em 390** (web `explorar-1`)
- **Hoje:** a barra da marca, com "Progresso salvo agora", vem em cima do cabeçalho da trilha, e os dois somam quase 30% da tela. O app não tem a barra da marca no mapa (iPhone `10`).
- **Regra:** no mapa, até 767 px, a barra da marca não aparece, e o selo de sincronia entra no cabeçalho da trilha, à direita do anel.
- **Onde:** web, para igualar o app.

**16. Os números gigantes nas capas do "Em alta"** (web e iPhone `40` e `41`)
- **Hoje:** um "1", "2", "3" ou "4" enorme, branco com contorno, fica na capa e esbarra nos selos. Ninguém lê aquilo como posição.
- **Regra:** a posição vira uma pílula pequena no canto superior direito da capa: "1º", em 13 px 800 `#0B1B5C` sobre branco, com 24 de altura e raio 12. O leitor de tela lê "1º em alta".
- **Onde:** as três plataformas.

**17. Selos empilhados na capa** (web e iPhone `40`)
- **Regra:**
  - a capa leva só o selo do tema;
  - o selo "Exemplo" (item 9) sai da capa e vai para a linha de informações do cartão: "6 lições · 3 partes · Exemplo", no selo neutro;
  - o leitor de tela continua com o nome do item 9.
- **Onde:** as três plataformas.

**18. A navegação lateral da web, com quatro estilos** (web 1440, Explorar e Perfil)
- **Hoje:**
  - "Minhas trilhas" é um link sem ícone;
  - "Nova trilha" é um botão com borda;
  - "Explorar" selecionado é uma pílula branca com sombra;
  - "Perfil" selecionado tem borda azul.
  São dois jeitos diferentes de mostrar o item selecionado.
- **Regra:**
  - os quatro itens são iguais: 48 px de altura, ícone de 20 (os da cápsula do app: livro, lâmpada, bússola e pessoa), rótulo 16 800 e raio 14;
  - fora da seleção, sem fundo e com o texto em `#0B1B5C`;
  - selecionado, com fundo `#E9E7FF` e texto e ícone em `#2563FF`, a mesma subcápsula da barra de abas;
  - "Perfil" continua embaixo.
- **Onde:** web a partir de 1024 px.

**19. A política de privacidade aparece duas vezes no Perfil** (web 390 e 1440, iPhone `55` e `63`)
- **Regra:** "Política de privacidade do Studoo" sai da seção "Privacidade e dados" e fica só em "Ajuda". Na seção sobram "Ver quem recebe" (secundário) e "Permitir o uso de IA" ou a chave, conforme o estado.
- **Onde:** as três plataformas.

**20. "Excluir conta" diferente na web e no app**
- **Hoje:** na web é um texto vermelho solto; no app (iPhone `55`), um botão secundário com borda vermelha.
- **Regra:** nas três plataformas, o botão secundário de 44 px com borda e texto `#C23B4E` (spec 11, ação destrutiva de baixa ênfase), depois de "Sair".
- **Onde:** as três plataformas.

### P2

**21. A coluna do Perfil larga demais na web** (web 1440)
- **Regra:** a coluna de configurações vai até 680 px, como a da aula, para a chave não ficar longe do rótulo.

**22. O cartão do visitante no Perfil sem saída** (web e app)
- **Regra:** o cartão "Conta temporária…" ganha o botão "Entrar com uma conta", que abre a entrada.
- Isso só vale se a entrada guardar o progresso do visitante. Se não guardar, o cartão fica como está, porque uma saída que perde o que a pessoa fez é pior que nenhuma.

### Matemática no aparelho

Ainda não há captura nativa (iPhone nem Android) dos visuais, do "Resolva comigo" e do gráfico de função. A revisão sobre a prévia web do app está nas seções 13, 17 e 18 da spec 15. O que só o aparelho prova:
- o texto grande do sistema;
- o VoiceOver e o TalkBack nos roteiros da spec 15;
- o desenho em `react-native-svg` no tamanho real.
Isso fica para a rodada nativa.

**Próximo lote:** os quatro momentos da demo (material e citação, erro e ponte, "Ensine ao Stu", sincronia) e o Android completo da rodada nova.
