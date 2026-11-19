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
   - **Na geração ao vivo**, o Stu abre o mapa com um balão em que pontinhos digitam e dicas de estudo se revezam. Cada nó cai no lugar assim que chega, o esqueleto do próximo gira e, quando a trilha fica pronta, o troféu entra com confete.
   - **Ao Começar**, a IA escreve o conteúdo das lições, o que leva alguns segundos com a IA real. Em vez de um esqueleto, a tela **Escrevendo suas lições** mostra o Stu escrevendo com um lápis, folhas que voam, a lista das lições da trilha com um brilho que desce por ela e dicas que se revezam. O aceite é um pedido só, sem andamento por lição, então nenhuma lição ganha o visto antes da hora. Quando o aceite volta, o título vira **Lições prontas!**, o visto verde passa pela lista e a primeira lição abre.
6. **Aula.** A aula por etapas da [spec 02](02-aula-web.md) vale na web e no app. A barra de andamento é grossa e avança com uma mola; cada etapa entra deslizando. O conceito vem num balão do Stu. No exercício de escolha, as opções são cartões com relevo, com as teclas 1, 2, 3… na web e as letras A, B, C… no app; na web, Enter verifica e continua. Depois de **Verificar**, o rodapé vira o painel de retorno: sobe verde no acerto ("Mandou bem!", com confete) ou âmbar no erro ("Quase lá!", e o exercício treme). No erro, **Tentar de novo** volta ao exercício e **Continuar** segue, como antes.
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

**Barras de baixo:** o fundo do rodapé e o da barra de quatro itens vão até a borda da tela. A área segura de baixo (barra de início do iPhone, barra de gestos do Android) fica dentro deles, sem linha embaixo nem faixa solta. Com o teclado aberto, o teclado cobre essa área e o rodapé encosta nele.

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
