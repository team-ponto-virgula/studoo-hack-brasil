# Parecer visual independente — R6

Revisor: `revisao_visual_r1` · candidata **28b003e6c29728e1fd8c96f14efbb497353b0d10** · 24/11/2026. [R5](PARECER-VISUAL-R5.md), [R4](PARECER-VISUAL-R4.md) e rodadas anteriores preservadas. Nenhuma fonte de UI alterada, nenhum commit criado por este revisor.

**D3, D4 e D5 atingem 9,0 nas três direções no recorte visual observado. O nome de material de 160 caracteres agora quebra na fonte, no diálogo e no apoio. D10 integral permanece `null` neste parecer até a matriz e os percursos competentes. A candidata completa não está aprovada: existe contradição de copy de material confirmada por fluxos em D1/D9, além do callback assíncrono de clipboard encontrado por esse revisor de fluxos.**

## Fonte e execução

Chromium **156.0.8078.79**/Playwright em Linux, 390×844 e 360×800, DPR 1, fonte raiz padrão de 16 px e ampliada a 32 px. Bancada HTML mobile, sintética/local. Não executou React Native, iPhone/Android, teclado/safe area nativos, microfone, OCR, autenticação, API, IA ou email reais.

A comparação `5ad1225..28b003e` identificou sete arquivos de UI alterados: `app.js`, `index.html`, `accessibility.css`, `media-pages.js`, `social-pages.js`, `personal-pages.js/css`. **Dez arquivos permanecem com os SHA-256 da R5**, inclusive os três CSS de direção, base, material JS/CSS, media/social CSS e fornecedor QR. Isso sustenta a continuidade de linguagem visual; não transforma capturas R5 em capturas R6. A geometria e os alvos abaixo foram coletados novamente na R6.

| Bloco R6 independente | Quantidade | Resultado |
| --- | ---: | --- |
| Matriz de quadros: 35 bases e estados/formatos declarados | **127 quadros × 3 direções × 2 larguras × padrão/200% = 1524 vistas/PNGs** | Zero exceções JS, overflow de documento/área principal/componentes internos selecionados ou CTA de rodapé fora. Total confere com o esperado. |
| Conteúdo longo em 15 páginas/estados, dois títulos | **360 vistas** | Zero falhas, zero JS; nome de 40, título válido de 80, arquivo de 160, objetivo de 800, resumo/descrição/email longos. `.context` quebra nas duas larguras/escalas. |
| Fonte do material, diálogo aberto e apoio expandido | **12 combinações, três capturas por combinação** | Zero overflow em cada contêiner, conteúdo preservado. Fecha V1-R5. |
| Nove folhas/expansões abertas por controles da bancada | **108 vistas** | Zero caso incompleto, JS, overflow de documento/conteúdo/diálogo/detalhes ou CTA fora. Inclui balão, apoio, reinício, destinatário, capa, confirmação de postagem e material. |
| Compartilhamento/QR em nove contextos × duas páginas | **216 vistas e 216 verificações** | Todos passaram nas três direções/larguras/escalas. São estados observados; não exercitam o callback de clipboard pendente. |
| Seleção de resposta/interesse/cor/capa, normal/reduzido | **24 probes** | Zero reanimação, alteração de opacidade, deslocamento de título/controle ou rolagem. Capa com delta **0 px**. Entrada de navegação de 180 ms normal e `none`/0 ms reduzido nas três direções. |
| Diagnóstico de copy com título contendo nome do arquivo | **3 quadros**, um por direção, 390 px | Confirma os dois avisos contraditórios na mesma folha. Foi encaminhado a fluxos, sem alegar publicação real. |

Contagens se sobrepõem e não se somam como páginas únicas ou testes funcionais. O parcial genérico foi normalizado para associar e deduplicado com o caso explícito; os dois parciais próprios são **associar e aberta**. Não há alegação de um parcial de lacuna como quadro distinto.

Os **17 hashes antes/depois são iguais** na matriz principal e em longos/fontes/folhas/guards; os quatro complementos coincidem com o baseline principal. `conferencia-final.json` registra esses cruzamentos e o esperado de 1524 vistas. `equivalencia-r5.json` registra os dez arquivos inalterados e sete alterados. O principal conservou os 17 pares completos; exemplos de novos hashes estão em `notas-r6.json` e nas fichas por direção.

Provas em `/workspace/work/revisao-visual-r6/`: `resultado.json`, `casos.json`, `longos.json`, `fontes.json`, `folhas.json`, `guards.json`, `motion.json`, `copy-material.json`, scripts e PNGs. **Seis pranchas novas** de oito quadros foram abertas, duas por direção, além dos PNGs individuais de fonte/diálogo/apoio, restrições de compartilhamento e copy. Isso é inspeção visual de uma amostra declarada, apoiada pelas medidas; não é afirmação de que todos os 1524 PNGs foram abertos individualmente.

A liberação da fonte foi comunicada ao root após a coleta. Redação, pranchas e comparações posteriores usam artefatos salvos. Os eventos cronometrados de geração da R5 não foram repetidos nem rebatizados nesta rodada; as capturas R6 mostram seus estados, e D7 continua fora desta nota.

## Fechamentos e prioridades

### V1-R5 fechado — fonte, diálogo e apoio

O nome `'n'.repeat(156)+'.pdf'` permanece completo e quebra dentro da largura, sem redução de fonte ou truncamento. Em B360, tanto padrão quanto 200%: área principal **360/360**, nome em `small` **247/247**, diálogo **328/328**, parágrafo **280/280** e apoio **318/318** (`clientWidth/scrollWidth`). As três direções e duas larguras/escalas passaram. O diálogo longo usa rolagem vertical; não exige colocar 160 caracteres e a consulta inteira na primeira dobra.

Evidências abertas: `fonte-caderno-100-360.png`, `fonte-dialog-jornada-200-360.png`, `fonte-apoio-foco-200-360.png`. O cabeçalho de 80 caracteres também conserva sua largura e leitura nas 360 vistas longas.

### B1/B2-R5 fechados no desenho observado

“Etapa anterior” aparece no corpo, junto ao progresso/conteúdo de exercício, explicação e retorno. No parcial de associação em 360 px/200%, o rodapé cai de quatro para três ações; a área principal cresce de **361,03 para 426,63 px em A**, **359,03 para 424,63 px em B** e **369,81 para 432,81 px em C**. As saídas seguem visíveis, com mais espaço de leitura. O comparativo usa a fonte R5 identificada e a coleta R6, sem alterar as imagens anteriores.

A legenda de moderação vira uma tag compacta, mantendo a simulação explícita. O cartão de capa reserva texto/ícone/borda: os seis probes de capa normal/reduzido registram agora delta zero; não é apenas ausência de animação. A identificação da trilha no hero C aparece no eyebrow e continua íntegra com título longo. Pranchas `prancha-*-1.png` e `prancha-*-2.png` mostram os ajustes nas três direções.

### D1/D9 — contradição de copy aberta, encaminhada a fluxos

**Médio na competência de fluxos/confiança · A/B/C.** Com título válido `revisao.pdf para a prova` e referência `revisao.pdf`, a mesma folha mostra:

- “Arquivo, nome e fotos não são publicados. Trechos citados, páginas e título da trilha podem aparecer na cópia.”
- “Vão junto o título, os trechos citados nas lições e as páginas de referência. O título traz o nome do seu arquivo. Arquivo bruto e fotos das páginas não vão.”

O segundo aviso descreve o título visível; o primeiro faz uma promessa absoluta incompatível. Os três quadros e textos estão em `copy-material.json` e `copy-material-*.png`. O revisor de fluxos reproduziu o caso em seu diagnóstico `material-nome-probe.json`, na pasta `/workspace/work/revisao-fluxos-r6/`, e confirmou impacto D1/D9. A correção precisa alinhar as mensagens sobre título/trechos/páginas e arquivo bruto/fotos. Não houve envio ou exposição real nesta bancada.

O mesmo revisor informou outro médio D9 no callback assíncrono do clipboard. **As 216 verificações de guard deste parecer não o fecham:** elas examinam superfícies já renderizadas, não a troca de contexto enquanto uma Promise está pendente. Esses achados impedem a aprovação integral; não são apagados pelas notas visuais.

## Limite da cobertura e notas

Os guards novos representam corretamente a própria trilha e a trilha de material por link; cópias recebidas por flag/prefixo, visitante, sessão expirada, ausência de trilha, publicação em revisão e destino material+Explorar conservam saídas claras sem link/QR. Em material+link, Explorar está desabilitado com explicação. As medidas incluem 100/200%, e os casos exatos estão em `guards.json`.

As 127 queries e as folhas abertas demonstram equivalência visual A/B/C e representação das variantes observadas. **Não fecham sozinhas a matriz de 18 famílias/14 LCs, isolamento, cancelamento, retorno e retomada de cada fluxo.** D10 integral continua `null` neste parecer até a auditoria de matriz e as provas competentes de interação. Nenhuma nova ausência de representação foi confirmada pelo visual nesta rodada. A nota histórica D10=8 da R4 continua no registro da R4.

| Critério | Peso | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo |
| --- | ---: | ---: | ---: | ---: |
| D1 — valor/textos | 12 | `null` | `null` | `null` |
| D2 — ação/autonomia | 12 | `null` | `null` | `null` |
| D3 — hierarquia/leitura/adaptação | 12 | **9,0** | **9,0** | **9,0** |
| D4 — identidade/acabamento | 8 | **9,0** | **9,0** | **9,0** |
| D5 — movimento com controle | 10 | **9,0** | **9,0** | **9,0** |
| D6 — acesso observável | 14 | `null` | `null` | `null` |
| D7 — resposta/espera | 10 | `null` | `null` | `null` |
| D8 — feedback/recuperação | 10 | `null` | `null` | `null` |
| D9 — continuidade/confiança | 6 | `null` | `null` | `null` |
| D10 — cobertura/consistência integral | 6 | `null` | `null` | `null` |

D4 preserva diferenças de composição: A usa Stu, superfícies arredondadas e caminho; B usa folha/margem/marca de página; C usa bloco navy e foco compacto no próximo assunto. Os CSS dessas três arquiteturas são os mesmos da R5, com nova inspeção dos componentes afetados. A nota considera o **kit provisório** disponível, sem aprovar o novo Stu caderno ou branding final.

Nota ponderada/global e C1–C10 do produto permanecem **`null`**. Não se normalizam os pesos dos três critérios visuais. As facetas de leitura/movimento observadas passaram; os gates integrais exigem os outros pareceres e os médios D1/D9 continuam abertos na candidata R6. Nativo/TestFlight, uso por pessoas e métricas empíricas não foram realizados por esta revisão.
