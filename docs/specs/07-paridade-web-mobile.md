# Paridade entre web e app

**Regra.** Igual por padrão; diferença só por obrigação da plataforma. Na mesma largura, a mesma tela: mesma ordem, tamanhos, textos, ícones e comportamento. "Fica melhor assim no toque" não é motivo: se é melhor, as duas mudam.

**Ação principal em tela estreita.** Até 600 px, a ação principal aparece sem rolar, ocupa a largura toda e vem antes de qualquer saída secundária. Onde uma plataforma já faz isso e a outra não, a outra segue.

Esta tabela é a única lista de diferenças entre a web móvel e o app. O que não está nela é defeito. Ela vem do levantamento de 18/11, que comparou o site em `fc6e458` com a prévia do app, em 390×844 e 360×800, e foi refeita no mesmo dia contra o site em `cd870b1`. O app foi corrigido na `feat/ui-hackathon-mobile` (de `d116640` a `0a7e759`; a rodada medida de `2a2c1c6` a `0a7e759` zerou ou explicou cada linha de espaço, caixa, tipografia, ordem e alinhamento). As decisões são do Lead.

**Rodada revisada (pedido 5a5d2e21).** De `3aa3773` em diante, o app copiou o estilo computado da web em `bf8cf37` (caixas com borda que fecha e degrau por fora, fim da rolagem, rodapé compacto, cabeçalho e legenda da ponte, mapa, paisagens, cabeçalhos de 60 e 64 contando a linha, anel de foco só pelo teclado como `:focus-visible`), medido contra uma web local com o mesmo código e IA simulada (o site passou a usar IA real e não se gera nada nele).

**Casca do iPhone (pedido 6779fab3).** Conteúdo, ordem e textos continuam iguais nas três plataformas; no iPhone, a moldura segue o iOS atual (P13 a P16). A P12 (anel de foco no botão tocado na prévia) saiu: desde `ac8e8d0`, o anel dos botões só aparece pelo teclado, como `:focus-visible`.

**Resolvido em 18/11.** A web fez W1 a W6, B1 e B2 em `cd870b1`, e o app copiou o esqueleto novo da web (D1, `1a66d2d`). O espaçamento do mapa (A1) ficou igual ao da web em `22c6599` e `0a7e759`: a distância de um nome de lição ao próximo é a mesma nos dois. Esses itens saíram da tabela.

## Diferenças que sobram

| # | Diferença | Onde | Motivo | Quem muda |
|---|---|---|---|---|
| P1 | Sessão no SecureStore (app) × cookie httpOnly (web) | Entrada | O app não tem cookie de navegador; o SecureStore é o cofre do sistema | Ninguém |
| P2 | Google pelo navegador do sistema (app) × troca de página (web) | Entrada | O Google não aceita login em WebView embutida | Ninguém |
| P3 | Voltar do aparelho fecha cartões e caixas como "Cancelar" e volta uma tela; na web valem o Esc e o histórico do navegador. No iPhone, o mesmo voltar vem pelo gesto da borda (P17) | Todas | Navegação do sistema Android | Ninguém |
| P4 | O app reserva a área segura (entalhe, Dynamic Island, barra de gestos e de início): nada fica atrás da ilha | Todas | Bordas do aparelho; na prévia web valem 0 | Ninguém |
| P5 | O app sobe o conteúdo para o campo em foco ficar acima do teclado; Enter para verificar existe só na web | Campos e exercícios | Teclado virtual × teclado físico; no aparelho, a tecla de envio do teclado envia a lacuna | Ninguém |
| P6 | Anúncios e foco do leitor de tela: `accessibilityLiveRegion`, `announceForAccessibility` e foco do TalkBack (app) × `aria-live` e foco do teclado (web) | Todas | APIs de acessibilidade de cada plataforma; o texto anunciado é o mesmo | Ninguém |
| P7 | Link "Ir para o conteúdo" só na web | Todas | Atalho de Tab do teclado; no app o TalkBack navega por títulos e controles | Ninguém |
| P8 | Área de toque de 48 dp nos alvos pequenos (selo [1], "•••", "Sair"), com o desenho igual ao da web | Várias | Regra de acessibilidade do Android; a área cresce por fora (`hitSlop`), sem mudar o desenho | Ninguém |
| P9 | Seletor de arquivo, câmera e pedido de microfone do sistema | Material, Explique | DocumentPicker, ImagePicker e permissão do Android × `input type=file` e permissão do navegador; botões e textos iguais | Ninguém |
| P10 | Alça de redimensionar o campo de texto só na web | Explique | Recurso do navegador; o TextInput nativo não tem | Ninguém |
| P11 | Fontes TTF variáveis pelo expo-font (app) × WOFF2 (web). A quebra equilibrada dos títulos (`text-wrap: balance`) vem do `textBreakStrategy` do Android; o iOS e a prévia web quebram como sempre | Todas | Formato de fonte e motor de texto de cada plataforma | Ninguém. Conferir no aparelho se o peso pedido pela fonte variável aparece; se não aparecer, carregar arquivos estáticos por peso |
| P13 | Ícones da moldura como SF Symbols no iPhone: barra de baixo (a aba selecionada preenchida), botões de ícone do cabeçalho (X da aula, olho da senha) e a seta dos botões. Os ícones de conteúdo (nós do mapa, etapas da aula, blocos da conclusão) seguem iguais aos da web | Todas, no iPhone | Ícones do sistema iOS (`expo-symbols`); no Android e na prévia web, os desenhos de hoje | Ninguém |
| P14 | No iOS 26 ou mais novo, a barra de baixo, o rodapé neutro e a faixa fixa do mapa ficam sobre Liquid Glass, sem o fundo branco e sem as linhas. O rodapé verde ou laranja do retorno mantém a cor | Barras, no iPhone | Material do sistema iOS 26 (`expo-glass-effect`); no iOS anterior, no Android e na prévia web, o fundo de hoje | Ninguém |
| P15 | Confirmações ("Sair", "Apagar trilha") pelo alerta do sistema, com o mesmo texto e as mesmas ações: "Cancelar" e a confirmação, em vermelho quando apaga | Minhas trilhas, mapa, no iPhone | Alerta do sistema iOS (`Alert`); no Android e na web, o cartão de hoje | Ninguém |
| P16 | Menu "•••" do cartão como folha de ações do sistema, com o nome da trilha no alto, "Apagar" em vermelho e "Cancelar" | Minhas trilhas, no iPhone | Folha de ações do iOS (`ActionSheetIOS`); no Android e na web, o balão de hoje | Ninguém |
| P17 | Gesto de voltar no iPhone: arrastar da borda esquerda para a direita faz o mesmo que o voltar do Android, pela mesma função de cada tela: da aula volta ao mapa da trilha, da geração cancela com o mesmo aviso, da recuperação de senha volta à entrada; se um voltar passar a pedir confirmação, o gesto abre a mesma. Onde não há para onde voltar (Minhas trilhas, entrada), o gesto não começa. Só começa nos primeiros 20 pt da esquerda e falha se o dedo anda 12 pt na vertical antes de 10 pt para a direita, então não disputa com rolagem; no carrossel da apresentação, que ocupa a largura toda, fica desligado (o arrasto é do carrossel). A tela acompanha o dedo até 42 pt (parada com movimento reduzido), sem a tela anterior por baixo; com o VoiceOver, o escape (dois dedos em "Z") chama o mesmo voltar. Não age dentro das janelas sobrepostas (janela do nó), que fecham pelos próprios botões | Todas, no iPhone | Gesto de voltar do iOS; o app ainda não usa a pilha nativa de telas, então o gesto vem de `react-native-gesture-handler` e chama o voltar do app (`voltar.ts`). No Android e na prévia web, nada muda | Ninguém |
| V1 | A conversa ao vivo do Explique só aparece na prévia web do app; no aparelho, a opção fica escondida e o Explique segue com "Gravar" e o texto | Explique | O WebRTC nativo pede um módulo próprio (react-native-webrtc) e um build novo; por decisão do Lead, sem dependência nativa nesta versão. Na prévia, o transporte é o WebRTC do navegador, no mesmo fluxo da web | App, quando o módulo nativo entrar |

## O que não é diferença de tela

- "Esqueci minha senha" e "Experimentar sem conta" aparecem conforme `/api/auth/config`, com a mesma regra nos dois. No site, recuperação e visitante estão desligados.
- Trilhas da conta, textos gerados pela IA e a ordem das opções (sorteada por sessão, com a mesma regra em `aula.tsx` e `licao.tsx`) mudam de um ambiente para outro.
- As ondas do mapa (começo da trilha e fronteira entre partes) usam no app os mesmos caminhos SVG da web, com `react-native-svg` (pedido 6779fab3): não há mais o "V" sob a faixa "Parte N" nem nas colinas da geração. Ícones, olho de mostrar senha, colinas da entrada (elipses de CSS na web), morro do troféu e a estrada até ele seguem desenhados com Views, no mesmo desenho da web.
- Animações em andamento na hora da captura: o balão "Começar" flutua 4 a 5 px e a estrela do pedido cintila, nos dois.
- No balão do nó atual, um espaço de largura zero separa a ação do título. Assim o texto visível continua contido no nome acessível ("Começar: <título>. Lição X de Y, atual."), no formato da web 4.6.

## Como conferir

- Os pares lado a lado (web à esquerda, app à direita), em 390×844 e 360×800, e as medidas automáticas (texto, fonte, peso, cor, caixa, o que fica parado e o que rola) de cada rodada ficam na pasta de trabalho de quem entrega, só até o Lead aceitar a entrega (regra de disco de 18/11). As pastas antigas de `studoo-ui-capturas/` (pares, medidas e o levantamento com as classes) foram apagadas na limpeza de disco de 18/11; esta tabela é o que vale.
- Desde o pedido 5a5d2e21, as capturas são em repouso (movimento reduzido nos dois lados) e a ferramenta compara também a caixa visual (o ancestral com fundo, borda, raio, degradê ou sombra): bordas por lado, estilo da borda, degradê, degrau por fora, contorno, reticências, tamanho e traço dos ícones, o branco no fim da rolagem e o que é tocável.
- Uma diferença nova que a plataforma obriga entra nesta tabela com o motivo. Qualquer outra diferença é corrigida.
