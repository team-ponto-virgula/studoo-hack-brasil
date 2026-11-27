# Refino da experiência para a banca (27/11)

Tarefa #25. Revisão tela por tela do Studoo publicado (`80e84cd`), na ordem em que a banca vê: entrada, criação, espera, primeira lição, retorno, conclusão, progresso e retomada. Depois, o resto do produto.

Este documento só propõe. Não muda código, não toca na página de apresentação (spec 18, do Lead), nos envios da Apple nem na produção.

## Como ler

- **Prioridade.** P0: aparece no roteiro de dois minutos e atrapalha o que o apresentador precisa mostrar. P1: aparece no caminho da banca. P2: melhora, mas a demo passa sem.
- **Origem da evidência.** Quase tudo o que foi medido nesta rodada vem do **navegador** (Chrome 158, sem janela), com o **servidor local na versão `80e84cd`**, IA de demonstração, sessão de visitante e as chaves de visitante, comunidade, compartilhar, cadastro e apresentação ligadas. **Não é o site publicado e não é aparelho.**
- **Site publicado.** Três telas só existem com a IA de verdade ou com dados reais e foram **olhadas no site publicado**, em 27/11, como visitante, **sem aceitar o uso da IA e sem criar trilha**: o aceite da IA, o aceite recusado e o Explorar com trilhas. Cada item diz quando a origem é essa.
- **App (Android e iPhone).** O app foi lido **pelo código** (`apps/mobile/src`) e pelas **capturas de 24/11 da prévia web do app** (`docs/ux/evidencias/clareza-2026-11-24/rnweb/`, 390 × 844 e 360 × 800), que são navegador, não aparelho. Onde o texto diz "app: pelo código" ou "app: prévia de 24/11", **não há prova nativa**. Nenhuma afirmação deste documento vale como medida no aparelho. A prévia web do app não foi aberta de novo nesta rodada: ela só fala com o servidor publicado, e montar uma trilha lá gastaria IA paga e gravaria dados em produção.
- **Teclado.** O navegador sem janela não tem teclado na tela. Tudo o que depende do teclado aberto está marcado "sem prova".
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

- **Onde:** "Lição concluída!" (momento 4 do roteiro, 1:30 a 2:00). Web e app (app: pelo código, `apps/mobile/src/estudo.tsx:3068-3089`, e pela prévia de 24/11; mesma ordem da web).
- **Evidência:** web, `c15-conclusao-390`, `f04-conclusao-360`. App, prévia de 24/11: `docs/ux/evidencias/clareza-2026-11-24/rnweb/06-conclusao-390x844.png` (mesma ordem, selo sobre o Stu, as conquistas abaixo da dobra e "Voltar à trilha" como texto).
- **Hoje.** O roteiro manda concluir a lição "para mostrar os cartões de história na tela de conclusão (Ponte construída)". Em 390 × 844, "Ponte construída" começa em 670 e o rodapé preso começa em 713: aparece o título e meia linha. "Você ensinou ao Stu" fica todo abaixo da dobra. Antes deles, a tela mostra o aviso da sessão, a lição liberada, "O que você praticou" e a linha "Mais um passo na sua trilha.". O apresentador precisa rolar para mostrar o que acabou de fazer.
- **Proposta.** Quando a pessoa construiu a ponte ou ensinou ao Stu, isso vem logo depois do progresso.

  | Ordem | Antes | Depois |
  | --- | --- | --- |
  | 1 | Stu, "Lição concluída!", nome da lição | Igual |
  | 2 | "Progresso na trilha" | Igual |
  | 3 | Aviso da sessão ou da conta | **"Ponte construída" e "Você ensinou ao Stu"**, quando existirem, numa linha cada: ícone de 20 px, título em negrito e o texto de hoje em uma linha de 14/21 |
  | 4 | "Liberada na trilha: …" | Aviso da sessão ou da conta |
  | 5 | "O que você praticou" | "Liberada na trilha: …" |
  | 6 | "Mais um passo na sua trilha." | "O que você praticou" e, quando existir, o aviso de rever ("Você errou 1 exercício antes de acertar. Vale rever esta lição amanhã…"), que continua logo depois dele |
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
- **Evidência:** `a08-material-390` e medida na página, **antes de escolher o arquivo**: a largura do documento é 429 px numa tela de 390 e 399 px numa tela de 360 (medida repetida duas vezes). Depois de escolher o material, os dois campos saem da tela e a largura volta ao normal (390).
- **Hoje.** Os dois campos de arquivo escondidos (`.estudio-arquivo-input`) deveriam ter 1 px. No celular, a regra `.estudio-acoes > * { width: 100% }` (`src/app/estudio.css:203`) vem depois e vence a de 1 px (`src/app/estudio.css:71`). Cada campo fica com 390 px, começando em 39: sobram 39 px para a direita. No navegador em modo celular, a página inteira passa a ter 429 px de largura, o que dá rolagem lateral ou a tela toda encolhida.
- **Proposta.** O campo escondido volta a ter 1 px em qualquer largura. É correção, não desenho novo.
- **Critério observável.** Em 360 × 800 e em 390 × 844, na tela do material com "Escolher arquivo" à vista (antes de escolher), a largura do documento é igual à da tela e não há rolagem lateral; depois de escolher, continua igual. Conferir também num Android e num iPhone, no navegador.
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
- **Sem prova nesta rodada:** as perguntas. A IA de demonstração não gera perguntas ("A geração está indisponível agora. Tente novamente.") e, no site publicado, elas pedem a IA paga. O aceite da IA foi visto no site publicado e está no M1.

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
| Alvo de toque de 44 px nas chaves de som | spec 04, item 9; spec 12 | As chaves "Música de fundo" e "Efeitos sonoros", na folha de som da aula e no Perfil, têm 52 × 32. As linhas têm 65 e 85 px, mas só a chave responde ao toque | `i02-som-390`, `k01-perfil-390` |
| Sem o selo de visto sobre o Stu na conclusão | spec 04, item 4 (19/11) | O selo verde está na web e no código do app. O Piloto A (24/11) refez a conclusão e não cita o selo. **O Lead decide se a regra de 19/11 ainda vale** | `c15-conclusao-390` |

## 3. O que foi visto e fica como está

- Proposta pronta: a tela rola até a lição 1 inteira abaixo da placa (spec 16, item 1, cumprida na web).
- Retorno do erro: "Não foi dessa vez", "Ver outro jeito de entender", "Tentar de novo", "Pular por agora" e a linha "Se pular, este exercício volta no fim da lição.".
- Retorno do acerto, na web em 390 e em 1280.
- Minhas trilhas com o cartão "Seu próximo passo".
- Mapa da trilha ao voltar da lição: cabeçalho, "Progresso salvo agora", a placa "Continue de onde parou. A próxima lição já está liberada." e o nó atual com o cartão "Começar".
- Computador (1280): navegação lateral, mapa, balão do nó com "Começar", conceito, exercício de ligar e retorno do acerto.
- Depois de enviar a explicação: os quatro cartões de retorno e "Concluir lição" no rodapé.
- A espera da criação e os estados da retomada: valem as decisões da spec 17 (mudança 1) e da spec 04 ("Retomada da criação"). Os estados com rede lenta e sem rede foram vistos e estão na seção 6. A falha da retomada do visitante em produção segue na #20.
- Criação com material: "Experimentar com frações" abre "Frações — material de demonstração" com a marca "Modo demonstração", "Confira o conteúdo antes de gerar", as três páginas com "Ver texto completo" e "Criar trilha deste material" preso acima da cápsula (702 a 754 em 390 × 844). A proposta sai com 3 lições em 2 partes, lição 1 inteira abaixo da placa e sem a pílula "Ver o fim da trilha", porque a trilha cabe quase toda na tela.
- "Ajustar pedido" numa proposta feita de assunto: volta para "O que você quer aprender?" com o texto no campo e o cursor nele.
- Sair no meio da lição: volta ao mapa com "Progresso salvo agora" e a placa "A primeira lição já está aberta. Continue de onde parou.".
- Folha de som da aula e a seção "Som" do Perfil (spec 12), fora o tamanho das chaves, que está na seção 2.
- Minhas trilhas: o menu "•••" (Compartilhar, Configurações, Apagar), a confirmação de apagar com o nome e o progresso da trilha, o aviso "Trilha "…" apagada." e a tela vazia ("Nenhuma trilha ainda", "Criar minha primeira trilha"), em 768 e em 390.
- Perfil do visitante (specs 07 P27, 09 e 12): o cartão da conta temporária, "Meu estudo", Som, Privacidade e dados, Pessoas bloqueadas, Ajuda e Conta. A confirmação de sair diz o que se perde ("Sair da sessão de visitante? Como visitante não há e-mail nem senha: as trilhas e o progresso desta sessão não passam para uma conta e deixam de ficar disponíveis neste navegador.") e oferece "Ficar" e "Sair".
- Criar conta (`/cadastro`): "Criar sua conta", um campo de e-mail, "Enviar código" e "Já tenho conta".
- Explorar sem trilhas ("O Explorar ainda está vazio", "Ir para minhas trilhas") e a aba "Seguindo" do visitante ("Para seguir pessoas, entre com uma conta").
- Tela do material no computador (1280): "Escolher arquivo" e "Experimentar com frações" lado a lado, sem sobra de largura.

## 4. Passagem da página de apresentação para o app

A página é do Lead; aqui só a passagem. Visto na web em 390 × 844, com a apresentação ligada.

| De | Para | O que se vê | Avaliação |
| --- | --- | --- | --- |
| "Experimentar sem conta" | Nova trilha (`/?tela=nova`) | "O que você quer aprender?" com o campo, sem tela no meio | Certo, como a spec 18 define |
| "Entrar" | Entrada (`/login`) | A primeira metade da tela repete a apresentação ("Aprenda qualquer coisa, um passo de cada vez.", "Ver como funciona", "Experimentar sem conta"); o e-mail, a senha, "Entrar" e "Esqueci minha senha" cabem inteiros na primeira tela (o campo de e-mail começa em 531 de 844). Não há como voltar à página a não ser pelo botão do navegador | Fica como a spec 18 define |
| Campo de assunto + "Continuar" | Nova trilha (`/?tela=nova`) | O assunto chega escrito no campo e "Montar minha trilha" já está ligado. A sessão de visitante é criada nesse toque, sem aviso | Certo na chegada. **Ponto para o Lead, na página dele:** o bloco "O que você quer aprender?" da apresentação não diz que "Continuar" começa uma conta temporária de 24 horas; "Experimentar sem conta" diz isso na entrada. Uma linha curta embaixo do campo resolve |

No site publicado a apresentação está desligada: o endereço principal abre a entrada (`/login`). A passagem acima só foi vista no servidor local, com a apresentação ligada.

## 5. Capturas e origem

Capturas desta rodada: navegador (Chrome 158, sem janela), 27/11, visitante. Onde a tabela não diz outra coisa, a origem é o servidor local em `80e84cd` com IA de demonstração. As marcadas "publicado" são do site publicado, sem aceitar a IA. Pasta temporária do Designer, apagada ao fim da tarefa; a prancha do lote curto fica no Drive.

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
| `a09-nova-1280`, `a11-nova-768` | Nova trilha no computador e no tablet | 1280 × 720, 768 × 1024 |
| `a10-material-1280` | Tela do material no computador | 1280 × 720 |
| `m01-material-390`, `m03-material-lido-390`, `m05-material-proposta-390` | Material: escolher, conferir e proposta | 390 × 844 |
| `a13-continuar-390` | Nova trilha, vinda de "Continuar" na apresentação | 390 × 844 |
| `a18-cadastro-390` | Criar conta | 390 × 844 |
| `a14-aceite-ia-390` (publicado) | Aceite da IA | 390 × 844 |
| `a15-comecamos-prod-390` (publicado) | "Por onde começamos?" com o aviso da música | 390 × 844 |
| `a16-sem-aceite-390`, `a17-sem-aceite-pular-390` (publicado) | Aceite recusado em "Responder perguntas" e em "Pular perguntas" | 390 × 844 |
| `h01-sem-rede-390`, `h02-sem-rede-25s-390` | Aceite da proposta sem rede e depois que a rede volta | 390 × 844 |
| `h03-espera-lenta-390`, `h04-licao1-390` | Lição abrindo com rede lenta e a lição aberta | 390 × 844 |
| `i02-som-390`, `i03-sair-390` | Folha de som da aula; mapa depois de sair no meio da lição | 390 × 844 |
| `d03-minhas-768` a `d06-vazio-768`, `d07-vazio-390` | Minhas trilhas: lista, menu, apagar e vazia | 768 × 1024, 390 × 844 |
| `j01-explorar-390`, `j02-explorar-1280` | Explorar vazio | 390 × 844, 1280 × 720 |
| `j03-explorar-prod-390` (publicado) | Explorar com trilhas | 390 × 844 |
| `k01-perfil-390`, `k02-perfil-1280`, `k03-sair-390` | Perfil do visitante e a confirmação de sair | 390 × 844, 1280 × 720 |

**Android e iPhone:** nenhuma captura nativa nova. O que este documento diz do app vem do código e das capturas de 24/11 da prévia web do app, e está marcado.

## 6. Segundo lote: o resto do produto

Ordem de implementação sugerida: M1, M2, M3, M4, M5. Nenhum deles está no roteiro de dois minutos; M1 aparece se a banca recusar o aceite da IA, e M2 aparece em qualquer demonstração feita no computador.

### M1 (P1). Aceite da IA recusado em "Responder perguntas": a tela diz o que falta

- **Onde:** "Por onde começamos?", depois de "Responder perguntas" e de "Agora não" no aceite da IA. Web (visto) e app (pelo código, `apps/mobile/src/diagnostico.tsx:54`).
- **Evidência e origem:** `a16-sem-aceite-390` e `a17-sem-aceite-pular-390`, **site publicado**, 27/11, visitante, 390 × 844. Código: `src/app/diagnostico.tsx:83`.
- **Conferido e certo no publicado:** o aceite abre no alto, com "Permitir e continuar" e "Agora não" presos embaixo (spec 17, B3). No caminho "Pular perguntas", recusar leva a "Não deu para gerar agora. Veja o aviso abaixo.", "Para continuar, permita o uso de IA." e o botão "Permitir o uso de IA" (spec 17, B4).
- **Hoje.** No caminho "Responder perguntas", recusar leva a uma mensagem de falha que não é verdade: "Não foi possível carregar a pergunta. Você pode tentar novamente ou montar a trilha direto.", com o botão "Tentar novamente". O botão só abre de novo o mesmo aceite. A pessoa não fica sabendo que o que falta é a permissão. No app, a frase é outra: "Não foi possível carregar a pergunta. Tente novamente.". É o mesmo defeito B4, no caminho que ficou de fora do conserto.
- **Proposta.**

  | | Antes | Depois (web e app) |
  | --- | --- | --- |
  | Mensagem | "Não foi possível carregar a pergunta. Você pode tentar novamente ou montar a trilha direto." | "Para continuar, permita o uso de IA." |
  | Botão principal | "Tentar novamente" | "Permitir o uso de IA" |
  | Outras saídas | "Pular perguntas", "Voltar ao pedido" | Iguais |

- **Texto final.** Os dois textos já existem no contrato (`consentimento_ia` e `permitirAgora`, `packages/contratos/src/experiencia.ts:1513` e `:1597`). Nenhum texto novo. A frase de falha continua valendo para a falha de verdade, e passa a ser a mesma na web e no app: "Não foi possível carregar a pergunta. Você pode tentar de novo ou montar a trilha direto.".
- **Comportamento.** "Permitir o uso de IA" abre o mesmo aceite; ao permitir, a primeira pergunta carrega sem outro toque. Recusar de novo volta para esta mesma tela. O foco vai para a mensagem.
- **Critério observável.** Na web e no app, em 390 × 844: "Responder perguntas", "Agora não". A tela mostra "Para continuar, permita o uso de IA." e o botão "Permitir o uso de IA"; não aparece "Não foi possível carregar a pergunta". Tocar no botão e permitir mostra a primeira pergunta.
- **Para o roteiro (Lead):** com a IA de verdade, o aceite aparece no primeiro toque que usa a IA. Quem apresenta numa sessão nova precisa contar com esse toque, ou entrar na demo com o aceite já dado.
- **Sem prova:** o que vem depois de permitir (as perguntas e "Seu ponto de partida"), porque pede a IA paga.

### M2 (P1). Nova trilha no tablet e no computador: as ideias aparecem todas

- **Onde:** "O que você quer aprender?", web a partir de 601 px. O celular fica como está.
- **Evidência e origem:** `a09-nova-1280`, `a11-nova-768`, servidor local. Código: `src/app/pedido.css:340-354`.
- **Hoje.** As sete ideias ficam numa linha só, que rola para o lado, com a barra de rolagem escondida, em qualquer largura. No celular o dedo arrasta. No computador, a terceira ideia aparece cortada na borda da coluna e as outras quatro, incluindo "Frações" e "Surpreenda-me", ficam fora da tela (a linha vai até perto de 2048 px numa tela de 1280). Com o mouse não há seta, barra nem sinal de que existe mais. Em 1280 × 720, "Ver como funciona" termina em 717, colado no fim da tela.
- **Proposta.**

  | | Antes (1280 × 720) | Depois (a partir de 601 px) |
  | --- | --- | --- |
  | Ideias | Uma linha que rola, com três à vista e a terceira cortada | As sete à vista, quebrando em linhas dentro da coluna (três linhas em 1280), sem rolagem lateral |
  | "Adicionar por link", "Ver trilhas da comunidade", "Ver como funciona" | Um por linha | Os três lado a lado, numa linha, centralizados |

- **Texto final.** Sem mudança, na mesma ordem (specs 09 e 10).
- **Comportamento.** Até 600 px nada muda (vale o L6). A ordem de leitura e de teclado continua a mesma. "Surpreenda-me" continua sendo a última ideia.
- **Critério observável.** Em 768 × 1024, 1280 × 720 e 1366 × 768, sem rolar: as sete ideias estão inteiras na tela, nenhuma cortada; os três botões de texto estão numa linha só; em 1280 × 720 sobra pelo menos 24 px abaixo deles.

### M3 (P2). "Ajustar pedido" numa proposta feita de material volta ao material

- **Onde:** proposta pronta de uma trilha criada com "Tenho um material". Web (visto) e app (pelo código: o mesmo destino, `apps/mobile/src/estudo.tsx:1213`).
- **Evidência e origem:** `m05-material-proposta-390` e leitura da tela seguinte, servidor local, material de demonstração, 390 × 844. Código: `src/app/estudo.tsx:1260`.
- **Hoje.** Numa proposta feita de assunto, "Ajustar pedido" volta para o campo com o texto lá: certo. Numa proposta feita de material, o mesmo botão leva para "O que você quer aprender?" com o campo vazio e "Montar minha trilha" apagado. O material sumiu: abrindo "Tenho um material" de novo, a tela pede o arquivo outra vez. Com o material de demonstração é um toque; com um PDF de verdade, é escolher e esperar a leitura de novo. Não foi conferido com arquivo real.
- **Proposta.** Quando a proposta veio de um material, "Ajustar pedido" volta para a tela "Confira o conteúdo antes de gerar", com o mesmo material carregado, as páginas e "Criar trilha deste material". De lá a pessoa cria de novo, tira o material ("Remover material") ou troca para "Prefiro escrever o assunto".
- **Texto final.** Sem mudança.
- **Comportamento.** O foco vai para o nome do material. Se o material não estiver mais guardado (a página foi recarregada, por exemplo), a tela abre "Tenho um material" vazia, com a linha "Escolha o material de novo para ajustar a trilha.". Essa linha é o único texto novo.
- **Critério observável.** Na web e no app: "Experimentar com frações", "Criar trilha deste material", "Ajustar pedido". A tela mostra "Frações — material de demonstração" com as páginas e "Criar trilha deste material", sem escolher o arquivo de novo.

### M4 (P2). Lição abrindo com rede lenta: a espera tem palavras

- **Onde:** depois de "Começar a lição 1" ou de "Reenviar pedido", enquanto a lição chega. Web (visto). App: pelo código, o leitor de tela ouve "Abrindo a lição" (`apps/mobile/src/estudo.tsx:2517`); a tela não foi conferida.
- **Evidência e origem:** `h03-espera-lenta-390`, servidor local com a rede do navegador limitada (1,5 s de atraso), 390 × 844. Código: `src/app/estudo.tsx:1073-1101`.
- **Hoje.** A tela mostra só o esqueleto cinza da lição. "Abrindo a lição" existe, mas só para o leitor de tela. Com a rede do evento lenta, quem vê fica alguns segundos diante de blocos cinza sem saber se travou. A spec 04 já decidiu que o esqueleto fica até a lição chegar; isso não muda.
- **Proposta.** Se o esqueleto ainda está na tela depois de 2 s, aparece embaixo dele, centralizada, a linha "Abrindo a lição…" em 14/21, na cor do texto secundário. Some quando a lição chega.
- **Texto final.** "Abrindo a lição…" (o texto de hoje do contrato, `packages/contratos/src/experiencia.ts:1188`, com reticências na tela).
- **Comportamento.** Não move o esqueleto nem o foco. O leitor de tela continua ouvindo uma vez só. Com movimento reduzido, a linha entra sem transição.
- **Critério observável.** Com a rede limitada, em 390 × 844: antes de 2 s, só o esqueleto; depois de 2 s, o esqueleto e "Abrindo a lição…"; ao chegar a lição, a linha some. Igual no app.

### M5 (P2). Um jeito só de dizer "tentar de novo"

- **Onde:** botões e frases de erro do produto inteiro, web e app (os textos são do contrato compartilhado).
- **Evidência e origem:** contagem em `packages/contratos/src/experiencia.ts` em `80e84cd`: 23 linhas com "Tentar de novo" ou "Tente de novo" e 13 com "Tentar novamente" ou "Tente novamente". Na tela: o retorno do erro na aula diz "Tentar de novo" (`c05-erro-390`); o aceite recusado diz "Tentar novamente" (`a16-sem-aceite-390`); a IA de demonstração responde "A geração está indisponível agora. Tente novamente.".
- **Hoje.** A mesma ação tem dois nomes, às vezes em telas vizinhas do mesmo caminho.
- **Proposta.** Fica "Tentar de novo" (botão) e "Tente de novo" (frase), que já são a maioria e são o jeito de falar do resto do produto. As 13 linhas com "novamente" trocam só essa palavra.
- **Comportamento.** Nenhum. É troca de texto no contrato; as duas plataformas recebem juntas.
- **Critério observável.** Nenhuma tela da web nem do app mostra "Tentar novamente" ou "Tente novamente"; a busca por "novamente" no contrato não encontra botão nem frase de erro.

### Vistos sem proposta

- **Explorar com trilhas (site publicado, 390 × 844, `j03-explorar-prod-390`).** O título, a descrição em duas linhas, as abas, a busca e os filtros ocupam perto de 420 px. O primeiro cartão aparece, mas o botão "Quero estudar" dele começa em 841, abaixo da tela. Não há proposta: encolher o alto mexe nas specs 09 e 10 e o Explorar não está no roteiro. Fica anotado para depois do evento.
- **Cabeçalho da aula no conceito (`h04-licao1-390`).** O título da lição aparece cortado embaixo da barra de progresso e inteiro, em letra grande, 100 px abaixo. Nas outras etapas a linha pequena serve de contexto. Fica.
- **Links das políticas no aceite da IA (`a14-aceite-ia-390`, site publicado).** Têm 24 px de altura. São links dentro de um parágrafo; ficam.
- **"Ver o fim da trilha" nos estados sem rede (`h01-sem-rede-390`).** A pílula continua por cima do nome da lição 3 enquanto a tela mostra "Verificar status". Resolve junto com o L4.

### Rede, retomada e a #20

Visto na web, servidor local, 390 × 844 (`h01-sem-rede-390`, `h02-sem-rede-25s-390`):

| Situação | O que a tela mostra | Avaliação |
| --- | --- | --- |
| "Começar a lição 1" sem rede | "Verificar status" apagado, "Sem conexão. Vamos verificar o status quando a conexão voltar." e "Ajustar pedido" | Como a spec 04 define |
| A rede volta | A tela confere sozinha e mostra "Seu pedido não chegou ao servidor." com "Reenviar pedido" | Como a spec 04 define |
| "Reenviar pedido" com rede lenta | Esqueleto da lição, sem palavras | M4 |

Implicações para a experiência enquanto a #20 (retomada do visitante em produção) está aberta, sem mexer no conserto:

- Em todos os estados de dúvida que vi há uma saída que não depende da retomada ("Ajustar pedido" e a seta de voltar). Isso precisa continuar verdadeiro no que o Web & API mudar.
- O roteiro da banca não deve depender de retomar uma criação ao vivo. Se a retomada for mostrada, que seja por gravação ou no servidor de ensaio, até a #20 fechar.
- A frase "Seu pedido não chegou ao servidor." só é honesta quando o servidor respondeu que não recebeu. Se a causa achada na #20 for outra (sessão do visitante, por exemplo), a frase certa é a do estado de dúvida, com "Verificar status". Peço para ver o texto final antes de publicar.

## 7. Inventário de telas e estados

Larguras: as que foram vistas na web nesta rodada. "App" diz de onde vem o que se sabe do app; nenhuma linha tem prova no aparelho. Decisão: **Fica**, **Proposta** (com o número), **Regra** (decidida e não cumprida, seção 2) ou **Sem prova**.

### Caminho da banca

| Tela ou estado | Web: larguras vistas | App | Decisão |
| --- | --- | --- | --- |
| Página de apresentação e a passagem para o app | 390 (local) | Não existe no app | Do Lead. Passagem: seção 4 |
| Entrada (`/login`) | 390 (local e publicado) | Não conferido | Fica |
| Nova trilha, celular | 360, 390 | Prévia de 24/11 (`01-pedido`) | Proposta L6; Regra (cápsula em 360) |
| Nova trilha, tablet e computador | 768, 1280 | Não se aplica | Proposta M2 |
| Nova trilha com o teclado aberto | Sem prova | Sem prova | Sem prova |
| "Por onde começamos?" | 390 (local e publicado) | Pelo código | Proposta L7 |
| Aceite da IA | 390 (publicado) | Não conferido | Fica |
| Aceite recusado em "Pular perguntas" | 390 (publicado) | Pelo código | Fica |
| Aceite recusado em "Responder perguntas" | 390 (publicado) | Pelo código | Proposta M1 |
| Perguntas e "Seu ponto de partida" | Sem prova | Sem prova | Sem prova (pede a IA paga) |
| Material: escolher o arquivo | 360, 390, 1280 | Não conferido | Proposta L5 (defeito); Regra (alto compacto) |
| Material: conferir o conteúdo | 390 | Não conferido | Fica |
| Material: câmera e arquivo de verdade | Sem prova | Sem prova | Sem prova |
| Espera da criação | 390 (com a IA de demonstração dura menos de 1 s) | Não conferido | Fica (spec 17, mudança 1). Duração real: sem prova |
| Proposta pronta | 390 | Prévia de 24/11 (`02-proposta`) | Proposta L4 |
| "Ajustar pedido", vindo de assunto | 390 | Pelo código | Fica |
| "Ajustar pedido", vindo de material | 390 | Pelo código | Proposta M3 |
| Aceite sem rede, volta da rede, reenviar | 390 | Não conferido | Fica (spec 04) |
| Lição abrindo com rede lenta | 390 | Pelo código | Proposta M4 |
| Aula: conceito e exemplo | 390, 1280 | Prévia de 24/11 (`03-licao-conceito`) | Fica |
| Aula: exercícios | 390, 1280 | Prévia de 24/11 (`04-primeiro-exercicio`) | Fica |
| Retorno do erro | 390 | Prévia de 24/11 (`05-feedback-erro`) | Fica |
| Ponte de reforço | 390 | Não conferido | Proposta L8 |
| Retorno do acerto | 390, 1280 | Não conferido | Fica |
| Ensine ao Stu | 360, 390, 768, 1280, 1440 | Pelo código; nenhuma captura existe | Proposta L1 |
| Ensine ao Stu com o teclado aberto e com gravação de voz | Sem prova | Sem prova | Sem prova |
| Retorno da explicação | 390 | Não conferido | Fica |
| Lição concluída, celular | 360, 390 | Prévia de 24/11 (`06-conclusao`) | Proposta L2; selo: o Lead decide |
| Lição concluída, tablet e computador | 768, 1280 | Não se aplica | Proposta L3 |
| Trilha concluída | Sem prova | Sem prova | Sem prova (spec 17, seção 7, já define) |
| Mapa ao voltar da lição | 390, 1280 | Prévia de 24/11 (`07-mapa-progresso`) | Fica |
| Retomada na lição 2 | 390 | Prévia de 24/11 (`08-retomada-licao2`) | Fica |
| Sair no meio da lição | 390 | Não conferido | Fica |

### Resto do produto

| Tela ou estado | Web: larguras vistas | App | Decisão |
| --- | --- | --- | --- |
| Minhas trilhas com trilha | 390, 768, 1280 | Não conferido | Fica |
| Menu "•••" da trilha | 768 | Não conferido | Fica |
| Apagar trilha: confirmação e aviso | 768 | Não conferido | Fica |
| Minhas trilhas vazia | 390, 768 | Não conferido | Fica |
| Configurações da trilha e Compartilhar | Não abertas | Não conferido | Sem prova |
| Adicionar por link e "Ver como funciona" | Não abertas | Não conferido | Sem prova |
| Explorar vazio | 390, 1280 | Não conferido | Fica |
| Explorar com trilhas | 390 (publicado) | Não conferido | Fica; anotado em "Vistos sem proposta" |
| Explorar, "Seguindo", visitante | 390 | Não conferido | Fica |
| Perfil do visitante | 390, 1280 | Não conferido | Fica (specs 07 P27, 09, 12) |
| Perfil com conta | Sem prova | Sem prova | Sem prova (não entrei com conta) |
| Som: folha da aula e seção do Perfil | 390 | Não conferido | Regra (chaves de 52 × 32) |
| Sair da sessão de visitante | 390 | Não conferido | Fica |
| Criar conta | 390 | Não conferido | Fica |
| Código por e-mail e recuperar senha | Sem prova | Sem prova | Sem prova |
| Excluir conta | Não aberta | Não conferido | Sem prova (spec 07 P27 define) |
| Frases de erro e de tentar de novo | Contrato | Contrato | Proposta M5 |
| Texto ampliado | Sem prova | Sem prova | Sem prova |
| Movimento reduzido | Sem prova | Sem prova | Sem prova |
| Áreas seguras e a casca do iOS | Não se aplica | Sem prova | Nenhuma proposta deste documento mexe na casca, na cápsula nem nas áreas seguras |

### O que precisa de aparelho

Estas conferências não cabem no navegador sem janela e pedem um Android e um iPhone (ou os emuladores do Mobile & QA), em 390 × 844 e 360 × 800:

1. L1 com o teclado aberto: o campo e "Enviar minha explicação" à vista.
2. L1 e L2 no app: a ordem e as medidas depois da mudança. Não existe nenhuma captura do Ensine ao Stu no app.
3. Nova trilha com o teclado aberto: "Montar minha trilha" à vista.
4. L5 no navegador do celular: sem rolagem lateral na tela do material.
5. As chaves de som: se a linha inteira responde ao toque no app.
6. Texto ampliado e movimento reduzido no caminho da banca.
