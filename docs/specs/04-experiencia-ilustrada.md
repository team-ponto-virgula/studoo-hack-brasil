# Experiência ilustrada: entrada, apresentação, pedido e mundo da trilha

**Estado:** implementada na web e no app (13/11/2026), em três passadas: o mundo ilustrado; as animações e o retorno da aula; e, com a IA da OpenAI, a tela que escreve as lições. Complementa a [spec 03](03-trilha-ao-vivo.md) sem mudar API, contrato ou banco.

## Problema

A interface funcionava, mas era plana: a entrada não dizia o que o Studoo faz, não havia apresentação para quem chega, as sugestões do pedido puxavam para programação e a trilha era um caminho sobre fundo branco. Queremos a sensação de jornada do caminho do Duolingo, com a cara do Studoo.

## Experiência

1. **Entrada.** Na tela larga, a metade direita é uma paisagem do mundo do Studoo, com o Stu e temas de vários assuntos (violão, inglês, frações, fotografia, SQL, culinária). No celular, a paisagem vira uma faixa acima do título. O formulário confere o e-mail e a senha antes de enviar e mostra o erro no próprio campo; a senha pode ser mostrada, e a web avisa quando o Caps Lock está ativado.
2. **Boas-vindas (app).** Antes da entrada, a mesma paisagem com o Stu, a promessa ("Aprenda qualquer coisa, um passo de cada vez") e três destaques.
3. **Apresentação.** No primeiro acesso de cada navegador ou aparelho, sem planos salvos, cinco passos: o Stu, qualquer assunto, a trilha que nasce, o progresso salvo e, por fim, **O que te interessa?**, em que a pessoa escolhe uma área e o pedido já abre com as ideias dela. Cada passo entra deslizando na direção em que a pessoa anda. Pular encerra a qualquer momento. O pedido tem o link **Como funciona?** para rever, e a barra lateral da web também. A web guarda que a apresentação foi vista no `localStorage` (`studoo.apresentacao`); o app, no SecureStore.
4. **Pedido.** As ideias vêm por área de interesse (Populares, Idiomas, Música, Matemática, Ciências, Tecnologia, Artes, Carreira e Dia a dia), cada uma com um ícone próprio, que pula quando a área é escolhida. **Populares** abre primeiro e mantém **SQL para a prova**. **Surpreenda-me** sorteia uma ideia. O campo vazio mostra exemplos que se escrevem sozinhos, letra por letra; no app, eles param enquanto o campo está em foco. A dica diz "diga o tema, o que você já sabe e aonde quer chegar". Acima do campo, o Stu reage: convida, incentiva enquanto a pessoa escreve e comemora a ideia escolhida, e o campo brilha quando uma ideia é aplicada.
5. **Mundo da trilha.** O caminho passa por um mapa ilustrado. Cada trecho da trilha é uma região, em ciclo: campos, floresta, montanhas, lago, vila e nuvens. Entre um trecho e outro, a região seguinte começa numa fronteira ondulada, e o marco fica sobre ela; ele fica dourado quando o trecho é vencido, e a bandeira acena. O caminho termina no fim do mapa, com o troféu, que fica dourado quando a trilha é concluída. Os nós têm relevo, o rótulo **Começar** flutua sobre o nó atual e o anel dele respira devagar. Cada lição mostra o nome embaixo do nó, para achar uma lição e rever sem tocar uma por uma. Árvores e flores balançam com o vento.
   - **O Stu acompanha a pessoa.** Fica ao lado do nó atual, sobe e desce devagar e acena de vez em quando; com tudo concluído, pula ao lado do troféu. A frase dele vai numa placa de madeira no alto do mapa.
   - **Ao abrir**, os nós caem no lugar em sequência e o cenário brota logo depois.
   - **Na volta de uma lição concluída**, o nó comemora com um pulo e confete, a linha até o próximo se desenha e só então o próximo nó se abre.
   - **Na geração ao vivo**, cada nó cai no lugar assim que chega, sobre o caminho em rascunho, e o esqueleto do próximo gira. Quando a proposta fica pronta, o troféu entra, sem confete ("Geração que se acompanha" e "Criar a trilha", abaixo).
   - **Ao Começar**, um toque salva a trilha e abre a etapa 1 da lição 1, sem tela no meio: o botão mostra "Criando sua trilha…" enquanto a IA escreve as lições, e o nó 1 vira a aula quando o aceite volta ("Criar a trilha", abaixo).
6. **Aula.** A aula por etapas da [spec 02](02-aula-web.md) vale na web e no app. A barra de andamento é grossa e avança com uma mola; cada etapa entra deslizando. O conceito vem num balão do Stu. No exercício de escolha, as opções são cartões com relevo, com as teclas 1, 2, 3… na web e as letras A, B, C… no app; na web, Enter verifica e continua. Depois de **Verificar**, o rodapé vira o painel de retorno: sobe verde no acerto ("Mandou bem!", com confete) ou âmbar no erro ("Quase lá!", e o exercício treme). O Stu reage no próprio painel, na ponta direita da linha do título (spec 13, emenda de 19/11: a reação mora no painel de retorno). No erro, **Tentar de novo** volta ao exercício e **Continuar** segue, como antes.
7. **Conclusão e trilhas.** A lição concluída tem chuva de confete (que some antes dos números e dos botões), raios girando atrás do Stu, que pula, e o resumo da lição: tempo, acertos (de primeira ou quantos exercícios de quantos) e etapas. Se ficou exercício sem acerto, ou a prática em “ainda não”, não há chuva: a conclusão sugere rever a lição. A barra da trilha enche a partir de onde estava. Minhas trilhas mostra cartões com uma faixa do mundo, que entram em sequência, e a ação que cabe: começar, continuar ou rever a trilha. As telas entram com uma subida curta, e os esqueletos brilham enquanto carregam.

## Entrada sem rolar (regra do dono, 19/11; web móvel e app)

Num aparelho de 390 × 844 pt ou maior, a entrada aparece de uma vez, sem rolar: a barra da marca, a ilustração, o título, a descrição, "Ver como funciona", E-mail, Senha inteira com o olho e "Entrar" (e, quando o servidor oferece, "Esqueci minha senha", Google e "Experimentar sem conta"). Mesmos textos e mesma ordem de hoje.

**Altura útil:** a altura da tela menos a área segura de cima e menos o rodapé fixo do "Entrar" (12 + botão de 48 com degrau de 4 + 14, mais a área segura de baixo, que fica dentro dele). Na web móvel, a altura dinâmica da janela (`100dvh`) menos o rodapé fixo.

**Medidas de partida (nível 0):** barra da marca de 60 (58 + a linha de 2); respiro de 24 em cima; ilustração de até 140, com 24 embaixo; título de 32/40 (três linhas a 353 de largura); descrição de 17/25,5; "Ver como funciona" com 44; o formulário a 28 da descrição, cada campo com 81 (rótulo de 21, vão de 8, caixa de 52) e 20 entre os campos; 20 entre o último item e o rodapé.

**O que cede para caber, nesta ordem:**

1. **A ilustração.** Fica com o que sobra, até 140: `altura útil − (todo o resto) − 24`. Ela é recortada de cima (ficam as colinas e o Stu, que diminui junto: largura `(altura − 14) / 1,1`, entre 28 e 72). Abaixo de 44, sai, com a margem de 24. É a primeira a sair e a última a voltar: só aparece no nível 0.
2. **Os espaços (nível 1),** se nem sem a ilustração couber: 16 de respiro em cima, o formulário a 16 da descrição e 12 entre os campos.
3. **O título e a descrição (nível 2):** título de 26/32 (até duas linhas) e descrição de 15/22.
4. **A descrição (nível 3),** só em tela muito baixa: sai. O título e "Ver como funciona" ficam.

**O que sobra** quando a ilustração sai (menos de 68) ou já está nos 140, e nos níveis 1 a 3: metade acima do título e metade acima do formulário, sem um vão só embaixo, colado no rodapé.

Se ainda assim não couber (texto grande do sistema), a página rola, e o rodapé nunca cobre o último item: o fim da rolagem deixa 20 acima dele. O nível só sobe (a decisão espera 200 ms com as medidas paradas) e volta a 0 quando a altura da janela muda.

**Teclado aberto (ou foco num campo do formulário):** a parte de cima (ilustração, título e descrição) recolhe: fica montada, sem altura e fora do leitor de tela. "Ver como funciona", E-mail, Senha e "Entrar" ficam juntos na tela. O campo em foco fica sempre inteiro acima do rodapé: a tela rola até ele, com 16 de folga. Isso vale para todo campo do app (recuperar senha, Editar perfil, Nova trilha, a resposta aberta da aula e o Explique). O app não tem tela de criar conta. Ao fechar o teclado, a parte de cima volta. Com movimento reduzido, sem animação.

**Barras de baixo:** o fundo do rodapé e o da barra de quatro itens vão até a borda da tela. A área segura de baixo (barra de início do iPhone, barra de gestos do Android) fica dentro deles, sem linha embaixo nem faixa solta. Com o teclado aberto, o teclado cobre essa área e o rodapé encosta nele. Pela regra da spec 05 ("Barra de abas em cápsula"), em implementação, a barra de abas deixa de encostar na borda e passa a flutuar 8 acima da área segura; o rodapé continua indo até a borda.

**Pontos de corte por altura útil** (aqui, a área que rola: da área segura de cima até o rodapé, com a barra da marca dentro; medidos na prévia do app a 390 e a 360 de largura, de 20 em 20 pt de altura, com a configuração do site, sem "Esqueci minha senha"):

| Altura útil | Nível | Ilustração | O que muda |
| --- | --- | --- | --- |
| 722 ou mais | 0 | 140 | o que passa vira respiro |
| 626 a 721 | 0 | altura útil − 582 (44 a 139) | nada mais |
| 559 a 625 | 0 | sai | respiro de até 33 em cima e acima do formulário |
| 531 a 558 | 1 | — | espaços menores |
| 447 a 530 (468 a 530 a 360 de largura) | 2 | — | título 26/32 em duas linhas, descrição 15/22 |
| 395 a 446 | 3 | — | sem a descrição |
| menos de 395 | 3 | — | a página rola |

Com "Esqueci minha senha" (mais 65 de altura), cada corte sobe 65: a ilustração aparece a partir de 691.

**Medido na prévia do app** (áreas seguras de cada aparelho simuladas; configuração do site; teclado de 336 pt), antes (`4cd28c6`) e depois:

| Aparelho | Áreas seguras (cima/baixo) | Altura útil | Ilustração | Fim da Senha / início do rodapé | Antes | Com o teclado: folga da Senha (antes) |
| --- | --- | --- | --- | --- | --- | --- |
| 393 × 852 (iPhone 15) | 59 / 34 | 683 | 101 | 722 / 742 (folga 20) | 761 / 744: Senha cortada em 17, rolava 39 | 43 (−334, atrás do teclado) |
| 390 × 844 (iPhone 12 a 14) | 47 / 34 | 687 | 105 | 714 / 734 (folga 20) | 749 / 736: cortada em 13, rolava 35 | 47 (−334) |
| 375 × 812 (iPhone mini) | 50 / 34 | 652 | 70 | 682 / 702 (folga 20) | 752 / 704: cortada em 48, rolava 70 | 16 (−334) |
| 360 × 800 (Android, barra de gestos) | 24 / 24 | 676 | 94 | 680 / 700 (folga 20) | 726 / 702: cortada em 24, rolava 46 | 26 (−334) |

Um iPhone SE (375 × 667, áreas 20 / 0) fica com cerca de 569 de altura útil: nível 0 sem a ilustração.

**Na web móvel**, a mesma ordem cabe em CSS. A ilustração usa `flex: 0 1 140px`, com `min-height: 0` e `max-height: 140px` dentro da coluna de altura `100dvh` menos o rodapé, e cede primeiro. Os níveis 1 a 3 entram por `@media (max-height: …)` nas alturas úteis da tabela, e a ilustração só fica no nível 0. A parte de cima recolhe com `:focus-within` no formulário.

## Regras que continuam valendo

- A região é só cenário: não tem nome na tela e não agrupa lições por assunto. O leitor de tela continua ouvindo "Marco 1", "Marco 2"…, e "alcançado" quando o trecho foi vencido.
- Sem XP, sequência de dias, ranking ou moeda (D16). Nada de coruja, cores, ícones ou textos do Duolingo.
- Todo o cenário é decorativo e fica fora do leitor de tela. Com movimento reduzido, nada se move, o confete não aparece e a informação é a mesma.
- O resumo da lição é medido na tela (tempo e tentativas) e não é guardado nem vira pontuação.

## Decisões de design que mudam

- **Relevo.** Nós, marcos, cartões, opções e botões têm um lábio mais escuro embaixo, que some no toque. Antes, só o que flutuava tinha sombra (DESIGN §4).
- **Movimento contínuo.** Antes, só o Stu "pensando" se repetia (DESIGN §13). Agora também se repetem, enquanto o estado dura: o rótulo **Começar** e o anel do nó atual, o Stu guia, as árvores, a bandeira do marco vencido e os pontinhos da geração. Tudo para com movimento reduzido.
- **Cores do retorno.** Verde `#1F7A5A` e âmbar `#9A5B00` nos botões do painel, escuros o bastante para o texto branco ter contraste AA.

## Paridade entre web e app

- O mundo é feito só de formas simples (círculo, elipse, retângulo, triângulo e cúpula), descritas em `mundo-desenhos.ts`. A web desenha em SVG (`src/ui/mundo.tsx`) e o app com `View` (`apps/mobile/src/mundo.tsx`), sem nova dependência nativa. O arquivo de desenhos é o mesmo nos dois lados.
- As áreas e ideias do pedido, os passos da apresentação, as dicas da geração e os textos de **Escrevendo suas lições** têm o mesmo texto em `src/mensagens/pt-BR.ts` e em `apps/mobile/src/mensagens.ts`.
- `npm run test:paridade` confere as duas coisas, sem servidor nem banco.
- Adaptações do app: a apresentação vira páginas que também deslizam para o lado; as áreas do pedido ficam numa fileira que rola para o lado; o aviso de Caps Lock fica só na web.

## Revisão do dono (19/11): a geração que se acompanha até a última lição

O dono pediu animações na geração e a tela acompanhando até a última lição. Hoje o título ocupa um cartão alto e o mapa fica parado no alto: da terceira lição em diante, o que nasce fica abaixo da dobra, e a pessoa só vê o rodapé contar. Vale para web, Android e iPhone. Esboço: `geracao-390.png`, na pasta de trabalho do Designer (`ux/05-geracao-acompanhada`).

Revisto em 19/11 por "Criar a trilha", abaixo: saíram as dicas que se revezam, as estrelinhas, o "Mais uma!", o confete, as contagens e a tela Escrevendo suas lições.

**A tela durante a geração.**
- O cartão do título vira uma faixa de 52 px presa embaixo do cabeçalho: os três pontinhos que digitam e o nome do pedido (Nunito 800 de 15 px, numa linha, com reticências), sem contagem. O mapa ganha o resto da tela.
- A frase vai numa placa presa no alto do mapa: fundo `#FFF9EC`, borda de 2 px `#E8D3A8`, raio de 16 e 16 px das laterais. Ela diz só o que é verdade, sem dicas que se revezam: "Montando sua trilha" (`montandoTitulo`) enquanto chegam lições, "Ainda montando a próxima lição…" (`aguardandoLicao`) depois de 12 s sem lição nova e "Proposta pronta: 9 lições em 3 partes." (`propostaPronta`) no fim. O Stu (`stu-curioso`, em laço) fica do lado de fora da lição mais nova, no lado oposto ao nome, subindo e descendo devagar.
- O rodapé: "Cancelar" e "Montando a trilha", sem a contagem de lições.

**Cada lição que nasce**, do evento até a próxima espera:
1. Em 0 ms, se a tela está acompanhando, ela rola até a vaga da lição ficar a 60% da altura do mapa (320 ms, com saída suave).
2. Em 120 ms, o caminho se desenha do nó anterior até a vaga (300 ms), tracejado, como rascunho.
3. Em 320 ms, o nó cai 26 px e pula (escala de 0,7 a 1,08 e de volta a 1, em 380 ms, com mola), com o contorno tracejado do rascunho, e o anel dele fica azul por 1,2 s.
4. Em 420 ms, o nome entra do lado do nó (opacidade e 12 px, 220 ms).
5. Em 560 ms, árvores e flores perto do nó brotam (escala de 0 a 1, 260 ms).
6. Em 700 ms, o esqueleto da próxima vaga gira e o Stu anda até a lição nova (400 ms).

Se os eventos chegarem mais rápido que a sequência, cada lição começa quando a anterior chega ao passo 3: nada fica para trás nem se acumula. Na primeira lição de um trecho novo, o marco vem antes, na fronteira ondulada (cai 12 px em 260 ms), com a pílula “Parte 3”, e a lição chega 200 ms depois.

**Quem manda na rolagem.**
- A tela acompanha enquanto a pessoa não mexe. Se ela rolar para cima mais de 40 px, ou puser o foco do teclado num nó da prévia, a tela para de acompanhar. Aparece então, 16 px acima do rodapé, a pílula azul “Ver a lição nova · 7”: 44 px de altura, seta para baixo e o número da última lição.
- Tocar na pílula rola até a lição nova (320 ms) e volta a acompanhar. Se a pessoa rolar sozinha até a lição nova, também volta.
- Rolar para baixo não desliga o acompanhamento.

**Quando a proposta fica pronta.**
- Se a tela está acompanhando, ela rola até o fim do caminho. O troféu entra (escala de 0 a 1,1 e de volta a 1, 420 ms), sem confete e sem som. A placa vira "Proposta pronta: 9 lições em 3 partes.": é uma proposta, e a trilha só existe depois do toque. O Stu faz um ciclo de `stu-feliz` ao lado do troféu. O rodapé troca para "Ajustar pedido" e "Começar a lição 1" (`comecarLicao1`), deslizando 12 px em 220 ms. O foco vai para "Começar a lição 1".
- Se não está acompanhando, a pílula vira “Ver o fim da trilha”. O resto acontece igual.
- Ao subir até o começo do mapa, a faixa volta a ser o cartão do título.

**Depois de "Começar a lição 1".** Não há mais a tela Escrevendo suas lições: veja "Criar a trilha", abaixo.

**Movimento reduzido.** A tela continua acompanhando, mas pula direto, sem rolagem animada. Nada cai, pula, brota ou chove: o nó, o nome e o cenário aparecem juntos, com 150 ms de opacidade; o troféu aparece sem escala, e o Stu fica parado. A informação é a mesma.

**Leitor de tela.** Cada lição nova é anunciada (`aria-live` educado; no app, `announceForAccessibility`): “Lição 3: Combinar condições com AND.” No fim: “Proposta pronta, 9 lições. Começar a lição 1.” Durante a geração, o foco não se mexe: fica em “Cancelar” ou onde a pessoa estiver.

**Espera longa.** Com a IA real, uma lição pode demorar. Depois de 12 s sem lição nova, a placa diz “Ainda montando a próxima lição…”, sem barra de progresso inventada.

**Paridade.** Na web, `scrollTo` com rolagem suave (imediata com movimento reduzido); no app, `ScrollView.scrollTo` e `Animated`. Sem dependência nova. Os textos novos (a pílula, a placa da espera longa e o anúncio do fim) entram em `packages/contratos/src/experiencia.ts`, iguais nos dois lados.

**Quem decide.** Tudo nesta seção é decisão de design. Nada precisa do dono.

## Criar a trilha: da prévia à etapa 1 (pedido do dono, 19/11)

**Estado:** regra de design, em implementação na web e no app. Os textos já estão em `mensagens.geracao` (commit 66f4553 do Web & API). Ainda sem validação no aparelho.

O dono pediu UI, UX e animação melhores ao criar uma trilha. O destino não muda: na prévia pronta, um toque salva a trilha e abre a etapa 1 da lição 1, e o mapa salvo aparece quando a pessoa volta da aula. Não entram tela no meio, segundo botão, pausa fixa, contagem, etapas inventadas, confete nem texto de enfeite. Esboço antes e depois: `ux/13-criar-trilha/sequencia.png`, na pasta do Designer.

**A prévia é rascunho.** Os nós da prévia têm face branca e contorno tracejado de 2 px `#9CB4F5`, sem o lábio. O caminho é tracejado 8/8, também em `#9CB4F5`. Quando a trilha passa a existir, eles viram os nós e o caminho de sempre.

**O toque (0 ms).**
- O botão principal da prévia pronta diz "Começar a lição 1" (`comecarLicao1`).
- Em até 100 ms do toque, o botão afunda (o lábio some), mostra o giro de 16 px e "Criando sua trilha…" (`criandoTrilha`).
- "Ajustar pedido" sai, e o botão ocupa a largura toda, numa linha: 200 ms, ou na hora com movimento reduzido. Na metade da largura, em 390, o rótulo com o giro quebraria em duas linhas.
- Se o nó 1 não estiver à vista, a prévia rola até ele (240 ms).
- O Stu anda até o nó 1 (400 ms) e passa a `stu-estudando`, em laço, no tamanho do guia do mapa. O anel do nó 1 respira. O resto da tela não muda.
- Leitor de tela: "Criando sua trilha." (`anuncioCriando`, educado). O foco fica no botão.

**Enquanto o aceite não volta.**
- Sem pausa mínima: o aceite não espera nada além da resposta. Saem a `pausa(ESCRITA_MINIMA_MS)`, de 1.200 ms, e a `pausa(PAUSA_LICOES_PRONTAS_MS)`, de 900 ms, nos dois clientes.
- Depois de 1,5 s sem resposta, aparece uma linha embaixo do botão, centrada, em 14/20 `#5E6A85`: "Escrevendo as lições da trilha. Com a IA, leva alguns segundos." (`escrevendoLicoes`). É verdade: é o aceite que escreve o conteúdo das lições. A linha é só da espera real: na referência rápida (IA falsa, rede local), o aceite volta antes de 1,5 s, e ela não aparece.
- Sem barra, sem porcentagem e sem visto por lição, porque o aceite é um pedido só.
- A tela Escrevendo suas lições sai, com a lista, o brilho e as dicas.

**A trilha passa a existir (o aceite volta ok).** A passagem é a própria navegação para a aula, em até 470 ms:
- t = 0: toca `geracao_pronta`. O nó 1 pulsa (1 → 1,12 → 1, 180 ms) e fica no estado atual, azul cheio. O caminho tracejado vira sólido (180 ms, opacidade), e o Stu faz um ciclo de `stu-comemorando`.
- t = 120 ms: um círculo da cor do fundo da aula cresce a partir do centro do nó 1 até cobrir a tela (300 ms, ease-out).
- t = 320 ms: a etapa 1 entra por cima (opacidade, 150 ms). Se a lição ainda carrega, entra o esqueleto da aula no mesmo lugar, sem giro.
- A busca da lição (`obterLicao`) começa no instante em que o aceite volta, junto com a passagem, e não depois dela.
- A aula aceita toque assim que monta: nada espera a animação acabar.
- O foco vai para o título da etapa 1, e o leitor de tela ouve "Trilha criada. Lição 1: <título>." (`anuncioCriada`).
- A geração sai do histórico (substitui, não empilha): voltar da aula leva ao mapa salvo, nunca à prévia.
- Como fazer: na web, `clip-path: circle()` a partir do `getBoundingClientRect` do nó 1. No app, `measureInWindow` do nó e uma `View` redonda animada por cima, dentro da tela da geração; quando ela cobre a tela, a aula entra sem transição. Sem dependência nova.
- Movimento reduzido: sem pulso, sem o Stu andando e sem círculo; a aula entra por opacidade em 150 ms. O som segue a preferência de som (spec 12), não a de movimento.

**Som.** O único som de conclusão é `geracao_pronta`, no t = 0 da passagem. Ele é aquecido ao abrir a geração, para tocar sem atraso. O fim da proposta (troféu) não tem som. `geracao_licao` segue a spec 12.

**Erro, tentar de novo e sair.**
- **O aceite falhou:** o botão volta a "Começar a lição 1" e "Ajustar pedido" volta. A linha embaixo, em `#C23B4E`, diz "Não deu para criar a trilha. Confira a conexão e tente de novo." (`erroCriacao`). O Stu fica ao lado do nó 1, parado, em `stu-encorajador`. O novo toque usa o mesmo token, e o servidor devolve a trilha já criada para esse token (`aceitarProposta`, em `src/servidor/aprendizado/servico.ts`), então nada duplica.
- **Proposta expirada (`proposta_invalida`):** a linha diz "Esta proposta expirou. Monte de novo." (`propostaExpirada`), e o botão vira "Montar de novo" (`montarDeNovo`), que refaz a geração com o mesmo pedido.
- **Sair durante "Criando sua trilha…"** (voltar, gesto ou outra aba): não cancela no servidor. O cliente ignora a resposta e não abre a aula, e a trilha aparece em Minhas trilhas.
- Cancelar durante a geração continua como hoje (P17 da spec 07).

**Critérios observáveis.**
- C1: do toque até o botão mudar, no máximo 100 ms (6 quadros numa gravação a 60 fps).
- C2: o relato do tempo tem sempre quatro números:
  - total: do toque até a etapa 1 interativa;
  - aceite: do toque até a resposta do aceite;
  - busca da lição: da resposta do aceite até a resposta do `obterLicao`, que é uma segunda chamada, em sequência;
  - passagem: da resposta do aceite até a aula na tela, com o esqueleto ou com a etapa 1.
  - **Referência rápida** (IA falsa, rede local, sem atraso simulado): passagem de no máximo 470 ms e total de no máximo o aceite mais 470 ms. Em 0491ed7, o total era de pelo menos 2,1 s.
  - **Espera real** (IA real ou rede lenta, simulada e identificada no relato): sem meta de total. Os quatro números entram como medidos, sem descontar a demora. A passagem continua em no máximo 470 ms, mesmo com a busca da lição lenta. O esqueleto fica até a lição chegar, e a etapa 1 fica interativa em até 100 ms depois disso. A linha de 1,5 s aparece.
  - Nos dois casos, nenhuma pausa fixa.
- C3: nenhuma tela e nenhum segundo botão entre a prévia e a etapa 1.
- C4: um `geracao_pronta` por trilha criada, na passagem, e nenhum som no fim da proposta.
- C5: sem confete, sem dicas que se revezam, sem "Mais uma!", sem contagens, sem barra e sem visto por lição.
- C6: tentar de novo depois de uma falha não duplica (Minhas trilhas com uma trilha), e voltar da aula leva ao mapa salvo.
- C7: com movimento reduzido, a troca é por opacidade e a informação é a mesma; os dois anúncios saem.
- C8: "Criando sua trilha…" fica numa linha em 320, 360 e 390.

**Paridade.** Igual na web, no Android e no iPhone, com os mesmos tempos e os mesmos textos.

**Quem decide.** É decisão de design; nada precisa do dono.

## Revisão de banca da noite (19–20/11)
Revisão com olhar de jurado sobre o 9e6e96e. Cobre a entrada, o "Ver como funciona", o pedido, o roteiro do pitch, o Explorar, o perfil e o compartilhar. Na web foram 390×844 e 390×667, rodando local com IA falsa, mais as capturas recentes do Web & API em 390 e 1440. No app, as capturas recentes do Mobile & QA (prévia web). Os itens vão do mais grave ao menos grave. Ficou de fora o que já está decidido e em implementação: ordenar em lista única na web, reação no painel, mascote parte 2 na web, revisão das configurações, geração que se acompanha na web, Curtir B e C e controle de som no app. Os esboços dos três primeiros estão na pasta do Designer, `ux/11-banca-noite/`.

### 1. Entrada no celular: caber sem rolar, com "Entrar" junto dos campos (web; o app já cabe)
- **Hoje:** em 390×844, o campo de e-mail começa na dobra e o de senha fica abaixo dela; em 390×667, nenhum campo aparece. "Entrar" fica preso no rodapé, longe dos campos, e com o modo visitante ligado vira botão branco (`src/app/login/entrada.tsx`). O app já tirou a faixa ilustrada e cabe (b1254bd).
- **Regra (web até 767 px, igual ao app):**
  - Sem faixa ilustrada quando a janela tem até 860 px de altura. Acima disso, a faixa tem 120 px.
  - Título em 28/34 (até 3 linhas em 390) e texto em 15/22 (até 3 linhas). "Ver como funciona" é um botão de texto de 44 px.
  - **Modo visitante ligado:** o cartão "Experimentar sem conta" fica como está. O formulário vem logo abaixo, e "Entrar" fica dentro dele, logo depois da senha, na largura toda, com 48 px, em estilo secundário. Não há rodapé preso.
  - **Modo visitante desligado:** "Entrar" é o principal (azul cheio, 48 px), no mesmo lugar.
  - "Esqueci minha senha" fica embaixo do botão, como botão de texto de 44 px. Com o teclado aberto, vale a regra do app: o campo em foco fica acima do teclado.
- **Aceite:** em 390×844 aparecem, sem rolar, o botão "Entrar" (visitante desligado) ou o campo de e-mail inteiro (visitante ligado). Em 390×667, o campo de e-mail aparece inteiro nos dois casos.

### 2. "Ver como funciona": arte grande, sem selo de demonstração e sem vazio (web e app)
- **Hoje:** a arte ocupa uns 40% da tela, e sobram uns 300 px vazios até o rodapé em 390×844. A arte dos passos 1 e 2 leva o selo "Modo demonstração" (`src/app/apresentacao.tsx:165` e `:178`), que serve para conteúdo simulado, não para ilustração. No passo 3, os cartões da arte têm texto de 11 a 13 px. O último passo oferece "Experimentar sem conta" e "Voltar", sem "Entrar".
- **Regra:**
  - A arte ocupa 52% da altura útil (mínimo de 280 px, máximo de 420), e o título e o texto ficam centrados no espaço que sobra até o rodapé.
  - Sem o selo "Modo demonstração" na arte do tour.
  - Os textos da arte têm 14 px no mínimo. No passo 3 ficam só dois cartões ("O que fez sentido" e "Próximo passo"), mais o Stu concentrado. O passo 1 ganha o `stu-estudando`, em 160 px, ao lado da citação. Continua valendo a §B4 da spec 13 nos outros passos.
  - **Último passo:** com o modo visitante ligado, as ações ficam empilhadas, porque o rótulo não cabe na metade (spec 11): "Experimentar sem conta" (principal) em cima e "Entrar" (secundário) embaixo. Com ele desligado, só "Entrar", como principal. "Voltar" sobe para o alto, à esquerda, como botão de texto de 44 px, no lugar de "Pular".

### 3. Pedido: material e ideias à vista (web e app)
- **Hoje:** em 390×844, as ideias de um toque começam abaixo da dobra. O aviso "Você ainda não tem trilhas. Comece uma aqui…" repete o título, e o Stu do alto tem uns 110 px.
- **Regra, com a mesma ordem nos três:**
  1. O Stu curioso em 72 px (56 quando a janela tem até 700 px de altura, e aí o subtítulo sai), o título "O que você quer aprender?" e "Pode ser qualquer assunto!".
  2. O campo e "Montar minha trilha".
  3. "Tenho um material" num cartão compacto: 64 px de altura, com ícone, título e "Foto, PDF, DOCX ou CSV", sem a pílula "Seu material".
  4. Uma fileira de ideias populares que rola para o lado: chips de 44 px com ícone e texto, na ordem de hoje, terminando em "Surpreenda-me".
  - O aviso `planos.semTrilhas` deixa de aparecer no pedido.
- **Aceite:** em 390×844 e em 390×667 aparecem, sem rolar e acima da barra de abas, o campo, "Montar minha trilha", "Tenho um material" e a fileira de ideias.

### 4. Conclusão: o clímax com uma ação clara (web e app)
- **Hoje:**
  - Na trilha concluída, o botão principal é "Voltar à trilha", e "Compartilhar esta trilha" aparece no meio, como secundário (`src/app/estudo.tsx:1444-1446`).
  - Um selo de visto verde cobre o Stu nas duas conclusões.
  - Os números usam bordas grossas coloridas.
  - Antes das ações, a página empilha números, "O que você praticou", o aviso de sincronia e "Frases desta lição".
- **Regra:**
  - **Trilha concluída:** "Compartilhar esta trilha" é o principal, "Começar um assunto novo" o secundário, e "Voltar à trilha" vira botão de texto.
  - **Lição concluída:** fica como hoje ("Ir para a próxima lição" como principal e "Voltar à trilha" como secundário).
  - Sem o selo de visto sobre o Stu: a expressão e o título já dizem.
  - Os números ficam em três blocos brancos, com borda de 2 px #E1E7FA, ícone de 16 px na cor de hoje e valor em 22 px #0B1B5C. Sem borda colorida grossa.
  - "O que você praticou" e "Frases desta lição" ficam recolhidos num botão de texto, "Ver o que você praticou", que abre no lugar. As ações continuam no rodapé preso.

### 5. Navegação no celular no mesmo lugar desde o primeiro uso (web)
- **Hoje:** na conta sem trilhas, a web mostra "Minhas trilhas" e "Perfil" no alto e não mostra a barra de abas. Com trilhas, a barra de abas aparece embaixo (cabeçalho em `src/app/estudo.tsx:653-672`). O app mostra a barra de abas.
- **Regra:** nas telas de topo, a barra de abas (Minhas trilhas, Nova trilha, Explorar e Perfil) aparece sempre, inclusive sem trilhas, com "Nova trilha" marcada. No celular, o cabeçalho fica só com a marca e o selo de sincronia, e "Minhas trilhas" e "Perfil" saem do alto. É igual ao app (spec 07).

### 6. Geração no app: progresso que se lê (app; a web segue quando a geração que se acompanha entrar)
- **Hoje:** os três pontos animados ao lado do título, no alto, parecem um menu. A dica da placa tem uns 12 px, com contraste baixo, e o rótulo do nó que está nascendo fica esmaecido (capturas de geração do Mobile & QA).
- **Regra:** os três pontos saem do alto, porque o rodapé já diz "Montando a trilha". A dica da placa passa a 14/20, em #0B1B5C. O rótulo do nó que nasce fica em #5E6A85, sem opacidade.

### 7. Lição: conceito em blocos curtos e áudio com botão (web e app)
- **Hoje:** no celular, o balão "O Stu explica" chega a umas 110 palavras, com seis frases de áudio como links no meio do parágrafo (aula de inglês, 390).
- **Regra:**
  - O balão mostra até 3 frases (cerca de 50 palavras), e o resto fica em "Continuar lendo" (a chave já existe), que abre no lugar.
  - As frases com áudio saem do parágrafo e viram uma lista logo abaixo dele, na mesma ordem. Cada uma tem um botão "Ouvir" de 44 px, com ícone de alto-falante e texto.

### 8. Estados vazios sem controles que não servem (web e app)
- **Hoje:** o Explorar vazio mostra as abas e a fileira de temas com setas acima do aviso.
- **Regra:** com a lista vazia, a fileira de temas e as setas somem. Ficam as abas Comunidade e Seguindo e o aviso com o Stu e "Ir para minhas trilhas". Vale também para a busca sem resultado e para Seguindo vazio.

### 9. Alvos de toque de 44 px em todo botão de texto (web e app)
- **Hoje:** `.botao--texto` só tem 44 px de altura dentro da navegação (`src/app/globals.css:342`). "Ver como funciona", o "Pular" do tour, "Esqueci minha senha" e "Rever a explicação" ficam entre uns 20 e 32 px de altura.
- **Regra:** todo botão de texto e todo link de ação têm área de toque de 44×44 px no mínimo.
  - Na web: altura mínima de 44 px e respiro de 12 px dos lados. Quando o desenho não comporta isso, a área cresce por fora com um `::after`.
  - No app: `hitSlop` de 12 nos botões de texto.

### 10. Texto auxiliar legível (web e app)
- **Hoje:** placas, metadados e fontes usam 11 a 12 px, às vezes com opacidade. Exemplos: "Toque nas frases destacadas para ouvir", "Fonte · …", a dica da placa da geração e o rótulo do nó que nasce.
- **Regra:** no mínimo 13 px para metadados e 14 px para dicas. A cor mínima é #5E6A85 sobre branco (5,4:1) e #4B5675 sobre lavanda ou creme. Texto nunca usa opacidade abaixo de 1.

### Decisão do dono
- **Modo visitante no site da banca ("Experimentar sem conta").** Recomendo deixar ligado durante o hackathon: o jurado experimenta sem pedir senha. O item 1 já trata os dois casos.

### Já decidido, mas ainda fora da web no 9e6e96e (fora da contagem)
- Perfil vazio com "?" no avatar e "Tudo salvo" sem nada salvo (spec 10, pedido 1): na web, o perfil continua assim.

