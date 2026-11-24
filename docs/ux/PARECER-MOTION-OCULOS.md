# Parecer independente — motion v2 «Óculos em foco»

Revisor: agente `revisao_ios`, sem autoria do componente ou do filme. **24/11/2026.** Este parecer avalia a direção visual do **conceito Python**, no equivalente a **390×844**, sem reutilizar as notas da v1. A coreografia é exclusivamente mobile; o site não recebe intro.

## Escopo e versão

- Contrato: [`abertura-motion.json`, versão 2](../../packages/contratos/src/abertura-motion.json), logo de **210×69** sobre branco, sequência de **560 ms**, dissolve de **120 ms**, nominal de **680 ms** e teto de **900 ms**. SHA-256 do contrato final identificado: `1bdf6b883a830f00f7dd3b178cd15dec06c7f0a343cc2f4fb3f4811780cafb67`.
- Renderizador: [`scripts/motion/oculos-em-foco.py`](../../scripts/motion/oculos-em-foco.py), a partir da marca integral e dos [óculos derivados do ícone oficial](../../apps/mobile/assets/marca/abertura-oculos-hd.png). Não houve geração de novo personagem nem recomposição tipográfica das letras.
- Filme examinado: [MP4 de conceito](evidencias/oculos-em-foco-2026-11-24/oculos-em-foco.mp4), **780×1688 a 60 fps**, correspondente a 390×844 em escala 2×. Quadros examinados: **0, 101, 190, 280, 385, 493 e 560 ms**, além da sequência quadro a quadro dos primeiros 600 ms, extraída por ffmpeg. A conferência final de proveniência releu somente o [quadro de foco a 190 ms](evidencias/oculos-em-foco-2026-11-24/frame-190.png): faixa de reflexo a **−24°/4 dp** e vidro com **`#2563FF` a 10%**, alinhados ao componente. Forma, marcos e PNG integral da marca não mudaram.
- A reprodução inclui **500 ms extras de repouso final para apresentação** e 160 ms de cauda. O arquivo de 1,35 s não é medição da duração do app, nem captura de Expo ou aparelho. GIF também é material de apresentação e não prova loop no componente.

Os arquivos antigos 115/218/320/440/563/640 ms existentes na pasta de trabalho pertencem a uma renderização anterior; não compõem a amostra declarada deste parecer.

Proveniência final, após o alinhamento do reflexo e da cor do vidro: SHA-256 do MP4 `0fa244af1974f1b334b9066d4bfbed561767246305e767334eee9bee1d1235fd`; do quadro 190 `3c3346918d76a233b615477a1512473aa693df31a7d6d8fa7eebac4e31a63598`; do renderizador Python `9b3f289f4bc6cda562c1df5ba85542aa7a7612562f61847a4a3670120094598e`. As mídias e os [metadados do render](evidencias/oculos-em-foco-2026-11-24/render.json) ficam no repositório e podem ser reproduzidos pelo script a partir do contrato identificado acima. O [GIF de apresentação](evidencias/oculos-em-foco-2026-11-24/oculos-em-foco.gif) mantém o mesmo limite de escopo do MP4.

## Até três achados

1. **Ritmo e ideia — favoráveis no conceito.** A extração dos óculos, o gesto de foco e a volta ao nome formam três momentos distinguíveis. A ampliação e o pequeno retorno angular dão protagonismo aos dois “o”; o reflexo único explica a ideia óptica sem acrescentar partículas ou efeitos concorrentes. A extração é rápida e intencional, e a recomposição precede o dissolve. Não identifiquei nesse recorte uma necessidade concreta de mais efeitos ou de prolongar a sequência. Reconhecimento por pessoas ainda não foi observado.
2. **Legibilidade, fidelidade e recortes — favoráveis na amostra renderizada.** Em 390 px a marca completa permanece legível; a armação ampliada tem contorno limpo, sem serrilhado ou emenda evidente nas imagens examinadas. O foco não encosta nas bordas da tela. Nos marcos amostrados, os pixels visíveis ficaram aproximadamente entre x=94,5–296,5 e y=361–454,0, com ampla margem. Os quadros **0 e 560** do render são idênticos byte a byte em RGB; o quadro 493 também já usa o mesmo PNG integral. Isso comprova a igualdade dos repousos no filme, não o encaixe do splash do sistema com React em um aparelho.
3. **Tempo e integração — ainda exigem prova separada.** Os 500 ms de apresentação fazem o repouso final parecer mais longo do que no componente. A redução da sequência para 560 ms foi registrada como refinamento para dar margem ao dissolve dentro do teto; o filme não demonstra que os timers reais cumprem esse orçamento. Origem JS, carga dos assets, interrupção, pronto/sequence em qualquer ordem, acessibilidade e saída para a próxima tela pertencem à execução do componente. Não encontrei defeito visual médio/alto confirmado **no conceito examinado**, mas essa conclusão não fecha os gates do app.

## Avaliação e limites

### Comparação com a prévia complementar

Examinei também [frame-151](evidencias/oculos-em-foco-2026-11-24/rnw-151.png), [frame-263](evidencias/oculos-em-foco-2026-11-24/rnw-263.png) e [reflexo](evidencias/oculos-em-foco-2026-11-24/rnw-reflexo.png), **390×844**, capturados do componente **React Native Web**. Os óculos ampliados e inclinados mantêm forma e contorno coerentes com a direção; não há corte e o reflexo fica contido nas lentes. Não identifiquei defeito visual médio/alto confirmado nesses três quadros.

São marcos com **fontes retidas e relógio controlado**, conforme `qa.json`. O número no nome de cada captura não é o mesmo instante da animação no filme Python: o ensaio registra montagem e início do movimento separadamente. Não fiz comparação pixel a pixel entre instantes sem sincronização. Essa captura também não mostra o sistema operacional nem transforma a prévia em iOS.

Os logs de motion da pasta exploratória `hd560` que consultei são **anteriores à correção do deadline absoluto**. Seus tempos e contagens **não aprovam a latência do componente atual**, nem demonstram cumprimento do teto ou desempenho nativo. Não executei novamente esse roteiro nesta revisão; a comparação acima usa os quadros como evidência de composição. A fonte retida no ensaio estático conduz ao fallback; não usar essa captura controlada como ciclo natural ou prova do orçamento atual.

| Critério | Conceito Python | Prévia React Native Web | iOS | Android |
| --- | --- | --- | --- | --- |
| C3 · Composição e adaptação | Composição em 390×844 observada; sem corte no recorte declarado | Três quadros em 390×844 examinados; demais adaptações fora deste recorte | `null` | `null` |
| C4 · Identidade e acabamento | Repousos iguais e contorno favorável na escala renderizada | Óculos/reflexo coerentes com a direção, sem corte nos quadros examinados | `null` | `null` |
| C5 · Movimento e controle | Ritmo visual observado; controle real não comprovado pelo filme | Marcos estáticos examinados; logs exploratórios não aprovam a latência atual | `null` | `null` |

**Não atribuo nota numérica ao app a partir do conceito.** Os antigos 9,5 não aprovam esta v2. Este parecer favorável de direção não equivale a aprovação nativa, teste com leitor de tela, medição de latência do componente ou certificação de acessibilidade. «Antialiasing limpo» refere-se à inspeção visual desse render 2×; não afirma qualidade já medida em todas as densidades ou GPUs.

A próxima conferência de plataforma é um build em iOS/Android: comparar primeiro/final com o splash estático, registrar o ciclo inteiro e as dispensas sem acrescentar o repouso de apresentação. A amostra complementar de React Native Web acima recebe identificação própria e nunca é chamada de gravação iOS. Nenhum código de produção foi alterado por esta revisão.
