# Refino da experiência para a banca (27/11)

Tarefa #25. Revisão tela por tela do Studoo publicado (`80e84cd`), na ordem em que a banca vê: entrada, criação, espera, primeira lição, retorno, conclusão, progresso e retomada. Depois, o resto do produto.

Este documento só propõe. Não muda código, não toca na página de apresentação (spec 18, do Lead), nos envios da Apple nem na produção.

## Como ler

- **Prioridade.** P0: aparece no roteiro de dois minutos e atrapalha o que o apresentador precisa mostrar. P1: aparece no caminho da banca. P2: melhora, mas a demo passa sem.
- **Origem da evidência.** Tudo o que foi medido nesta rodada vem do **navegador** (Chrome 158, sem janela), com o **servidor local na versão `80e84cd`**, IA de demonstração, sessão de visitante e as chaves de visitante, comunidade, compartilhar, cadastro e apresentação ligadas. **Não é o site publicado e não é aparelho.**
- **App (Android e iPhone).** Nesta rodada o app foi lido **pelo código** (`apps/mobile/src`). Onde o texto diz "app: pelo código", **não há prova nativa nem captura**. Nenhuma afirmação deste documento vale como medida no aparelho.
- **Larguras conferidas na web:** 360 × 800, 390 × 844, 768 × 1024, 1280 × 720, 1366 × 768 e 1440 × 900.
- **O que já estava decidido não é proposto de novo.** Quando a regra existe e o publicado não a cumpre, o item diz "regra já decidida" e aponta a spec.

## 1. Lote curto: o que mais aparece na demo

Ordem de implementação sugerida: L1, L2, L5, L3, L6, L4, L7, L8.

### L1 (P0). Ensine ao Stu: o campo e o envio aparecem na primeira tela

- **Onde:** aula, etapa "Ensine ao Stu" (momento 3 do roteiro, 0:55 a 1:30). Web em todas as larguras. App: pelo código.
- **Evidência:** `c12-ensine-390`, `f02-ensine-360`, `f01-ensine-768`, `e08-ensine-1280`.
- **Hoje (web).** Ao chegar na etapa, a pessoa vê o convite três vezes e nenhum lugar para responder:
  1. a linha "Ensine ao Stu" e, logo abaixo, um cartão com o título "Ensine ao Stu" e "Explique a ideia com suas palavras. Esta etapa é opcional.";
  2. o balão do Stu, "Agora eu sou o aluno: me explique com suas palavras!";
  3. o parágrafo "Explique a ideia desta lição como se ensinasse um amigo e dê um exemplo seu. O Stu aponta o que fez sentido e propõe uma situação nova.".

  Só depois vêm "A ideia desta lição: …", o campo e os botões. A única ação à vista sem rolar é a de sair, "Pular e concluir".

  | Largura | O rodapé preso começa perto de | Campo "Sua explicação" começa em | "Enviar minha explicação" em |
  | --- | --- | --- | --- |
  | 360 × 800 | 693 | 732 (fora da tela) | 1041 |
  | 390 × 844 | 737 | 710 (só a borda de cima) | 997 |
  | 768 × 1024 | 917 | 638 | 869 |
  | 1280 × 720 | 612 | 648 (fora da tela) | 879 |
  | 1440 × 900 | 792 | 648 | 879 (fora da tela) |

- **Hoje (app, pelo código).** O app não tem o cartão do item 1. A ordem é balão do Stu, passos, parágrafo, "A ideia desta lição", voz e campo (`apps/mobile/src/estudio-adaptativo.tsx:960-975`). A web e o app já estão diferentes aqui, sem linha na spec 07.
- **Proposta.** Um cartão só, com o convite dito uma vez e o campo logo em seguida.

  | Ordem | Antes (web, 390) | Depois (web e app) |
  | --- | --- | --- |
  | 1 | Linha "Ensine ao Stu" | Linha "Ensine ao Stu", com a marca "Opcional" à direita. Ela é o título da etapa e recebe o foco |
  | 2 | Cartão "Ensine ao Stu" + "Explique a ideia com suas palavras. Esta etapa é opcional." | Sai |
  | 3 | Balão do Stu | Balão do Stu, igual |
  | 4 | "Passo 1 de 3 · Gravar ou escrever" | Igual |
  | 5 | Parágrafo de quatro linhas | Sai daqui (vai para o item 9, mais curto) |
  | 6 | "A ideia desta lição: …" | Igual |
  | 7 | Campo "Sua explicação", 156 px | Campo "Sua explicação", com altura mínima de 96 px até 600 px de largura e de 120 px acima disso |
  | 8 | Ajuda da gravação, entre o campo e os botões | "Gravar explicação" e "Enviar minha explicação", logo abaixo do campo |
  | 9 | "Gravar explicação" e "Enviar minha explicação" | "Explique como se ensinasse um amigo e dê um exemplo seu." e, embaixo, a ajuda da gravação de hoje |

- **Texto final.**
  - Título da etapa: "Ensine ao Stu". Marca: "Opcional".
  - Balão: "Agora eu sou o aluno: me explique com suas palavras!" (não muda).
  - Ajuda embaixo dos botões: "Explique como se ensinasse um amigo e dê um exemplo seu."
  - Saem: "Explique a ideia com suas palavras. Esta etapa é opcional." e a frase "O Stu aponta o que fez sentido e propõe uma situação nova.".
- **Comportamento.** Nada muda no envio, na gravação, no retorno em quatro cartões nem no rodapé ("Pular e concluir" antes de enviar, "Concluir lição" depois). "Enviar minha explicação" continua no fluxo da página (spec 16, item 24). A pílula "Ver mais abaixo" deixa de aparecer na chegada, porque não sobra nada escondido que a pessoa precise.
- **Mexe em decisões anteriores (precisa do aceite do Lead):**
  - spec 17, seção 7, que lista a frase "Explique a ideia com suas palavras." na etapa. O balão do Stu já diz isso; a frase sai para não repetir.
  - spec 16, item 29, que fixou o parágrafo longo. Fica a primeira frase, encurtada.
- **Critério observável.** Ao chegar na etapa, sem rolar e com o texto no tamanho padrão:
  - em 360 × 800 e em 390 × 844, o campo inteiro e "Enviar minha explicação" inteiro ficam acima do rodapé (pela conta das alturas de hoje, "Enviar" termina perto de 668 em 360 × 800, com o rodapé em 693, e perto de 637 em 390 × 844, com o rodapé em 737);
  - em 1280 × 720 e em 1366 × 768, o campo inteiro fica acima do rodapé; "Enviar minha explicação" fica inteiro à vista em 1440 × 900;
  - antes do campo, o convite aparece uma vez só, no balão do Stu;
  - com o teclado aberto, o campo e "Enviar minha explicação" seguem à vista (spec 17, seção 7);
  - no app, a mesma ordem, medida no Android e no iPhone. Sem essa medida, o item fica aberto no app.

### L2 (P0). Conclusão: as conquistas da lição aparecem sem rolar

- **Onde:** "Lição concluída!" (momento 4 do roteiro, 1:30 a 2:00). Web e app (app: pelo código, `apps/mobile/src/estudo.tsx:3068-3089`, mesma ordem da web).
- **Evidência:** `c15-conclusao-390`, `f04-conclusao-360`.
- **Hoje.** O roteiro manda concluir a lição "para mostrar os cartões de história na tela de conclusão (Ponte construída)". Em 390 × 844, "Ponte construída" começa em 670 e o rodapé preso começa em 713: aparece o título e meia linha. "Você ensinou ao Stu" fica todo abaixo da dobra. Antes deles, a tela mostra o aviso da sessão, a lição liberada, "O que você praticou" e a linha "Mais um passo na sua trilha.". O apresentador precisa rolar para mostrar o que acabou de fazer.
- **Proposta.** Quando a pessoa construiu a ponte ou ensinou ao Stu, isso vem logo depois do progresso.

  | Ordem | Antes | Depois |
  | --- | --- | --- |
  | 1 | Stu, "Lição concluída!", nome da lição | Igual |
  | 2 | "Progresso na trilha" | Igual |
  | 3 | Aviso da sessão ou da conta | **"Ponte construída" e "Você ensinou ao Stu"**, quando existirem, numa linha cada: ícone de 20 px, título em negrito e o texto de hoje em uma linha de 14/21 |
  | 4 | "Liberada na trilha: …" | Aviso da sessão ou da conta |
  | 5 | "O que você praticou" | "Liberada na trilha: …" |
  | 6 | "Mais um passo na sua trilha." | "O que você praticou" |
  | 7 | "Ponte construída", "Você ensinou ao Stu" | Tempo, De primeira, Etapas |
  | 8 | Tempo, De primeira, Etapas | |

- **Texto final.** Os títulos e os textos de hoje, sem mudança: "Ponte construída" / "Você transformou o erro em degrau, atravessou o reforço e voltou para vencer." e "Você ensinou ao Stu" / "Você explicou a ideia com suas palavras e testou seu entendimento.". A linha "Mais um passo na sua trilha." sai quando há pelo menos uma conquista; sem conquista, fica onde está.
- **Comportamento.** As ações do rodapé não mudam. O leitor de tela lê na ordem nova. Sem ponte e sem explicação, a tela fica exatamente como hoje.
- **Mexe em decisão anterior (precisa do aceite do Lead):** o Piloto A (spec 04, emenda de 24/11) pôs as "histórias condicionais" como secundárias, depois do objetivo praticado. A troca vale só para a posição delas; o resto da ordem do piloto fica.
- **Critério observável.** Depois de uma lição com ponte e com explicação enviada, em 390 × 844 e em 360 × 800, sem rolar: "Ponte construída", "Você ensinou ao Stu" e "Liberada na trilha: …" ficam inteiros acima do rodapé. Igual no app, medido no aparelho.

### L3 (P1). Conclusão no computador: as ações ficam presas embaixo

- **Onde:** "Lição concluída!", web a partir de 601 px.
- **Evidência:** `e09-conclusao-1280`.
- **Hoje.** A partir de 601 px as ações não ficam presas. "Ir para a próxima lição" fica em 786 px da página. Em 1280 × 720 e em 1366 × 768 (notebook e projetor), o botão está fora da tela; só aparece em janelas com 900 px de altura ou mais. Na aula, na mesma largura, a ação ("Avançar", "Verificar", "Continuar") já fica numa barra presa embaixo.
- **Proposta.** A conclusão usa a mesma barra presa da aula a partir de 601 px: "Ir para a próxima lição" à esquerda e "Voltar à trilha" ao lado, na coluna do conteúdo.
- **Texto final.** Sem mudança.
- **Comportamento.** O fim da página reserva a altura da barra, para os números não ficarem atrás dela. Na trilha concluída, a mesma barra leva as ações que a spec 17, seção 7, define.
- **Critério observável.** Em 1280 × 720 e em 1366 × 768, ao chegar na conclusão, "Ir para a próxima lição" e "Voltar à trilha" estão inteiros na tela sem rolar. Em 768 × 1024, também.

### L4 (P2). Proposta pronta: só um botão é azul cheio

- **Onde:** prévia da trilha, depois de montar. Web em 390 × 844. App: não conferido nesta rodada.
- **Evidência:** `g01-proposta-390` (tela parada, 2,5 s depois de ficar pronta).
- **Conferido e certo:** ao ficar pronta, a tela rola sozinha até a lição 1. Com a tela parada, o nó da lição 1 fica de 157 a 285 px, inteiro abaixo da placa (77 a 127), como a spec 16, item 1, pede. Uma captura feita no meio dessa rolagem mostrava o nó cortado; não é defeito.
- **Hoje.** "Ver o fim da trilha" é uma pílula azul cheia, da mesma cor de "Começar a lição 1", 33 px acima dele (545 a 589; o botão começa em 622), por cima do caminho e do nó da lição 3. A spec 16, item 1, chama esse controle de "botão de texto". Na tela há dois azuis cheios, e o menor fica mais perto do dedo.
- **Proposta.** "Ver o fim da trilha" passa a ter o desenho da pílula "Ver mais abaixo" da aula: fundo branco, borda de 2 px `#E1E7FA`, texto e seta em azul, 44 px de altura. Lugar e comportamento não mudam.
- **Texto final.** Sem mudança.
- **Critério observável.** Em 390 × 844 e em 360 × 800, com a proposta pronta e a tela parada: o círculo e o nome inteiro da lição 1 ficam abaixo da placa; na tela há um único botão azul cheio, "Começar a lição 1".

### L5 (P1, defeito). Tela do material no celular: a página fica mais larga que a tela

- **Onde:** Nova trilha, "Tenho um material", web até a largura do celular. É o primeiro passo do roteiro (0:00 a 0:25).
- **Evidência:** `a08-material-390` e medida na página: a largura do documento é 429 px numa tela de 390.
- **Hoje.** Os dois campos de arquivo escondidos (`.estudio-arquivo-input`) deveriam ter 1 px. No celular, a regra `.estudio-acoes > * { width: 100% }` (`src/app/estudio.css:203`) vem depois e vence a de 1 px (`src/app/estudio.css:71`). Cada campo fica com 390 px, começando em 39: sobram 39 px para a direita. No navegador em modo celular, a página inteira passa a ter 429 px de largura, o que dá rolagem lateral ou a tela toda encolhida.
- **Proposta.** O campo escondido volta a ter 1 px em qualquer largura. É correção, não desenho novo.
- **Critério observável.** Em 360 × 800 e em 390 × 844, na tela do material antes e depois de escolher o arquivo, a largura do documento é igual à da tela e não há rolagem lateral. Conferir também num Android e num iPhone, no navegador.
- **Regra já decidida e não publicada na web:** o alto compacto desta tela (spec 16, item 35: Stu de 56, título em 24/30, aviso da IA numa linha). No publicado, o título ocupa três linhas grandes.

### L6 (P1). Nova trilha: as três saídas de texto cabem acima da cápsula

- **Onde:** Nova trilha, web até 600 px. App: não conferido nesta rodada.
- **Evidência:** `a03-nova-390`, `a04-nova-360`.
- **Hoje.** Depois das ideias vêm três botões de texto, um por linha, com 28 px de vão entre eles: "Adicionar por link" (581 a 625), "Ver trilhas da comunidade" (653 a 697) e "Ver como funciona" (725 a 769). Em 390 × 844 o último encosta na cápsula, que começa em 770. Em 360 × 800 a cápsula começa em 726 e "Ver como funciona" fica inteiro atrás dela na primeira vista.
- **Regra já decidida e não cumprida em 360 × 800:** nenhum elemento tocável fica inteiro atrás da cápsula na primeira vista (spec 16, item 35).
- **Proposta.** O vão entre os três botões de texto cai de 28 para 4 px (cada um continua com 44 px de altura). Eles passam a ocupar de 581 a 721.
- **Texto final.** Sem mudança, na mesma ordem (specs 09 e 10).
- **Critério observável.** Em 360 × 800 e em 390 × 844, sem rolar, os três botões ficam inteiros acima da cápsula, com pelo menos 4 px de folga em 360 × 800.

### L7 (P2). "Por onde começamos?": o pedido tem nome e a tela tem o Stu

- **Onde:** passo entre o pedido e a proposta. Web e app (o app usa o mesmo título, `apps/mobile/src/diagnostico.tsx:48`; a tela do app não foi conferida).
- **Evidência:** `a05-comecamos-390`.
- **Hoje.** O pedido da pessoa ("Frações") aparece como texto solto embaixo do título, sem dizer o que é. A tela não tem o Stu, que estava na tela anterior, e metade dela fica vazia.
- **Proposta.** O Stu de 72 px ao lado do título, como em "O que você quer aprender?". O pedido ganha rótulo.
- **Texto final.** Rótulo "Seu pedido", em 14/21, e embaixo o pedido em 17/26 negrito. O parágrafo e os três botões não mudam.
- **Critério observável.** Em 390 × 844 e em 360 × 800, a tela mostra o Stu ao lado do título, "Seu pedido" acima do texto do pedido, e "Responder perguntas" inteiro sem rolar.
- **Sem prova nesta rodada:** as perguntas e a tela de aceite da IA. A IA de demonstração não gera perguntas ("A geração está indisponível agora. Tente novamente."). Ficam para o segundo lote, no site publicado.

### L8 (P2). Ponte de reforço: no desafio, o cabeçalho encolhe

- **Onde:** "Outro jeito de entender", passos 2 e 3 (momento 2 do roteiro). Web até 600 px. App: não conferido nesta rodada.
- **Evidência:** `c06-ponte-390`, `c08-ponte3-390`.
- **Hoje.** O selo "Reforço", o título, o parágrafo "Você respondeu "…". Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício." (três linhas) e as tábuas se repetem iguais nos três passos e ocupam 330 dos 844 px. Em 390 × 844 as três alternativas do desafio cabem com 20 px de folga. Em telas mais baixas, a última alternativa fica atrás de "Verificar".
- **Proposta.** Nos passos 2 e 3, até 600 px, o parágrafo "Você respondeu…" não aparece (a pessoa já leu no passo 1). O selo, o título e as tábuas ficam.
- **Critério observável.** Em 360 × 800, no passo 3, as três alternativas ficam inteiras acima do rodapé sem rolar.
- **Fica com o Lead (conteúdo):** a frase da IA de demonstração "Uma resposta incorreta indica que vale revisar esta ideia antes de continuar.".

## 2. Regras já decididas que o publicado (`80e84cd`, web) ainda não cumpre

Não são propostas novas. Entram aqui para a divisão da implementação.

| Regra | Onde está | O que se vê hoje | Evidência |
| --- | --- | --- | --- |
| Nenhum tocável inteiro atrás da cápsula na primeira vista | spec 16, item 35 | "Ver como funciona" em 360 × 800 (L6) | `a04-nova-360` |
| Alto compacto da tela do material | spec 16, item 35 | Título em três linhas grandes (L5) | `a08-material-390` |
| Alvo de toque de 44 px nos botões de texto | spec 04, item 9 | "Etapa anterior" tem 29 px de altura; "Ver mais abaixo" tem 33 | `c12-ensine-390`, `e08-ensine-1280` |
| Sem o selo de visto sobre o Stu na conclusão | spec 04, item 4 (19/11) | O selo verde está na web e no código do app. O Piloto A (24/11) refez a conclusão e não cita o selo. **O Lead decide se a regra de 19/11 ainda vale** | `c15-conclusao-390` |

## 3. O que foi visto e fica como está

- Proposta pronta: a tela rola até a lição 1 inteira abaixo da placa (spec 16, item 1, cumprida na web).
- Retorno do erro: "Não foi dessa vez", "Ver outro jeito de entender", "Tentar de novo", "Pular por agora" e a linha "Se pular, este exercício volta no fim da lição.".
- Retorno do acerto, na web em 390 e em 1280.
- Minhas trilhas com o cartão "Seu próximo passo".
- Mapa da trilha ao voltar da lição: cabeçalho, "Progresso salvo agora", a placa "Continue de onde parou. A próxima lição já está liberada." e o nó atual com o cartão "Começar".
- Computador (1280): navegação lateral, mapa, balão do nó com "Começar", conceito, exercício de ligar e retorno do acerto.
- Depois de enviar a explicação: os quatro cartões de retorno e "Concluir lição" no rodapé.
- A espera da criação e os estados da retomada: valem as decisões da spec 17 (mudança 1) e da spec 04 ("Retomada da criação"). Os estados com rede lenta e sem rede entram no segundo lote. A falha da retomada do visitante em produção segue na #20.

## 4. Passagem da página de apresentação para o app

A página é do Lead; aqui só a passagem. Visto na web em 390 × 844, com a apresentação ligada.

| De | Para | O que se vê | Avaliação |
| --- | --- | --- | --- |
| "Experimentar sem conta" | Nova trilha (`/?tela=nova`) | "O que você quer aprender?" com o campo, sem tela no meio | Certo, como a spec 18 define |
| "Entrar" | Entrada (`/login`) | A primeira metade da tela repete a apresentação ("Aprenda qualquer coisa, um passo de cada vez.", "Ver como funciona", "Experimentar sem conta"); o campo de e-mail começa em 531 de 844. Não há como voltar à página a não ser pelo botão do navegador | Proposta no segundo lote (P2) |
| Campo de assunto + "Continuar" | Não conferido nesta rodada | | Segundo lote |

## 5. Capturas e origem

Todas as capturas desta rodada: navegador (Chrome 158, sem janela), servidor local em `80e84cd` com IA de demonstração, visitante, 27/11. Pasta temporária do Designer, apagada ao fim da tarefa; a prancha do lote curto fica no Drive.

| Captura | Tela | Largura |
| --- | --- | --- |
| `a02-login-390` | Entrada, vinda de "Entrar" na apresentação | 390 × 844 |
| `a03-nova-390`, `a04-nova-360` | Nova trilha | 390 × 844, 360 × 800 |
| `a05-comecamos-390` | "Por onde começamos?" | 390 × 844 |
| `g01-proposta-390` | Proposta pronta, tela parada | 390 × 844 |
| `a08-material-390` | Tela do material | 390 × 844 |
| `c05-erro-390`, `c10-acerto-390` | Retorno do erro e do acerto | 390 × 844 |
| `c06-ponte-390`, `c08-ponte3-390`, `c09-ponte-acerto-390` | Ponte de reforço | 390 × 844 |
| `c12-ensine-390`, `f02-ensine-360`, `f01-ensine-768`, `e08-ensine-1280` | Ensine ao Stu | 390, 360, 768, 1280 |
| `c15-conclusao-390`, `f04-conclusao-360`, `f03-conclusao-768`, `e09-conclusao-1280` | Lição concluída | 390, 360, 768, 1280 |
| `d01-mapa-390`, `d02-minhas-390` | Mapa e Minhas trilhas | 390 × 844 |
| `e01-minhas-1280` a `e07-completar-1280` | Minhas trilhas, mapa e aula no computador | 1280 × 720 |

**Android e iPhone:** nenhuma captura nativa nova. O que este documento diz do app vem do código e está marcado.

## 6. Segundo lote (em andamento)

Inventário e propostas do restante: perguntas e aceite da IA (no site publicado), espera com rede lenta, retomada sem rede, trilhas, Explorar, Perfil, ajustes, som, compartilhar, estados vazios e de erro, teclado, texto ampliado, movimento reduzido, e a conferência do app na prévia web do app.
