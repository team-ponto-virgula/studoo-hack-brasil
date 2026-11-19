# Produção dos sons do Studoo

**Estado:** 19/11, revisão do Sound Designer a pedido do dono ("as músicas ruins", "atraso nos sons").
Vale para `public/sons/` (web) e `apps/mobile/assets/sons/` (app), que são byte a byte iguais.
A regra de onde o som toca e como a pessoa controla continua na [spec 12](../specs/12-som.md).

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
| `foco_calmo` | `public/sons/fundos/foco-calmo.mp3` | MP3 44,1 kHz mono, 80 kbps | 89,30 s | 32 compassos | **cue principal**: tema na kalimba + pad + contracanto de flauta. É o que a spec 12 recomenda para a aula |
| `chuva_suave` | `chuva-suave.mp3` | idem | 89,30 s | idem | caixinha de música esparsa sobre chuva |
| `lofi_estudo` | `lofi-estudo.mp3` | idem | 89,30 s | idem | piano elétrico em meio-tempo, bumbo, escova, vinil |
| `biblioteca` | `biblioteca.mp3` | idem | 89,30 s | idem | piano de feltro, muito espaço, sem percussão |
| `brisa_natural` | `brisa-natural.mp3` | idem | 89,30 s | idem | flauta à frente, harpa, vento |

Todos com 873 KB (limite de 1 MB), pico entre −4,7 e −11,9 dBFS e −24,3 a −24,7 dBFS RMS.

**Onde cada cue toca:** o fundo é um só no app inteiro depois da entrada (decisão do dono, spec 12); o que muda é o clima escolhido. Na entrada, na recuperação de senha e nas páginas públicas `/t` e `/p` não toca. Para a demonstração, o cue é `foco_calmo`: é o tema, e é o único que tem as quatro frases com contracanto.

## Emenda do laço

- A cauda de 1,2 s é dobrada no começo (`fecha_laco` em `gerar-trilha.py`) e o corte cai no compasso exato: o fim continua no começo, sem *fade* nem degrau.
- Cada clima termina com um *pickup* do dominante (A4 e C#5) nas duas últimas colcheias, que resolve na tônica do compasso 1: a volta soa como continuação, não como reinício.
- Medido no MP3 decodificado, em duas voltas: salto na virada entre 0,01× e 1,22× o passo típico de 99,9% do próprio arquivo (sem estalo).
- `aparoInicioSeg = 0,026` (atraso do codificador MP3 que o navegador não tira) e `aparoFimSeg = 0`. No app, o cruzamento de 150 ms já cobre a diferença.

## Efeitos

22 efeitos, mesmos IDs e mesmos nomes de arquivo de antes; WAV PCM 16 bits mono 44,1 kHz.

- **Ataque:** todos começam em 0,00–0,02 ms de silêncio e o primeiro pico chega em 0,4–3,3 ms. Os seis que tinham subida lenta foram refeitos: `acerto` (era 82 ms), `erro` (99 ms), `concluir_licao` (242 ms), `concluir_trilha` (307 ms), `conta_criada` (273 ms), `geracao_pronta` (211 ms).
- **Família musical:** `acerto` (D5→A5), `concluir_licao` (D F# A D), `concluir_trilha` (motivo B A G resolvendo em Ré) e `conta_criada` (arpejo de Ré) saem da cadência do tema, como o encerramento aparentado da referência. `erro` (G4→F4) é curto, grave e simpático.
- **No celular:** `erro` e `erro_rede` foram refeitos para ter corpo em 200–800 Hz; o `erro` antigo tinha 0,3% da energia em 0,5–3 kHz (quase inaudível no alto-falante).
- **Volume:** cada efeito foi medido (RMS dos 50 ms mais fortes) e o volume do catálogo leva todos ao mesmo alvo por prioridade — `alta` ≈ −9, `media` ≈ −13, `baixa` ≈ −18. Antes, `erro` tocava 5 dB abaixo de `acerto` com o mesmo papel.

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
- O texto da linha do clima na folha "Som" (`OPCOES_FUNDO_UI`) do Lo-fi era "Batida lenta, sem melodia"; com o novo arranjo há melodia discreta, e o Lead aprovou em 19/11 o texto **"Batida lenta e abafada"**, que vale no catálogo, na spec 12 e nos testes.
