# Aprender qualquer assunto

O Studoo ensina qualquer assunto, não só programação. A lição tem formatos e recursos para idiomas, música, culinária, história, ciências e habilidades práticas, na web e no app, com os mesmos dados e a mesma sequência.

## Formatos de exercício

| Formato | A pessoa | Resposta enviada | Correção |
| --- | --- | --- | --- |
| `lacuna` | escreve uma palavra, número ou símbolo | o texto | tolera maiúsculas, acentos, aspas, pontuação nas pontas e artigo; grafias que soam igual em português (ch e x, ç, ss e s, sc e xc, z e s entre vogais: “tarracha”), com aviso de grafia; um deslize de digitação em palavras de 5 letras ou mais (dois a partir de 9), com aviso; a frase em volta junto (“how much” na lacuna de “How ___ is…”), uma palavra de cortesia (“repeat please”, “por favor”) ou, com a lacuna no fim da frase, um complemento (“repeat it”), com o aviso de que basta o que falta. Com a palavra certa no meio de outras, o retorno diz que ela está na resposta e que a lacuna pede só o que falta. Números e símbolos (`>=`) seguem exatos. Com `exata`, a grafia é a lição (idioma) e não há tolerância a deslize: uma letra a mais ou a menos continua errada, mas o retorno diz **Quase! Confira a grafia**. Com a IA configurada, uma resposta errada passa por um desempate (sinônimo, número por extenso), menos uma armadilha conhecida da lição (“chave”), que continua errada, com o aviso; com `exata`, o desempate sabe que a grafia é a lição e não aceita palavra escrita errado. |
| `multipla_escolha` | escolhe uma opção | o id | exata |
| `ordenar` | vê todos os itens numa lista só e arrasta para pôr em ordem, ou toca em dois para trocar de lugar (chegam embaralhados, sempre do mesmo jeito) | `a,b,c` | exata; o retorno diz quais posições já estão certas |
| `associar` | liga cada item da esquerda ao par da direita (a direita chega embaralhada) | `e1=d2,e2=d1` | exata; o retorno diz quais pares estão certos |
| `verdadeiro_falso` | julga a afirmação e escolhe a justificativa | `falso:j2` | os dois precisam estar certos; acertar só o valor gera um aviso |
| `aberta` | explica com as próprias palavras (mínimo de caracteres) | o texto | com a IA, critério por critério, e os essenciais continuam obrigatórios (sem o essencial, o retorno diz “Falta o ponto principal desta resposta: …”), com o aviso da armadilha ou da grafia junto; no modo demonstração, confere as ideias-chave (grupos de palavras-chave sem acento, pelo começo da palavra, com um deslize de digitação em palavras de 5 letras ou mais) e desconsidera a ideia negada logo antes (“não continuo”), a menos que o termo já comece com a negação (“não para”). Critérios em `essenciais` (o ponto da lição, como “I'd like” e não “I like”) precisam aparecer para passar. Erros comuns (`armadilhas`, como “I want” num pedido) ganham um aviso próprio, e uma ideia achada só com um deslize de digitação (“coffe”) vale com o aviso da grafia; na lacuna, a armadilha vale para a resposta inteira errada (“chave”, o nome popular da tarraxa). Mostra os critérios e, no acerto ou na segunda tentativa, uma resposta modelo; “Tentar de novo” mantém o texto para a pessoa corrigir. |

O trecho de um exercício tem um tipo (`trechoTipo`): `codigo` (o único em fonte monoespaçada), `frase`, `citacao`, `formula` ou `passos`. Lições salvas antes dos tipos recebem um tipo inferido (código só quando parece código). As lacunas (`___`) aparecem como um espaço sublinhado.

## Revisão do dono (19/11): ordenar em lista única e cada formato em 3 segundos

Vale para web, Android e iPhone, com os mesmos textos, medidas e ordem. O ordenar por fichas (a ficha ia para “Sua ordem”, com vagas e “Recomeçar”) sai. A resposta enviada e a correção não mudam (`a,b,c`). Esboços: `ordenar-390.png` e `formatos-390.png`, na pasta de trabalho do Designer (`ux/02-ordenar-formatos`).

### Ordenar em lista única

**Como funciona.** Todos os itens ficam numa lista só, na ordem do servidor, que nunca é a resposta. A pessoa arrasta um item para outro lugar, ou toca em dois itens para trocar os dois de lugar. A ordem da lista é a resposta.

**Anatomia (390 px).**
- Logo abaixo do enunciado, a linha de como responder (ver abaixo): o ícone de arrastar e “Arraste para pôr em ordem ou toque em dois itens para trocar.”
- Lista numerada, com 8 px entre os cartões, na largura do quadro (na web larga, até 640 px).
- Cartão: altura mínima de 56 px, respiro de 10 px em cima e embaixo e 12 px à esquerda, raio de 16, borda de 2 px `#C9D1EA`, fundo branco e degrau de 4 px `#C9D1EA`, que some no toque como nos outros cartões. Da esquerda para a direita: o número da posição num círculo de 28 px (fundo `#EEF3FF`, número `#2A44A8`, Quicksand 700 de 15 px, sem “º”); o texto (Nunito 700, 16/22, `#1B2A5E`, até três linhas, sem cortar); a alça de arrastar (seis pontos de 20 px, `#8A94B3`) numa área de toque de 44 × 44 px.
- Sem o rótulo “Sua ordem”, sem a caixa tracejada e sem vagas.

**Estados do cartão.**

| Estado | Como fica |
| --- | --- |
| Normal | como na anatomia |
| Mouse em cima (web) | borda `#9FB1F0` e cursor de mão na alça |
| Foco pelo teclado | anel de 3 px `#3858D6`, afastado 3 px |
| Escolhido (primeiro toque) | sobe 2 px; borda `#3858D6`, fundo `#EEF3FF`, degrau de 6 px `#2A44A8` e o círculo do número cheio `#3858D6`, com o número branco |
| Arrastando | escala 1,03, com a sombra `0 12px 24px rgba(27, 42, 94, .18)`; os outros abrem espaço |
| Certo e travado (nova tentativa) | borda `#2F9E6F`, fundo `#EEFAF3`, círculo `#2F9E6F` e o visto no lugar da alça; não se move nem troca |
| Depois de verificar | certo em verde e errado em âmbar (borda `#E3A24A`, fundo `#FFF6EA`, círculo `#E3A24A` e um X no lugar da alça) |
| Enviando | igual; os toques são ignorados |

**Toques e gestos.**
- Tocar num cartão escolhe ele, e a linha de como responder vira “Agora toque em outro item para trocar os dois de lugar.” Tocar em outro troca os dois. Tocar de novo no escolhido, ou fora da lista, desfaz a escolha.
- Arrastar: no toque, segurar 180 ms e mover, para a rolagem da página continuar livre; com o mouse, 4 px de movimento já arrastam; pela alça, o arrasto começa na hora. Perto da borda de cima ou de baixo da tela (64 px), a página rola sozinha.
- Teclado (web): Tab chega a cada cartão. Enter ou Espaço escolhe; com um escolhido, as setas para cima e para baixo movem ele uma posição, e Enter ou Espaço noutro cartão troca os dois; Esc desfaz a escolha.
- Os travados ficam fora: arrastar passa por eles sem tirá-los do lugar, e tocar num travado só lê o estado.

**Movimento.**
- Escolher: 120 ms, com saída suave.
- Trocar: os dois cartões deslizam um para o lugar do outro em 240 ms, com uma mola curta (curva 0,2, 0,9, 0,3, 1,2); ao chegar, ganham um brilho `#EEF3FF` que some em 400 ms.
- Soltar o arrastado: 200 ms até o lugar, com a mesma mola; os outros andam em 180 ms.
- Movimento reduzido: nada sobe, escala ou desliza. A troca e o soltar são imediatos, e os dois cartões que mudaram ficam com o brilho por 600 ms (só cor).
- App: os mesmos tempos com `Animated` e o arrasto com `react-native-gesture-handler`, que já está instalado. Sem dependência nova e sem vibração (o app não tem `expo-haptics`).

**Textos finais.**
- Como responder: “Arraste para pôr em ordem ou toque em dois itens para trocar.”
- Com um escolhido: “Agora toque em outro item para trocar os dois de lugar.”
- Rodapé antes da primeira mudança: “Mude a ordem para verificar.”, com “Verificar” desligado. Depois da primeira mudança, “Verificar” liga e o rodapé fica sem texto.
- “Voltar à ordem inicial”, um link que aparece depois da primeira mudança. Na nova tentativa, ele volta à ordem com que a tentativa começou.
- Nome acessível do cartão: “2º de 4: Despachar a mala”. O escolhido tem o estado selecionado (`aria-pressed` na web e `accessibilityState.selected` no app).
- Avisos falados (`aria-live` educado; no app, `announceForAccessibility`): ““Despachar a mala” escolhido. Toque em outro item para trocar os dois de lugar.”, ““Despachar a mala” e “Pegar o cartão de embarque” trocaram de lugar.” e ““Despachar a mala” agora está na posição 3 de 4.”
- Ações de acessibilidade em cada cartão (VoiceOver e TalkBack; na web, as setas): “Mover para cima” e “Mover para baixo”.
- Travado: ““Mostrar o passaporte no balcão”, na posição 1: já está certo.” O retorno continua como hoje (“Confira a 2ª posição…” e “2 de 4 na posição certa.”).

**Nova tentativa.** Os itens certos ficam travados no lugar, em verde. Os outros continuam onde estavam, sem o âmbar, e só eles se mexem. A dica da tentativa anterior continua embaixo. “Verificar” liga depois da primeira mudança.

**O que a web e o app acompanham.** A resposta começa com a ordem do servidor, não vazia. No ordenar, `respostaCompleta` e `faltaParaVerificar` (em `packages/contratos/src/licao.ts`) comparam a resposta com a ordem inicial (`exercicio.itens`; na nova tentativa, a ordem com que ela começou), e o texto da falta vira “Mude a ordem para verificar.” A API e a correção não mudam. Saem os textos `suaOrdem`, `disponiveis`, `vazio`, `vaga`, `colocar` e `tirar`; `recomecar` vira “Voltar à ordem inicial”.

### Cada formato em 3 segundos

A pergunta é uma só: dá para entender o que fazer em 3 segundos? Do mais grave para o menos grave:

1. **Verdadeiro ou falso (grave).** São duas perguntas na tela ao mesmo tempo, Verdadeira ou Falsa e três porquês, com rótulos pequenos em caixa alta. A pessoa vê cinco caixas e não sabe por onde começar. Mudar: as duas partes viram perguntas numeradas de 16 px em 800 (“1. A frase é verdadeira ou falsa?” e “2. Por quê?”). Os porquês aparecem só depois da escolha, entrando de cima em 200 ms (com movimento reduzido, aparecem direto), e o foco vai para “2. Por quê?”. Trocar a escolha mantém o porquê marcado.
2. **Associar (grave no celular).** Em 390 px, duas colunas de 160 px apertam as definições, que chegam a quatro linhas, e os rótulos “Itens” e “Pares” não dizem nada. Mudar: abaixo de 560 px, os itens da esquerda viram uma fileira de fichas numeradas no alto (“1 Tarraxa”, “2 Pestana”) e os pares ficam embaixo, um por linha, na largura toda. Ligar dá ao par o número e a cor da ficha. A instrução vira dois passos, com o atual em azul: “1 Escolha um item” e “2 Toque no par dele”. “Itens” e “Pares” saem da tela e ficam só para o leitor de tela. A partir de 560 px, ficam as duas colunas.
3. **Como responder (média, em todos os formatos).** Hoje só o ordenar e o associar dizem como responder, cada um num lugar. Mudar: todo exercício tem uma linha logo abaixo do enunciado, com ícone de 20 px `#3858D6` e texto de 16 px em 700 `#5E6A85`. Escolha: “Toque na resposta certa.” Lacuna: “Escreva o que falta na frase.” Ordenar: como acima. Associar: os dois passos. Verdadeiro ou falso: “Diga se a frase é verdadeira ou falsa e por quê.” Aberta: “Explique com as suas palavras, em uma ou duas frases.”
4. **Lacuna (média).** O espaço da frase é um traço fino, diferente na web (barra cinza-azulada) e no app (traço azul-marinho), e o campo embaixo diz só “Sua resposta”: não fica claro que o que se escreve vai para a frase. Mudar: o espaço vira uma vaga com largura mínima de 72 px, altura de 1,4 em, borda tracejada de 2 px `#9FB1F0`, raio de 8 e fundo branco. Com o campo em foco, a borda fica cheia `#3858D6`. O que se escreve aparece na vaga, como hoje, e tocar na vaga põe o foco no campo. O rótulo do campo vira “Escreva o que falta”. Igual na web e no app.
5. **Resposta aberta (baixa).** “Faltam 40 letras” aparece antes de qualquer letra e soa como cobrança. Mudar: antes de escrever, “Pelo menos 40 letras”; escrevendo, “Faltam 12 letras”; passado o mínimo, “52 letras”, em verde e com o visto. O campo cresce com o texto, de 5 até 10 linhas.
6. **Múltipla escolha (passa).** As letras A, B e C e os cartões com degrau se explicam sozinhos. Só o rótulo “Sua resposta” sai da tela e fica para o leitor de tela.

**Quem decide.** Tudo nesta seção é decisão de design. O modelo de lista única é decisão do Lead. Nada precisa do dono.

## Recursos

- **Falas**: frases para ouvir e repetir, com idioma BCP 47, tradução e a pronúncia escrita do jeito que se lê em português (`pronuncia`, como “eks-KIÚZ mi”, nas trilhas prontas de inglês e nas lições de idioma da IA), com a legenda de como ler (a parte em maiúsculas é a mais forte); na escuta, a pronúncia aparece junto do texto. Os avisos aparecem um por vez (o da última ação), e o do microfone diz o que fazer: sem microfone, usar um fone com microfone ou o celular; com ele bloqueado, liberar no cadeado ao lado do endereço (ou nos ajustes do app). **Falar** confere a pronúncia: a pessoa fala a frase e o texto reconhecido é comparado palavra por palavra (`conferirFala`, em `packages/contratos/src/fala.ts`: números por extenso, contrações, uma letra trocada em palavras longas), com o que foi dito, quantas palavras saíram e o que conferir. Na web, o reconhecimento é o do navegador (funciona sem a IA); no app, a gravação vai para a rota de voz (precisa da IA ligada, e sem ela o app avisa). Sem resposta em 8 segundos (ou ao parar sem nada ouvido), avisa “Não deu para ouvir”. A web usa a voz do navegador e o app, a do aparelho (`expo-speech`). Um exercício pode ter uma fala sem trecho (escuta); o texto aparece quando a pessoa pede e, depois do acerto, com a tradução (antes, a tradução entregaria a resposta).
- **Acorde**: diagrama desenhado pelo app (SVG na web, Views no app), com o número de cada corda embaixo (com a palavra “corda”) e o de cada casa ao lado (com “casa”), os dois com ordinal (6ª, 1ª) para não se confundirem com o número do dedo, na bolinha; as cordas engrossam da 1ª à 6ª, como na ilustração, e os passos do passo a passo são quadrados (os dedos, bolinhas); e o som sintetizado na hora. Com `anterior` (nas trilhas prontas e nas lições de troca da IA), a troca aparece com os dois acordes lado a lado (Am → C) e um botão de ouvir para cada um, da mesma largura. Com `batida`, um guia mostra os oito tempos (1↓ e↑ 2↓ e↑…) e destaca o que soa; **Parar** interrompe o som (Karplus-Strong, `sintetizarAcorde` em `packages/contratos/src/som.ts`), o mesmo WAV nas duas plataformas. Com `batida`, um segundo botão toca o ritmo (`sintetizarBatida`: para baixo em cada tempo, com acento no primeiro, e para cima, mais leve, entre eles). Na web, o som sai de um `blob:`, liberado pela CSP (`media-src 'self' blob:`, em `src/proxy.ts`); se o aparelho não tocar, aparece um aviso no lugar do silêncio.
- **Linha do tempo**: marcos com data ou tempo, para história, processos e tempos de preparo.
- **Barra de fração**: um inteiro dividido em partes iguais (até 12), com algumas pintadas e um rótulo (como “2/4 = 1/2”).
- **Imagem**: a foto do material enviado, ou uma ilustração com `fonte` (a lição 1 do violão mostra as partes numeradas, desenhadas só com formas, em `src/servidor/ia/ilustracao-violao.ts`, com as cordas da mais grossa, no alto e cor de bronze, à mais fina; a legenda liga cada número à parte da explicação: “Cabeça: 1 tarraxa · Braço: 2 casa…”). O servidor guarda uma miniatura da foto e a lição mostra a página de onde veio a explicação. O material de demonstração (frações) tem uma ilustração gerada no servidor.
- **Prática**: tarefa, minutos do cronômetro (1 a 30), passos para conferir, uma dica e, se fizer sentido, um som de referência (`som`: o rótulo e as casas, como a 6ª corda solta para afinar; a IA também o escreve nas lições de violão).
- **Para consultar**: o acorde e a barra de fração também estão no exercício, recolhidos depois da resposta (**Ver o acorde Am**), para a pergunta ficar no alto (a linha do tempo, não: entregaria a ordem). A prática mostra o recurso, os passos e as frases da lição no fim, depois do **Como foi?**.
- **Ouvir**: enquanto a voz fala, o botão mostra **Tocando…**; se o aparelho não tem voz para a frase, aparece um aviso (e, na escuta, o texto).

## Conteúdo

- **IA da OpenAI**: a estrutura da trilha traz, para cada lição, um `resumo` (o que a pessoa vai saber fazer), que aparece na prévia. O esquema estrito da lição pede `exemploTipo`, `passos`, `outroJeito`, `recurso`, `falas` (com tradução e pronúncia), `pratica` (com o som de referência no violão) e 2 ou 3 `exercicios` nos seis formatos (ao menos um de produzir a resposta: lacuna, ordenar ou aberta; o normalizador ainda aceita um só), com os critérios da aberta marcados como essenciais ou não e as armadilhas da lacuna e da aberta. O recurso de acorde aceita o `anterior` da troca. Tudo o que as trilhas prontas têm escrito à mão, a IA também escreve. Numa lição de idioma, as frases entre aspas retas do conceito e do exemplo viram aspas curvas, que o app torna tocáveis; fora dos idiomas, as aspas ficam como vieram, porque podem ser código. O normalizador refaz ids, monta o gabarito de ordenar e associar a partir da ordem do modelo e descarta só o opcional que não fecha (uma pronúncia longa demais, um som com cinco cordas, um exercício extra fora do formato), mantendo o resto da lição; uma armadilha que aparece numa resposta certa (no gabarito ou na resposta modelo) sai, e o essencial só vale quando se destaca (no máximo dois, nunca todos). O formato antigo (um `exercicio`, critérios só com o texto) continua aceito.
- **Modo demonstração** (IA falsa): trilhas prontas, com pelo menos dois exercícios em cada lição (as de inglês têm três, com menos de 40% de “ouça e escolha” e quase metade de produzir a resposta, como “I'm ___ Brazil” e a ordem do check-in no aeroporto; toda escuta tem tradução, e um teste garante). Os números de inglês ficam no exemplo, com os algarismos na tradução, e a explicação fala só do que confunde (‑teen e ‑ty). Quase todas as lições de inglês têm prática com cronômetro (falar em voz alta a apresentação, o balcão do aeroporto, o check-in do hotel, os preços e a viagem inteira na revisão), e a revisão retoma a imigração e o hotel numa resposta aberta. O violão ensina as mãos, a postura e as cordas já na primeira lição, com a afinação como bônus (com um app afinador ou comparando com o Mi que o Studoo toca), sem pressão no primeiro dia; a trilha de inglês tem uma lição de aeroporto (check-in e embarque) e fecha com a revisão, depois do restaurante e conteúdo de verdade para violão, inglês para viagem (com frases para a imigração do aeroporto), culinária básica, história do Brasil, frações e fotografia com o celular (`src/servidor/ia/demos.ts`), além de SQL. Para quem aprende, a origem aparece como “Trilha pronta do Studoo sobre…” (`origemLegivel`), sem jargão técnico. Todas as ideias populares da tela inicial têm trilha pronta (um teste garante). Outros assuntos recebem a trilha genérica, que também usa os formatos novos.

## Quando a pessoa erra

O retorno de erro dá uma pista, sem entregar a resposta: nas trilhas prontas, um teste garante que a dica não repete a opção certa, não começa por “É falsa” e não cita todos os pares. O título é **Quase lá!** só quando parte da resposta está certa (itens na posição, pares, o valor ou o porquê, critérios); sem nada certo, **Não foi dessa vez**. No erro, a pessoa pode tentar de novo ou **Pular por agora**; quem pula termina com menos acertos no resumo e a sugestão de rever.

O exercício errado ganha um reforço pelo Stu, sempre do exercício que a pessoa errou (a avaliação guarda o índice do exercício junto com o erro): **Ver outro jeito de entender** pede o reforço e mostra o cartão (a tela rola até ele quando o reforço chega). Com a IA, a explicação e o exemplo são novos, e as alternativas da pergunta chegam numa ordem que varia com o enunciado (o modelo tende a pôr a certa em primeiro); se ela falhar ou não responder, vale o reforço local. No modo demonstração (e como reserva), o reforço começa citando o que a pessoa fez (“Você ligou ‘Tarraxa’ a ‘Espaço do braço…’. Vamos ver só esse par.”), traz a mesma ideia por outro caminho: cada lição das trilhas prontas tem um **outro jeito** escrito para isso (`outroJeito`, uma analogia ou uma regra prática, como “no ‑teen a força da voz vai no fim”), e as lições da IA também, escrito pela própria IA; ele fica guardado só no servidor; nas outras, o passo a passo ou as frases da lição, uma por linha, e por último o exemplo e uma pergunta mais simples sobre o mesmo ponto, com a explicação específica do erro (`src/dominio/aprendizado/reforco.ts`): só duas opções na escolha, a resposta certa contra a escrita na lacuna, só o valor no verdadeiro ou falso, qual item vem primeiro no ordenar, o par que ficou errado no associar e qual ideia a resposta aberta precisa trazer.

## Explique com suas palavras sem IA

Sem a IA, o retorno do **Explique com suas palavras** não confere se o texto está certo, mas é específico: as ideias-chave da lição saem das respostas dos exercícios (o que vai na lacuna, a opção certa curta, os itens de ligar, os critérios da resposta aberta; `termosDaLicao`), e o retorno diz quais a explicação trouxe, quais faltaram (com uma pergunta sobre a primeira que faltou) e se a pessoa deu um exemplo. A busca tolera um deslize de digitação, ignora o termo negado e entende “I am” como “I'm”; uma ideia contida em outra (“from”, em “I'm from Brazil”) não conta duas vezes. Conta como exemplo usar uma frase da lição (“excuse me where is the bank”), citar uma frase entre aspas numa lição de idioma ou o jeito falado (“tipo quando…”, “quando eu…”); sem exemplo, o próximo passo pede um, em vez de dizer que a explicação já cobre tudo. O retorno também reconhece as palavras da explicação do Stu que a pessoa usou (“cabeça, braço e corpo”, sem as do título), trata como complemento opcional o que falta quando a pessoa já trouxe a maior parte das ideias, aponta erros comuns do próprio texto (`armadilhas` da lição e das respostas abertas, como “I here” ou “I flying”, sem o verbo, e “for vacation”; as da lacuna ficam de fora, porque valem para a resposta inteira e num texto livre apareceriam em qualquer frase) e termina com um próximo passo de verdade. A nota de que o retorno é automático fica no pé, como legenda, e a tela rola até o retorno. Com a IA configurada, este retorno é a reserva quando ela não responde.

## Limites

- A voz depende do navegador ou do aparelho; sem voz, o texto continua disponível.
- O app passou a usar `expo-speech`: gere um novo development build antes de testar no Android.
- Sem chave da OpenAI, a resposta aberta tem só a correção de ideias-chave, identificada como simulada.
- A miniatura da foto vale para imagens enviadas; páginas de PDF não viram imagem.
