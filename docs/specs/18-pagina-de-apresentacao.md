# Página de apresentação do Studoo

**Estado:** regra de design de 23/11, a pedido do dono: "quero que crie uma landing page para o studoo, com animações, boa CTA, seja uma ui e ux muito boa com foco no app". Só web. Ainda não implementada.
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
| Android | "Baixar para Android", com o ícone de download | "Versão de teste para Android 7 ou mais novo. O arquivo instala direto, sem loja." | O APK do build 4, pelo link configurado |
| iPhone, antes da aprovação da Apple | "Usar no iPhone agora", com o ícone de celular | "O app para iPhone chega em breve pelo TestFlight." | A folha "Studoo na Tela de Início" (1.5) |
| iPhone, depois da aprovação | "Instalar no iPhone", com o ícone de download | "Versão de teste pelo TestFlight, o app de testes da Apple." | O link público do TestFlight |
| Computador | Dois botões lado a lado, de 52 px: "Baixar para Android" (primário) e "Usar no iPhone" (secundário, no mesmo estado do iPhone), e à direita o cartão do QR (1.6) | "Aponte a câmera do celular para o código, ou toque no botão do seu aparelho." | O APK, e a folha do iPhone ou o TestFlight |

- **A troca do iPhone para o TestFlight** é só de configuração: quando o link público existir no servidor (a variável configurável do Web & API), o estado muda sozinho, sem mexer na página. Sem o link, vale o estado "em breve".
- **Estados de toque e foco do botão:** os do primário do Studoo (afunda 3 px ao tocar, anel de foco de 3 px `#2563FF` com 2 px de distância).
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
- Um cartão branco de 176 × 208, com borda de 2 px `#E1E7FA` e raio 20.
- Dentro, o QR para `/baixar` (`/baixar` redireciona conforme o aparelho), desenhado com os pontos arredondados do Código Studoo, e embaixo "Aponte a câmera do celular", em 14/20.
- O QR tem o `alt` "Código QR para baixar o Studoo no celular".
