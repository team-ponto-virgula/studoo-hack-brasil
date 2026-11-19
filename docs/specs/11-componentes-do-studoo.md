# Componentes do Studoo no lugar dos do sistema

**Estado:** regra de design de 19/11, pedido 4 do Lead. Vale para web, Android e iPhone, com a mesma anatomia, medidas, textos, foco e movimento. Parte da regra do dono “nada de janela nativa” (spec 07, “Sem janelas do sistema”), que lista o pouco que continua do sistema. Esboço: `componentes-390.png`, na pasta de trabalho do Designer (`ux/04-componentes`).

Hoje a web tem dois menus (o balão do Explorar, que abre em cima, e o `details` de Minhas trilhas) e duas confirmações (a folha com título, `DialogoConfirmar`, e o `.modal-cartao`, com a mensagem toda em negrito e sem título). Cada componente abaixo passa a ser um só, nas três plataformas.

## Menu de ações

**Onde.** No “•••” dos cartões (Minhas trilhas, Explorar e perfil) e em qualquer lista curta de ações, até cinco. Com mais de cinco, ou com conteúdo além de ações, usa-se a folha.

**Botão.** 44 × 44 px, raio de 12, três pontos de 4 px `#5E6A85` com 4 px entre eles. Aberto, ganha o fundo `#F1F4FD`. O nome acessível é “Mais opções de “<título>””, com `aria-haspopup="menu"` e `aria-expanded`.

**Balão.** Largura mínima de 200 px e máxima de 280; respiro de 6; borda de 1 px `#E1E7FA`; raio de 16; fundo branco; sombra `0 12px 28px rgba(15, 23, 42, .18)`. Abre embaixo do botão, alinhado pela direita, a 6 px. Se faltar espaço embaixo (menos de 8 px até a borda da tela ou até a barra de abas), abre em cima. Fica sempre a 8 px das bordas da tela.

**Item.** Altura de 48 px, 12 px de respiro dos lados e raio de 10. Ícone de 20 px à esquerda, a 12 px do texto. Texto em Nunito 800 de 16 px, `#1B2A5E`. Com o dedo ou o mouse em cima, fundo `#F1F4FD`; com o foco pelo teclado, anel de 3 px `#3858D6` por dentro. A ação de perigo (Apagar, Denunciar) vem sempre por último, em `#C23B4E` (texto e ícone), depois de uma linha de 1 px `#E1E7FA` com 6 px acima e abaixo; num menu só com ela, não há linha.

**Ordem e textos.** Minhas trilhas: “Compartilhar”, “Configurações”, “Apagar”. Explorar e perfil de outra pessoa: “Denunciar”.

**Comportamento.**
- Abrir leva o foco ao primeiro item. As setas para cima e para baixo andam pelos itens, com volta; Home e End vão às pontas; Enter ou Espaço escolhem; Esc e Tab fecham e devolvem o foco ao “•••”.
- Tocar fora fecha sem escolher, e esse toque não aciona o que estiver embaixo.
- Escolher fecha o balão e só depois abre o destino: a folha, a tela ou a confirmação. No iPhone, isso acontece depois que o balão sai, como em `janelas.ts`.
- Web: `role="menu"` e `menuitem`, sem texto a mais: o leitor de tela já diz "menu" e a posição de cada item. App: o balão é um contêiner com o rótulo "Menu, N opções" ("Menu, 1 opção" no singular; chave nova `componentes.menuRotulo(n)`), e o foco do leitor vai para ele ao abrir (`AccessibilityInfo.setAccessibilityFocus`, com `accessibilityViewIsModal` no iOS); cada item é um botão com o próprio texto. (Detalhado em 19/11.)

**Movimento.** Entra em 160 ms, com a opacidade de 0 a 1 e a escala de 0,96 a 1 a partir do canto do botão (curva 0,2, 0,9, 0,3, 1); sai em 120 ms, só com a opacidade. Com movimento reduzido, só a opacidade, em 120 ms.

## Confirmação

**Onde.** Antes de toda ação que não se desfaz ou que perde algo: apagar a trilha, sair da conta, parar de compartilhar, remover a foto, sair sem salvar e recomeçar a lição do zero.

**Fundo e cartão.** Véu `rgba(15, 23, 42, .45)` na tela toda; tocar no véu é o mesmo que “Cancelar”, menos enquanto a ação é enviada. O cartão fica no centro, com largura `min(100% − 32 px, 400 px)`, respiro de 24, raio de 24, borda de 2 px `#E1E7FA`, sombra `0 20px 48px rgba(15, 23, 42, .24)` e 12 px entre os blocos.

**Conteúdo, nesta ordem.**
1. Título: a pergunta, curta, em Quicksand 700 de 20/26, `#1B2A5E`, em até três linhas. Por exemplo, “Apagar “Receitas de família, medidas certas”?”.
2. Texto: uma ou duas frases sobre o que acontece, em Nunito 400 de 16/24, `#5E6A85`.
3. Aviso a mais, se houver, num parágrafo à parte (como o do link de compartilhamento).
4. Ações.

**Ações.** Ficam lado a lado, cada uma com metade da largura e 8 px entre elas: “Cancelar” (secundário) à esquerda e a ação (primária) à direita. Quando a ação destrói algo, ela é vermelha cheia: `#C23B4E`, texto branco e degrau `#8F2A39`. Se um rótulo não cabe na metade (16 px 800, com 18 px de respiro), as duas ficam uma por linha, com a ação em cima. O rótulo da ação repete o verbo do título (“Apagar”, “Sair”, “Parar de compartilhar”); nunca é “OK” nem “Sim”.

**Foco e leitor de tela.** O cartão abre com o foco em “Cancelar”, a ação segura. O Tab fica preso no cartão. Esc, o voltar do Android e o Z de dois dedos do iOS cancelam. Ao fechar, o foco volta ao botão que abriu. Na web, `role="alertdialog"` e `aria-modal`, com o título como rótulo e o texto como descrição; no app, o leitor começa pelo título.

**Enviando e erro.** Enquanto envia, a ação mostra o gerúndio com um giro (“Apagando…”), os dois botões ficam desligados e o véu não fecha. Se der erro, o cartão continua aberto e mostra, em `#C23B4E` 15 px 800 e acima das ações: “Não deu para apagar agora. Confira a conexão e tente de novo.”

**Movimento.** O véu entra em 200 ms. O cartão entra em 220 ms, com a opacidade e a escala de 0,96 a 1, e sai em 150 ms. Com movimento reduzido, só a opacidade.

**O que sai.** O `.modal-cartao` da web, com a mensagem toda em negrito e sem título, dá lugar a esta confirmação em todas as telas. No app, o `CartaoConfirmacao` passa a sempre ter título e texto.

## Aviso

**Onde.** No retorno de uma ação que não pede decisão: “Capa salva.”, “Perfil salvo.”, “Link copiado.”, o aviso da primeira curtida e os erros de rede de uma ação de toque, como “Não deu para curtir agora.”. Não serve para confirmar algo destrutivo nem para erro de campo: o erro de campo fica embaixo do campo.

**Faixa.** Largura `min(100% − 32 px, 480 px)`, centralizada, 16 px acima da barra de abas; onde não há barra, 16 px acima da borda de baixo, com a área segura. Fundo `#1B2A5E`, texto branco em Nunito 800 de 15/22, respiro de 12 × 16, raio de 16 e sombra `0 12px 30px rgba(15, 23, 42, .28)`. Ícone de 20 px à esquerda: visto no acerto, alerta no erro e coração na curtida.

**Ação.** No máximo uma, em texto à direita, `#AFC2FF` em 15 px 800, com área de toque de 44 px: “Tentar de novo”, “Desfazer” ou “Ver”. Nunca uma ação que destrói algo.

**Tempo.** Some em 4,5 s, ou em 7 s quando tem ação. O tempo para enquanto o mouse está em cima ou o foco está no aviso. No toque, arrastar para baixo dispensa. Só há um aviso por vez: o novo entra no lugar do antigo na hora.

**Movimento.** Sobe 10 px com a opacidade em 220 ms e sai em 160 ms. Com movimento reduzido, só a opacidade.

**Leitor de tela.** Na web, `role="status"` com `aria-live` educado; no app, `announceForAccessibility`. O aviso nunca leva o foco.

## Folha

A folha de hoje fica como está (`.folha` e `.folha-fundo`): sobe de baixo até 767 px e vira um cartão no centro a partir de 768 px, com até 480 px de largura, até 92% da altura, raio de 24 e entrada de 260 ms. No toque, ela ganha a alça de 40 × 5 px no alto, e arrastar a folha 80 px para baixo fecha. Esc e o véu fecham. O título tem o X de 44 px à direita.

## Alvos e texto auxiliar (19–20/11)
Vale para todos os componentes: botões de texto e links de ação têm área de 44×44 px no mínimo, e o texto auxiliar tem 13 px (metadados) ou 14 px (dicas) no mínimo, sem opacidade. Medidas na spec 04, "Revisão de banca da noite", itens 9 e 10.
