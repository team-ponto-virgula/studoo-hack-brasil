# Filme de lançamento do Studoo

O filme que apresenta o Studoo no HackBrasil: **2:00**, **1920×1080**, **60 quadros por segundo**, com som. Esta pasta guarda tudo o que o gera. O arquivo de vídeo não fica no repositório.

## O que o filme mostra

| Tempo | Cena | O que mostra |
|---|---|---|
| 0:00 | Abertura | "Aprender algo novo devia ser simples." A avalanche de conteúdo: "Muito conteúdo. Pouca prática." |
| 0:06,7 | **Fala do Júlio (20 s)** | O problema, em três tempos, ao lado da janela dele. |
| 0:26,7 | O logo | O Stu pousa, o logo monta: "Aprenda qualquer coisa. Uma lição por vez." |
| 0:33,3 | O pedido | Digitar "Quero aprender violão do zero" e ver a trilha se montar. |
| 0:43,3 | A lição | O mapa, o Stu explica, o diagrama do acorde e o som do Lá menor. |
| 0:53,3 | O erro | Errar, abrir "outro jeito de entender" e acertar na nova tentativa. |
| 1:03,3 | A prática | Cronômetro e a batida para tocar junto; "Como foi?" e a lição concluída. |
| 1:13,3 | Qualquer assunto | Culinária, história, inglês, frações e fotografia; a correção da resposta aberta. |
| 1:20 | O seu material | O material vira trilha e a lição cita a página. |
| 1:26,7 | Web e app | O site no computador e o app no celular, na mesma lição. |
| 1:30 | **Fala do Miguel (20 s)** | Como funciona, em três tempos, ao lado da janela dele. |
| 1:50 | Fecho | Trilha concluída, o lema, o logo e os créditos. |

A sugestão de fala, os tempos e o jeito de encaixar os vídeos gravados estão no [roteiro](ROTEIRO.md).

## Transparência

- **As telas do app são gravações reais**, feitas no ambiente local em **modo demonstração** (`IA=falsa`): as trilhas mostradas são as prontas, sem IA ao vivo. O filme diz isso em todas as cenas com gravação. A cena do pedido mostra a trilha "se montando" como o app faz nesse modo; ela não é uma geração da OpenAI.
- Alguns trechos de espera, leitura e digitação estão **acelerados**; os toques, as correções e as cenas com som passam em tempo real.
- Os cartões da abertura e os gráficos ao lado das falas são **ilustrações** (não são dados de uso nem números de pesquisa). O filme não traz percentuais nem depoimentos.
- A frase "A IA monta a trilha", no espaço do Miguel, descreve o produto com a IA ligada; ela aparece num gráfico, não em cima de uma gravação.
- **O som**: a música e os efeitos são sintetizados por `audio/trilha.mjs` (não há amostras nem faixas de terceiros). O acorde de Lá menor e a batida de violão das cenas da lição e da prática são o **som do próprio app**, gerado pelo mesmo código (`packages/contratos/src/som.ts`). A música anda a 144 BPM, o dobro dos 72 BPM da batida do app, para os dois caírem no mesmo tempo sem acelerar a gravação.

## Como é feito

| Pasta | O que faz |
|---|---|
| `captura/` | Grava o app de verdade, quadro a quadro. O Chrome roda com relógio virtual: cada quadro avança exatamente 1/60 s, então animações, cronômetros e sons do app ficam no tempo do vídeo. Cada roteiro (`cenas/*.cjs`) grava um trecho e guarda os toques, as teclas e os momentos importantes. |
| `filme/` | A composição em [Remotion](https://www.remotion.dev) (React). `src/tempos.js` é a fonte única dos tempos; `src/cenas/` tem uma cena por arquivo; `montar.mjs` renderiza cena por cena, gera a trilha e junta tudo. |
| `audio/` | A trilha sonora, que lê os mesmos tempos do filme: o som nasce dos mesmos números que a imagem. |
| `entrega/` | A página para assistir (`assistir.html`) e um servidor de arquivos com suporte a avançar e voltar o vídeo. |

Os desenhos do cenário (árvores, casas, nuvens) e as fontes são os do app: `filme/preparo.mjs` os copia de `src/ui/mundo-desenhos.ts` e de `apps/mobile/assets/fontes` na hora de montar.

## Montar de novo

Precisa de Node 24, do `ffmpeg` no caminho, das dependências do repositório (`npm ci` na raiz) e do [Playwright](https://playwright.dev) para gravar. Se alguma ferramenta estiver em outro lugar, diga onde em variáveis de ambiente ou num `ambiente.local.json` nesta pasta (veja `ambiente.cjs`).

1. **Deixe o Studoo rodando** em modo demonstração, com o banco local ([guia](../docs/RODAR-LOCALMENTE.md)): o site em `http://localhost:3100` e, para a cena do app, a prévia web do Expo em `http://localhost:8097` (ou aponte `STUDOO_WEB` e `STUDOO_APP`).
2. **Grave o app** (a partir da raiz do repositório):

   ```bash
   node --import tsx video/captura/respostas.mjs      # o que tocar e escrever em cada exercício das trilhas prontas
   video/captura/fila.sh 01-pedido 02-licao1 03-acorde 04-ritmo 05-fim 06-ingles 07-assuntos 08-material 09-desktop 10-app
   node video/captura/publicar.mjs                    # leva os clipes para o filme, com os toques e as marcas
   ```

3. **Monte o filme**:

   ```bash
   cd video/filme
   npm install
   node montar.mjs            # renderiza o que falta, gera a trilha e junta tudo
   node montar.mjs --forcar   # refaz todas as cenas (uns 30 minutos em 4 núcleos)
   ```

   O resultado sai em `video/saida/`: `studoo-lancamento.mp4`, uma versão leve para a web e o som separado (`trilha.wav`, `so-musica.wav`, `so-efeitos.wav`).

Para conferir uma cena sem montar o filme: `node foto.mjs cena-pedido:60,300,540` desenha esses quadros numa folha em `filme/saida-fotos/`.

## Trocar a música

A imagem e os efeitos não dependem da música. Para usar outra faixa, mantenha `so-efeitos.wav` (toques, transições e o som do app) e misture com a faixa nova:

```bash
ffmpeg -i studoo-lancamento.mp4 -i so-efeitos.wav -i minha-musica.mp3 \
  -filter_complex "[1:a][2:a]amix=inputs=2:normalize=0:duration=first[som]" \
  -map 0:v -map "[som]" -c:v copy -c:a aac -b:a 256k -t 120 studoo-com-outra-musica.mp4
```

Os momentos fortes caem em 0:26,7 (logo), 0:41,7 (trilha pronta), 0:50,0 (acorde do app), 1:01,7 (acerto), 1:05,0 (batida do app), 1:11,7 (lição concluída) e 1:56,7 (logo final).
