# Experiência ilustrada: entrada, apresentação, pedido e mundo da trilha

**Estado:** implementada na web e no app (13/11/2026), em três passadas: o mundo ilustrado; as animações e o retorno da aula; e, com a IA da OpenAI, a tela que escreve as lições. Complementa a [spec 03](03-trilha-ao-vivo.md) sem mudar API, contrato ou banco.

## Problema

A interface funcionava, mas era plana: a entrada não dizia o que o Studoo faz, não havia apresentação para quem chega, as sugestões do pedido puxavam para programação e a trilha era um caminho sobre fundo branco. Queremos a sensação de jornada do caminho do Duolingo, com a cara do Studoo.

## Experiência

1. **Entrada.** Na tela larga, a metade direita é uma paisagem do mundo do Studoo, com o Stu e temas de vários assuntos (violão, inglês, frações, fotografia, SQL, culinária). No celular, a paisagem vira uma faixa acima do título. O formulário confere o e-mail e a senha antes de enviar e mostra o erro no próprio campo; a senha pode ser mostrada, e a web avisa quando o Caps Lock está ativado.
2. **Boas-vindas (app).** Antes da entrada, a mesma paisagem com o Stu, a promessa ("Aprenda qualquer coisa, um passo de cada vez") e três destaques.
3. **Apresentação.** No primeiro acesso de cada navegador ou aparelho, sem planos salvos, cinco passos: o Stu, qualquer assunto, a trilha que nasce, o progresso salvo e, por fim, **O que te interessa?**, em que a pessoa escolhe uma área e o pedido já abre com as ideias dela. Cada passo entra deslizando na direção em que a pessoa anda. Pular encerra a qualquer momento. O pedido tem o link **Como funciona?** para rever, e a barra lateral da web também. A web guarda que a apresentação foi vista no `localStorage` (`studoo.apresentacao`); o app, no SecureStore.
4. **Pedido.** As ideias vêm por área de interesse (Populares, Idiomas, Música, Matemática, Ciências, Tecnologia, Artes, Carreira e Dia a dia), cada uma com um ícone próprio, que pula quando a área é escolhida. **Populares** abre primeiro e mantém **SQL para a prova**. **Surpreenda-me** sorteia uma ideia. O campo vazio mostra exemplos que se escrevem sozinhos, letra por letra; no app, eles param enquanto o campo está em foco. A dica diz "diga o tema, o que você já sabe e aonde quer chegar". Acima do campo, o Stu reage: convida, incentiva enquanto a pessoa escreve e comemora a ideia escolhida, e o campo brilha quando uma ideia é aplicada.
5. **Mundo da trilha.** O caminho passa por um mapa ilustrado. Cada trecho da trilha é uma região, em ciclo: campos, floresta, montanhas, lago, vila e nuvens. Entre um trecho e outro, a região seguinte começa numa fronteira ondulada, e o marco fica sobre ela; ele fica dourado quando o trecho é vencido, e a bandeira acena. O caminho termina no topo, com o troféu, que fica dourado quando a trilha é concluída. Os nós têm relevo, o rótulo **Começar** flutua sobre o nó atual e o anel dele respira devagar. Árvores e flores balançam com o vento.
   - **O Stu acompanha a pessoa.** Fica ao lado do nó atual, sobe e desce devagar e acena de vez em quando; com tudo concluído, pula ao lado do troféu. A frase dele vai numa placa de madeira no alto do mapa.
   - **Ao abrir**, os nós caem no lugar em sequência e o cenário brota logo depois.
   - **Na volta de uma lição concluída**, o nó comemora com um pulo e confete, a linha até o próximo se desenha e só então o próximo nó se abre.
   - **Na geração ao vivo**, o Stu abre o mapa com um balão em que pontinhos digitam e dicas de estudo se revezam. Cada nó cai no lugar assim que chega, o esqueleto do próximo gira e, quando a trilha fica pronta, o troféu entra com confete.
   - **Ao Começar**, a IA escreve o conteúdo das lições, o que leva alguns segundos com a IA real. Em vez de um esqueleto, a tela **Escrevendo suas lições** mostra o Stu escrevendo com um lápis, folhas que voam, a lista das lições da trilha com um brilho que desce por ela e dicas que se revezam. O aceite é um pedido só, sem andamento por lição, então nenhuma lição ganha o visto antes da hora. Quando o aceite volta, o título vira **Lições prontas!**, o visto verde passa pela lista e a primeira lição abre.
6. **Aula.** A aula por etapas da [spec 02](02-aula-web.md) vale na web e no app. A barra de andamento é grossa e avança com uma mola; cada etapa entra deslizando. O conceito vem num balão do Stu. No exercício de escolha, as opções são cartões com relevo, com as teclas 1, 2, 3… na web e as letras A, B, C… no app; na web, Enter verifica e continua. Depois de **Verificar**, o rodapé vira o painel de retorno: sobe verde no acerto ("Mandou bem!", com confete) ou âmbar no erro ("Quase lá!", e o exercício treme). No erro, **Tentar de novo** volta ao exercício e **Continuar** segue, como antes.
7. **Conclusão e planos.** A lição concluída tem chuva de confete, raios girando atrás do Stu, que pula, e o resumo da lição: tempo, acerto (de primeira ou em quantas tentativas) e etapas. A barra do plano enche a partir de onde estava. Meus planos mostra cartões com uma faixa do mundo, que entram em sequência, e a ação que cabe: começar, continuar ou rever a trilha. As telas entram com uma subida curta, e os esqueletos brilham enquanto carregam.

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
