# Parecer visual independente — R3

Revisor: `revisao_visual_r1` · candidata **902eca4e3a8e8ac374d79972677a1ed3edc83859** · 24/11/2026. Reteste localizado, posterior às [R1](PARECER-VISUAL-R1.md) e [R2](PARECER-VISUAL-R2.md), sem reescrever seus resultados. Nenhuma fonte do protótipo foi alterada por este revisor.

**Resultado: a conclusão B foi corrigida; a meta ainda não pode ser confirmada em D3 por um caso de email longo no retorno de recuperação, comum às três direções.** O caso de código de confirmação, que usa `.lead`, passou. A mensagem de recuperação enviada usa outro componente e ainda não quebra o email.

## Reteste executado

Chromium/Playwright em Linux, viewport 390×844 e 360×800, texto padrão e 200%. Foram medidas **36 vistas**: conclusão, código de confirmação e recuperação com instruções enviadas, nas três direções. O payload de email é sintético, com **138 caracteres**, local de 63 e um rótulo de domínio de 61 caracteres: `'n'.repeat(63) + '@' + 'd'.repeat(61) + '.example.test'`. Não houve envio de email ou uso de conta real.

Os 12 arquivos de HTML/JS/CSS usados mantiveram hashes iguais antes/depois. A captura ficou em `/workspace/work/revisao-visual-r3`, com `resultado.json`, `retarget.cjs`, `resumo.log` e imagens. **Zero pageerrors; todos os rodapés inteiros.**

| Caso | Vistas | Resultado |
| --- | ---: | --- |
| Conclusão em A/B/C, duas larguras, padrão/200% | 12 | Passou: zero overflow no conteúdo e nos detalhes medidos de estatísticas/próximo passo. |
| Código de confirmação com email longo | 12 | Passou: o texto quebra dentro da largura e o CTA fica inteiro. |
| Recuperação `s=enviado` com o mesmo email | 12 | Falhou: a mensagem em `.note` transborda horizontalmente nas três direções. |

O `git diff 31fb427..902eca4` foi conferido. Os três CSS de direção, base CSS, módulos de mídia/social e fornecedor do QR permanecem com os hashes da R2. A continuidade de D4/D5/D10 abaixo se apoia nas provas dessa rodada anterior para o conteúdo não afetado e nesta inspeção das alterações localizadas; não significa repetir as 570 vistas ou os 42 subfluxos.

## V1-R2 fechado — conclusão B

O seletor específico B agora aceita o reflow das estatísticas. Na conclusão 360×800 a 200%, não há o corte de “Seu” nem a coluna que quebrava “próximo” em “próxi/mo”. A grade mantém as palavras em espaços suficientes, usando rolagem vertical quando necessária. O conteúdo de `.completion-next` também não apresenta o overflow interno da R2.

As 12 vistas de conclusão, que incluem A e C como regressão do componente compartilhado, passaram sem overflow de viewport/área rolável ou de estatísticas/próximo passo. Não houve redução de fonte, truncamento ou ocultação para fazer caber.

## V1-R3 aberto — retorno de recuperação com email longo

**Médio · D3 · A/B/C.** O estado `p=recuperar&s=enviado` inclui o email em um `<span>` de `.note`. A correção de `.lead` e `.flow-description` não alcança esse span. Sua largura mínima e a palavra sem espaços levam a área de conteúdo de 360/390 px a:

- **A/B:** `scrollWidth` 1245 px em 100%; 2423 px em 200%.
- **C:** `scrollWidth` 1167 px em 100%; 2266 px em 200%.

O endereço sai da área visível já em texto padrão. Evidência direta: `jornada-recuperar-enviado-100-360.png`, os pares B/C e `resultado.json`. O fato de o CTA continuar inteiro não corrige a informação cortada sobre o destino das instruções.

Recomendação: permitir que o conteúdo textual de `.note` encolha e quebre palavras (`min-width:0` e `overflow-wrap:anywhere` no span, preservando o ícone). Não mascarar, abreviar ou reduzir a fonte do email. Repetir recuperação enviada nas três direções e nas duas larguras/padrão/200%, mantendo código de confirmação e uma nota comum como regressão.

## Notas desta competência

| Critério | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo | Origem da evidência |
| --- | ---: | ---: | ---: | --- |
| D3 — leitura/adaptação | 8,0 | 8,0 | 8,0 | A falha V1-R3 é comum às três. A conclusão B e o código corrigidos passaram; a nota considera o pior caso confirmado. |
| D4 — acabamento do desenho | 9,0 | 9,0 | 9,0 | Composição/tokens da R2 preservados; ajustes localizados não alteraram identidade ou deformaram arte. Somente o kit provisório é considerado, sem aprovação do novo Stu caderno. |
| D5 — movimento com controle | 9,0 | 9,0 | 9,0 | Prova R2 de seleção estável e modo reduzido, com CSS/expressão de entrada preservados na diferença conferida. Não é nova medição de fluidez nativa. |
| D10 — cobertura/consistência observada | 9,0 | 9,0 | 9,0 | As 35 páginas e os subestados visuais R2 permanecem; os ajustes de fluxo são avaliados também pelo parecer competente de fluxos. |

Os demais D, as notas globais e os critérios C do produto/nativo continuam `null` neste parecer. A nota de desenho não se transfere para APIs, persistência real, paridade web/RN, teclado/safe area, leitor de tela ou desempenho em aparelho. A pequena correção restante precisa de prova; não foi arredondada para 9.
