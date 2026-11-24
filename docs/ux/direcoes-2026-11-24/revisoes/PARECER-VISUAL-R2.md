# Parecer visual independente — R2

Revisor: `revisao_visual_r1` · candidata **31fb42736d15d75ed75d7c1cf046f01d81a9251d** · 24/11/2026. Esta rodada sucede o [parecer R1](PARECER-VISUAL-R1.md), que permanece como histórico. Foram avaliados desenho HTML mobile e subfluxos locais; não houve execução de React Native, iPhone/Android, microfone, IA, login ou persistência em servidor.

**Resultado: A e C atingem 9 nas facetas desta revisão; B ainda tem um defeito de reflow a corrigir.** Não foi calculada nota global por este revisor, pois as demais competências pertencem aos outros pareceres. A conclusão não aprova branding final nem o produto instalado.

## O que foi conferido nesta fonte

Chromium 156.0.8078.79, Playwright, `/usr/bin/chromium`, Linux. Captura principal de **20:19:56 a 20:22:01 UTC**, com hashes idênticos antes/depois dos 12 arquivos de HTML/JS/CSS usados, incluindo módulos de foto/QR e segurança/publicação.

- **360 vistas em tamanho padrão:** 35 páginas-base + 20 estados + 5 formatos adicionais de exercício, nas três direções e em 390×844/360×800.
- **210 vistas de geometria a 200%:** todas as 35 páginas, nas duas larguras e três direções.
- **60 casos de conteúdo longo:** início, pedido, proposta, mapa e perfil, 100%/200%, duas larguras e três direções. O nome sem espaços e o título/objetivo longos da R1 foram mantidos. **60/60 sem overflow ou rodapé fora da tela.**
- **408 PNGs principais**, capturas dirigidas, pranchas e inspeção em tamanho original dos mapas, novas telas, gravação/transcrição, revisão e caso residual da conclusão B. Os arquivos ficam em `/workspace/work/revisao-visual-r2`.
- **Zero pageerrors** na captura de 570 vistas. Todos os rodapés ficaram inteiros. Houve um único caso com overflow horizontal interno: conclusão B em 360×800 a 200%.
- **42 verificações interagidas (14 por direção):** seguir sem acertar → conclusão “Vale rever” → mapa depois de reload local; iniciar gravação por toque, timer ilustrativo, cancelar mantendo texto, parar e revisar transcrição; escolher imagem de exemplo, aproximar, confirmar e salvar no perfil; ver QR com aviso demonstrativo; escolher motivo de denúncia, conferir e obter protocolo local. Todas passaram sem pageerror.
- **Movimento local:** repetição do probe da R1, nas três direções com `no-preference` e `reduce`. Selecionar `>=` não iniciou animações, não mudou a opacidade e não moveu o título. A entrada de navegação mantém 180 ms nominais; em movimento reduzido, a animação computada é `none`/0 s.

Evidências: `resultado.json`, `longos.json`, `motion.json`, `subfluxos.json`, `overflow-b-conclusao200.json`, scripts e imagens. Em `longos.json`, `sameAsMainCapture: true` confirma que a fonte coincide com a captura principal desta R2; o nome de campo reaproveitado da R1 foi corrigido para evitar ambiguidade. A medição não compara os hashes de R2 aos da implementação antiga.

Hashes principais: `app.js` = `2ebf5cf30fca4f4b29e9af91a658c0692d85a809e16ae38f5f922a1bb62a6a15`; `accessibility.css` = `a05379e9a26e42a6a3f8dfdb06df35e2f730b85cd00fab2c962b8ddbaabe6d95`. Os temas A/B/C mantiveram seus hashes anteriores; os demais hashes e os módulos novos estão no resultado completo.

## Fechamento dos achados da R1

| Achado R1 | Resultado R2 |
| --- | --- |
| Conectores A cruzavam “Praticando” e “Desafio”. | **Corrigido.** O traço termina no último nó de cada parte. A leitura dos títulos foi preservada em 390/360. |
| A/B estouravam em Interesses, Explorar, Perfil público e Meu perfil a 200%; nomes longos também falhavam. | **Corrigido nos casos reproduzidos.** Menus/badges/nomes ficam na largura disponível, sem reduzir fonte ou truncar. O caso residual abaixo é uma regra específica da conclusão B. |
| Toda seleção reanimava a área inteira por 180 ms, com 5 px de deslocamento. | **Corrigido.** Os seis probes de escolha local registraram zero animações, zero deslocamento e opacidade 1. A dispensa por movimento reduzido passou. |
| Ausência de “seguir sem acertar”/“Vale rever”, gravação/parar/transcrição e prévia do Código Studoo. | **Corrigido no escopo de desenho.** Os estados agora têm telas/ações observáveis e foram percorridos localmente nas três direções. Foto/recorte e denúncia/publicação também receberam frames próprios. Não é validação dos recursos nativos ou serviços reais. |

## Única correção restante nesta competência

**V1-R2 · D3 · Médio localizado — conclusão B a 200% em 360 px.** A área rolável mede 360 px, mas seu conteúdo chega a **362 px**. O último valor “Seu” fica parcialmente cortado; “próximo” quebra em “próxi/mo” numa coluna estreita, apesar de haver bastante espaço vertical.

Causa identificada: a regra específica `body[data-direction="caderno"] .screen[data-page="conclusao"] .stats` ainda aplica `1fr 1.75fr 0.75fr` e vence a regra comum de reflow. A última coluna mede aproximadamente **64 px**, enquanto o texto “Seu” ocupa **86 px**; o grupo tem `scrollWidth` **342 px** para 320 px de caixa. Isso não é um erro de medição do contorno de um SVG: o corte é visível no quadro `caderno-conclusao-200-final-360.png`.

Além disso, o cartão `.completion-next` apresenta `scrollWidth` 320 px para 315 px internos, embora permaneça dentro da viewport. Ao corrigir, dar `min-width:0` e quebra adequada ao seu conteúdo evita pressão semelhante com títulos/descrições longos.

Aplicar o reflow de estatísticas com especificidade suficiente para B (ou retirar essa grade rígida), sem esconder números, reduzir letras ou transformar a palavra cortada em abreviação. Repetir conclusão B nas duas larguras, padrão/200%, com título/descrição longos. A mudança localizada não exige reapresentar toda a R2 como se tivesse sido repetida.

## Notas e limites

| Critério | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo | Justificativa |
| --- | ---: | ---: | ---: | --- |
| D3 — hierarquia/leitura/adaptação | 9,0 | 8,0 | 9,0 | A/C passaram o conjunto visual/geométrico declarado; B mantém V1-R2 aberto. |
| D4 — identidade/acabamento do desenho | 9,0 | 9,0 | 9,0 | Componentes e hierarquia coerentes, três composições distinguíveis e novas telas integradas. A nota considera o kit provisório disponível, não a aprovação do Stu caderno final. |
| D5 — movimento com controle | 9,0 | 9,0 | 9,0 | Navegação breve, escolhas locais estáveis, modo reduzido respeitado, nenhuma ação condicionada ao término da animação. Sem medição de frames em aparelho. |
| D10 — cobertura/consistência observada | 9,0 | 9,0 | 9,0 | As 35 páginas-base e os estados críticos desta competência estão equivalentes e navegáveis; 42 checks dos novos subfluxos passaram. A matriz completa e os fluxos restantes dependem da consolidação dos outros pareceres. |

D1/D2/D6/D7/D8/D9 e notas globais permanecem `null` neste parecer; não se calcula média normalizando essas lacunas. A pequena regressão B mantém sua faceta D3 abaixo da meta até correção e nova evidência.

As três direções preservam as teses: A tem o caminho mais próximo do princípio do Duolingo, B expressa caderno/materialidade, C prioriza foco e composição editorial. Não foi feita pesquisa com pessoas nem medida de preferência, compreensão, satisfação ou retenção. Arte do novo Stu, APIs, armazenamento real, paridade web/RN, teclado/safe area, VoiceOver/TalkBack e desempenho nativo continuam sem aprovação por estes números.
