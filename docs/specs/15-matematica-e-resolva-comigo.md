# Matemática desenhada e "Resolva comigo"

**Estado:** proposta de UX de 21/11 (Designer), ajustada no mesmo dia à decisão do Lead: um motor de desenho único em `packages/contratos`, campos aditivos na lição (`visuais`, `visual`, `alt` e `resolucao`) e três fases (seção 0). Ainda não implementada. Vale para web, Android e iPhone. No app, entra num build novo (o build 4 ou depois). Esboço em 390 na pasta de trabalho do Designer (`ux/16-matematica/esboco.html` e `esboco-390.png`).

**Pedido do dono:** a folha de geometria analítica da namorada dele (baricentro, pontos colineares por determinante 3×3 e um triângulo) virou uma lição só de texto. Fórmula, matriz e desenho não apareciam, e "Ver a ilustração" e "Rever a explicação" ficavam fechados. Ele quer:
1. fórmulas e diagramas desenhados, de um jeito que sirva para muitos tipos de fórmula;
2. quando a IA achar necessário, um "Resolva comigo": um exercício de exemplo resolvido passo a passo, com a pessoa fazendo uma parte.

**Regras que já valem:**
- A IA nunca devolve desenho livre (SVG ou HTML). Ela devolve dados estruturados, e o Studoo desenha.
- Um visual inválido some, e a lição continua em texto.
- Todo visual tem texto para o leitor de tela.
- Web e app iguais na mesma largura, com as cores e o mascote do Studoo.
- Nada de janela nativa.

## 0. Fases: o que o dono vê em cada uma

| Fase | O que muda | Onde | O que a pessoa vê |
|---|---|---|---|
| 1. Só servidor | O servidor desenha os visuais e manda um PNG no lugar do recurso (seção 7) | Build 3 e o site atual, sem app novo | O texto da lição como hoje, com a fórmula em texto linear (x_G = (x_A + x_B + x_C) / 3). "Ver a ilustração" abre o desenho do Studoo: a figura e a fórmula principal, com a legenda "Desenho do Studoo · …". O exemplo de procedimento sai em passos de texto, sem "Sua vez" |
| 2. Site e build 4 | Web e app desenham os visuais no próprio aparelho | Site e build 4 | As seções 1 a 4: fórmula desenhada em linha e em bloco, visual aberto no conceito, no exemplo e no exercício, e "Resolva comigo" com o "Sua vez". "Ver a ilustração" volta a ser só a foto do material |
| 3. Ponte e mais visuais | O "Resolva comigo" curto na ponte e os outros visuais da seção 2.2 | Site e build seguinte | Depois de um erro numa lição de procedimento, o passo 2 da ponte é um "Resolva comigo" de 3 passos. Entram gráfico de função, figura com medidas, ângulos, barras e tabela |

A reta numérica entra já na fase 1, porque o exercício da captura do dono precisa dela.

## 1. A fórmula

**O que é.** A IA escreve a fórmula num LaTeX restrito, e o Studoo a lê com um parser próprio, que gera uma árvore fechada. O Studoo valida e desenha essa árvore (decisão do Lead, proposta do Web & API). O desenho é o desta seção. Peças da primeira versão:
- número, variável, operador (+ − × ÷ = ≠ < > ≤ ≥ →) e parênteses;
- fração, potência, índice (x_A), raiz quadrada;
- matriz e determinante;
- os três destaques, que envolvem qualquer peça: no LaTeX restrito, `\foco{…}`, `\procurado{…}` e `\resposta{…}`, no máximo dois por fórmula. Fora deles, a fórmula não tem cor.

Tudo o que estiver fora dessa lista invalida a fórmula, que vira o texto linear, e a lição continua.

**Motor (decidido):** o cálculo da posição de cada peça fica num lugar só (`packages/contratos`), e o resultado é desenhado em SVG na web, em `react-native-svg` no app e em PNG no servidor (fase 1). O desenho sai igual nos três.

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

**Ajustes da revisão do contrato (244d5fd, 21/11):**
- **Coordenadas com decimal:** a vírgula é o decimal na tela, então o separador do par vira ponto e vírgula sempre que uma coordenada do ponto tem casa decimal: "A (1,5; 2)". Com inteiros, continua "A (1, 2)". Vale para o rótulo, para o separador dentro da fórmula ("C = (4, 0)") e para o texto falado.
- **Texto falado:**
  - "→" lê "então", e não "seta para";
  - fração de dois termos simples lê "1 sobre 3";
  - as outras frações leem "fração: numerador …, denominador …" e, quando vem mais coisa depois da fração, "fim da fração", como a raiz faz. Sem isso, "denominador b mais c" fica ambíguo.
- **Letras gregas:** Δ e π entram já na fase 1, porque o Δ = b² − 4ac (Bhaskara) e o π do círculo são os mais comuns da escola. Os glifos vêm da Noto Sans Bold (licença OFL), desenhados como contorno na mesma tabela de glifos da Nunito. α, β, θ, λ, μ e σ ficam para a fase 2. O "Δ" de triângulo na frase continua sendo texto.

## 2. O diagrama

**Princípio:** a IA escolhe o visual mais simples que responde à pergunta. O exercício da namorada só fala de abscissas, então o visual certo é a reta numérica, não o plano inteiro (esboço, quadro 1).

### 2.1 Plano cartesiano (o primeiro caso)

**Dados que a IA preenche** (o formato é do Web & API):
- intervalo de x e de y;
- até 12 pontos, cada um com um nome curto (`id`, até 3 caracteres), as coordenadas e o papel: dado, especial, procurado ou resposta. Um ponto derivado (baricentro, ponto médio) é especial e tem a conta feita pelo servidor;
- no máximo 8 pontos com rótulo na mesma figura, para caber em 390. Os outros aparecem sem rótulo;
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
- **Rótulos:** o Studoo monta o rótulo a partir do `id` e das coordenadas ("A (1, 2)", com espaço depois do nome e da vírgula e o sinal de menos verdadeiro), e não usa texto livre da IA. Ficam em 13/16 800 `#0B1B5C`. O especial usa `#5B3FD9` e o procurado `#9A5B00`: o roxo `#7C5CFF` só preenche o losango, porque como texto ele não passa de 4,5:1 sobre branco. O Studoo escolhe o lado (direita, esquerda, acima ou abaixo) que não cobre outro ponto, rótulo ou eixo.
- **A resposta nunca aparece antes da hora.** No visual de um exercício (`visual` do enunciado) e no PNG da fase 1, o ponto procurado não é desenhado na posição dele, nem com as coordenadas: ele fica só na legenda, como "C = ?". O mesmo vale na reta numérica. A posição e o valor do procurado só aparecem como resposta, no último passo do "Resolva comigo" ou no retorno do exercício.
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

**Na fase 2, o visual aparece aberto, dentro do conteúdo, e não atrás de "Ver a ilustração" (na fase 1, ele fica atrás dele; seção 7).**
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
- o nome curto (até 24 caracteres), que aparece na linha compacta do passo feito;
- a frase;
- a fórmula;
- a mudança no visual, se houver. Ela pode vir como o visual inteiro do passo, desde que mantenha os eixos e o intervalo do passo anterior. Assim, o desenho troca no mesmo lugar, sem pular de escala.

O último passo mostra a resposta no papel "resposta", na fórmula e no desenho.

**"Sua vez", exatamente um passo por exemplo** (no modelo do Web & API, `tentativa`, com no máximo uma por resolução):
- é o penúltimo ou o último passo, a conta que repete o método;
- o selo "SUA VEZ" (`resolvaComigo.suaVez`), em âmbar, a pergunta e 3 opções, cada uma uma fórmula em linha ou um número;
- o rodapé fica com "Verificar" desligado até a escolha;
- **certo:** som `acerto`, a opção fica verde e aparece um cartão verde "Isso!" com a frase do porquê e a fórmula seguinte. O rodapé volta a "Próximo passo";
- **errado:** som `erro`, a opção fica vermelha e aparece a frase do porquê daquela opção (a IA entrega uma por opção errada). O rodapé passa a "Tentar de novo". Na segunda escolha errada, o Studoo mostra a certa, com o porquê, e segue. Nunca trava a pessoa;
- digitar a resposta fica para depois (fase 3 ou seguinte). Por isso, a `tentativa` não tem `esperada` nem `dica`: ela tem `pergunta` e 3 `opcoes`, cada uma com `texto` ou `formula`, `correta` e `porque`;
- o "Sua vez" não conta no progresso nem no comprovante da lição.
- **No passo do "Sua vez", nada entrega a resposta antes da escolha:** a fórmula do passo, o `\resposta{…}` e o ponto revelado no desenho só aparecem depois do acerto ou da segunda escolha errada. Até lá, o cartão mostra a frase e a pergunta, e a fórmula do passo anterior fica como contexto.

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

É a fase 1 da seção 0, só no servidor, e já chega ao build 3:
- a fórmula da seção 1, com fração e índice;
- o plano e a reta numérica da seção 2;
- o PNG da seção 7, em "Ver a ilustração";
- o exemplo em passos de texto.

Isso cobre o item c da folha (o terceiro vértice pelo baricentro) e o exercício da captura. Matriz, determinante e Sarrus (o item d, pontos colineares) entram no motor da fase 1, mas o "Sua vez" e o visual aberto só chegam na fase 2.

## 6. Roteiro de aceite (fase 2)

Web em 390 e 1440 e app em 390. Use a folha da namorada (ou uma igual, com dados sintéticos) e a lição da captura.

| # | Passos | Esperado |
|---|---|---|
| X1 | Abre o conceito do baricentro | A fórmula x_G = (x_A + x_B + x_C) ÷ 3 em bloco, com fração desenhada e índices; o leitor de tela lê o texto falado |
| X2 | Abre o exemplo | "Resolva comigo": o problema, o plano com A, B, G e C procurado, "Passo 1 de 4" |
| X3 | Avança os passos | A fórmula de cada passo tem o que mudou em foco, e os feitos ficam compactos em cima |
| X4 | "Sua vez", escolhe errado | Som de erro, o porquê da opção, "Tentar de novo"; na segunda errada, mostra a certa e segue |
| X5 | "Sua vez", escolhe certo | Som de acerto, "Isso!" e a fórmula seguinte |
| X6 | Último passo | C vira resposta no desenho (verde, com o valor) e x_C = 4 em verde na fórmula; "O método"; "Agora é com você" |
| X7 | Exercício da captura | O enunciado, a reta numérica aberta com A em 3, B em 5, G em 4 e "C = ?" só na legenda, e as opções na primeira tela |
| X8 | Visual com dado inválido (teste) | Ele some, e a lição segue em texto, sem espaço vazio |
| X9 | Fórmula larga em 390 | Diminui até 85% e depois rola para o lado; nunca corta nem quebra a fração |
| X10 | Movimento reduzido e leitor de tela | Sem animação; anúncios e textos falados da seção 4 |

## 7. Fase 1: o desenho como imagem

Na fase 1, o build 3 e o site atual recebem os visuais da lição como **uma imagem PNG** gerada no servidor, no lugar do `recurso`. Ela aparece no "Ver a ilustração" que já existe, recolhido. Só a fase 2 abre o visual no lugar (seção 3).

**Como o build 3 mostra a imagem** (`apps/mobile/src/aula-formatos.tsx`, `ImagemDoMaterial`, em `6c8b1d2`):
- a caixa tem a largura do conteúdo, borda de 2 px `#E1E7FA`, raio 16 e fundo branco;
- ela começa em 16:10, mas assume a proporção da própria imagem (`Image.getSize`), mostra a imagem inteira (`contain`) e tem altura máxima de 360 px;
- a legenda é `fonte · descricao`, e o leitor de tela lê `fonte: descricao`. Sem `fonte`, aparece "Do seu material".

**O PNG:**
- **Uma imagem por lição**, porque o build 3 tem um recurso só:
  - ela leva no máximo uma figura (plano ou reta numérica) e até duas fórmulas;
  - a lição pode ter até 3 visuais; para o PNG, o servidor escolhe a primeira figura e a primeira fórmula de `visuais`;
  - o que não couber fica no texto da lição, com a fórmula em texto linear.
- **Modo enunciado:** como a mesma imagem aparece no exemplo e nos exercícios, ela nunca mostra resposta. O procurado fica só como "C = ?" (seção 2.1), e a fórmula é a geral (x_G = (x_A + x_B + x_C) ÷ 3), nunca a resolvida.
- **Prancheta de 320 pontos de largura**, a largura do conteúdo em 360 e 390, exportada em 4× (1280 px de largura). Assim ela fica nítida até uns 640 px de largura em tela de densidade 2. O arquivo fica bem abaixo do limite de 700.000 caracteres do recurso.
- **Proporção, entre 16:5 e 1:1,1:**
  - só a fórmula: 320 × altura do conteúdo (mínimo 100);
  - só a reta numérica: 320 × 140;
  - só o plano: a proporção do intervalo, entre 16:10 e 1:1;
  - fórmula com figura: a fórmula numa faixa de cima e a figura embaixo, com no máximo 1:1,1 (320 × 352), para caber nos 360 px sem encolher.
- **Tamanhos mínimos**, na prancheta de 320, que na tela de 390 dão quase o mesmo em pixels:
  - fórmula 20 (termos da fração 17, índice 13);
  - rótulos dos pontos 13 em 800;
  - números da grade e nomes dos eixos 11;
  - legenda interna ("C = ?") 13.
  Nada menor que 11. Os traços são os da seção 2.1 (eixos 2, segmentos 3, grade 1).
- **Fundo e contraste:**
  - fundo branco liso, sem borda, sem raio e sem sombra, porque a caixa do app já tem os dela;
  - margem interna de 16 pontos;
  - as cores das seções 1 e 2, com texto a pelo menos 4,5:1 sobre o branco (`#0B1B5C`, `#5E6A85`, `#2563FF`, `#9A5B00`, `#1F7A5A`, `#5B3FD9`); a grade e os preenchimentos são decorativos;
  - não entra o fundo `#F1F4FD` do bloco de fórmula da seção 1: na imagem, a faixa da fórmula fica separada da figura por uma linha de 1 ponto `#E1E7FA`.
- **Legenda e texto alternativo:**
  - `fonte` = "Desenho do Studoo" (texto novo, `recursos.desenhoDoStudoo`), nunca "Do seu material", que seria falso para um desenho gerado;
  - `descricao` = o `alt` curto do visual, até 140 caracteres, que vira a legenda visível e o texto do leitor de tela. Por exemplo: "Triângulo ABC no plano, com A (1, 2), B (−2, 7) e o baricentro G (1, 3); C é o vértice procurado."
  - Com duas peças, a descrição junta as duas: "Fórmula do baricentro e o triângulo ABC…".
- **A foto do material:** numa lição com desenho do Studoo, o PNG ocupa o recurso no lugar da foto, só na fase 1. A foto volta ao "Ver a ilustração" na fase 2.
- **Falha:** se o desenho falhar, o recurso fica como estava gravado, e a lição segue (a regra do Web & API).

**Aceite da fase 1** (build 3 no iPhone e site atual, em 390):

| # | Passos | Esperado |
|---|---|---|
| F1 | Lição do baricentro, "Ver a ilustração" | A fórmula geral em cima e o triângulo embaixo, com A, B e G rotulados e "C = ?" sem posição; a legenda "Desenho do Studoo · …" |
| F2 | Exercício da captura, "Ver a ilustração" | A reta numérica com A em 3, B em 5, G em 4 e "C = ?" fora da reta; nenhuma resposta à vista |
| F3 | Ampliar a captura | Texto legível (o rótulo menor com uns 11 px na tela), sem serrilhado |
| F4 | Leitor de tela na imagem | "Desenho do Studoo: <descrição>" |
| F5 | Lição sem visual, ou com visual inválido | O recurso de antes (foto ou nada), sem caixa vazia |

## 8. Parecer do motor (a130fe0, 21/11)

Conferido nas imagens do motor em 4× (baricentro, colinearidade, reta das abscissas e galeria de fórmulas). Elas são de dados sintéticos e não são telas.

**Está bom e fica:**
- a faixa da fórmula em cima com a figura embaixo, em 320 × 352, separadas pela linha `#E1E7FA`;
- o procurado só na legenda ("C = ?"), sem segmento nem polígono que aponte para ele;
- fração, fração dentro de fração, raiz com barra, parênteses altos, matriz com colchetes, determinante com barras;
- Δ e π;
- o ";" no par com decimal, "área" e "base" retos e os destaques de foco e resposta.

**Muda, por ordem de importância:**
1. **Número de eixo nunca some.** Hoje, quando um rótulo de ponto chega perto, o motor apaga o número do eixo: no baricentro faltam o 4 e o 8 do eixo y, e na colinearidade faltam o −6, o −4, o −2 e o 0 do eixo x. Os números dos eixos têm lugar fixo e prioridade. Quem se move é o rótulo do ponto, que tenta os outros lados (direita, esquerda, acima, abaixo, depois as diagonais). Só se nenhum lado couber o rótulo do ponto vira só o nome ("A").
2. **Grade de 1 em 1.** As linhas da grade ficam a cada unidade até 20 unidades no eixo, para a pessoa ler A (1, 2) contando quadradinhos. Acima de 12 unidades, só os números passam a aparecer de 2 em 2. Hoje a grade também pula de 2 em 2, e A (1, 2) fica entre linhas.
3. **Respiro dos sinais:**
   - relações (=, ≠, ≤, ≥, <, >, →) com 5 unidades de cada lado: hoje "a≤b≠c→d≥e" fica colado;
   - "+", "−", "×" e "÷" com 4;
   - 6 entre colchete ou barra que fecha e o sinal seguinte ("|…| = 0" e "] × [");
   - dentro do expoente e do índice, metade do respiro ("n+1", não "n + 1").
4. **Fim da reta e dos eixos:** a seta começa uma unidade depois da última marca. Hoje o "8" da reta numérica fica embaixo da ponta da seta.
5. **π:** o glifo da Noto Sans Bold está mais pesado e mais largo que a Nunito ao lado. Use o peso SemiBold, ou reduza a 92% na tabela, e o mesmo para o Δ, se ficar desigual.

**Cores finais** (decididas aqui; os testes passam a travar estes valores, sem exceção):

| Papel | Uso | Valor | Contraste |
|---|---|---|---|
| `focoTexto` | texto em foco na fórmula | `#1D4ED8` sobre `#EAF0FF` | 5,87:1 |
| `foco` | traço ou marca em foco (guia, eixo em foco) | `#2563FF` | gráfico, 4,9:1 sobre branco |
| `procurado` | anel tracejado e símbolo da legenda | `#B9780F` | gráfico, 3,65:1 sobre branco |
| `procuradoTexto` | "C = ?" e o `\procurado{…}` | `#9A5B00` | texto, acima de 4,5:1 sobre branco e sobre `#FFF6EA` |

O âmbar fica coerente como par: o tom do gráfico é mais claro e o do texto mais escuro, como o roxo do especial (`#7C5CFF` no losango e `#5B3FD9` no texto) e o azul (`#2563FF` no traço e `#1D4ED8` no texto em foco).

**Piso de texto: 13 unidades em todos os papéis**, no lugar do 15 do motor e do 11 e 13 da seção 7.
- **Por que não 15:** o piso alto é o que tira os números dos eixos (item 1) e deixa o índice quase do tamanho da base dentro da fração. Um termo de 17 com índice de 15 perde a hierarquia.
- **Por que 13:** na tela de 280, 13 dá 11,4 pt, acima do mínimo de 11.
- **Tamanhos por papel:**
  - rótulos dos pontos 14 em 800;
  - legenda e linha "C = ?" 14;
  - números dos eixos 13;
  - índice e expoente com 65% da base e piso 13;
  - fórmula 22 na faixa e termos de fração 17.

**Aceite F1 a F5 da seção 7:**
- **Aceitos com as imagens, depois dos itens 1 a 3 acima:**
  - F1, o conteúdo: fórmula geral em cima, A, B e G rotulados, "C = ?" sem posição e legenda;
  - F2, o conteúdo: reta com A, B e G e "C = ?" fora da reta.
- **Só a tela real prova** (build 3 no iPhone e site atual):
  - a legenda "Desenho do Studoo · …", que vem de `fonte` e `descricao`, fora da imagem;
  - a caixa sem encolher nos 360 px;
  - F3, a legibilidade no tamanho real;
  - F4, o leitor de tela;
  - F5, o recurso antigo quando não há visual.

**Aceite final do desenho (b4cb4ec, 21/11).** As correções (i) a (v), as cores, o piso de 13 e o halo branco de 3 unidades estão certos. F1 e F2 estão aceitos no conteúdo, com três ajustes pequenos (pela ordem):
1. **O rótulo só com o nome fica junto do ponto.** Na colinearidade, o "A" fica a umas 25 unidades do ponto, acima e à esquerda, e parece solto. A letra fica a no máximo 8 unidades da borda do ponto, em qualquer das 8 direções, mesmo sobre a grade (o halo resolve). Se nenhuma direção couber, o ponto fica sem letra, e a legenda traz "A (−1, −1)" com o símbolo do ponto antes. Continua valendo levar as coordenadas para a legenda.
2. **Ponto na origem.** Quando um ponto está em (0, 0), o "0" da origem não aparece, para não ficar ao lado da letra "O", que é quase igual. O ponto ganha o rótulo inteiro, "O (0, 0)", e não vai para a legenda.
3. **Tracejado só com motivo.** No ponto-na-origem, o segmento OP está tracejado sem depender de ponto escondido. Pela seção 2.1, segmento comum é cheio de 3 unidades. O tracejado fica para a linha-guia e para o que depende do procurado.

**Aceito como está:**
- os vãos do halo no segmento quando ele passa atrás de um número do eixo (baricentro, nos números 4 e 5), porque o número legível vale mais que o traço contínuo;
- "A (1, 2)" sobre a aresta BC na resposta, com halo;
- a reta numérica e a galeria (respiros, π, determinante e ";").

**Determinante (Sarrus):** as diagonais que subtraem passam a `#B9780F`, o âmbar gráfico do procurado, e as que somam continuam `#2563FF`. Aprovado. A seção 1 passa a valer com esse valor.

**Para fechar F3 a F5 e a fase 2, na tela real:**
- **Build 3 no iPhone e site atual, em 390 e 1440**, numa lição de geometria analítica gerada pelo servidor com o motor:
  - captura de "Ver a ilustração" aberto, com a imagem inteira na caixa, sem encolher abaixo da largura, e a legenda "Desenho do Studoo · …";
  - captura ampliada, para ver o texto menor (13 unidades) no tamanho real;
  - VoiceOver lendo "Desenho do Studoo: <descrição>", com gravação ou com o texto do painel de legendas do VoiceOver;
  - uma lição sem visual e uma com visual inválido, para ver o recurso antigo sem caixa vazia.
- **Build 4 e site com os visuais no aparelho:**
  - o roteiro X1 a X10 da seção 6;
  - a fórmula em linha dentro da frase (marco 3b), conferida à parte quando o contrato dela chegar.

## 9. Fórmula em linha (contrato fa5a3e4, 21/11)

Conferido em `formula-no-texto.ts`, no teste e em `golden-segmentos.json`, e rodando `partirTextoComFormulas` e `falarTextoComFormulas` em frases de exemplo. A marca `$…$`, que não pega "R$ 5,00", "US$10" nem "custa $5 e $10", e a gramática do LaTeX restrito batem com a seção 1. Os ajustes vêm por ordem de importância.

1. **Nunca aparece sublinhado nem circunflexo cru na tela, nem na fala.** Hoje, a fração dentro da frase cai em "Isso vale (x_A + x_B) / 2", com "x_A" em texto e o leitor de tela lendo o sublinhado. O texto linear de uma fórmula que não cabe em linha tem de ser montado com as peças desenhadas: o índice e o expoente continuam desenhados como em linha, e só a fração vira barra ou "÷". A fala vem da árvore (`falarFormula`), nunca do texto linear.
2. **A heurística só vale em lição de matemática.** Rodando em "Em Python, use x_1 = 3 e print(x_1).", o `x_1` vira índice, e lê-se "x índice 1". A heurística (texto sem marca) só liga quando a lição já tem matemática: uma marca `$…$`, um visual de fórmula, ou trecho do tipo `formula`. Ela nunca liga em lição com trecho do tipo `codigo`. A marca `$…$` explícita vale sempre.
3. **Fração simples em frase:**
   - Quando os dois termos são simples (número, variável ou variável com índice), a fração vira "a/b" desenhada em linha, sem espaços ("1/2", "x_A/2"), e se fala "1 sobre 2". Isso vale para `\frac` e para "/" dentro da marca.
   - Os outros "/" dentro da marca são divisão, "÷", com a fala "dividido por".
   - Fração com termo composto, em frase, vira "(x_A + x_B) ÷ 2" com as peças desenhadas (item 1).
   - Hoje "$1/2$" sai "1 ÷ 2" e se fala "1 dividido por 2": numa frase, meio é um número, não uma conta.
4. **Casos da heurística:**
   - está certo: `x_A`, `x_{A}`, `a_1`, `x_10`, `x_AB`, `b^2`, `10^3`, e palavras, arquivos e endereços de fora;
   - `2x` e `4ac` ficam texto, sem problema;
   - `x²` em Unicode também fica texto, porque a Nunito tem ² e ³;
   - "H_2O" vira H₂O, e isso é bom;
   - "CO_2" continua com o sublinhado cru e cai no item 1: na falta de leitura, tire o sublinhado ("CO2") em vez de mostrá-lo.
5. **Fala:** está natural. Por exemplo: "Use x índice G é igual a abre parênteses x índice A, mais x índice B, mais x índice C fecha parênteses dividido por 3 para achar o ponto."; "O valor de x índice C é 4, não R$ 4,00.". O resto do texto vai como está.
6. **Desenho em linha:**
   - **Tamanho:** a fórmula tem o tamanho do texto ao redor (16/24 nos textos da aula, 17 onde o texto é 17), na cor do texto e sem fundo, a não ser nos destaques.
   - **Índice e expoente:** 70% do tamanho do texto, no mínimo 11 px. O índice desce 0,3 em e o expoente sobe 0,45 em, dentro da altura de linha de 1,5. A linha não cresce.
   - **Alinhamento:** a base da fórmula fica na linha de base das palavras.
   - **Espaço em volta:** o espaço normal entre palavras, sem margem extra.
   - **Dentro da fórmula:** 0,2 em em volta dos sinais.
   - **Quebra:** a fórmula não quebra no meio da linha. Se for mais larga que a linha, ela vira o texto linear do item 1, que pode quebrar nos espaços.

**Quero ver antes do build 4**, em 390, na prévia web do app e na web, com a origem declarada:
- um parágrafo da aula com "x_G = (x_A + x_B + x_C) ÷ 3" no meio;
- uma linha que começa com x²;
- uma opção de exercício com "x_C";
- um enunciado com "1/2";
- o mesmo com o texto ampliado a 200%, para ver que índice e expoente não cortam nem encostam na linha de cima.

## 10. Aceite do desenho em linha (prévia web do app beb96c7 sobre f03ea86, 21/11)

Conferido nas quatro capturas de 390 e nas quatro da simulação de 200% do Mobile 2, com o `medidas.json`. A origem é a prévia web do app, não o aparelho, com uma lição sintética.

**Aceito em 390:**
- o tamanho igual ao do texto;
- índice e expoente perto de 70%, nas alturas certas;
- a base na linha de base (desvio 0);
- o passo de linha constante de 24;
- o respiro dos sinais;
- a fórmula sem quebrar;
- a pontuação colada ("x_C?", "25.");
- nenhum "$" na tela;
- "1/2" desenhado como fração em linha.

**Muda, por ordem de importância:**
1. **O peso da fórmula é o do texto ao redor.** Hoje, num texto regular (o balão "O Stu explica" e o exemplo), a fórmula sai em negrito, e "com x = 3, x² = 9" mistura um x regular com um x² negrito na mesma frase. A fórmula em linha usa o peso do texto:
   - regular no texto da aula;
   - negrito no enunciado e nos títulos, como já sai certo na captura 4.
   As variáveis continuam em itálico. O negrito fica para os destaques, que já têm cor.
2. **Variável sozinha na frase de matemática.** "x = 3" e "lado x" ficam em texto reto, e o x² ao lado fica em itálico. Duas ações:
   - o gerador marca com `$…$` toda variável e toda conta curta nas lições de matemática (prompt do Web & API);
   - nessas lições, a heurística também pega "letra sozinha, espaço, sinal (= + − × ÷ < > ≤ ≥) e número ou letra" ("x = 3", "a + b").
   A letra solta numa palavra ("lado x") só vira fórmula com a marca.
3. **Conferir a medida da fração em linha.** No enunciado, o "1/2" tem desvio de −25,3 no `medidas.json`. Na imagem, ele está alinhado. Meça a base do algarismo, não a caixa da fração, e confirme 0.

**Simulação de 200%:**
- **Aceito:** índice e expoente não encostam na linha de cima nem na de baixo; a pontuação fica colada; a opção "x_C = 2" fica legível.
- **Só a rodada nativa prova** (texto grande do sistema no iPhone e escala de fonte no Android):
  - no enunciado simulado, as linhas com índice ficaram mais altas que as outras, e a regra é que a linha não cresce;
  - o parágrafo largo deve cair no linear com as peças desenhadas (já pedido ao Mobile 2);
  - a letra da opção e o resto da tela devem crescer junto com o texto.

**"CO₂":** aceito com os algarismos subscritos do Unicode (U+2080 a U+2089), desde que a fonte do texto (Nunito) tenha esses glifos nas três plataformas. Sem o glifo, sai "CO2" simples, e nunca o quadrado de glifo ausente. O leitor de tela lê o algarismo normalmente ("C O 2").
