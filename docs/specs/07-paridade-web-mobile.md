# Revisão de paridade entre web e Android

Web e app devem oferecer o mesmo percurso, conteúdo, identidade visual e ações. O desktop conserva a barra lateral; no celular, a navegação e as ações principais ficam na parte inferior. Os componentes continuam nativos no Android.

## Ajustes desta revisão

- A entrada do app abre diretamente no login, como a web. A antiga etapa separada de boas-vindas foi retirada; o Stu e a paisagem continuam no formulário e a apresentação de cinco passos continua após o primeiro acesso.
- Login valida e-mail e senha vazios com mensagens no campo. Após credenciais inválidas, as duas versões limpam a senha. A indisponibilidade do Google só aparece depois de concluir a consulta de configuração.
- O separador entre Google e e-mail, a tipografia dos títulos em celular, a paisagem e os espaçamentos da entrada foram alinhados.
- Recuperação usa o mesmo símbolo de cadeado/confirmação, aviso de envio, etapas, rótulos de carregamento e ação inferior. A versão web estreita deixa de colocar o formulário dentro de um cartão adicional. No app, o título recebe foco ao mudar de etapa.
- Conclusão da aula fica sem o cabeçalho adicional no app. Na web em celular, as duas ações finais ficam juntas no rodapé, como no app. A chuva de confetes usa a mesma quantidade de peças.
- A CSP web permite os atributos de estilo usados pelo React para posicionamento, cores e progresso. Tags de estilo continuam exigindo nonce em produção, assim como os scripts.
- `packages/contratos/src/experiencia.ts` passa a ser a fonte de textos de apresentação, pedido, geração, trilha, aula, retomada, autenticação e erros. Os arquivos de mensagens de cada plataforma mantêm apenas os acessores e aliases necessários. Não há mudança na API nem no banco.

## Percursos revisados

| Percurso | Verificação |
| --- | --- |
| Entrada | Google/configuração, e-mail e senha, validações e mostrar senha |
| Recuperação | Pedido de código, código inválido, troca, confirmação e retorno ao login |
| Apresentação | Cinco passos e escolha de área |
| Pedido | Área, sugestões, campo, fala do Stu e geração |
| Geração | Andamento, prévia pronta e preparação das lições |
| Aula | Conceito, exemplo, exercício, erro, nova tentativa e acerto |
| Conclusão | Resumo, progresso e ações para continuar |
| Trilha | Caminho, marcos, próximo passo e retorno aos planos |
| Minhas trilhas | Cartões e retomada |

As capturas locais ficam em `artifacts/paridade/`. A web usa API e banco locais com IA falsa; a prévia do app usa React Native Web e API simulada. Quantidade de planos e conteúdo gerado dependem da conta e dos dados de cada ambiente, e não são diferenças de interface.

Os testes de paridade verificam a fonte única de textos, os desenhos e as cores de texto, ação, campos e feedback. Os testes de movimento verificam preferência de movimento reduzido, segundo plano e limpeza das assinaturas. Build e tipos são conferidos nas duas plataformas.

Permanecem adaptações deliberadas: navegador versus SecureStore para sessão, navegador do sistema para Google no Android, gestos e teclado nativos, áreas seguras e barra lateral no desktop. Esta revisão não substitui a validação em aparelho Android: teclado físico/virtual, TalkBack e desempenho nativo ainda precisam ser conferidos ali.

## Diferenças deliberadas do app nas rodadas de UI 1.1 a 1.3

Números e textos seguem `docs/ui/DIRECAO-UI.md` e `experiencia.ts`. Estas diferenças vêm do toque e da tela estreita:

- Ponte: a cena fica horizontal também no celular e o Stu atravessa até "De volta ao desafio". Os textos das tábuas ficam numa legenda numerada logo abaixo da cena, porque quatro tábuas com texto não cabem legíveis em 390 px. O retorno da vitória aparece logo abaixo da cena, que a tela traz à vista antes da travessia.
- Privacidade do material: até a configuração de acesso responder, o app mostra o aviso geral (`privacidade`). Depois, mostra o aviso do provedor ativo (`privacidadePorProvedor(ia)`).
- Material: o CSV aparece em tabela com rolagem horizontal dentro do cartão. As páginas de texto mostram quatro linhas e um botão para abrir o resto.
- Stu no exercício: cada uma das três comemorações (de primeira, acerto e depois da ponte) tem movimento e adereço próprios (✦, ✓ e tábuas).
- Explique: as ondas da gravação seguem o volume do microfone (`metering` do expo-audio). Com movimento reduzido, ficam paradas.
- Conclusão: os cartões de história ficam em uma coluna.
- Estado de erro (rodadas 3A a 3A.2): é o mesmo cartão com o Stu, o texto e uma ação, mas a ação ocupa a largura do cartão, como os outros botões de toque.
- Erro na lição: o cartão não tem ação, porque a nova tentativa é o próprio botão do rodapé (Verificar, Concluir). Na web, "Tentar novamente" recarrega a página.

## Diferenças deliberadas do app na rodada 4

O app segue a rodada 4 da web publicada (`c824b29`): entrada com uma ação principal (4A), aula focada (4B), erro compacto (4C), ponte em foco (4D), recurso visual no conceito (4E), esqueleto no carregamento (4F), selo de sincronia só em Minhas trilhas e no mapa (4G), citação focal, mapa e conclusão (4I a 4O). As diferenças vêm do toque e da tela estreita:

- Painel de erro: "Ver outro jeito de entender" ocupa a largura toda; embaixo, numa linha só, "Tentar de novo" (secundário) e "Pular por agora" (botão de texto, 14 px). Em 360 px, nenhum rótulo quebra linha. Na web, os três botões ficam numa linha que quebra conforme a largura.
- Ponte em foco: com a ponte aberta, o exercício recolhe e o painel de retorno sai, como na web. No app, o cartão "Origem do conteúdo" também sai, para a ponte ficar no alto da tela. "Voltar ao exercício" fica no alto do cartão desde o começo. Na vitória, ele aparece logo embaixo da cena, junto do "Isso!", e a tela traz o alto do cartão à vista antes da travessia.
- Ponte reaberta depois de vencida (o mesmo erro, de novo): o título é "Outro jeito de entender", a cena não repete a travessia, a explicação e o exemplo ficam à vista para reler e "Voltar ao exercício" aparece no alto e no fim. O desafio já vencido não volta. "Tentar de novo" e "Voltar ao exercício" fecham o pedido de reforço, então um erro novo mostra outra vez "Ver outro jeito de entender".
- Conclusão depois de sair e voltar: as pontes vencidas e a explicação ao Stu entram no andamento da lição (em memória, 24 horas, como o resto do andamento). O cartão "Ponte construída" e o do Explique aparecem mesmo quando a pessoa fecha a lição no meio e volta.
- Mapa: com a primeira lição atual e o nome dela em duas linhas, o balão "Começar" cobria a faixa da Parte 1. O começo do mapa ganha 64 de fundo e a faixa fica entre os postes da placa e o balão, em 360 e 412.
- Não se aplicam ao app: Enter para verificar (o teclado do aparelho já envia a lacuna pela tecla de envio e as escolhas são por toque), fontes WOFF2 (o app embute TTF pelo expo-font) e configuração de acesso no servidor da página de login (o app consulta `/api/auth/config` ao abrir e só mostra o Google e o "Esqueci minha senha" quando a resposta os oferece).

## Diferenças deliberadas do app na rodada 4.2

O app segue a web 4.2.1 (`2a43314`): `trilhaRepetida()` no lugar da regra fixa de frações, a placa "A primeira lição já está aberta" (`stuInicioEmAndamento`), "Ponte construída" no mapa, "Apagar" num menu de mais opções, a ponte reaberta montada, a fração da lacuna na fonte da interface com algarismos tabulares e os botões ocupados logo no toque. As diferenças vêm do toque e da tela estreita:

- Menu dos cartões em Minhas trilhas: na web, o "•••" abre um menu sobreposto. No app, o toque mostra "Apagar" ao lado do "•••", no próprio cartão, e um segundo toque fecha. "Apagar" continua pedindo confirmação. Não há botão "+ Nova trilha" no alto da lista, porque a aba "Nova trilha" fica sempre embaixo.
- Ponte construída (vitória ou releitura): como na web no celular, as quatro tábuas ficam verdes e a legenda sai. Na releitura, o app mantém "Voltar ao exercício" também no alto do cartão (a web mostra só o do fim), para a saída ficar à vista sem rolar em 360 × 800.
- Próxima ação de cada passo da ponte: ao abrir a ponte e depois de "Ver exemplo" e "Ir para o desafio", a tela rola só o necessário para "Ver exemplo", "Ir para o desafio" e "Conferir este exemplo" ficarem à vista, com o começo do passo perto do alto quando cabe. A rolagem é animada, menos com movimento reduzido.
- Segunda ponte na mesma lição: o estado da ponte (passo, opção marcada, retorno, vitória) é zerado quando ela fecha. Com o mesmo erro, volta a ponte vencida, montada, para reler. Com um erro diferente, vem a ponte nova, do passo 1, sem nada marcado e sem elogio.
- Mapa: o nome da trilha vai até duas linhas na barra de cima. Ícone de mostrar senha: um olho desenhado com Views, porque o app não usa SVG.

## Rodada 4.3 no app

- "Experimentar sem conta": o mesmo bloco da web (botão principal e aviso), só quando `/api/auth/config` devolve `visitante: true`. O aviso é o do aparelho (`experimentarAvisoApp`). O toque pede `POST /api/mobile/visitante` e segue o caminho do login por senha (SecureStore e entrada no app). Com o visitante oferecido, "Entrar" fica secundário, como na web. `limite_visitante` aparece no cartão de erro da entrada. No site publicado, o visitante continua desligado.
- Ponte reaberta: o aviso neutro `ponteReabertaAviso` fica logo abaixo da cena, no lugar do elogio da vitória. O botão do desafio diz "Verificar", texto que vem do contrato.

## Rodadas 4.4 e 4.5 no app

O app segue a web 4.5.1 (`c56460a`). "Ver como funciona" na entrada abre a apresentação sem sessão, com os quatro primeiros passos. Ela termina em "Entendi", que volta à entrada com o foco no link, ou em "Experimentar sem conta", com o visitante ligado. As diferenças vêm do toque e da tela estreita:

- Fechar a apresentação: o voltar do aparelho fecha, como o Esc da web. Na prévia web do app, o Esc e as setas também funcionam. Na abertura, a web põe o foco do teclado no título do passo. No app, o TalkBack vai ao título e o foco do teclado segue o sistema.
- Último passo com "Experimentar sem conta": abaixo de 600 px, os botões ficam um sobre o outro, para o rótulo caber numa linha. "Voltar" fica em cima e a ação principal embaixo, no lugar de "Continuar". Na web, abaixo de 768 px, os dois botões dividem a largura e o rótulo quebra em duas linhas.
- Os quatro momentos usam as peças do próprio app, paradas: o cartão "Fonte do seu material" da lição, a cena da ponte vencida (as quatro tábuas verdes e o Stu na chegada), os cartões do Explique em tamanho compacto e o mapa com "Ponte construída" e o selo de sincronia. Os textos são os exemplos de `mensagens.apresentacao.exemplos`.
- Na web, as tábuas da ponte trazem o texto. No app, como na lição, os rótulos ficam na legenda numerada abaixo da cena, começando por "Sua tentativa". O mapa perdeu as duas estrelas, como na web, para o selo de sincronia caber no canto.

