# Paridade entre web e app

**Regra.** Igual por padrão; diferença só por obrigação da plataforma. Na mesma largura, a mesma tela: mesma ordem, tamanhos, textos, ícones e comportamento. "Fica melhor assim no toque" não é motivo: se é melhor, as duas mudam.

**Ação principal em tela estreita.** Até 600 px, a ação principal aparece sem rolar, ocupa a largura toda e vem antes de qualquer saída secundária. Onde uma plataforma já faz isso e a outra não, a outra segue.

Esta tabela é a única lista de diferenças entre a web móvel e o app. O que não está nela é defeito. Ela vem do levantamento de 18/11, que comparou o site em `fc6e458` com a prévia do app, em 390×844 e 360×800, e foi refeita no mesmo dia contra o site em `cd870b1`. O app foi corrigido na `feat/ui-hackathon-mobile` (de `d116640` a `0a7e759`; a rodada medida de `2a2c1c6` a `0a7e759` zerou ou explicou cada linha de espaço, caixa, tipografia, ordem e alinhamento). As decisões são do Lead.

**Rodada revisada (pedido 5a5d2e21).** De `3aa3773` em diante, o app copiou o estilo computado da web em `bf8cf37` (caixas com borda que fecha e degrau por fora, fim da rolagem, rodapé compacto, cabeçalho e legenda da ponte, mapa, paisagens, cabeçalhos de 60 e 64 contando a linha, anel de foco só pelo teclado como `:focus-visible`), medido contra uma web local com o mesmo código e IA simulada (o site passou a usar IA real e não se gera nada nele).

**Resolvido em 18/11.** A web fez W1 a W6, B1 e B2 em `cd870b1`, e o app copiou o esqueleto novo da web (D1, `1a66d2d`). O espaçamento do mapa (A1) ficou igual ao da web em `22c6599` e `0a7e759`: a distância de um nome de lição ao próximo é a mesma nos dois. Esses itens saíram da tabela.

## Diferenças que sobram

| # | Diferença | Onde | Motivo | Quem muda |
|---|---|---|---|---|
| P1 | Sessão no SecureStore (app) × cookie httpOnly (web) | Entrada | O app não tem cookie de navegador; o SecureStore é o cofre do sistema | Ninguém |
| P2 | Google pelo navegador do sistema (app) × troca de página (web) | Entrada | O Google não aceita login em WebView embutida | Ninguém |
| P3 | Voltar do aparelho fecha cartões e caixas como "Cancelar" e volta uma tela; na web valem o Esc e o histórico do navegador | Todas | Navegação do sistema Android | Ninguém |
| P4 | O app reserva a área segura (entalhe, barra de gestos) | Todas | Bordas do aparelho; na prévia web valem 0 | Ninguém |
| P5 | O app sobe o conteúdo para o campo em foco ficar acima do teclado; Enter para verificar existe só na web | Campos e exercícios | Teclado virtual × teclado físico; no aparelho, a tecla de envio do teclado envia a lacuna | Ninguém |
| P6 | Anúncios e foco do leitor de tela: `accessibilityLiveRegion`, `announceForAccessibility` e foco do TalkBack (app) × `aria-live` e foco do teclado (web) | Todas | APIs de acessibilidade de cada plataforma; o texto anunciado é o mesmo | Ninguém |
| P7 | Link "Ir para o conteúdo" só na web | Todas | Atalho de Tab do teclado; no app o TalkBack navega por títulos e controles | Ninguém |
| P8 | Área de toque de 48 dp nos alvos pequenos (selo [1], "•••", "Sair"), com o desenho igual ao da web | Várias | Regra de acessibilidade do Android; a área cresce por fora (`hitSlop`), sem mudar o desenho | Ninguém |
| P9 | Seletor de arquivo, câmera e pedido de microfone do sistema | Material, Explique | DocumentPicker, ImagePicker e permissão do Android × `input type=file` e permissão do navegador; botões e textos iguais | Ninguém |
| P10 | Alça de redimensionar o campo de texto só na web | Explique | Recurso do navegador; o TextInput nativo não tem | Ninguém |
| P11 | Fontes TTF variáveis pelo expo-font (app) × WOFF2 (web). A quebra equilibrada dos títulos (`text-wrap: balance`) vem do `textBreakStrategy` do Android; o iOS e a prévia web quebram como sempre | Todas | Formato de fonte e motor de texto de cada plataforma | Ninguém. Conferir no aparelho se o peso pedido pela fonte variável aparece; se não aparecer, carregar arquivos estáticos por peso |
| P12 | Anel de foco no botão tocado, só na prévia web do app | Prévia | No Android o toque não move o foco; ele só aparece com teclado ou D-pad | Ninguém (artefato da prévia) |
| V1 | A conversa ao vivo do Explique só aparece na prévia web do app; no aparelho, a opção fica escondida e o Explique segue com "Gravar" e o texto | Explique | O WebRTC nativo pede um módulo próprio (react-native-webrtc) e um build novo; por decisão do Lead, sem dependência nativa nesta versão. Na prévia, o transporte é o WebRTC do navegador, no mesmo fluxo da web | App, quando o módulo nativo entrar |

## O que não é diferença de tela

- "Esqueci minha senha" e "Experimentar sem conta" aparecem conforme `/api/auth/config`, com a mesma regra nos dois. No site, recuperação e visitante estão desligados.
- Trilhas da conta, textos gerados pela IA e a ordem das opções (sorteada por sessão, com a mesma regra em `aula.tsx` e `licao.tsx`) mudam de um ambiente para outro.
- O app não usa SVG. Ícones, olho de mostrar senha, colinas da entrada (elipses de CSS na web), morro do troféu e a estrada até ele são desenhados com Views, no mesmo desenho da web. As ondas do mapa (começo e fronteira entre partes) são curvas Bézier na web e arcos de círculos grandes no app: onde dois arcos se cruzam fica um "V" (sob a faixa "Parte N"). Fechar isso pede `react-native-svg`; a decisão é do Lead (pedido 5a5d2e21).
- Animações em andamento na hora da captura: o balão "Começar" flutua 4 a 5 px e a estrela do pedido cintila, nos dois.
- No balão do nó atual, um espaço de largura zero separa a ação do título. Assim o texto visível continua contido no nome acessível ("Começar: <título>. Lição X de Y, atual."), no formato da web 4.6.

## Como conferir

- Os pares lado a lado (web à esquerda, app à direita), em 390×844 e 360×800, ficam em `studoo-ui-capturas/paridade/pares/` (antes), `paridade/pares-depois/` (depois das correções) `paridade/pares-cd870b1/` (contra o site em `cd870b1`), `paridade/pares-v7/` (o app em `0a7e759` contra o site em `abf48eb`) e `paridade/pares-v11/` (o app contra a web local em `bf8cf37`, com IA simulada e as mesmas trilhas; pedido 5a5d2e21). Os estados da voz ao vivo, em simulação local, ficam em `paridade/pares-voz/`.
- Desde o pedido 5a5d2e21, as capturas são em repouso (movimento reduzido nos dois lados) e a ferramenta compara também a caixa visual (o ancestral com fundo, borda, raio, degradê ou sombra): bordas por lado, estilo da borda, degradê, degrau por fora, contorno, reticências, tamanho e traço dos ícones, o branco no fim da rolagem e o que é tocável.
- As medidas automáticas (texto, fonte, peso, cor, caixa, o que fica parado e o que rola) ficam em `paridade/medidas/`. O levantamento com as classes está em `paridade/LEVANTAMENTO.md`.
- Uma diferença nova que a plataforma obriga entra nesta tabela com o motivo. Qualquer outra diferença é corrigida.
