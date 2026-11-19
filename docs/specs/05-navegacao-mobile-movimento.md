# Navegação mobile e movimento

## Experiência

Nas telas de topo, a web em celular e o app têm os destinos ao alcance do polegar: **Minhas trilhas** e **Nova trilha**, mais **Explorar** e **Perfil** quando o servidor liga a comunidade e o compartilhamento. A seleção tem fundo claro e uma animação curta no ícone. A barra passa a ser uma cápsula que flutua sobre o conteúdo, com a aba selecionada numa subcápsula; a regra está em "Barra de abas em cápsula", abaixo, e ainda está em implementação. A navegação fica fora da aula, da apresentação e da geração, que têm suas próprias ações. Em desktop, a web mantém a barra lateral.

Em Minhas trilhas, **Seu próximo passo** destaca a primeira trilha em andamento na ordem da lista. Se nenhuma foi iniciada, destaca a primeira não concluída. **Retomar trilha** abre o caminho e permite continuar pela lição disponível. A contagem de lições concluídas soma os planos salvos; não é XP nem uma métrica inventada. Se todos foram concluídos, o destaque convida a revisar ou criar outro assunto.

Se a proposta tem o mesmo nome de uma trilha que a pessoa já tem, a tela avisa e oferece **Abrir a que já existe**. Cada cartão tem **Apagar**, discreto, depois da ação principal: pede confirmação (as lições e o progresso da trilha vão junto) e, sem trilhas, a tela volta ao pedido. A ação de criar trilha não fica duplicada no rodapé de Minhas trilhas. Nas outras telas, a ação principal fica acima da navegação. As áreas seguras são respeitadas. Ao digitar, a navegação some; na web, a ação do formulário volta ao fluxo da página. No app, arrastar o conteúdo fecha o teclado.

## Movimento e acessibilidade

- Botões nativos têm uma resposta de escala curta no conteúdo, sem alterar a posição ou o tamanho da área de toque. Soltar ou cancelar o toque retorna ao tamanho normal. Ações ocupadas não aceitam novos toques.
- A seleção da navegação anima uma vez, com escala de 0,85 a 1. Os rótulos e o estado selecionado continuam disponíveis para tecnologia assistiva.
- `apps/mobile/src/movimento.ts` compartilha uma consulta de preferência e duas assinaturas nativas entre todos os componentes. Não cria um listener por árvore, confete ou botão.
- O app suspende o movimento ao entrar em segundo plano. Ao retornar, respeita a preferência atual. Uma resposta assíncrona antiga não sobrescreve um evento novo de acessibilidade.
- Sem resposta da preferência, as animações aguardam. Se a consulta falhar, a interface usa o estado estático. Tremores e pulos interrompidos voltam à posição neutra.
- Na web, animações CSS são pausadas em abas ocultas. Movimento reduzido preserva conteúdo, progresso, seleção e ações sem os efeitos de movimento.
- A entrada lateral das telas não cria rolagem horizontal temporária.

## Barra de abas em cápsula (pedido do dono, 19/11)

**Estado:** regra de design, em implementação na web e no app; ainda sem validação no aparelho.

**Pedido do dono.** A barra de baixo deve parecer a do WhatsApp: uma cápsula só, que flutua acima da área de gesto, com espaço visível dos lados e embaixo, e a aba selecionada numa subcápsula. Os ícones e os textos são os do Studoo. No iPhone, o material é o Liquid Glass do sistema quando o aparelho tem. A captura que ele mandou não entra no repositório; esta descrição basta.

**O que não muda.**
- Onde a barra aparece: nas telas de topo (Minhas trilhas e o mapa de uma trilha, Nova trilha, Explorar, Perfil e as telas abertas a partir deles, P22 da spec 07), também sem trilhas (spec 04, banca, item 5). Fica fora da aula, da apresentação, da geração e da entrada. Some com o teclado aberto.
- Os destinos e a ordem: Minhas trilhas, Nova trilha, Explorar (só com `comunidade`) e Perfil (só com `compartilhar`). São 2, 3 ou 4 abas, conforme o servidor; a contagem não muda durante o uso.
- Os nomes, os ícones (livro, lâmpada, bússola e pessoa; SF Symbols no iPhone, P13 da spec 07) e o que cada aba faz. "Minhas trilhas" fica marcada também no mapa de uma trilha. Com uma ação em andamento (`ocupado`), as abas ficam desligadas.
- "Nova trilha" aparece uma vez só: sem botão flutuante de "+" e sem repetir a ação no pé de Minhas trilhas.
- O rodapé das lições, o da geração e o da apresentação continuam colados na borda de baixo, com a área segura dentro (spec 04, "Barras de baixo"; P14 da spec 07). Só a barra de abas flutua.

**Geometria (texto em 100%).** É a mesma na web até 767 px, no Android e no iPhone.
- **Cápsula:** 16 de margem dos lados. Com área segura lateral, a margem é `max(16, área segura + 8)`. Largura máxima de 480, centrada.
- **Distância da base:** 8 acima da área segura de baixo, e nunca menos de 16 da borda. Os 16 valem onde a área segura é 0, como no navegador e no Android com botões. No iPhone com barra de início (34), a base fica a 42 da borda.
- **Altura:** 62 (respiro de 4, aba de 54, respiro de 4), com raio 31.
- **Abas:**
  - A largura vem do rótulo, e a sobra da cápsula é dividida igualmente entre as abas: `flex: 1 1 auto`, e `flex-shrink: 0` nos rótulos de uma palavra.
  - Mínimo de 48 × 54 por aba, sem vão entre elas. O toque de cada aba vai até a borda da cápsula, incluindo os 4 de respiro, e não há faixa morta.
  - Por dentro: respiro de 6, ícone de 24 em cima, vão de 2 e rótulo em Nunito 800 de 12/15, centrado, numa linha.
- **Aba selecionada:** a subcápsula preenche a aba, com raio 27 (concêntrico com o 31 da cápsula). O fundo é #E9E7FF (o fundo de "selecionado" da spec 13, §B5), com ícone cheio e rótulo em #1D4ED8 (5,53:1). As outras abas têm ícone de contorno e rótulo em #5E6A85 (5,42:1 no branco).
- **Por que a largura vem do rótulo:** com abas iguais em 390, "Minhas trilhas" (81 px em 12) não cabe numa linha. Com a largura pelo rótulo, as quatro abas cabem numa linha a partir de 320 (94 + 76 + 62 + 48 = 280, a largura útil da cápsula).

**Material.**
- **iPhone com iOS 26 ou mais novo, sem "Reduzir transparência":** Liquid Glass do sistema (`GlassView`, `glassEffectStyle="regular"`, `colorScheme="light"`), sem contorno e sem sombra próprios, porque o vidro já tem os dele. A subcápsula #E9E7FF é opaca, para o rótulo selecionado não depender do que passa por baixo. No aparelho, confira o contraste de #5E6A85 sobre o vidro com o mapa e os cartões coloridos atrás. Se ficar abaixo de 4,5:1, clareie o vidro com `tintColor` branco, começando em `rgba(255, 255, 255, 0.5)`.
- **iOS anterior, iOS com "Reduzir transparência", Android e web estreita:** superfície #FFFFFF opaca, sem desfoque. O contorno é de 1 px `rgba(11, 27, 92, 0.10)`, desenhado por fora, sem ocupar espaço. A sombra é leve. Na web: `box-shadow: 0 0 0 1px rgba(11,27,92,.10), 0 8px 24px rgba(11,27,92,.14)`; no app, a mesma lista em `boxShadow`. O app lê "Reduzir transparência" em `AccessibilityInfo.isReduceTransparencyEnabled()` e acompanha o evento `reduceTransparencyChanged`, trocando o material na hora.

**Texto ampliado e telas estreitas.**
- O rótulo cresce com o tamanho de texto do sistema até 1,3× (15,6/19,5) e para aí: `maxFontSizeMultiplier={1.3}` no app e `font-size: min(0.75rem, 15.6px)` na web. O ícone fica em 24.
- Quando os rótulos não cabem numa linha, os de duas palavras quebram no espaço ("Minhas / trilhas", "Nova / trilha"). Os de uma palavra nunca quebram nem encolhem. As abas ficam com a altura da mais alta, com os ícones alinhados em cima. A cápsula cresce (85 com duas linhas a 1,3×), e o raio continua 31.
- Conferido no esboço do Designer, com a Nunito do projeto, sem nenhum rótulo vazando:

| Tela | Texto | Cápsula | Abas (largura) | Rótulos |
|---|---|---|---|---|
| 320, 4 abas | 100% | 288 × 62 | 94, 76, 62, 48 | uma linha |
| 390, 4 abas | 100% | 358 × 62 | 112, 94, 80, 63 | uma linha |
| 360, 4 abas | 130% | 328 × 85 | 107, 86, 75, 52 | duas linhas nas de duas palavras |
| 320, 4 abas | 130% | 288 × 85 | 85, 68, 75, 52 | duas linhas nas de duas palavras |
| 390, 2 abas | 100% | 358 × 62 | 184, 166 | uma linha |

- Na web, o zoom da página escala tudo. A 320 px de CSS (o refluxo da WCAG), cabe numa linha. A 260 px de CSS (390 com o zoom de 150% do Safari), cabe com duas linhas.

**Fim da rolagem, foco e o que fica preso no pé.**
- O conteúdo rola por baixo da cápsula em todas as plataformas, não só no vidro.
- O fim da rolagem reserva a altura medida da cápsula, mais a distância dela até a borda, mais 16. Assim, o último item e os botões do fim ficam acima dela. A cápsula muda de altura com o texto ampliado, por isso a medida é a de verdade, não um número fixo. No iOS, o indicador de rolagem termina acima da cápsula (`scrollIndicatorInsets`).
- Na web, `scroll-padding-bottom` usa a mesma reserva, para o foco pelo teclado nunca ficar atrás da cápsula (WCAG 2.4.11). No app, um item focado pelo leitor de tela atrás da cápsula rola até ficar acima dela.
- **Ações presas das telas de topo** (o "Continuar" do mapa quando o nó atual sai da vista, a barra de salvar do perfil):
  - Ficam 12 acima do topo da cápsula, com as mesmas margens de 16 e a largura máxima de 480. Deixam de ser faixas coladas na borda nessas telas.
  - Um botão só flutua sozinho, com o degrau e a sombra dele.
  - Mais de um elemento ganha um bloco com a superfície da cápsula, raio 24 e respiro 8. A barra de salvar vira esse bloco, com 64 de altura (8 + botão de 48 + 8), e mantém a linha única da spec 10.
  - A reserva do fim da rolagem soma a altura delas mais 12.
- O aviso do app (spec 11) fica 16 acima da cápsula, ou da ação presa, quando houver.
- Com o teclado aberto, a cápsula some, como hoje, e na web a ação presa volta ao fluxo da página.

**Movimento.**
- Cada tela monta a sua cápsula, então a subcápsula não desliza de uma aba para a outra. Ela aparece já na aba nova, e o ícone dá o 0,85 → 1 de hoje (260 ms).
- Ao pressionar, o ícone vai a 0,9 enquanto o dedo está em cima, sem mexer na área de toque. No app, isso substitui a opacidade de 0,7.
- Com movimento reduzido, a troca é imediata, sem escala.

**Acessibilidade.**
- Continua como hoje: na web, `nav` com o rótulo "Navegação de estudos", botões e `aria-current="page"`; no app, `tablist` com `tab` e `selected`.
- O rótulo fica sempre visível: a aba nunca vira só ícone.
- O foco pelo teclado é um anel de 3 px #2563FF por dentro da subcápsula (`outline-offset: -3px`), para a borda arredondada da cápsula não cortá-lo.
- Os alvos têm no mínimo 48 × 54.

**Verificação.** Esboço com seis casos, na pasta do Designer (`ux/12-barra-de-abas/capsula.png` e `capsula.html`), com a conferência automática de encaixe acima. Não conferido no aparelho. Falta conferir no aparelho: o vidro, o contraste sobre ele, a "Reduzir transparência" e o TalkBack/VoiceOver com a cápsula sobreposta.

## Paridade e verificação

Web e app usam os mesmos textos de retomada e a mesma prioridade de planos. Não há mudança em API, contratos ou banco, nem dependência nativa nova. O mascote não foi substituído nesta mudança.

Verificados nesta implementação:

- `npm run typecheck` e `npm run typecheck --workspace=@studoo/mobile`.
- `npm run test:paridade`: quatro casos, incluindo os textos de retomada.
- `npm run test:movimento`: quatro casos com eventos nativos simulados, cobrindo compartilhamento/limpeza de assinaturas, segundo plano, corrida da consulta e falha da preferência. Incluído no CI.
- `npm run build`.
- Fluxo em Chromium: entrada, apresentação, pedido, geração, aula, resposta incorreta, tentativa correta, conclusão, trilha, planos e retomada. Web com IA falsa e banco local; prévia do app em React Native Web com API simulada.
- Web em 360, 390, 768 e 1440 px; prévia do app em 360 e 390 px. Movimento reduzido, teclado e ausência de erros JavaScript conferidos no navegador.

Capturas e vídeo local ficam em `artifacts/ux-mobile/`. Não foi executado em emulador ou aparelho Android; teclado nativo, TalkBack e desempenho físico ainda precisam dessa validação. Isso segue a regra atual de verificação do projeto.
