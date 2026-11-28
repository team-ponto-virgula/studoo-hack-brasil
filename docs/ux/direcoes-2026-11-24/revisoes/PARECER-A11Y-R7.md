# R7 — confirmação independente da candidata

Candidata **`f0c9b7fb3fb962827fd743096fee935b4873ed29`**, examinada em 24/11/2026 por HTTP em Chromium 156.0.8078.79. Revisão somente leitura. Todas as execuções foram encerradas e a fonte foi liberada explicitamente; depois disso houve apenas consolidação dos arquivos gravados.

**Resultado:** 210 capturas canônicas novas, 36 vistas do aviso alterado e 138 verificações de clipboard/teclado passaram. Nenhum achado médio novo neste escopo. **D3/D5/D6/D7 = 9,0 em cada direção**, sustentados pelas provas novas R7 e pela equivalência delimitada das provas R6. Esta ficha não atribui nota global ou de produto instalado.

## Prova nova da fonte R7

| Conjunto novo | Resultado e limite |
| --- | --- |
| Canônico | **210 PNGs novos DPR2**: 35 páginas × três direções × 390×844/360×800. Headers físicos 780×1688/720×1600, 210/210 conferidos. |
| Fonte servida | **17/17 respostas HTTP** coincidem por SHA-256 com os blobs da candidata. |
| Aviso de compartilhamento | **36 vistas**: três fixtures × seis pares × 100%/200%, DPR1. Texto, quantidade, ordem e métricas conferidos. |
| Clipboard/teclado | **138/138 checks** nos seis pares: 54 de fallback/teclado e 84 de retorno tardio. Zero pageerrors. Clipboard controlado, sem operação real do sistema. |
| Equivalência | **17 arquivos comparados**, 14 byte idênticos a R6 e três alterados; **26 unidades relevantes do app idênticas**. Leitura/diff, zero novos testes de navegador nesse subparecer. |

Os 17 HTML/JS/CSS recursivos foram verificados contra os blobs do commit completo e receberam hashes antes/depois, `sourceStable=true`. Incluem material/personal, media/social e vendor. `matriz.json` contém `metadata.commit`, hashes completos, medidas e as 210 linhas. `http-source.json` confirma os bytes servidos. Nenhum PNG antigo foi copiado ou reetiquetado: o capturador desta rodada executa somente os 210 canônicos; `states=[]` e `expanded=[]` identificam que as variantes R6 não são capturas R7.

## Leitura, contraste e rodapé

| Medida R7 | Jornada Azul | Caderno Claro | Foco Vivo |
| --- | ---: | ---: | ---: |
| Menor alvo canônico | 44 px | 44 px | 44 px |
| Menor CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto examinado | 12 px | 12 px | 12 px |
| Menor contraste de texto normal canônico | 5,417:1 | 5,254:1 | 5,318:1 |

Nas 210 vistas: zero erros JavaScript, controle sem nome, alvo abaixo de 44 px, auxiliar abaixo de 12 px, contraste textual reprovado, recorte/overflow horizontal ou botão de rodapé fora da viewport. Os avisos novos também passaram nessas métricas de geometria/texto em 100%/200%; esse roteiro não instrumentou pageerrors separadamente.

Contraste usa cores CSS computadas e fundos efetivos compostos por alfa, luminância WCAG e limiares 4,5:1 normal/3:1 grande. Textos desabilitados são separados. Isso não mede texto em raster, toda borda/ícone ou condições físicas de renderização. Ampliação de texto significa fonte raiz 32 px no protótipo, sem alegação de Dynamic Type nativo.

## Aviso central novo

As três fixtures usam uma trilha própria, variando somente os metadados e o título:

- Com material `guia.pdf` e título `SQL com GUIA.PDF`, há um aviso que diz explicitamente que o título traz o nome do arquivo; a comparação ignora caixa.
- Com o mesmo material e título genérico, o aviso orienta conferir o título, que pode conter o nome do arquivo.
- Um título com `.pdf` sem metadados de material recebe o aviso geral; a extensão sozinha não cria uma alegação de material.

Em todos os 36 casos, o aviso esperado aparece **uma única vez, antes de Ver Código Studoo**, e não permanece a afirmação absoluta antiga “Arquivo, nome e fotos não são publicados”. Arquivo bruto e dados pessoais são distinguidos do título/trechos/páginas que acompanham a cópia.

O primeiro harness procurava `.note`; esse componente é `.publication-note`. O conteúdo já estava na página. O JSON, script e log iniciais foram preservados com sufixo `harness-inicial`; o seletor foi corrigido e os 36 casos reexecutados na mesma candidata. Esse falso negativo de seletor não foi atribuído ao produto nem somado como cobertura nova. Prova final: `aviso-compartilhamento.json` e 36 PNGs próprios R7.

## Clipboard e integração por teclado

O fallback válido de app/social expõe diálogo nomeado **Link de exemplo**, foco inicial correto, ciclo de Tab/Shift+Tab e Escape devolvendo o foco ao acionador. O Código Studoo mantém o diálogo **Compartilhar este exemplo** e seu retorno; o fallback do clipboard seleciona o campo rotulado **Link de exemplo**, mostra `role=status` e permite continuar por Tab.

As promessas controladas foram resolvidas e rejeitadas depois de mudanças efetivamente conferidas: navegação nos três pontos de entrada; troca da própria para uma recebida em app/media; mudança de destino no app; retirada/status na entrada social. As 84 verificações tardias conservaram tela, toast e foco escolhidos. Não surgiram modal ou retorno de foco atrasados. Os JSONs registram contexto antes/depois, foco e estado, além dos 54 checks de fallback.

As janelas instrumentadas de dois frames tiveram mediana 24,8 ms e p95 32,2 ms. São observações locais do harness, não latência real de clipboard, rede ou aparelho. Não houve escrita real no clipboard, seletor ou folha nativa; promessas foram interceptadas para provocar sucesso/rejeição e concorrência de modo reproduzível.

Esta prova confirma o acesso e a resposta local dos ramos afetados. Confirmação/cancelamento/retirada e integridade completa do domínio compartilhado têm o parecer de fluxo próprio; esta especialidade não o substitui por uma captura de estado.

## Provas R6 históricas e equivalência

Base histórica **`28b003e6c29728e1fd8c96f14efbb497353b0d10`**. Todos os CSS/HTML do inventário de 17 arquivos do protótipo e os módulos material/personal completos são byte idênticos. As 26 unidades comparadas incluem render, restauração de foco, K5, conteúdo/marcação de exercício/editar, cores, listeners, `go`, `ask` e helpers pertinentes. A API apenas acrescenta `getRenderToken`; material/personal não o consultam. O diff delimita mudanças novas a compartilhamento/Código e seus retornos assíncronos.

| Prova histórica, não reexecutada como R7 | Como é sustentada nesta candidata |
| --- | --- |
| 120 transições K5, 270 registros de cores/anterior e 1.200 de material/personal | Unidades relevantes e módulos completos idênticos; novos ramos de compartilhar separados. |
| 24 cenários longos/36 PNGs: título80 e material160 a 100%/200% | CSS e marcação pertinente inalterados, fontes R6 preservadas, 210 bases novas R7 e 18 avisos novos a 200%. Não são 24 novos cenários R7. |
| 90 estados comuns, 105 ampliados e 156 variantes dirigidas R6 | Permanecem vinculados a R6; equivalência delimita continuidade, sem PNG reetiquetado. |
| Movimento normal/reduzido e resposta/espera local R6 | CSS e caminhos pertinentes intactos; novos retornos de clipboard têm prova R7. Não se apresenta medição de geração R6 como tempo aferido novamente. |
| 186 checks comuns, 42 guards de foto e 66 da bancada parcial R6 | Provas históricas preservadas e diff sem mudança nesses ramos. Nenhuma recontagem no total R7. |

`equivalencia/equivalencia.json` registra hashes de blobs R6/R7, unidades com trechos/linhas e comparação da API. Isso demonstra equivalência **delimitada**, não equivalência universal do programa. Os três arquivos JS alterados foram identificados explicitamente; seus ramos de compartilhar não receberam aprovação por herança.

## Notas e gates deste parecer

| Critério | Jornada | Caderno | Foco | Fundamentação |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Parecer completo de conteúdo/fluxo fora deste recorte. |
| D2 | null | null | null | Acesso dirigido não aprova todo o domínio. |
| D3 | 9,0 | 9,0 | 9,0 | Canônicos frescos, aviso novo 100/200 e equivalência dos longos R6. |
| D4 | null | null | null | Parecer de arte/visual. |
| D5 | 9,0 | 9,0 | 9,0 | Prova R6 identificada + invariância de estilos/caminhos pertinentes. |
| D6 | 9,0 | 9,0 | 9,0 | Métricas novas, fallback/teclado novo e equivalência dos ramos R6. |
| D7 | 9,0 | 9,0 | 9,0 | Espera local R6 delimitada e novos retornos assíncronos conferidos. |
| D8 | null | null | null | Evidência dirigida não substitui o domínio completo de recuperação. |
| D9 | null | null | null | Integração e confiança completas pertencem ao fluxo. |
| D10 | null | null | null | Mesma matriz de 18 famílias depende da cobertura consolidada. |

DG3/DG4 passam no conjunto especializado demonstrado, considerando os ramos R6 equivalentes e as provas novas R7. DG1/DG2/DG5/DG6 e nota global aguardam os demais pareceres/consolidação. Não há nota 9,5/10, aprovação universal ou uso do objetivo solicitado como evidência.

Produto web/iOS/Android instalado, leitores reais, gestos, teclado virtual/safe area, clipboard/arquivo/câmera/microfone nativos, OCR/IA/email/API/moderação reais e uso por pessoas **não foram validados**. C1–C10 do produto e distribuição TestFlight permanecem separados. Nenhuma política de `file://` foi contornada.

## Arquivos preservados

Em `/workspace/work/revisao-a11y-r7/`: `matriz.json`/`resumo.json`, 210 PNGs DPR2; `http-source.json`; `aviso-compartilhamento.json`, 36 PNGs e bruto do harness; `parecer-qa-r7.json`; scripts `matriz-final.cjs`, `source-guard.cjs`, `aviso-compartilhamento.cjs`, `consolidar-parecer.cjs`. Subpareceres: `teclado/RELATORIO-TECLADO-R7.md` e `equivalencia/RELATORIO-EQUIVALENCIA-R7.md`, com JSONs/scripts/diff. R1–R6 continuam nos diretórios originais; nenhuma prova histórica foi apagada ou promovida a execução nova.
