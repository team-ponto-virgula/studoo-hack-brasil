# Referências de UI para o Studoo

Levantamento de 17/11/2026 para a rodada de UI do HackBrasil. Reúne apps web e desktop reconhecidos pela interface, o padrão que vale trazer de cada um e onde ele entra no Studoo.

**Como usar.** Trazer o princípio, nunca a aparência. A identidade do Studoo continua (Stu, paleta índigo, Quicksand/Nunito, relevo, mundo ilustrado). A spec 04 proíbe qualquer semelhança com o Duolingo e a D16 proíbe XP, sequência de dias, ranking e moeda.

**Seleção.** A escolha dos apps é curadoria do Studoo Lead (opinião), apoiada em prêmios de design e nos textos em que as próprias equipes explicam suas decisões.

**Confiança das fontes.**
- ✔ página lida por inteiro nesta pesquisa
- ○ só o resumo da busca; página não aberta
- △ análise de terceiros, não é fonte oficial

## 1. Quadro de referências

| App (onde roda) | O que faz melhor | O que trazer para o Studoo | Fonte |
|---|---|---|---|
| **Linear** (web, desktop) | Hierarquia e densidade: o redesenho quis "reduce visual noise" e alinhou rótulos, ícones e botões na barra lateral e nas abas. O tema passou de 98 variáveis para 3 (cor base, cor de destaque, contraste), geradas em LCH. O azul de destaque ficou restrito. | Casca do desktop (barra lateral e topo) e Meus planos; azul de ação só na ação principal; tema gerado por poucas variáveis. | ✔ [How we redesigned the Linear UI](https://linear.app/blog/how-we-redesigned-the-linear-ui) |
| **Raycast** (desktop) | Barra de ação no rodapé com as ações do contexto e o atalho de cada uma, para a pessoa aprender os atalhos. Campo de busca maior porque é o principal da tela. Ícones com a mesma espessura de traço e o mesmo raio. Lema: "fast, simple, and delightful". | Rodapé da aula como barra de ação com as teclas visíveis (1–4, Enter); o campo do pedido como o elemento dominante da tela; ícones coerentes. | ✔ [A fresh look and feel](https://raycast.com/blog/a-fresh-look-and-feel) (2022) |
| **NotebookLM** (web) | A citação no texto leva direto ao trecho do material que sustenta a resposta; também cita imagens, gráficos e diagramas. | Citação clicável na lição que abre o trecho exato do material (página, parágrafo ou linha) em destaque. | ✔ [Blog do Google](https://blog.google/technology/ai/notebooklm-goes-global-support-for-websites-slides-fact-check/) (2024) |
| **Perplexity** (web, desktop) | Marcador numerado ao lado de cada afirmação; passar o cursor ou tocar mostra a fonte; lista de fontes que se expande. | Marcador numerado discreto na frase e lista "Fontes desta lição" recolhível. | △ [Perplexity design breakdown](https://www.925studios.co/blog/perplexity-design-breakdown) |
| **Brilliant** (web, mobile) | O tutor Koji reage ao estado da lição e ao esforço: diferente se a pessoa "breezed through a problem or fought for it". Princípio declarado: tirar o peso do erro e tratar o erro como degrau. A fala é mostrada pelo volume do áudio. Um só personagem para iOS, Android e web. Só resultados qualitativos, sem números. | Estados do Stu ligados à lição (acertou de primeira, acertou depois da ponte, errou); o erro como degrau; o Stu que reage ao volume da voz no Ensine ao Stu; mesmo conjunto de estados na web e no app. | ✔ [Brilliant builds its tutor character with Rive](https://rive.app/blog/brilliant-builds-its-math-and-coding-tutor-character-with-rive) |
| **Things 3** (desktop, mobile) | Uma interação-assinatura (o botão Magic Plus, que se arrasta até onde o item novo deve entrar) e animações que mantêm a pessoa no lugar. O site da Cultured Code diz que o app ganhou dois Apple Design Awards. | Uma interação-assinatura própria do Studoo (a ponte); abrir a lição a partir do nó sem perder o contexto. | ○ [Cultured Code](https://culturedcode.com/) |
| **Figma** (web, desktop) | Torna o tempo real visível: os cursores das outras pessoas aparecem no arquivo. | Tornar a sincronia visível no passo 4 da demo ("atualizado agora" quando o progresso chega de outro aparelho). | ○ [Multiplayer editing in Figma](https://www.figma.com/blog/multiplayer-editing-in-figma/) |
| **Apple Handoff** (desktop, mobile) | Começar num aparelho e continuar no outro de onde parou; um ícone aparece quando há algo para continuar. | Cartão "Continue de onde parou", com a lição e o aparelho de origem, ao abrir no segundo dispositivo. | ○ [Suporte da Apple](https://support.apple.com/102426) |
| **Superhuman** (web, desktop) | "Rather than focus on features that users need, we focus on how software makes a user feel." Brinquedos: partes que dão prazer de explorar mesmo sem objetivo e criam surpresa boa (ex.: o adiar que entende "two d"). | Brinquedos dentro da lição: o acorde que toca, a fração que se parte, a linha do tempo que se arrasta. Combina com a D16: sem pontos nem medalhas. | ✔ [The frameworks behind Superhuman](https://nfx.com/post/superhuman-product-frameworks) |
| **Stripe** (web) | Sistema de cores construído em espaço de cor perceptual, para texto e ícone terem contraste legível em todo o painel. | Escala de cores com contraste AA por construção, em vez de ajustar verde e âmbar à mão. | ○ [Designing accessible color systems](https://stripe.com/blog/accessible-color-systems) |
| **Airbnb** (web, mobile; redesenho de 2025) | Ícones com volume e movimento com significado: ao tocar no ícone da casa, a porta abre e a luz acende. | Um gesto próprio para cada ícone de área de interesse e de tipo de lição (hoje todos pulam igual). | ○ [Bloomberg](https://www.bloomberg.com/news/articles/2025-06-13/apple-airbnb-ditch-flat-app-icons-for-new-3d-ui-design) · [It's Nice That](https://www.itsnicethat.com/articles/airbnb-app-redesign-140525) |
| **Spotify Wrapped** (desktop, mobile) | Resumo pessoal contado em cartões, como uma história; a equipe de produto adaptou a identidade da campanha ao app. | Conclusão da trilha em três cartões: o que aprendeu, a ponte que construiu, o que explicou ao Stu. Sem pontuação. | ○ [Spotify Design](https://spotify.design/article/how-we-brought-2020-wrapped-to-life-in-the-mobile-app) |
| **Arc** (desktop) | A primeira experiência faz sentir o valor em vez de explicar (ligar e desligar os anúncios) e deixa a pessoa escolher cor e estilo. | No primeiro acesso, a pessoa vê a trilha nascer do próprio material antes de qualquer explicação. | △ [Built for Mars](https://builtformars.com/company/arc) |
| **Notion** (web, desktop) | A página nova oferece modelos e sugestões em vez de uma tela em branco; um único sistema de ilustração. | Meus planos nunca vazio: ideias prontas e "Experimentar com frações" no lugar do vazio. | △ [SaaS UI: onboarding do Notion](https://www.saasui.design/pattern/onboarding/notion) |

### Princípios de movimento (Family, app de iOS)

Não é web nem desktop, mas o texto "Family Values" é a melhor explicação publicada de interface fluida. ✔ [Family Values](https://benji.org/family-values)

- **Simplicidade.** Uma coisa por vez: cada bandeja mostra um conteúdo ou uma ação.
- **Fluidez.** "We fly instead of teleport": a tela entra na direção do toque; o elemento que continua existindo viaja de uma tela para a outra em vez de ser trocado; "Continue" vira "Confirm" aproveitando as letras em comum.
- **Encanto na medida.** Quanto mais rara a ação, maior pode ser o momento; o que se repete muito ganha só um toque sutil. Antes disso, acabamento básico em tudo. Cada animação precisa ter função.

## 2. Padrões por momento do roteiro de 2 minutos

**1. Seu próprio material → citação**
- Marcador numerado ao lado da frase da lição que veio do material (Perplexity).
- Ao tocar, abre o trecho exato com realce e a referência "página 2 · parágrafo 3"; no CSV, a linha da tabela; na foto, o recorte (NotebookLM).
- Lista "Fontes desta lição" recolhível no fim.

**2. O erro muda o caminho**
- O Stu reage ao esforço, não só ao resultado: acertar de primeira é diferente de acertar depois da ponte (Brilliant).
- O erro é degrau: o cartão da resposta errada não some, vira a primeira tábua da ponte (Brilliant + Family: o elemento viaja).
- Momento grande para evento raro: a ponte sendo construída e aparecendo no mapa leva a animação maior; verificar uma resposta comum fica sutil (Family).

**3. Ensine ao Stu**
- O Stu ouve: o movimento dele segue o volume da voz durante a gravação (Brilliant).
- Uma coisa por vez: gravar, revisar a transcrição, enviar (Family).
- Na web, barra de ação com os atalhos visíveis (Raycast).

**4. Evidência e outro dispositivo**
- Cartão "Continue de onde parou" com a lição e o aparelho de origem (Handoff).
- Sincronia visível: "atualizado agora" quando o progresso chega de outro aparelho (Figma).
- Conclusão em três cartões, como história (Wrapped), sem pontuação (D16).

**Moldura**
- Meus planos: nunca vazio (Notion); um único destaque de continuar, azul só na ação principal (Linear).
- Barra lateral: densidade e alinhamento (Linear).
- Pedido: o campo é a tela (Raycast).
- Aula: rodapé como barra de ação com atalhos (Raycast).

## 3. Sistema visual

- **Tema por poucas variáveis** (base, destaque, contraste) em espaço perceptual, com contraste AA por construção (Linear + Stripe). Na web dá para usar `oklch()`; no app, calcular os valores e gravar em `tema.ts`.
- **Ícones** com a mesma espessura e o mesmo raio (Raycast) e um gesto próprio por ícone (Airbnb).
- **Movimento**: voar em vez de teletransportar; cada animação com função; grande só no raro (Family).
- **Brinquedos** nas lições (Superhuman).
- **Acessibilidade como parte do show.** Nos Apple Design Awards de 2026, Guitar Wiz venceu em Inclusividade por instruções faladas, texto dinâmico, mais contraste e diferenciação sem cor. O Studoo já tem movimento reduzido e leitor de tela: vale mostrar no pitch.

## 4. O que está sendo premiado agora

Apple Design Awards 2026, anunciados em 2 de junho de 2026: 12 vencedores entre 36 finalistas. ✔ [Apple Newsroom](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)

- **Visual e gráficos:** Tide Guide, por animações próprias e um tema aquático coeso.
- **Interação:** Moonlitt, por ser elegante e fácil de aprender; Sago Mini Jinja's Garden, por controles que dispensam instruções.
- **Inclusividade:** Guitar Wiz (acessibilidade) e Pine Hearts (ajustes de texto, controles, movimento e retorno sensorial).
- **Encanto e diversão:** grug e Is This Seat Taken?.

Lição para o Studoo: tema coeso (o mundo ilustrado), interação que dispensa explicação e acessibilidade contam tanto quanto efeito visual.

## 5. Onde ver telas reais

- [Mobbin](https://mobbin.com/blog/mobbin-vs-refero): biblioteca de telas e fluxos reais de apps web e mobile; a mesma página compara com o Refero, outra biblioteca do tipo. ○
- [SaaS UI: estados vazios](https://www.saasui.design/empty-state-ui-design) e [onboarding do Arc](https://www.saasui.design/pattern/onboarding/arc-browser). △

## 6. O que não trazer

- Aparência, ícones, cores ou textos de outro app. Do Duolingo, nada (spec 04).
- XP, sequência de dias, ranking, moeda, medalhas (D16).
- Efeitos pesados (vidro, desfoque grande) que custem desempenho no Android.
- Modo escuro nesta rodada.

## 7. O que não foi conferido

- Nenhum app foi aberto e usado nesta pesquisa: as descrições vêm dos textos das equipes e de análises.
- As fontes marcadas com ○ e △ não foram lidas por inteiro.
- O segundo texto da Rive sobre o Brilliant (animações de motivação) não carregou.
- Os textos do Raycast (2022) e do NotebookLM (2024) são antigos; a interface pode ter mudado.
