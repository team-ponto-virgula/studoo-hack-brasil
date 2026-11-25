# Navegação mobile e movimento

## Experiência

Nas telas de topo, a web em celular e o app têm os destinos ao alcance do polegar: **Minhas trilhas** e **Nova trilha**, mais **Explorar** e **Perfil** quando o servidor liga a comunidade e o compartilhamento. A seleção tem fundo claro e uma animação curta no ícone. A barra passa a ser uma cápsula que flutua sobre o conteúdo, com a aba selecionada em uma superfície arredondada; a regra vigente está em "Barra de abas em cápsula", abaixo, atualizada para Jornada Azul em 25/11. A navegação fica fora da aula, da apresentação e da geração, que têm suas próprias ações. Em desktop, a web mantém a barra lateral.

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

**Estado:** regra de design de 19/11, atualizada pela escolha Jornada Azul em 25/11/2026; integração em andamento e conferência de produto a consolidar. Sem nova declaração de validação no aparelho.

**Pedido original do dono (19/11).** A barra de baixo deve parecer a do WhatsApp: uma cápsula só, que flutua acima da área de gesto, com espaço visível dos lados e embaixo, e a aba selecionada numa subcápsula. Os ícones e os textos são os do Studoo. No iPhone, o material é o Liquid Glass do sistema quando o aparelho tem. A captura que ele mandou não entra no repositório; esta descrição basta.

**Escolha vigente (25/11).** Na Jornada Azul, a navegação mantém a posição flutuante, a altura-base de 62, as medidas de toque, os nomes/ícones, a ordem, o crescimento com texto e a reserva de área segura. O contorno externo passa de raio 31 a **24**, e a aba selecionada passa de 27 a **16**, com fundo azul suave `#EDF3FF` e tinta de ação `#2457DD`; as demais usam `#50607A`. A alteração vale igualmente para web móvel, Android e iPhone e aproxima a barra da família de cartões/ações do Studoo. Não é uma nova exceção de plataforma nem muda os controles de foco/teclado. A geometria anterior permanece no [registro histórico](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/8c057241f6fc4820f36c284218a4f04affa59543/docs/specs/05-navegacao-mobile-movimento.md). A revisão da integração deve conferir os pares e contrastes reais; números de contraste do desenho anterior não são provas da nova candidata.

**O que não muda.**
- Onde a barra aparece: nas telas de topo (Minhas trilhas e o mapa de uma trilha, Nova trilha, Explorar, Perfil e as telas abertas a partir deles, P22 da spec 07), também sem trilhas (spec 04, banca, item 5). Fica fora da aula, da apresentação, da geração e da entrada. Some com o teclado aberto.
- Os destinos e a ordem: Minhas trilhas, Nova trilha, Explorar (só com `comunidade`) e Perfil (só com `compartilhar`). São 2, 3 ou 4 abas, conforme o servidor; a contagem não muda durante o uso.
- Os nomes, os ícones (livro, lâmpada, bússola e pessoa; SF Symbols no iPhone, P13 da spec 07) e o que cada aba faz. "Minhas trilhas" fica marcada também no mapa de uma trilha. Com uma ação em andamento (`ocupado`), as abas ficam desligadas.
- "Nova trilha" aparece uma vez só: sem botão flutuante de "+" e sem repetir a ação no pé de Minhas trilhas.
- O rodapé das lições, o da geração e o da apresentação continuam colados na borda de baixo, com a área segura dentro (spec 04, "Barras de baixo"; P14 da spec 07). Só a barra de abas flutua.

**Geometria (texto em 100%).** É a mesma na web até 767 px, no Android e no iPhone.
- **Cápsula:** 16 de margem dos lados. Com área segura lateral, a margem é `max(16, área segura + 8)`. Largura máxima de 480, centrada.
- **Distância da base:** 8 acima da área segura de baixo, e nunca menos de 16 da borda. Os 16 valem onde a área segura é 0, como no navegador e no Android com botões. No iPhone com barra de início (34), a base fica a 42 da borda.
- **Altura mínima:** 62 (respiro de 4, aba de 54, respiro de 4), com raio 24. Cresce com as linhas do rótulo e sua altura medida reserva o conteúdo.
- **Abas:**
  - A largura é dividida em colunas iguais (`flex: 1 1 0`), inclusive nas quatro abas. O texto pode quebrar dentro de cada coluna; nenhum rótulo invade o vizinho.
  - Mínimo de 48 × 54 por aba, sem vão entre elas. O toque de cada aba vai até a borda da cápsula, incluindo os 4 de respiro, e não há faixa morta.
  - Por dentro: respiro de 6, ícone de 24 em cima, vão de 2 e rótulo em Nunito 800 de 13/17, centrado, com as linhas necessárias.
- **Aba selecionada:** a superfície preenche a aba, com raio 16, dentro do contorno externo de raio 24. O fundo é `#EDF3FF`, com ícone cheio e rótulo em `#2457DD`. As outras abas têm ícone de contorno e rótulo em `#50607A`. O estado selecionado continua explicitado por semântica, além da cor.
- **Por que as colunas são iguais:** a revisão real em fonte 200% encontrou rótulos sobrepostos na distribuição anterior por tamanho de palavra. As colunas têm alvos previsíveis; o texto quebra e a barra cresce, sem limitar a ampliação.

**Material.**
- **iPhone com iOS 26 ou mais novo, sem "Reduzir transparência":** Liquid Glass do sistema (`GlassView`, `glassEffectStyle="regular"`, `colorScheme="light"`), sem contorno e sem sombra próprios, porque o vidro já tem os dele. A superfície selecionada `#EDF3FF` é opaca, para o rótulo não depender do que passa por baixo. No aparelho, confira o contraste de `#50607A` sobre o vidro com o mapa e os cartões coloridos atrás. Se ficar abaixo de 4,5:1, clareie o vidro com `tintColor` branco, começando em `rgba(255, 255, 255, 0.5)`.
- **iOS anterior, iOS com "Reduzir transparência", Android e web estreita:** superfície #FFFFFF opaca, sem desfoque. O contorno é de 1 px `rgba(11, 27, 92, 0.10)`, desenhado por fora, sem ocupar espaço. A sombra é leve. Na web: `box-shadow: 0 0 0 1px rgba(11,27,92,.10), 0 8px 24px rgba(11,27,92,.14)`; no app, a mesma lista em `boxShadow`. O app lê "Reduzir transparência" em `AccessibilityInfo.isReduceTransparencyEnabled()` e acompanha o evento `reduceTransparencyChanged`, trocando o material na hora.

**Texto ampliado e telas estreitas (Jornada Azul, 25/11).**
- O rótulo acompanha o tamanho de texto do sistema sem cap1,3× e sem limite de linhas. O ícone continua24. Na web, fonte em rem e `overflow-wrap:anywhere`; no app, Text sem `numberOfLines` ou `maxFontSizeMultiplier` para a navegação.
- As quatro colunas conservam mínimo48×54. Com as linhas necessárias, todas acompanham a altura da mais alta, alinhando os ícones pelo topo. A cápsula mantém raio24 e seleção16.
- A medida da barra, incluindo seu crescimento, reserva o fim da rolagem e reposiciona as ações presas. Texto ampliado não fica por baixo da barra.
- A prova anterior de esboço em130% é histórica e não certifica o novo controle; o relatório da implementação vincula as capturas reais100/200% e distingue web/RNWeb de aparelho.

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

## "Minhas trilhas" sem trilhas (pedido do dono, 20/11)

**Estado:** regra de design de 20/11, para a candidata do TestFlight. Vale para web, Android e iPhone. Ainda não implementada.

**Pedido do dono:** "Quando eu logo clico em minha trilha e eu não tenho trilha, não dá nenhum pop-up, não dá nada. Então coloque alguma reação quando não tiver trilha e clicar em minha trilha."

**Hoje:** na web, sem trilhas, a tela `planos` desenha o mesmo formulário de "Nova trilha" (`src/app/estudo.tsx`, `<Pedido … avisoSemTrilhas>`). A aba "Nova trilha" continua marcada (`abaNovaTrilha`). Para quem toca em "Minhas trilhas", só aparece a frase `planos.semTrilhas`, fácil de não ver.

**Decisão:** é um estado vazio da própria aba, sem aviso flutuante e sem janela. A troca de tela já é a resposta: a aba tocada fica marcada, e o conteúdo muda para o vazio com o Stu. Um aviso por cima repetiria a mesma frase e sumiria sozinho.

1. **Ao entrar continua igual** (regra do dono de 19/11). Depois de entrar, criar conta ou começar como visitante, sem trilhas, a tela é a "Nova trilha", com o foco no campo e a aba "Nova trilha" marcada. A abertura sem trilhas vai para `objetivo`, e não para a lista. O estado vazio só aparece quando a pessoa pede "Minhas trilhas".
2. **Ao tocar em "Minhas trilhas" sem trilhas:**
   - a aba "Minhas trilhas" fica marcada (`aria-current="page"` na web; `selected` no app), com o 0,85 → 1 do ícone (260 ms, seção "Barra de abas em cápsula");
   - o alto da tela é o de sempre: o título "Minhas trilhas" (`planos.titulo`), sem o subtítulo da lista;
   - embaixo, o bloco vazio, igual ao vazio do Explorar (spec 13), de cima para baixo:
     - o `stu-curioso` de 96, com o halo lavanda e o flutuar da spec 13;
     - "Nenhuma trilha ainda" (`planos.vazioTitulo`), no estilo de subtítulo de seção;
     - "Suas trilhas ficam aqui. Conte o que quer aprender e o Studoo monta a primeira." (`planos.vazioTexto`, 16/24, `#5E6A85`);
     - o botão principal "Criar minha primeira trilha" (`planos.vazioAcao`), com 48 px, na largura do conteúdo.
   - O botão abre a "Nova trilha" com o foco no campo. O que a pessoa já tinha escrito continua lá.
   - O formulário de pedido e a frase `planos.semTrilhas` saem da tela `planos`; a frase sai do contrato.
3. **Movimento:**
   - o bloco entra subindo 8 px e aparecendo em 200 ms, e depois o Stu flutua;
   - tocar de novo em "Minhas trilhas" com o vazio na tela faz o Stu dar um pulo (sobe 8 px e volta, 300 ms) e leva a tela ao topo;
   - com movimento reduzido, nada se mexe: a troca é imediata e o Stu fica parado.
4. **Som:** nenhum som novo. As abas não têm efeito na spec 12, e um som só nesta aba ficaria isolado.
5. **Leitor de tela:**
   - o foco vai para o título "Minhas trilhas", como nas outras trocas de seção;
   - a região educada anuncia "Nenhuma trilha ainda.";
   - o Stu é decorativo, e o botão se chama "Criar minha primeira trilha".
6. **Tela larga (navegação lateral):** o mesmo. "Minhas trilhas" fica marcada na lateral, e o bloco vazio fica na coluna do conteúdo, alinhado à esquerda, com até 560 px.
7. **Com a primeira trilha** (pronta, ou ainda sendo criada), "Minhas trilhas" mostra a lista de sempre.
8. **Onde mais:** o botão "Minhas trilhas" do alto, onde ele existe (por exemplo, o `meus-planos` do app), leva ao mesmo estado.
9. **A barra de abas aparece também sem trilhas** (spec 04, banca, item 5; spec 07). No app, `comNavegacaoAgora` (`apps/mobile/src/estudo.tsx`) ainda exige `planos.length > 0`. Sem a barra, não há "Minhas trilhas" para tocar: o app precisa seguir a regra.

**Textos novos** (contrato, `planos`): `vazioTitulo` "Nenhuma trilha ainda"; `vazioTexto` "Suas trilhas ficam aqui. Conte o que quer aprender e o Studoo monta a primeira."; `vazioAcao` "Criar minha primeira trilha". Sai `semTrilhas`.

**Spec 07:** nenhuma diferença de plataforma.

**Aceite** (web em 390 e 1440; app na prévia e no iPhone do TestFlight; conta nova sem trilhas):

| # | Passos | Esperado |
|---|---|---|
| V1 | Entra com a conta nova | "Nova trilha" com o foco no campo; aba "Nova trilha" marcada |
| V2 | Toca em "Minhas trilhas" | Aba "Minhas trilhas" marcada; título, Stu curioso, "Nenhuma trilha ainda", o texto e "Criar minha primeira trilha"; sem formulário |
| V3 | Escreve no campo, vai a "Minhas trilhas" e toca em "Criar minha primeira trilha" | Volta à "Nova trilha", com o foco no campo e o texto mantido |
| V4 | Toca de novo em "Minhas trilhas" no vazio | O Stu pula uma vez |
| V5 | Movimento reduzido | Troca imediata, sem pulo |
| V6 | Leitor de tela em V2 | Foco no título; anúncio "Nenhuma trilha ainda." |
| V7 | 1440, navegação lateral | Mesmo bloco, com "Minhas trilhas" marcada na lateral |
| V8 | Cria a primeira trilha | "Minhas trilhas" mostra a lista |

Teste de cada dev: com zero trilhas, a tela `planos` mostra o bloco vazio (`planos-vazio`), sem o pedido, com a aba "Minhas trilhas" marcada; a abertura sem trilhas continua em `objetivo`.

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
