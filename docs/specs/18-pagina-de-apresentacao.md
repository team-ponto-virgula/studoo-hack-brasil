# Página de apresentação do Studoo

**Estado:** regra de design de 23/11, a pedido do dono: "quero que crie uma landing page para o studoo, com animações, boa CTA, seja uma ui e ux muito boa com foco no app". Só web. **Revista em 28/11 (seção 0): a página virou uma trilha pelo mundo do Studoo.** A seção 0 vale sobre as outras quando divergirem.
- **Objetivo principal:** a pessoa instalar o app no Android ou no iPhone.
- **Objetivo secundário:** experimentar no navegador, sem conta.

**Decisões do Lead que esta spec segue:**
- **Endereço:** `/` para quem não entrou e `/conheca` para compartilhar. Quem já entrou vai direto ao app.
- **Botão principal por aparelho:** APK do build 4 no Android; TestFlight no iPhone, depois da aprovação da Apple; os dois e um QR para `/baixar` no computador.
- **Botões próprios do Studoo**, sem selos oficiais de loja.
- **Nada de número, promessa, depoimento ou logo de parceiro.**
- **Mascote:** só o Stu novo (`public/marca/stu/*`); o logo animado é `public/marca/logo-animado.svg`.
- **Telas dentro dos celulares:** capturas nativas do build 4.
- **Animações leves**, com uma versão parada para movimento reduzido.
- **Spec 07:** a página só existe na web.
- **Música:** o mesmo ambiente de som do site.

## 0. Revisão de 28/11: a página é uma trilha

Pedido do dono em 28/11: estudar a UI e a UX das páginas de referência e criar "uma nova landing page para o studoo", "sensacional e única, com personalidade". Estudadas: Duolingo, Wondering, Lumia AI, Brilliant, StudyFetch, Kahoot! Study Path, Studey e Gizmo (o ThinkU não respondeu).

### 0.1 A ideia
- **A página é uma trilha do Studoo.** A pessoa desce pelo mesmo mundo do mapa do app. O alto é o campo, e cada parada é uma região do mapa (floresta, lago, montanhas, vila e nuvens), com o chão e o relevo de `src/ui/mundo-desenhos.ts` e a onda da fronteira de `src/ui/mundo.tsx`. A trilha termina à noite, com o troféu.
- **Uma lição só, do caderno ao troféu.** As três primeiras paradas acompanham a mesma lição de exemplo, a de frações: a anotação vira lição com a fonte, o erro vira ponte e a pessoa ensina ao Stu. Depois vêm o assunto dela e o app no celular.
- **O Stu é o anfitrião.** Ele recebe a pessoa no alto e diz uma frase curta em cada parada. Um Stu por parada, parado no lugar dele (nada flutua sobre o texto).
- **Mostrar o produto, não contar.** Cada parada tem uma demonstração que a pessoa usa ali mesmo e, ao lado, a tela de verdade do app (seção 9), com o link para ampliar. Toda demonstração diz que é exemplo.

### 0.2 Ordem e textos

| # | Âncora | Região | Nó do cabeçalho | Lugar | Título | Fala do Stu |
|---|---|---|---|---|---|---|
| Alto | `#conteudo` | campo | — | — | "Seu caderno vira lição." | "Oi! Eu sou o Stu." |
| 1 | `#material` | floresta | Caderno | Floresta das Anotações | "Seu material vira lição" | "Eu não invento nada. Toque no [1] e veja de onde saiu." |
| 2 | `#ponte` | lago | Ponte | Lago da Ponte | "Errar não tira ponto. Vira ponte." | "Eu também erro. Por isso ando com tábuas na mochila." |
| 3 | `#ensinar` | montanhas | Ensinar | Pico do Entendi | "Entendeu? Ensine ao Stu." | "Me explica como se eu tivesse faltado na aula." |
| 4 | `#assuntos` | vila | Assuntos | Vila dos Assuntos | "O que você quer aprender?" | "Já estudei violão, frações e receita de bolo. Qual é o seu?" |
| 5 | `#baixar` | nuvens | Instalar | Acima das Nuvens | "Leve o Stu no celular" | "Me leva no bolso?" |
| Chegada | — | noite | — | Chegada | "Qual vai ser a sua primeira lição?" | — |

- **Subtítulo do alto:** "Mande uma foto, um PDF ou só o assunto que você quer estudar. O Stu cria lições curtas e explica de outro jeito quando você erra." A imagem de compartilhar usa a última frase.
- **As linhas das paradas 1, 2, 3 e 5** são as dos quatro momentos da seção 3 (a 5 continua dizendo "Com uma conta"). A da 4: "Comece por uma ideia pronta ou escreva a sua."
- **No alto**, três fichas ao lado do Stu dizem as três entradas: "Foto do caderno", "PDF ou documento" e "Só o assunto". O convite "Começar · Veja uma lição nascer" leva à parada 1.
- **Marco de cada parada:** o nó da trilha com o ícone, e a etiqueta "Parada N de 5" com o nome do lugar. A chegada leva só "Chegada".
- Todos os textos ficam em `src/app/conheca/textos.ts`. O leitor de tela ouve "O Stu diz:" antes de cada fala.

### 0.3 As demonstrações
1. **Caderno.** Uma anotação de exemplo ("Frações") vira a lição "Numerador e denominador", com "Baseado no seu material [1]". Tocar no [1] abre o cartão "Fonte do seu material" e risca na anotação a frase citada. Embaixo, "O Studoo lê: Foto, PDF, DOCX, CSV, ou só o assunto". Ao lado, a captura do momento 1 e o link "Abrir PDF de exemplo".
2. **Ponte.** A questão "Que fração do retângulo está pintada?" (3/5, 3/8 e 5/8). A resposta errada traz a pista daquele erro e "Outro jeito de entender", em 3 passos; no lago ao lado, três tábuas caem no lugar. Com o acerto, "Mandou bem!" e o Stu atravessa. Quem acerta de primeira lê "Se errasse, o Stu montaria uma ponte de 3 passos" e pode "Ver a ponte mesmo assim". A fala do Stu acompanha: "Três tábuas e a gente chega do outro lado." e "Chegamos! Errar fazia parte do caminho." O lago é desenho, fora do leitor de tela; o cartão diz tudo em texto.
3. **Ensinar.** Duas explicações de exemplo ("Com exemplo" e "Bem curta"). Ao escolher, o Stu ouve por 900 ms e responde com os dois blocos do app, "O que fez sentido" e "O que revisar". Embaixo: "Retorno de exemplo. No app, o Stu responde ao que você escrever." O Stu troca de expressão como no app: curioso, concentrado, e depois animado ou dando força.
4. **Assuntos.** O campo "O que você quer aprender?" e as seis ideias, como antes: começam a sessão de visitante com a ideia no campo. Ao lado, a trilha pronta no app.
5. **Instalar.** As abas e os passos da S4, sem mudança, e o cartão do QR no computador. Ao lado, a mesma trilha no site e no app, com o selo "Progresso salvo agora".

A resposta da questão, as pistas e os retornos ficam só na página. Nada aqui chama a IA nem cria conta.

### 0.4 Cabeçalho
- Uma cápsula que acompanha a página: o logo, a trilha das paradas e as ações.
- **A trilha é a navegação e o andamento.** Cada nó leva à sua parada. Conforme a pessoa rola, o nó da vez fica azul e os que ficaram para trás viram ouro, como as lições concluídas do mapa; os marcos da própria página acompanham. A parada da vez é a última que já passou do meio da janela.
- Até 1039 px os nomes somem e ficam só os nós (o nome continua para o leitor de tela, com 44 px de toque). Até 739 px a trilha vira a barra de andamento da lição, na borda de baixo da cápsula.
- **Ações:** "Entrar" e, só depois que os botões do alto saem da tela, o convite do aparelho: "Experimentar sem conta" no computador e "Instalar" no celular (leva à parada 5). Quem já entrou vê só "Abrir o Studoo".

### 0.5 Movimento
Tudo dentro de `prefers-reduced-motion: no-preference`. Nenhuma animação em laço: nada se mexe sozinho por mais que uns segundos, então a página não precisa de botão de pausa (WCAG 2.2.2). Parada, a página mostra o estado final inteiro.

| Onde | Gatilho | O que mostra |
|---|---|---|
| Alto | Ao abrir, uma vez | As nuvens assentam, o marcador risca "vira lição.", o Stu chega acenando, e o balão e as fichas entram |
| Céu do alto | A rolagem, onde o navegador liga a animação a ela | O céu se afasta devagar; quem move é a pessoa |
| Marcos e nós | A rolagem | O da vez acende; o que ficou para trás vira ouro, com um pulo curto |
| Blocos de cada parada | 20% na tela, uma vez | Entram subindo 16 px em 400 ms |
| Fonte (parada 1) | O toque no [1] | O marcador risca a frase citada e o cartão da fonte entra |
| Ponte (parada 2) | A resposta | As tábuas caem uma a uma (150 ms entre elas) e, no acerto, o Stu atravessa |
| Retorno do Stu (parada 3) | A escolha | Os dois blocos entram em sequência; sem movimento, vêm sem a pausa do "ouvindo" |
| Fichas (parada 4) | A lista na tela, uma vez | Uma a uma, como na seção 4 |

### 0.6 O que saiu e o que continua
- **Saíram:** a primeira dobra em duas colunas com o caderno (1.2), o celular do herói com três telas em laço (1.4) e o botão de pausar a prévia, os quatro momentos em abas (S2), a faixa "Resolva uma com o Stu." e a tabela de animações da seção 4. O roteiro `scripts/qa/heroi-troca.mjs` saiu junto com o laço.
- **Continuam como estão:** as decisões do Lead, os estados do botão por aparelho (1.3), a folha do iPhone (1.5), o cartão do QR (1.6, só na parada 5), os passos de instalar (S4), o rodapé (S6), as metas de acessibilidade e de peso (seção 5), a paridade (seção 7) e as capturas nativas, sem recorte (seção 9).
- **Capturas em uso:** os momentos 1 a 4, a janela do momento 4 e a trilha pronta (herói 2) da plataforma de quem abre. As capturas 1 e 3 do herói ficam no conjunto, sem aparecer.
- **Som:** a página é silenciosa, como já era no site. A seção 6 não vale.
- **Imagem com prioridade:** agora é o Stu do alto, e não mais a primeira captura do herói.

### 0.7 O Stu em tamanho grande
O kit do produto (spec 13) vai até 480 px. Na página o Stu aparece maior, e uma tela de 2× pedia mais do que o kit tem. `scripts/otimizar-stu-landing.mjs` gera, dos mesmos originais e com o recorte e a qualidade da tabela do kit, as imagens da página em `public/landing/`, com até 90 KB cada, e escreve `src/app/conheca/stu.gerado.ts`. O kit e o catálogo do contrato não mudam.

### 0.8 Conferência de 28/11
Fotos do build de produção local, no Chromium. Ainda não é o site publicado.
- **Larguras:** 320 × 568, 360 × 640, 390 × 844, 768 × 1024, 844 × 390 (deitado), 1280, 1440 e 1920. Nada passa da largura da janela. O botão principal fica inteiro na primeira dobra em todas.
- **Acessibilidade:** o axe sem violações em 360, 390, 768 e 1280, também com a fonte aberta, a ponte montada, o acerto e o retorno do Stu. Alvos de toque com 44 px ou mais. A ordem do Tab segue a ordem da tela.
- **Movimento reduzido:** tudo à vista desde o começo, sem animação nenhuma, e os estados finais das demonstrações inteiros.
- **Peso:** cerca de 550 KB na primeira carga, e nenhum salto de layout medido (CLS 0).
- **Não conferido:** Safari e aparelhos de verdade.

## 1. Herói e botão (primeira entrega, para o Web & API começar)

### 1.1 Textos do herói
- **Título:** "Aprenda qualquer coisa. Uma lição por vez." (o lema do filme).
- **Subtítulo:** "Conte o que quer aprender ou mande uma foto do seu material. O Studoo monta lições curtas e, quando você erra, explica de outro jeito."
- **Botão principal:** muda com o aparelho (1.3).
- **Ação secundária:** o botão de texto "Experimentar sem conta", que começa a sessão de visitante, a mesma do "Experimentar sem conta" da entrada, e abre "O que você quer aprender?".
- **Linha de apoio**, embaixo dos botões, em 14/20 `#5E6A85`: muda com o aparelho (1.3).
- **Cabeçalho:**
  - à esquerda, o logo animado (uma vez, ao abrir; parado com movimento reduzido);
  - à direita, o botão de som do site, como na entrada (seção 6), e o botão de texto "Entrar", que abre a entrada de hoje.

### 1.2 Primeira dobra

**Celular, 390 × 844** (o botão principal sempre visível sem rolar, também em 360 × 640):
1. Cabeçalho de 56 px: logo, som e "Entrar".
2. 24 px de respiro.
3. Título em Quicksand 700, 32/38, `#0B1B5C`, até 3 linhas.
4. 12 px, e o subtítulo em Nunito 17/26, `#5E6A85`.
5. 24 px, e o botão principal na largura toda, 56 px de altura, o primário do Studoo (azul `#2563FF`, lábio, raio 16), com o ícone do aparelho à esquerda.
6. 8 px, e "Experimentar sem conta" na largura toda, 48 px, botão de texto.
7. 8 px, e a linha de apoio.
8. Depois, o celular do herói (1.4), centralizado, com 260 px de largura, que começa ainda na primeira dobra e aparece pela metade. Ele avisa que há mais para baixo.

Em 360 × 640, o título vai a 28/34, e o subtítulo, a 16/24. O botão principal continua inteiro na primeira dobra.

**Tablet, 768:** a mesma ordem do celular, com a coluna de texto centralizada, até 560 px. O celular do herói fica com 300 px, e o QR não aparece.

**Computador, 1280** (a partir de 1024), em duas colunas na primeira dobra (até 760 px de altura):
- **À esquerda**, com até 560 px:
  - título em 56/64;
  - subtítulo em 20/30;
  - a fileira de botões (1.3, computador);
  - embaixo, "Experimentar sem conta";
  - a linha de apoio.
- **À direita:** o celular do herói, com 340 px de largura, levemente inclinado (−4°), e o `stu-acolhida` de 160 ao lado, com a base na mesma linha do celular, acenando.

O fundo da primeira dobra é o céu do mundo do Studoo: o degradê do mapa, de `#EAF0FF` a `#FFFFFF`, com duas nuvens e uma colina verde baixa atrás do celular (os desenhos de `src/ui/mundo-desenhos.ts`). O texto fica sobre a parte clara, com contraste AA.

### 1.3 Estados do botão, por aparelho

O aparelho é detectado pelo navegador (agente do usuário e `navigator.userAgentData`), sem pedir nada. Na dúvida, vale o estado do computador.

| Aparelho | Botão principal | Linha de apoio | Leva a |
|---|---|---|---|
| Android | "Baixar para Android", com o ícone de download | "Versão de teste para Android 7 ou mais novo, com {tamanho}. O arquivo instala direto, sem loja." Sem tamanho conhecido: "Versão de teste para Android 7 ou mais novo. O arquivo instala direto, sem loja." | O APK do build 4, pelo link configurado |
| iPhone, antes da aprovação da Apple | "Usar no iPhone agora", com o ícone de celular | "O app para iPhone chega em breve pelo TestFlight." | A folha "Studoo na Tela de Início" (1.5) |
| iPhone, depois da aprovação | "Instalar no iPhone", com o ícone de download | "Versão de teste pelo TestFlight, o app de testes da Apple." | O link público do TestFlight |
| Computador | "Experimentar sem conta" vira o botão principal, de 56 px, e ao lado fica o cartão do QR "Instale no celular" (1.6). Nenhum botão principal baixa o arquivo do app | "Para instalar no celular, aponte a câmera para o código." | A sessão de visitante; o QR leva a `/baixar` |

- **A troca do iPhone para o TestFlight** é só de configuração: quando o link público existir no servidor (a variável configurável do Web & API), o estado muda sozinho, sem mexer na página. Sem o link, vale o estado "em breve".
- **Estados de toque e foco do botão:** os do primário do Studoo (afunda 3 px ao tocar, anel de foco de 3 px `#2563FF` com 2 px de distância).
- **O tamanho do arquivo** é medido uma vez pelo Web & API, no arquivo real do link padrão, e fixado: em MB, com uma casa decimal e vírgula ("114,8 MB"), cortando a segunda casa e nunca arredondando para cima. Se o link mudar pela variável e o tamanho do arquivo novo não for conhecido, a linha sai sem o número.
- **No computador**, o "Experimentar sem conta" é o botão principal, e não o botão de texto. Assim ele fica à vista na primeira dobra em 1280, onde os avaliadores costumam abrir a página, e o botão de texto "Experimentar sem conta" embaixo some.
- **Ao tocar em "Baixar para Android":** o download começa, e o botão mostra por 4 s o visto e "Baixando…". Embaixo entra a linha "Abra o arquivo baixado para instalar. Se o Android pedir, permita instalar apps deste navegador.", que fica até a pessoa sair da página.
- **Rótulo para leitor de tela:** "Baixar o Studoo para Android, versão de teste" e "Usar o Studoo no iPhone agora". O ícone é decorativo.

### 1.4 O celular do herói
- Moldura própria do Studoo: um retângulo de raio 44, borda de 10 px `#0B1B5C`, ilha no alto e sombra suave (`0 24px 48px rgb(11 27 92 / 0.18)`). Não é a imagem de um iPhone de verdade nem de marca.
- Dentro, três capturas nativas do build 4, em sequência: "O que você quer aprender?" com uma ideia escolhida, a proposta pronta com o mapa, e uma lição com o acerto ("Isso aí!").
- Cada uma fica 3,5 s. A troca é por sumir e aparecer em 400 ms, com a nova entrando 12 px de baixo para cima, em laço. O laço só roda com a página visível e o herói na tela (IntersectionObserver) e para quando a pessoa sai da aba.
- **Com movimento reduzido:** só a captura da proposta pronta, parada, e o Stu parado.
- **Origem:** as capturas são escolhidas do conjunto do Mobile & QA (seção 9). O `alt` descreve a tela ("Tela do Studoo com a trilha pronta: 6 lições curtas em 3 partes"), e a sequência tem um `aria-label` só no conjunto, sem anunciar cada troca.

### 1.5 Folha "Studoo na Tela de Início" (iPhone, antes do TestFlight)

É a folha da spec 11, e não janela nativa:
- **Título:** "Use o Studoo no iPhone hoje".
- **Texto:** "No Safari, o Studoo abre como um app, em tela cheia."
- **Três passos numerados, cada um com o desenho do ícone do iOS em traço próprio:**
  1. "Toque em Compartilhar, na barra do Safari."
  2. "Escolha “Adicionar à Tela de Início”."
  3. "Toque em Adicionar. O Studoo fica com os seus apps."
- **Botão principal:** "Entendi".
- **Botão de texto:** "Experimentar sem conta", que abre a sessão de visitante.
- **Fora do Safari no iPhone:** a folha diz antes dos passos "Abra esta página no Safari para adicionar à Tela de Início."

### 1.6 Cartão do QR (computador)
- Um cartão branco de 196 × 248, com borda de 2 px `#E1E7FA` e raio 20, ao lado do botão principal, com o topo alinhado a ele.
- Dentro, de cima para baixo:
  - o título "Instale no celular", em 15/20 800;
  - o QR para `/baixar` (`/baixar` redireciona conforme o aparelho), desenhado com os pontos arredondados do Código Studoo, com 136 px;
  - "Aponte a câmera do celular", em 14/20;
  - o link pequeno "Baixar o arquivo para Android ({tamanho})", em 13/18, para quem passa o arquivo por cabo, com área de toque de 44 px de altura. Sem tamanho conhecido, "Baixar o arquivo para Android".
- O QR tem o `alt` "Código QR para baixar o Studoo no celular".

## 2. Ordem das seções

| # | Seção | 390 e 768 | 1280 |
|---|---|---|---|
| S1 | Herói (seção 1) | Texto, botões e o celular embaixo | Duas colunas |
| S2 | Como o Studoo ensina: os quatro momentos | Quatro blocos empilhados, cada um com o seu celular | O celular preso à direita, e a tela dentro dele troca enquanto os quatro textos passam à esquerda |
| S3 | Pode ser qualquer assunto | O Stu e uma fileira de ideias que corre devagar | O mesmo, mais largo |
| S4 | Instale em 3 passos | Seletor Android e iPhone, com três passos | Seletor e os três passos em linha |
| S5 | Chamada final | O Stu comemorando e os botões | O mesmo, centralizado |
| S6 | Rodapé | Links empilhados | Links numa linha |

Entre as seções, 72 px de respiro no celular e 120 px no computador. Os títulos de seção são Quicksand 700, 28/34 no celular e 40/48 no computador, em `#0B1B5C`.

## 3. Textos das seções

**S2. Título:** "Como o Studoo ensina". Os quatro momentos, cada um com título (20/26 800) e uma linha (17/26, `#5E6A85`):
1. **"Seu material vira lição"**: "Mande uma foto, um PDF ou um documento. Cada lição mostra de onde tirou a ideia, com o trecho do seu material."
2. **"Errou? Tem outro jeito"**: "O Stu explica a mesma ideia por outro caminho, em 3 passos curtos, e você tenta de novo."
3. **"Explique do seu jeito"**: "Conte ao Stu o que entendeu. Ele mostra o que fez sentido e o que vale revisar."
4. **"No computador e no celular"**: "Com uma conta, a sua trilha é a mesma no site e no app. Você continua de onde parou."

O momento 4 diz "com uma conta", porque o progresso do visitante fica só no aparelho dele.

**S3:**
- título "Pode ser qualquer assunto";
- linha "Comece com uma ideia pronta ou escreva a sua.";
- as seis ideias da tela inicial, em fichas com o ícone de cada uma, numa grade que quebra linha (todas à vista, também em 390): "Violão do zero: primeiros acordes", "Inglês para conversar em viagens", "Culinária: receitas básicas", "História do Brasil para a prova", "Frações" e "Fotografia com o celular";
- tocar numa ficha começa a sessão de visitante já com aquela ideia no campo. Se isso pedir rota nova, a ficha só abre o visitante, sem preencher (o Web & API decide).

**S4:**
- título "Instale em 3 passos";
- seletor de duas opções, "Android" e "iPhone", que abre no aparelho de quem está vendo (no computador, em Android).
- **Android:**
  1. "Toque em “Baixar para Android”."
  2. "Abra o arquivo baixado. Se o Android pedir, permita instalar deste navegador."
  3. "Abra o Studoo e entre com a sua conta, ou experimente sem conta."
  Embaixo, o botão "Baixar para Android". No computador, no lugar do botão, fica o cartão do QR (1.6), com o link pequeno do arquivo.
- **No computador** (o cartão do QR fica ao lado dos passos), os passos falam do celular:
  - **Android:**
    1. "Aponte a câmera do Android para o código ao lado."
    2. "Toque no link que aparecer e abra o arquivo baixado. Se o Android pedir, permita instalar deste navegador."
    3. "Abra o Studoo e entre com a sua conta, ou experimente sem conta."
  - **iPhone, antes do TestFlight:**
    1. "Aponte a câmera do iPhone para o código ao lado e abra a página no Safari."
    2. "Toque em Compartilhar e escolha “Adicionar à Tela de Início”."
    3. "Toque em Adicionar. O Studoo fica com os seus apps."
  - **iPhone, com o TestFlight:**
    1. "Instale o TestFlight, o app de testes da Apple, pela App Store."
    2. "Aponte a câmera do iPhone para o código ao lado e toque em “Instalar no iPhone”."
    3. "No TestFlight, toque em Instalar e abra o Studoo."
  - O cartão do QR da aba iPhone não traz o link do arquivo do Android. Os ícones do iOS aparecem só nos passos 2 (Compartilhar) e 3 (confirmar).
  - Na aba iPhone, antes do TestFlight, a linha "O app para iPhone chega em breve pelo TestFlight." e o botão "Experimentar sem conta" ficam embaixo dos passos, na coluna da esquerda, alinhados ao texto dos passos e com a largura do botão principal (não a coluna toda). O cartão do QR fica sozinho à direita (conferência de 24/11).
- **iPhone, antes do TestFlight:** os três passos da folha da seção 1.5, com a linha "O app para iPhone chega em breve pelo TestFlight." e o botão "Experimentar sem conta".
- **iPhone, com o TestFlight:**
  1. "Instale o TestFlight, o app de testes da Apple, pela App Store."
  2. "Toque em “Instalar no iPhone”, nesta página."
  3. "No TestFlight, toque em Instalar e abra o Studoo."
  Embaixo, o botão "Instalar no iPhone".
- Cada passo tem o número num círculo de 32 px `#E9E7FF`, com o número em `#1D4ED8`, e o texto em 17/26.

**S5:**
- `stu-celebrando` de 160;
- título "Qual vai ser a sua primeira lição?";
- o botão principal do aparelho (1.3) e "Experimentar sem conta". No computador, "Experimentar sem conta" é o principal, e o botão de texto "Instalar no celular" leva ao S4.

**S6:**
- o logo;
- a linha "Feito para o HackBrasil 2026.";
- os links "Política de privacidade" (`/privacidade`), "Suporte" (`/suporte`) e "Entrar", em 15/20, com área de toque de 44 px.

**Na `/conheca` com a pessoa já dentro da conta:** a página aparece igual, mas "Entrar" (cabeçalho e rodapé) vira "Abrir o Studoo", que leva a Minhas trilhas.

**Página no navegador:**
- título "Studoo: aprenda qualquer coisa, uma lição por vez";
- descrição "O Studoo transforma seu material em prática, usa o erro para oferecer outro caminho e pede que você explique o que entendeu.";
- imagem de compartilhar com o herói (o gerador de imagens que o servidor já tem).

## 4. Animações

O critério de todas: com função, leves, só CSS e IntersectionObserver, e a versão parada mostra tudo inteiro. "Movimento reduzido" é `prefers-reduced-motion` ou a preferência de movimento do Studoo (`src/ui/movimento.tsx`).

| Onde | Gatilho | Duração e curva | O que mostra | Versão parada |
|---|---|---|---|---|
| Logo do cabeçalho | Ao abrir a página, uma vez | A do `logo-animado.svg` | O Studoo "acorda" | O logo parado |
| Celular do herói | O herói na tela | 3,5 s por tela; troca em 400 ms, `cubic-bezier(.2,.8,.2,1)`, subindo 12 px | Pedido, trilha pronta e acerto: o produto em 10 s | Só a trilha pronta |
| Stu do herói (1280) | Ao abrir | O laço do `stu-acolhida` animado, por 3 ciclos, e depois parado | O Stu dá oi | `stu-acolhida` parado |
| Entrada de cada seção | 20% da seção na tela, uma vez | 400 ms, sumir e aparecer, subindo 16 px, saída suave | Ritmo de leitura | Tudo já à vista |
| Celular preso do S2 (1280) | O texto de um momento cruza o meio da tela | Troca de tela em 300 ms, sumir e aparecer; a moldura não se mexe | A tela do momento que se lê ("voar em vez de teletransportar") | Cada momento com a sua captura ao lado, como no celular |
| Selo "Progresso salvo agora" (momento 4) | O momento 4 na tela, uma vez | Escala de 1 a 1,06 e de volta, em 320 ms, e o ponto verde acende | A sincronia acontecendo | O selo parado |
| Fichas do S3 | A seção na tela, uma vez | As seis fichas em grade, quebrando linha, entram uma a uma (60 ms entre elas, 300 ms cada, subindo 8 px). Não há fileira correndo em laço | Muitos assuntos possíveis | As seis fichas já à vista |
| Stu do S5 | A seção na tela, uma vez | Um ciclo do `stu-celebrando` animado | Fechar com alegria | Parado |

Nenhuma animação muda o lugar de botão ou de texto já à vista. O laço do herói e o das fichas param com a aba escondida.

## 5. Acessibilidade e metas de conferência
- Contraste AA em todo texto, inclusive sobre o céu e sobre as fichas.
- Foco visível em tudo que se toca (anel de 3 px `#2563FF`, como no resto do Studoo). A ordem do Tab segue a ordem da tela, e um link "Pular para o conteúdo" leva ao S1.
- Alvos de toque de 44 px ou mais; os botões principais, 52 a 56.
- O axe sem violações em 390, 768 e 1280, com o visitante e com a pessoa já dentro da conta.
- O texto ampliado a 200% não corta nem sobrepõe nada.
- Imagens:
  - as capturas em WebP, com até 120 KB cada em 2×;
  - a primeira do herói carregada já (`fetchpriority="high"`) e as outras só quando chegam perto da tela;
  - o Stu nos tamanhos do kit;
  - a página inteira com até 1 MB na primeira carga, sem contar o APK.
- O seletor do S4 é um grupo de abas acessível (`tablist`), e as fichas que correm podem ser paradas e lidas pelo leitor de tela (a lista inteira fica no código uma vez, sem cópias para o laço lidas duas vezes).

## 6. Som

A página usa o ambiente de som que já está no layout (`AmbienteSom`). Não há player novo nem outra música.
- Como em todas as telas, o Lo-fi começa no primeiro gesto (toque, clique ou tecla; rolar não conta), e o aviso "Música de fundo ligada." da primeira vez segue a spec 16, item 14 (no alto, com o espaço reservado).
- O cabeçalho da página entra na lista de cabeçalhos do alto, para o aviso saber onde ficar.
- O botão de som do cabeçalho é o mesmo da entrada e abre a mesma folha de som.
- Tocar em "Baixar para Android" conta como o primeiro gesto. A música começar junto do download é aceito, porque é a mesma regra da entrada.

## 7. Paridade

A página só existe na web: o app já abre na entrada e no conteúdo. Ela foi registrada na spec 07, linha P34.

## 8. Quem faz o quê
- **Web & API:** a página, as rotas `/`, `/conheca` e `/baixar`, os links configuráveis (APK e TestFlight), o QR, a detecção do aparelho, as animações e as metas da seção 5.
- **Mobile & QA:** o conjunto de capturas nativas do build 4 (seção 9), com a origem.
- **Designer:** escolher as capturas e conferir a página em 390, 768 e 1280.

## 9. Capturas do app que a página usa

Capturas nativas do build 4 (simulador do iPhone ou emulador do Android, com a origem de cada uma), escolhidas pelo Designer no conjunto do Mobile & QA (`evidencias/landing-capturas`). Nada de prévia web dentro de moldura de celular.

| Lugar | Arquivo | Estado |
|---|---|---|
| Herói 1 | `heroi-1-iphone-pedido-fotografia.png` e `heroi-1-android-pedido-fotografia.png` (rodada 45277267126) | Final: "Fotografia com o celular" no campo, sem teclado |
| Herói 2 (e versão parada) | `heroi-2-iphone-proposta-pronta.png` e `heroi-2-android-proposta-pronta.png` | Final: a trilha pronta da mesma trilha, sem o aviso de trilha repetida. A do iPhone traz no alto a linha pequena "Trilha pronta do Studoo, a mais próxima do seu pedido…", do servidor sem IA real. Ela é aceita; uma rodada com IA real seria só troca de arquivo e não bloqueia |
| Herói 3 | `heroi-3-iphone-licao-acerto.png` e `heroi-3-android-licao-acerto.png` | Final: "Lente limpa e mãos firmes", com "Mandou bem!" |
| S2, momento 1 | `04-android-licao-fonte-do-material-producao.png` (rodada 45286100960: APK do canal interno, emulador Pixel 6 com Android 15, contra o site publicado, IA real, a partir de um PDF de uma página da equipe) | Final: "Baseado no seu material [1]" e o cartão "[1] Fonte do seu material · regra-dos-tercos.pdf · Página 1" com o trecho, sem selo de demonstração. O texto do balão começa repetindo "O Stu explica:" (defeito do conteúdo gerado, que o Web & API corrige no servidor). Ele é aceito na página, porque uma nova captura custaria outra leitura com a IA real |
| S2, momento 2 | `05b-iphone-ponte.png` | Final: a faixa da ponte, com as três tábuas e o Stu, conta o momento num olhar |
| S2, momento 3 | `06-android-ensine-ao-stu.png` | Final: abre em "O que fez sentido", com os vistos |
| S2, momento 4 | `03-iphone-mapa-da-trilha.png`, ao lado da mesma trilha no site, numa janela de navegador desenhada pelo Studoo (a captura da web é real) | Aceita. Um mapa com "Compartilhar" no lugar de "Em revisão" seria melhor, mas não bloqueia |

**Regras de uso:**
- **As capturas nativas não são recortadas** (decisão do Lead). A barra de status de cada sistema fica.
- **Cada celular mostra capturas de uma plataforma só.** No herói, quem abre no Android vê as três do Android, e os outros veem as três do iPhone.
- **A moldura própria do Studoo** segue a plataforma da captura: a ilha no alto para o iPhone, e um ponto de câmera de 10 px, centralizado, para o Android. Ela não desenha relógio.
- **Nos momentos do S2,** cada celular tem a sua moldura, e as plataformas podem ser diferentes entre um momento e outro.
- **Exportação:** WebP com a largura da moldura em 2× (680 px no herói do computador), até 120 KB cada, sem recorte.
- **`alt`:**
  - "Tela do Studoo perguntando o que você quer aprender";
  - "Tela do Studoo com a trilha pronta";
  - "Lição do Studoo com a resposta certa e o Stu comemorando";
  - "Lição do Studoo com o cartão da fonte, que mostra o trecho do seu material";
  - "A ponte do Studoo: outro jeito de entender, em 3 passos";
  - "O retorno do Stu à sua explicação";
  - "O mapa da trilha no app" e "A mesma trilha no site, aberta no navegador do computador".

## 10. Conferência da primeira versão (Web & API, ramo `feat/web-landing`, 23/11)

Fotos do build de produção local em 390 (Android e iPhone), 768 e 1280, com e sem movimento. Ainda não é o site publicado.
- **Aprovado:** a estrutura e a ordem; a primeira dobra com o botão à vista em 390; os estados do botão por aparelho; o computador com "Experimentar sem conta" principal e o cartão do QR com o tamanho (114,9 MB); a folha do iPhone; o S4 com o seletor e o QR no computador; a chamada final; o rodapé; a versão parada.
- **Decisões do Web & API, aceitas:**
  - o momento 4 com a janela de navegador desenhada pelo Studoo, a captura real da web e o celular sobre o canto;
  - o azul escuro `#1D4ED8` em "Entrar" e "Experimentar sem conta" sobre o céu;
  - os `alt` do momento 1 e da janela;
  - o `stu-curioso` de 96 no S3;
  - os nomes acessíveis começando pelo texto visível.

**Ajustes:**
1. **Título com uma frase por linha.** Hoje ele quebra em "Aprenda qualquer coisa. Uma / lição por vez.", com a segunda frase partida. Cada frase começa numa linha própria: "Aprenda qualquer coisa." e "Uma lição por vez.". Dentro de cada frase, a quebra é a do texto, equilibrada (`text-wrap: balance`). No computador, com a coluna de 560, fica "Aprenda qualquer / coisa. / Uma lição por vez.", e em 768, como já está, uma frase por linha.
2. **As ideias do S3 em grade, sem fileira correndo** (tabela da seção 4). Em 390, a fileira mostrava uma ficha só, o que não diz "qualquer assunto". A grade mostra as seis e dispensa o botão de pausar da regra 2.2.2 da WCAG.
3. **O aviso de música na página só aparece no alto da página.** Com a página rolada, o aviso fixo no alto cobria botões (o "Experimentar sem conta" do S4 e do S5 em 390 e em 1280), contra a spec 16, item 14.
   - Se o primeiro gesto acontecer com a página rolada (mais que a altura do cabeçalho), a música começa, mas o aviso espera: ele aparece quando a pessoa volta ao alto, ou na próxima tela do app;
   - como o aviso é de uma vez por aparelho, ele não se perde.
- **As capturas provisórias continuam até chegarem as finais** (seção 9):
  - o herói limpo da mesma trilha;
  - o momento 1 com o PDF de verdade, sem o selo;
  - de preferência, o mapa do momento 4 sem "Em revisão".
  O momento 1 não espera um build com o texto novo: espera a captura com o material de verdade.

**Segunda rodada (24/11):** os três ajustes estão conferidos nas fotos novas.
- O título fica com uma frase por linha. Em 1280, "Aprenda / qualquer coisa. / Uma lição por vez.", com o equilíbrio da primeira frase em duas linhas; está aceito.
- As ideias estão em grade em 390 e em 1280, sem fileira correndo. Isso já atende a regra 2.2.2 da WCAG, e não precisa de botão de pausa.
- O aviso de música não cobre mais botões.

Também está aceito:
- **O laço do herói sem quadro vazio:** a soma das opacidades nunca ficou abaixo de 0,95 nas amostras do Web & API.
- **A captura do momento 1 com o "!" no Wi-Fi do emulador:** é a barra do sistema da captura, sem recorte. É pequena e não diz nada falso.
- **O mapa do momento 4 com "Em revisão":** fica. O selo é pequeno, a janela do site ao lado mostra "Compartilhar", e trocar pediria outra rodada nativa. Se vier uma captura nova por outro motivo, ela entra.
