# Experiência ilustrada: entrada, apresentação, pedido e mundo da trilha

**Estado:** implementada na web e no app (13/11/2026). Complementa a [spec 03](03-trilha-ao-vivo.md) sem mudar API, contrato ou banco.

## Problema

A interface funcionava, mas era plana: a entrada não dizia o que o Studoo faz, não havia apresentação para quem chega, as sugestões do pedido puxavam para programação e a trilha era um caminho sobre fundo branco. Queremos a sensação de jornada do caminho do Duolingo, com a cara do Studoo.

## Experiência

1. **Entrada.** Na tela larga, a metade direita é uma paisagem do mundo do Studoo, com o Stu e temas de vários assuntos (violão, inglês, frações, fotografia, SQL, culinária). No celular, a paisagem vira uma faixa acima do título. O formulário confere o e-mail e a senha antes de enviar e mostra o erro no próprio campo; a senha pode ser mostrada, e a web avisa quando o Caps Lock está ativado.
2. **Boas-vindas (app).** Antes da entrada, a mesma paisagem com o Stu, a promessa ("Aprenda qualquer coisa, um passo de cada vez") e três destaques.
3. **Apresentação.** No primeiro acesso de cada navegador ou aparelho, sem planos salvos, quatro passos ilustrados: o Stu, qualquer assunto, a trilha que nasce e o progresso salvo. Pular encerra a qualquer momento. O pedido tem o link **Como funciona?** para rever, e a barra lateral da web também. A web guarda que a apresentação foi vista no `localStorage` (`studoo.apresentacao`); o app, no SecureStore.
4. **Pedido.** As ideias vêm por área de interesse (Populares, Idiomas, Música, Matemática, Ciências, Tecnologia, Artes, Carreira e Dia a dia), cada uma com um ícone próprio. **Populares** abre primeiro e mantém **SQL para a prova**. **Surpreenda-me** sorteia uma ideia. O campo tem um exemplo e a dica "diga o tema, o que você já sabe e aonde quer chegar".
5. **Mundo da trilha.** O caminho passa por um mapa ilustrado. Cada trecho da trilha é uma região, em ciclo: campos, floresta, montanhas, lago, vila e nuvens. Entre um trecho e outro, a região seguinte começa numa fronteira ondulada, e o marco fica sobre ela; ele fica dourado quando o trecho é vencido. O Stu abre o mapa com a frase num balão, e o caminho termina no topo, com o troféu, que fica dourado quando a trilha é concluída. Os nós têm relevo, o rótulo **Começar** flutua sobre o nó atual e o anel dele respira devagar. Na geração ao vivo, o cenário de cada linha brota logo depois do nó.
6. **Aula e conclusão.** O app passa a ter a aula por etapas da [spec 02](02-aula-web.md), como a web. A lição concluída mostra uma medalha com brilhos e a porcentagem do plano. Meus planos mostra cartões com uma faixa do mundo e a ação que cabe: começar, continuar ou rever a trilha.

## Regras que continuam valendo

- A região é só cenário: não tem nome na tela e não agrupa lições por assunto. O leitor de tela continua ouvindo "Marco 1", "Marco 2"…, e "alcançado" quando o trecho foi vencido.
- Sem XP, sequência de dias, ranking ou moeda (D16). Nada de coruja, cores, ícones ou textos do Duolingo.
- Todo o cenário é decorativo e fica fora do leitor de tela. Com movimento reduzido, nada se move e a informação é a mesma.

## Paridade entre web e app

- O mundo é feito só de formas simples (círculo, elipse, retângulo, triângulo e cúpula), descritas em `mundo-desenhos.ts`. A web desenha em SVG (`src/ui/mundo.tsx`) e o app com `View` (`apps/mobile/src/mundo.tsx`), sem nova dependência nativa. O arquivo de desenhos é o mesmo nos dois lados.
- As áreas e ideias do pedido e os passos da apresentação têm o mesmo texto em `src/mensagens/pt-BR.ts` e em `apps/mobile/src/mensagens.ts`.
- `npm run test:paridade` confere as duas coisas, sem servidor nem banco.
- Adaptações do app: a apresentação vira páginas que também deslizam para o lado; as áreas do pedido ficam numa fileira que rola para o lado; o aviso de Caps Lock fica só na web.
