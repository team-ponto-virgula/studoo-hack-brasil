# Produção dos sons do Studoo

**Estado:** 19/11, revisão do Sound Designer a pedido do dono ("as músicas ruins", "atraso nos sons").
Vale para `public/sons/` (web) e `apps/mobile/assets/sons/` (app), que são byte a byte iguais.
A regra de onde o som toca e como a pessoa controla continua na [spec 12](../specs/12-som.md).

**Decisão do dono (19/11):** só o Lo-fi de Estudo (`lofi_estudo`, versão de d5bf5aa) toca, em laço, no app inteiro, com os efeitos por cima, sem parar nem baixar a música. Os outros quatro arranjos ficam aqui como registro de produção e não são oferecidos na folha "Som". Recomendação do Designer: tirá-los do pacote do app e de `public/` (são uns 3,5 MB), mantendo as fontes que geram tudo.

## O que foi consultado (e o que não foi)

Referência de clima, com áudio do próprio compositor (Ambrose Yu, para o Duolingo):

- `https://ambroseyu.com/work/duolingo-adventures` — descrição do autor: tema em laço, ritmo de caminhada, "calmo que ainda parece Duolingo, sem dar ansiedade", com um encerramento curto aparentado do tema para a lição concluída.
- `https://ambroseyu.com/work/duolingo-core-product-sounds` — descrição do autor: sons de interação diretos e uma família que cresce com a recompensa (5, 10, lição perfeita).

Baixei três MP3 dessas páginas e **medi** (não escutei: esta máquina não tem saída de áudio e quem julga o som é o dono):

| Arquivo do compositor | Duração | Pico | Andamento estimado | Faixa 0,5–2 kHz |
|---|---|---|---|---|
| Tema de Adventures (laço) | 90,0 s | −5,8 dBFS | ~65 (meio-tempo) | 4,3% |
| Encerramento de Adventures | 3,9 s | −7,5 dBFS | fanfarra | 11,5% |
| "5 seguidas" (acerto) | 1,6 s | −1,8 dBFS | — | **83,3%** |

O que tirei disso, e que está no resultado: tema em laço com frase cantável, encerramento curto que cita a cadência do tema, e efeitos com a energia em 0,5–4 kHz (a faixa que o alto-falante do celular entrega). Nenhum arquivo, melodia ou timbre de terceiro foi usado: composição e síntese são minhas, feitas em `scripts/som/gerar-trilha.py`.

## Identidade musical

- **Ré maior, 86 BPM, 4/4, 32 compassos (89,30 s)** em quatro frases: A, A′ (contracanto e arpejo), B (nova melodia, mais aberta) e A″ (volta com *pickup* do dominante).
- Melodia entre D5 (587 Hz) e D6 (1175 Hz) — o miolo que o alto-falante pequeno reproduz. Graus conjuntos, saltos pequenos, respiração no fim de cada frase.
- Harmonia: D | G | Bm | A | D/F# | G | Em7 | A7 (frase B: Bm G D A Bm Em7 G A7).
- Instrumentos sintetizados: kalimba/malho, sino, pad quente, baixo curto com harmônicos (o celular não reproduz abaixo de ~200 Hz), flauta, piano de feltro, piano elétrico FM, chocalho, bumbo, escova, vinil, chuva e vento.
- Arranjo para celular: corte em 55 Hz, −2,6 dB em 320 Hz (tira o barro), +2,6 dB em 2,6 kHz e +2,4 dB em 6,5 kHz (presença), picos limitados só no topo e os cinco climas nivelados a **−24 LUFS**.

## Os cinco climas (mesmo tema, arranjos diferentes)

| id | arquivo | formato | duração | laço | papel |
|---|---|---|---|---|---|
| `foco_calmo` | `public/sons/fundos/foco-calmo.mp3` | MP3 44,1 kHz mono, 80 kbps | 89,33 s (laço de 89,30 s) | 32 compassos | **cue principal**: tema na kalimba + pad + contracanto de flauta. É o que a spec 12 recomenda para a aula |
| `chuva_suave` | `chuva-suave.mp3` | idem | 89,33 s | idem | caixinha de música esparsa sobre chuva |
| `lofi_estudo` | `lofi-estudo.mp3` | idem | 89,33 s | idem | piano elétrico em meio-tempo, bumbo, escova, vinil |
| `biblioteca` | `biblioteca.mp3` | idem | 89,33 s | idem | piano de feltro, muito espaço, sem percussão |
| `brisa_natural` | `brisa-natural.mp3` | idem | 89,33 s | idem | flauta à frente, harpa, vento |

Todos com 873 KB (limite de 1 MB), pico entre −4,7 e −11,9 dBFS e −24,3 a −24,7 dBFS RMS.

**Onde a música toca:** é uma só no app inteiro, depois da entrada (spec 12): o Lo-fi de Estudo, em laço. Na entrada, na recuperação de senha e nas páginas públicas `/t` e `/p` não toca.

## Emenda do laço

- A cauda de 1,2 s é dobrada no começo (`fecha_laco` em `gerar-trilha.py`) e o corte cai no compasso exato: o fim continua no começo, sem *fade* nem degrau.
- O arquivo começa com 26 ms do próprio fim (pré-rolo) e o compasso 1 cai exatamente em `aparoInicioSeg = 0,026 s`, que é onde o toca-sons começa a tocar. Assim o laço do navegador cobre os 32 compassos inteiros e começa no ataque, sem cortar o tema.
- Cada clima termina com um *pickup* do dominante (A4 e C#5) nas duas últimas colcheias, que resolve na tônica do compasso 1.

**Medido no Chromium** (`OfflineAudioContext.decodeAudioData`, a mesma decodificação que o toca-sons da web usa; página local servida em `http://…:8765` e analisada no navegador):

| | `foco_calmo` | `lofi_estudo` |
|---|---|---|
| Duração que o navegador entrega | 89,3283 s (3.939.380 amostras) | idem |
| Silêncio no começo / no fim | 0 / 0 amostras | 0 / 0 |
| Laço com `loopStart = 0,026` e `loopEnd = duração` | 89,3023 s (32 compassos) | idem |
| Salto na emenda ÷ passo típico do próprio arquivo | **0,19×** | **0,68×** |
| Nível 50 ms antes / depois da emenda | −33,2 / −17,1 dBFS | −35,5 / −15,3 dBFS |
| Começo do compasso 1 | 26,01 ms (o `loopStart`) | idem |

O Chromium **tira** o atraso e o enchimento do codificador MP3: o buffer já começa na música. A primeira versão do arquivo começava no compasso 1, então o `loopStart = 0,026` cortava 26 ms do ataque a cada volta — no `lofi_estudo` isso dava um degrau de 3,5× o passo típico (estalo audível). O pré-rolo de 26 ms resolve sem mexer no player: o laço passa a cobrir os 32 compassos e a emenda é a do material original.

O mesmo cálculo está em `python3 scripts/som/verificar-som.py --laco-web <arquivo>` (lê o bloco LAME, simula o buffer com e sem o atraso e compara com o começo sem aparo). O bloco LAME deste MP3 traz 576 amostras de atraso e 1.036 de enchimento.

**Num navegador que não tire o atraso** (o caso que o pré-rolo cobre): o começo cai 0,94 ms dentro da cauda, que está a −35 dBFS, e sobra ~11 ms de enchimento no fim — abaixo do limite em que se percebe buraco. Não foi possível medir outro motor além do Chromium nesta máquina.

## Efeitos

22 efeitos, mesmos IDs e mesmos nomes de arquivo de antes; WAV PCM 16 bits mono 44,1 kHz.

- **Ataque:** todos começam em 0,00–0,02 ms de silêncio e o primeiro pico chega em 0,4–3,3 ms. Os seis que tinham subida lenta foram refeitos: `acerto` (era 82 ms), `erro` (99 ms), `concluir_licao` (242 ms), `concluir_trilha` (307 ms), `conta_criada` (273 ms), `geracao_pronta` (211 ms).
- **Família musical:** `acerto` (D5→A5), `concluir_licao` (D F# A D), `concluir_trilha` (motivo B A G resolvendo em Ré) e `conta_criada` (arpejo de Ré) saem da cadência do tema, como o encerramento aparentado da referência. `erro` (G4→F4) é curto, grave e simpático.
- **No celular:** `erro` e `erro_rede` foram refeitos para ter corpo em 200–800 Hz; o `erro` antigo tinha 0,3% da energia em 0,5–3 kHz (quase inaudível no alto-falante).
- **Volume:** cada efeito foi medido (RMS dos 50 ms mais fortes) e o volume do catálogo leva todos ao mesmo alvo por prioridade — `alta` ≈ −9, `media` ≈ −13, `baixa` ≈ −18. Antes, `erro` tocava 5 dB abaixo de `acerto` com o mesmo papel.

## Amostra de mixagem: Lo-fi + acerto + erro

O dono escolheu o `lofi_estudo` como única música, em laço no app inteiro, com os SFX por cima sem interromper nem baixar o fundo. A amostra `amostra-mixagem-lofi-volta-acerto-erro.mp3` (14 s, 160 kbps) mostra exatamente essa combinação, com os bytes de `d5bf5aa`:

- fundo na amplitude do app (volume `0.24` do catálogo, sem ducking), atravessando a volta do laço: a emenda cai em **4,000 s** da amostra;
- `acerto` a **2,5 s** (`volume 0.90`) e `erro` a **8,0 s** (`0.86`), somados ao fundo sem alterar o ganho dele.

Medido na soma: pico combinado **−2,28 dBFS** no WAV (−2,73 dBFS no MP3 160 kbps), **nenhuma amostra em 0 dBFS** e 2,3 dB de folga. O pico da mistura é o do próprio efeito (−1,5 dBFS × 0,90 = −2,4 dBFS); o fundo entra em −37 dBFS RMS e acrescenta menos de 0,2 dB, então ele não é fonte de saturação. Na emenda, o degrau é 0,07× o passo típico da mistura e o fundo vai de −47,9 a −27,7 dBFS em 50 ms, sem estalo.

## Antes e depois (medido, não ouvido)

| Fundo | antes: RMS / centro / 0,5–3 kHz | depois: RMS / centro / 0,5–3 kHz |
|---|---|---|
| `foco_calmo` | −21,6 / 234 Hz / **1,0%** | −24,4 / 570 Hz / **65,8%** |
| `brisa_natural` | −21,7 / 196 Hz / **1,9%** | −24,5 / 605 Hz / **76,3%** |
| `lofi_estudo` | −21,4 / 189 Hz / **0,0%** | −24,3 / 449 Hz / **40,4%** |
| `biblioteca` | −21,7 / 1289 Hz / 41,6% | −24,7 / 649 Hz / **68,3%** |
| `chuva_suave` | −24,3 / 409 Hz / 16,4% | −24,7 / 755 Hz / **58,4%** |

Os antigos eram drones: 43–67% da energia abaixo de 200 Hz, quase nada na faixa da voz e do alto-falante, nenhuma melodia. Os novos têm melodia audível, a mesma loudness nos cinco e 6 dB de folga de pico sob os efeitos e a voz.

## Regenerar

```bash
python3 scripts/som/gerar-trilha.py musica     # os cinco climas (web + app + demo 128 kbps)
python3 scripts/som/gerar-trilha.py efeitos    # os 16 efeitos refeitos
python3 scripts/som/verificar-som.py --laco public/sons/fundos/*.mp3
```

Precisa de `numpy` e de um `ffmpeg` com `libmp3lame` (caminho em `FFMPEG`). Os scripts são a fonte de produção: mexer neles e rodar de novo reproduz os arquivos. As sementes são fixas (mesmo resultado a cada execução).

## Limites

- **Não escutei o resultado**: não há saída de áudio nesta máquina. A conferência foi por medição (loudness, bandas, picos, ataque, emenda, espectrograma) e pela composição escrita. O ouvido do dono decide.
- Não houve teste em aparelho físico (iPhone/Android); a emenda no app depende do cruzamento do toca-sons, que é do Mobile & QA.
- A coluna "celular" das medições (energia entre 400 Hz e 4 kHz) é um **proxy digital** da faixa que o alto-falante pequeno reproduz — não é teste de alto-falante.
- A emenda foi medida no Chromium e simulada para o caso sem corte de atraso; Firefox e Safari não foram medidos.
- O texto da linha do clima na folha "Som" (`OPCOES_FUNDO_UI`) do Lo-fi era "Batida lenta, sem melodia"; com o novo arranjo há melodia discreta, e o Lead aprovou em 19/11 o texto **"Batida lenta e abafada"**, que vale no catálogo, na spec 12 e nos testes.
