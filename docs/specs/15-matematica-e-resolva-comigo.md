# Matemática desenhada e "Resolva comigo"

**Estado:** proposta de UX de 21/11 (Designer), para o Lead juntar com as propostas do Web & API (dados e IA) e do Mobile 2 (app). Ainda não aprovada nem implementada. Vale para web, Android e iPhone. No app, entra num build novo (o build 4 ou depois). Esboço em 390 na pasta de trabalho do Designer (`ux/16-matematica/esboco.html` e `esboco-390.png`).

**Pedido do dono:** a folha de geometria analítica da namorada dele (baricentro, pontos colineares por determinante 3×3 e um triângulo) virou uma lição só de texto. Fórmula, matriz e desenho não apareciam, e "Ver a ilustração" e "Rever a explicação" ficavam fechados. Ele quer:
1. fórmulas e diagramas desenhados, de um jeito que sirva para muitos tipos de fórmula;
2. quando a IA achar necessário, um "Resolva comigo": um exercício de exemplo resolvido passo a passo, com a pessoa fazendo uma parte.

**Regras que já valem:**
- A IA nunca devolve desenho livre (SVG ou HTML). Ela devolve dados estruturados, e o Studoo desenha.
- Um visual inválido some, e a lição continua em texto.
- Todo visual tem texto para o leitor de tela.
- Web e app iguais na mesma largura, com as cores e o mascote do Studoo.
- Nada de janela nativa.

## 1. A fórmula

**O que é.** Uma árvore pequena e fechada de peças, que a IA preenche e o Studoo valida e desenha. O formato dos dados é decisão do Web & API. O desenho é o desta seção. Peças da primeira versão:
- número, variável, operador (+ − × ÷ = ≠ < > ≤ ≥ →) e parênteses;
- fração, potência, índice (x_A), raiz quadrada;
- matriz e determinante;
- o marcador de destaque, que envolve qualquer peça.

Tudo o que estiver fora dessa lista invalida a fórmula. Ela some, e o texto da lição continua.

**Recomendação para os devs (não é regra de tela):** o cálculo da posição de cada peça fica num lugar só (`packages/contratos`), e web e app desenham o resultado em SVG (`react-native-svg`, que o app já tem). Assim o desenho é o mesmo nas duas plataformas, sem biblioteca de matemática e sem WebView. Se o Web & API preferir uma biblioteca, ela tem de gerar o mesmo desenho nos dois lados.

**Tipografia:**
- Os números e os sinais usam a fonte do texto (Nunito 700). As variáveis vão em itálico.
- O índice (o "A" de x_A) e o expoente ficam retos, com 65% do tamanho, sem itálico. O índice desce 0,3 em; o expoente sobe 0,45 em.
- Os sinais têm 4 px de respiro de cada lado. O "×" é o sinal de vezes, nunca a letra x. O "−" é o sinal de menos, não o hífen.

**Em linha ou em bloco:**
- **Em linha**, dentro de uma frase, a fórmula tem o tamanho do texto ao redor (16 ou 17 px). Só cabem peças simples na linha: número, variável, índice, expoente e operador. Fração, raiz, matriz e determinante sempre vão em bloco.
- **Em bloco**, a fórmula fica numa linha própria, centralizada, com 22 px, num fundo `#F1F4FD`, com raio 14 e respiro de 10 × 12.
  - Se ela não couber na largura, primeiro diminui até 85% (no mínimo 18 px). Se ainda não couber, rola para o lado dentro do bloco, com uma sombra de 12 px na borda que tem mais.
  - Ela nunca quebra no meio de uma fração.

**As peças:**
- **Fração:** a barra tem 2 px, na cor do texto, e passa 4 px de cada lado do termo maior. Numerador e denominador ficam centralizados, com 85% do tamanho e 4 px de distância da barra. Uma fração dentro de outra fica com 85% de novo, no mínimo 14 px.
- **Raiz:** o sinal é desenhado (√) com 2 px de traço, e a barra de cima cobre todo o radicando.
- **Matriz:** colchetes desenhados com 2 px, da altura das linhas mais 4 px. As células ficam centralizadas, com 16 px entre colunas e 8 px entre linhas. Até 4 × 4.
- **Determinante:** a mesma grade, com barras verticais de 2 px no lugar dos colchetes. Para o método de Sarrus, o Studoo pode repetir as duas primeiras colunas à direita, mais claras (`#5E6A85`), e traçar as diagonais:
  - as que somam, em `#2563FF`;
  - as que subtraem, em `#C98A1A`;
  - uma diagonal por vez, só no "Resolva comigo" (seção 4).

**Destaque, com três papéis e nunca mais de dois numa fórmula:**
- **Foco**, o que mudou neste passo ou o que a pessoa precisa olhar: texto `#2563FF` sobre `#EAF0FF`, raio 6.
- **Procurado**, a incógnita (x_C, k): texto `#9A5B00` sobre `#FFF6EA`.
- **Resposta**, quando o valor é achado: texto `#1F7A5A` sobre `#E8F6EF`.
- O vermelho fica só no retorno de erro, nunca dentro da fórmula.

**Leitor de tela:** a fórmula tem um texto falado que o Studoo gera a partir da árvore, não a IA. Por exemplo: "x índice C é igual a 3 vezes 4, menos 3, menos 5". Uma fração é lida assim: "fração: numerador 1 mais menos 2 mais x C, denominador 3". Na web, o bloco é `role="math"` com esse texto em `aria-label`; no app, `accessibilityLabel`. Em linha, a frase inteira é lida com a fórmula falada no meio.

## 2. O diagrama

**Princípio:** a IA escolhe o visual mais simples que responde à pergunta. O exercício da namorada só fala de abscissas, então o visual certo é a reta numérica, não o plano inteiro (esboço, quadro 1).

### 2.1 Plano cartesiano (o primeiro caso)

**Dados que a IA preenche** (o formato é do Web & API):
- intervalo de x e de y;
- até 8 pontos, com nome de até 3 caracteres, coordenadas e papel (dado, especial, procurado ou resposta);
- segmentos entre pontos;
- até 2 polígonos;
- linhas-guia de um ponto até um eixo;
- a descrição para o leitor de tela.

Uma coordenada fora do intervalo, um nome repetido ou mais peças que o limite invalidam o visual.

**Desenho:**
- **Área:** a largura do conteúdo (358 px em 390; até 480 px no computador), com altura que segue a proporção do intervalo, entre 200 e 320 px. A unidade é a mesma em x e em y, para o triângulo não sair torto. Se a proporção passar disso, o intervalo do eixo menor cresce até caber.
- **Eixos:** 2 px `#0B1B5C`, com seta na ponta, e os nomes "x" e "y" em itálico, 13 px.
- **Grade:** 1 px `#E1E7FA` a cada unidade, ou a cada 2, 5 ou 10 quando passam de 12 marcas no eixo.
- **Números:** 12/16 `#5E6A85` nos marcadores da grade, com o "0" na origem. Eles ficam fora dos pontos e dos rótulos.
- **Pontos, por papel:**
  - dado: círculo de raio 6, cheio `#2563FF`, com anel branco de 2 px;
  - especial (baricentro, ponto médio, vértice da parábola): losango de 12 px `#7C5CFF`, com anel branco;
  - procurado: círculo de raio 8, fundo `#FFF6EA`, contorno tracejado de 2 px `#C98A1A`, com "?" no rótulo;
  - resposta: o procurado vira círculo cheio `#1F7A5A`, com o valor no rótulo.
- **Rótulos:** nome e coordenadas ("A (1, 2)"), 13/16 800 `#0B1B5C`, com a cor do papel no especial e no procurado. O Studoo escolhe o lado (direita, esquerda, acima ou abaixo) que não cobre outro ponto, rótulo ou eixo.
- **Segmentos:** 3 px `#2563FF`. Um segmento que ainda depende do procurado fica tracejado (6 e 5), com 60% de opacidade.
- **Polígono:** contorno pelos segmentos e preenchimento `rgba(37, 99, 255, 0.07)`.
- **Linhas-guia:** tracejadas de 2 px `#5E6A85`, do ponto até o eixo, com o valor do eixo em foco. É assim que o plano mostra "a abscissa de C".
- **Legenda:** só aparece quando há pontos de mais de um papel. Fica à direita do plano no computador e embaixo dele em 390, com o símbolo e a palavra (dados, baricentro, procurado).

### 2.2 Os outros visuais, por ordem de valor

1. **Reta numérica:** pontos e intervalos (aberto e fechado), com os mesmos papéis e cores do plano. Cobre média e abscissas, desigualdades, intervalos, distância e números inteiros. É o mais barato depois do plano.
2. **Gráfico de função no plano:** reta (y = ax + b) e parábola (y = ax² + bx + c), desenhadas pelo Studoo a partir dos coeficientes, com raízes, vértice e interseções como pontos especiais. É o mesmo plano da seção 2.1 com uma curva de 3 px.
3. **Figura geométrica com medidas:** triângulo, quadrilátero e círculo fora do plano, com os lados medidos, as marcas de lados iguais, o ângulo reto e a altura tracejada. Cobre área, perímetro, Pitágoras e semelhança.
4. **Ângulos e círculo trigonométrico:** ângulo com arco e valor; o círculo com seno e cosseno projetados nos eixos.
5. **Gráfico de barras ou de pontos:** para estatística (média, moda e mediana), com a linha da média tracejada.
6. **Tabela de valores** (x e f(x)), com uma coluna em foco. Ela já fica perto da matriz da seção 1.

O acorde, a linha do tempo e a barra de fração continuam como estão.

## 3. Onde o visual fica

**Confirmo a recomendação do Lead: o visual aparece aberto, dentro do conteúdo, e não atrás de "Ver a ilustração".**
- **Conceito e exemplo:** o visual fica logo depois da frase que fala dele, aberto, na largura do conteúdo. A fórmula em bloco vem antes do diagrama quando os dois aparecem juntos.
- **Exercício:** a ordem é o enunciado, o visual e as opções.
  - Em 390, o visual tem altura máxima de 200 px no exercício.
  - Com visual, o enunciado desce de 28 para 22 px, para as opções começarem na primeira tela.
  - Tocar no visual não abre janela nem amplia.
- **"Ver a ilustração"** continua recolhível, só para a foto do material da pessoa, que é apoio. **"Rever a explicação"** continua recolhível como hoje.
- **No computador (1440):** a mesma ordem, na coluna da aula (até 680 px), com o visual até 480 px, centralizado. Não há duas colunas, para manter a paridade com 390.
- **Visual inválido:** o lugar dele some, sem espaço vazio nem aviso, e a lição segue em texto.

## 4. "Resolva comigo"

**O que é:** um exemplo resolvido junto com a pessoa, com outros números, antes do exercício. É a forma da etapa "Exemplo" da lição quando o assunto é um procedimento com passos (contas, equações, fórmulas). Não é uma etapa nova: a lição continua com conceito, exemplo, exercícios e prática, e o contador de etapas não muda.

**Quando aparece:**
- **Na lição:** a IA decide, ao gerar a lição, se o exemplo é um "Resolva comigo". Isso acontece quando acertar o exercício depende de seguir passos, e não de lembrar uma ideia.
- **Depois de um erro:** não entra botão novo. O caminho continua sendo "Ver outro jeito de entender" (spec 05, "Ponte clara"). Quando a lição é de procedimento, o passo 2 da ponte, "Um exemplo", vira um "Resolva comigo" curto, de 3 passos, com números novos.
- **"Explique com suas palavras" (Ensine ao Stu)** não muda e continua opcional, depois do exercício.
- Cada um tem a sua hora, para não virarem três jeitos de dizer a mesma coisa:
  - "Resolva comigo" ensina o método, antes de tentar;
  - a ponte recupera depois de errar;
  - "Explique com suas palavras" firma o que foi aprendido, no fim.

**A tela, de cima para baixo (esboço, quadros 2 e 3):**
1. O selo "RESOLVA COMIGO" (`resolvaComigo.selo`, ícone de lápis), no estilo do "CONCEITO".
2. O problema de exemplo, em 17/23 800, e o visual dele (seção 2), aberto, com o procurado marcado.
3. O indicador "Passo n de N", com N traços de 6 px. Os feitos e o atual ficam em `#2563FF`, e o atual é mais largo (34 px).
4. Os passos feitos, cada um numa linha compacta: o visto verde, o nome curto do passo e a fórmula daquele passo em linha, reduzida. Tocar numa linha a reabre no lugar.
5. O passo atual, num cartão:
   - o Stu (`stu-concentrado`, 40 px) e uma frase do que se faz agora, em 16/22 700;
   - a fórmula em bloco, com o que mudou em foco;
   - quando o passo mexe no desenho, a mudança aparece no visual de cima (um ponto, uma linha-guia, o procurado virando resposta).
6. "Voltar um passo", botão de texto de 44 px, a partir do passo 2.
7. O rodapé preso: "Próximo passo" (`resolvaComigo.proximo`). No último passo, "Agora é com você" (`resolvaComigo.agora`), que vai ao exercício.

**Passos:** de 3 a 5 na lição; 3 dentro da ponte. A IA entrega para cada passo:
- o nome curto;
- a frase;
- a fórmula;
- a mudança no visual, se houver.

O último passo mostra a resposta no papel "resposta", na fórmula e no desenho.

**"Sua vez", um passo por exemplo:**
- é o penúltimo ou o último passo, a conta que repete o método;
- o selo "SUA VEZ" (`resolvaComigo.suaVez`), em âmbar, a pergunta e 3 opções, cada uma uma fórmula em linha ou um número;
- o rodapé fica com "Verificar" desligado até a escolha;
- **certo:** som `acerto`, a opção fica verde e aparece um cartão verde "Isso!" com a frase do porquê e a fórmula seguinte. O rodapé volta a "Próximo passo";
- **errado:** som `erro`, a opção fica vermelha e aparece a frase do porquê daquela opção (a IA entrega uma por opção errada). O rodapé passa a "Tentar de novo". Na segunda escolha errada, o Studoo mostra a certa, com o porquê, e segue. Nunca trava a pessoa;
- digitar a resposta fica para depois (seção 5).

**Fim do exemplo:**
- o cartão "O método" (`resolvaComigo.metodo`) lista os passos em uma linha cada, com a fórmula geral em bloco (por exemplo, x_G = (x_A + x_B + x_C) ÷ 3);
- o Stu fica com `stu-animado`;
- o rodapé mostra "Agora é com você";
- no exercício, "Rever a explicação" passa a abrir também "O método".

**Movimento:**
- o passo novo entra subindo 8 px em 200 ms;
- o foco da fórmula acende em 240 ms;
- um ponto novo no desenho cresce de 0 a 100% em 200 ms;
- com movimento reduzido, tudo troca na hora.

**Som:** sem som novo. `toque_opcao` na escolha, `acerto` e `erro` no "Verificar".

**Leitor de tela:**
- a cada passo, o foco vai para a frase do passo, e a região educada anuncia "Passo 2 de 4";
- a fórmula é lida pelo texto falado da seção 1, e o visual pela descrição dele;
- no "Sua vez", as opções são um grupo de escolha com a pergunta como nome.

**Textos novos** (contrato, `resolvaComigo`): `selo` "Resolva comigo"; `passo(n, total)` "Passo n de N"; `proximo` "Próximo passo"; `voltar` "Voltar um passo"; `suaVez` "Sua vez"; `isso` "Isso!"; `tentarDeNovo` "Tentar de novo"; `metodo` "O método"; `agora` "Agora é com você". A frase de cada passo vem da IA.

## 5. O menor pedaço que resolve o caso da namorada

**Primeiro pedaço (build 4):**
1. Fórmula com número, variável, índice, operadores, parênteses, fração e os três destaques, em linha e em bloco, com o texto falado.
2. Reta numérica e plano cartesiano com pontos, papéis, segmentos, triângulo e linhas-guia.
3. Visual aberto no exemplo e no exercício. "Ver a ilustração" fica só para a foto.
4. "Resolva comigo" na etapa Exemplo, de 3 a 5 passos, com um "Sua vez" de escolha.

Isso cobre o item c da folha (o terceiro vértice pelo baricentro) e o exercício da captura.

**Segundo pedaço:**
- matriz, determinante e as diagonais de Sarrus, que cobrem o item d da folha (k para pontos colineares);
- o "Resolva comigo" dentro da ponte.

**Depois:** gráfico de função, figura com medidas, ângulos, barras, tabela, digitar a resposta e raiz.

## 6. Roteiro de aceite (primeiro pedaço)

Web em 390 e 1440 e app em 390. Use a folha da namorada (ou uma igual, com dados sintéticos) e a lição da captura.

| # | Passos | Esperado |
|---|---|---|
| X1 | Abre o conceito do baricentro | A fórmula x_G = (x_A + x_B + x_C) ÷ 3 em bloco, com fração desenhada e índices; o leitor de tela lê o texto falado |
| X2 | Abre o exemplo | "Resolva comigo": o problema, o plano com A, B, G e C procurado, "Passo 1 de 4" |
| X3 | Avança os passos | A fórmula de cada passo tem o que mudou em foco, e os feitos ficam compactos em cima |
| X4 | "Sua vez", escolhe errado | Som de erro, o porquê da opção, "Tentar de novo"; na segunda errada, mostra a certa e segue |
| X5 | "Sua vez", escolhe certo | Som de acerto, "Isso!" e a fórmula seguinte |
| X6 | Último passo | C vira resposta no desenho (verde, com o valor) e x_C = 4 em verde na fórmula; "O método"; "Agora é com você" |
| X7 | Exercício da captura | O enunciado, a reta numérica com A em 3, B em 5, G em 4 e C procurado, aberta, e as opções na primeira tela |
| X8 | Visual com dado inválido (teste) | Ele some, e a lição segue em texto, sem espaço vazio |
| X9 | Fórmula larga em 390 | Diminui até 85% e depois rola para o lado; nunca corta nem quebra a fração |
| X10 | Movimento reduzido e leitor de tela | Sem animação; anúncios e textos falados da seção 4 |
