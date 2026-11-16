# Roteiro de fala do filme de lançamento

O filme tem **2:00**. Cada um aparece **uma vez, por 20 segundos**. Enquanto o vídeo gravado não entra, o filme mostra um espaço reservado com o nome, o relógio e esta sugestão de fala.

## Onde cada um aparece

| Quem | Entra | Sai | Duração | Onde fica na tela |
|---|---|---|---|---|
| **Júlio** | 0:06,7 | 0:26,7 | 20 s | janela de 800×800 px, à esquerda (x 110, y 140) |
| **Miguel** | 1:30,0 | 1:50,0 | 20 s | janela de 800×800 px, à direita (x 1010, y 140) |

Ao lado da janela, os gráficos seguem a fala em três tempos. Quem mudar o texto mantém os três assuntos na mesma ordem e nos mesmos tempos (eles estão em `filme/src/roteiro.js`).

## Júlio: o problema (0:06,7 a 0:26,7)

| Tempo no filme | Dentro da fala | O que aparece ao lado | Sugestão de fala |
|---|---|---|---|
| 0:06,7 – 0:13,3 | 0 a 6,7 s | "Conteúdo não falta." (cartões de vídeos, PDFs e cursos passando) | "Aprender sozinho hoje é assim: você procura um assunto e recebe uma montanha de vídeos, PDFs e cursos." |
| 0:13,3 – 0:20,0 | 6,7 a 13,3 s | "Falta praticar." (o contador de horas assistindo e a lista de prática vazia) | "Dá para passar horas assistindo e, na hora de fazer, não sair do lugar." |
| 0:20,0 – 0:24,3 | 13,3 a 17,7 s | "Errou? Ninguém explica." (o exercício marcado como errado, sem explicação) | "E quando você erra, ninguém explica o porquê." |
| 0:24,3 – 0:26,7 | 17,7 a 20 s | a tela limpa e a música cresce para o logo | "Por isso criamos o Studoo." |

## Miguel: como funciona (1:30,0 a 1:50,0)

| Tempo no filme | Dentro da fala | O que aparece ao lado | Sugestão de fala |
|---|---|---|---|
| 1:30,0 – 1:36,7 | 0 a 6,7 s | "Você pede. A IA monta a trilha." (o pedido vira as etapas: conceito, exemplo, exercício, prática) | "No Studoo, você diz o que quer aprender e a IA monta uma trilha de lições curtas, na ordem certa." |
| 1:36,7 – 1:43,3 | 6,7 a 13,3 s | "Errou? O caminho muda." (o desvio pelo reforço até o acerto) | "Em cada lição você pratica. Se errar, o Stu explica de outro jeito, até fazer sentido." |
| 1:43,3 – 1:47,7 | 13,3 a 17,7 s | "Web e app. O mesmo progresso." (e as tecnologias: Next.js, React Native + Expo, PostgreSQL, OpenAI) | "Funciona na web e no app, com o progresso salvo." |
| 1:47,7 – 1:50,0 | 17,7 a 20 s | a tela limpa e a música cresce para o fecho | "Aprenda qualquer coisa, uma lição por vez." |

## Como gravar

- Celular ou webcam **deitado (16:9)**, em 1080p, com o rosto **no centro** do quadro: o filme usa o quadrado do meio da imagem.
- Comece a falar logo no início do arquivo e pare em **20 segundos** (o que passar disso é cortado).
- Lugar silencioso e luz de frente. Não precisa de música: a trilha do filme abaixa sozinha durante a fala.

## Como colocar os vídeos no filme

1. Salve os arquivos como `julio.mp4` e `miguel.mp4` em `video/filme/public/falas/` (pode ser só um deles).
2. Em `video/filme`, rode `node montar.mjs`. Só as duas cenas de fala são refeitas: o vídeo entra na janela, a música abaixa mais nos espaços que têm fala e a voz é nivelada.
3. Para voltar ao espaço reservado, apague o arquivo da pasta `falas` e monte de novo.
