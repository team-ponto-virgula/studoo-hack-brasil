# Cobertura e consistência das direções — R7

24/11/2026 · candidata **`f0c9b7fb3fb962827fd743096fee935b4873ed29`**. As matrizes [R4](MATRIZ-COBERTURA.md), [R5](MATRIZ-COBERTURA-R5.md) e [R6](MATRIZ-COBERTURA-R6.md) permanecem históricas. O [protocolo](COBERTURA-E-REVISAO.md), seus pesos e sua régua não foram alterados.

**D10 = 9,0 em A/B/C no escopo declarado do desenho HTML mobile.** As 18 famílias/35 páginas e os 14 LC têm representação, captura e interação identificadas. Os três médios R6 receberam provas novas de correção, sem achado médio/alto/crítico aberto no conjunto examinado. O veredito combina revisão pontual R7 com equivalência delimitada das partes R6; não afirma repetição integral dos testes anteriores.

**A consolidação de desenho alcança 9,0 nas três direções.** Produto web/React Native instalado, iOS/Android, paridade, TestFlight, branding final e uso por estudantes continuam sem essa aprovação e com notas `null`/não realizados. 9,0 é a âncora do conjunto observado, não perfeição universal ou resultado empírico com pessoas.

## Fonte, unidade e procedência

P = representação conferida; I = interação local com efeito/destino verificável; C = captura. **C não implica I.** Query de erro, variante ou estado restrito confere representação/geometria; não prova chegar ao estado, cancelar ou recuperar. Esta matriz identifica de onde vem cada uma dessas provas.

O universo permanece **35 IDs em 18 famílias**, três direções, 390×844/360×800 e texto padrão/200%. A lista visual de 127 quadros da R6 permanece: o parcial genérico é normalizado/deduplicado em Associar; somente Associar e Aberta oferecem parcial. A nova rodada não remove estados para obter nota nem inventa parcial de lacuna atômica.

O diff R6→R7 altera somente **`app.js`, `media-pages.js` e `social-pages.js`**: contexto de clipboard/folha/confirmar/retirar/cancelar e aviso central de compartilhamento. **14 dos 17 HTML/JS/CSS são idênticos**, incluindo todos os CSS/HTML, material e personalização. A QA compara ainda **26 unidades textuais pertinentes do núcleo**, todas idênticas, e a API só acrescenta `getRenderToken`, não consultado por material/personal. Visual confirma sete assets/fontes idênticos ao Git R6. As novas coletas conservaram 17 hashes estáveis e a QA verificou os bytes das 17 respostas HTTP contra os blobs da candidata.

**E7** designa essas comparações, não testes novos de todos os ramos. Fonte: `/workspace/work/revisao-a11y-r7/equivalencia/{equivalencia.json,RELATORIO-EQUIVALENCIA-R7.md}`, `/workspace/work/revisao-visual-r7/equivalencia-r6.json` e `/workspace/work/revisao-fluxos-r7/equivalencia-r6.json`. O inventário de fluxo inclui 26 entradas com assets/exportador/licença, das quais 23 são iguais; não contradiz o denominador 17 HTML/JS/CSS usado por QA/arte/visual.

**H6-F/Q/V/AR** são evidências históricas da fonte `28b003e6c29728e1fd8c96f14efbb497353b0d10`, detalhadas na matriz R6. Continuam com seu commit e diretórios originais. Os complementos R7 não renomeiam nem somam essas execuções à rodada nova.

## Famílias e mínimo observado

Todas as bases têm **P atual e C nova Q7**, 35 páginas × A/B/C × duas larguras. A coluna I identifica o percurso responsável; subestados não repetidos conservam a prova H6 e E7. O mínimo indicado é o **menor julgamento competente sustentado no desenho declarado**, igual em A/B/C, sem média entre propostas ou entre facetas para ocultar defeito. Não é nota de usabilidade de cada página com estudantes.

| Família / IDs | I e variantes com prova | C e facetas de leitura/acesso/arte | Mínimo A/B/C |
| --- | --- | --- | ---: |
| **P01** `boasvindas/apresentacao/interesses` | F7-SQL confirma as cinco cenas/interesses; H6-F1/F2: avançar/voltar/pular e destino; E7 sem alteração nesses ramos. | Q7 base; H6-V/Q variantes, teclado/movimento; E7. | 9,0/9,0/9,0 |
| **P02** `entrar` | H6-F-LC LC02 e F1/F2: conta/visita, restauração/erro; E7. | Q7 base; H6-V/Q estados; E7. | 9,0/9,0/9,0 |
| **P03** `cadastro/codigo/senha/recuperar` | F7-SQL valida email/código/senha; H6-F1/F2: frames/recuperação e demais saídas; E7. | Q7 bases; H6-V/Q erros/ampliação; E7. | 9,0/9,0/9,0 |
| **P04** `pedido/consentimento` | F7-SQL ciclo; H6 pedido/rascunho/limites e LC18; E7. | Q7 bases; H6-V/Q longos/destinatário; E7. | 9,0/9,0/9,0 |
| **P05** `material` | H6-F-LC LC05 e Q-módulos: confirmar/cancelar/recuperar, eventos/foco; módulo íntegro por E7. | Q7 base; H6-V/Q tipos/prévias/erros/200%; E7. | 9,0/9,0/9,0 |
| **P06** `geracao` | F7-SQL gera/aceita; H6-F-LC LC06: eventos, cancelar, erros/espera; E7. | Q7 base; H6-V/Q parciais/espera/erros; E7. | 9,0/9,0/9,0 |
| **P07** `proposta` | F7-SQL/fronteiras; H6-F-LC LC07: aceite pendente/cancelar/falhas; E7. | Q7 base; H6-V/Q longa/aceite/erro; E7. | 9,0/9,0/9,0 |
| **P08** `inicio` | F7-SQL/fronteiras até 5/5/rever/nova; H6-LC08 carga/sincronia/erro; E7. | Q7 base; H6-V/Q/AR hero C/longos/estados; E7. | 9,0/9,0/9,0 |
| **P09** `mapa` | F7 percurso central; H6-LC09 ponte/balão/retorno e Q-diálogos; E7. | Q7 base; H6-V-folhas/Q e AR; E7. | 9,0/9,0/9,0 |
| **P10** `licao` | F7-SQL; H6-LC10 tentativas/reinício/origem/apoio; H6-Q-longos/anterior; E7. | Q7 base; H6-V/Q fontes/diálogo/longos/200%; E7. | 9,0/9,0/9,0 |
| **P11** `exercicio` | F7-SQL; H6 seis formatos/LC11/K5/parciais, com 26 unidades pertinentes e CSS íntegros por E7. | Q7 base; H6-V/Q seis formatos/erros/parciais/200%; E7. | 9,0/9,0/9,0 |
| **P12** `reforco` | F7-SQL erro/reforço/retorno; H6-F1/LC09-12: repetir/vencer/reabrir/voltar; E7. Resolva SQL N/A abaixo. | Q7 base; H6-V/Q vitória/apoio; E7. | 9,0/9,0/9,0 |
| **P13** `explique/retorno` | F7-SQL; H6-LC13 e F2/F3/Q-teclado: envio, cancelamento, texto/áudio locais; E7. | Q7 bases; H6-V/Q envio/Activity/permissão e texto 200%; E7. | 9,0/9,0/9,0 |
| **P14** `conclusao` | F7-SQL/fronteiras: confirmar progresso local, retomar/rever/5 lições; H6 save-erro; E7. | Q7 base; H6-V/Q/AR sem pseudométricas e Stu A de 112 px; E7. | 9,0/9,0/9,0 |
| **P15** `explorar/previa/publico` | H6-LC15/F1–F3: busca/ordem/paginação/Back/scroll/cópia/bloqueio; E7. F7 reforça cópia recebida restrita. | Q7 bases; H6-V/Q estados próprios; V7/Q7 guards afetados. | 9,0/9,0/9,0 |
| **P16** `perfil/editar/foto` | H6-LC16/Q-módulos/cores/foto; E7. F7 callbacks de retirada/confirmar/cancelar agora isolados. | Q7 bases; H6-V/Q postagens/capas/cores/200%; V7/Q7 afetados. | 9,0/9,0/9,0 |
| **P17** `configurar/compartilhar/codigostudoo` | H6-LC17 personalização + E7; **F7 guardas/async/positivos e Q7 clipboard** nos três JS alterados. | Q7 bases; **V7/AR7** aviso/revisão/fallback/restrições; H6 capa por E7. | 9,0/9,0/9,0 |
| **P18** `preferencias/privacidade/ajuda/denunciar/bloqueados` | H6-LC18/F1–F3: destinatário/revogar/sair/excluir/denúncia/bloquear; E7. F7 usa Privacidade como destino de invalidação. | Q7 bases; H6-V/Q folhas/diálogos/movimento; E7. | 9,0/9,0/9,0 |

H6 completa os subestados e as folhas; Q7 base não é usada para aprová-los sozinha. Os nomes dos casos, artefatos e limites estão nas duas tabelas seguintes. Não se alega que cada quadro foi um fluxo completo nem que todos os PNGs de V/Q foram abertos individualmente.

## Os 14 LC — P/I/C e origem exata

| LC | P atual e motivo de aproveitamento | I responsável | C responsável / veredito no recorte |
| --- | --- | --- | --- |
| **LC02** sessão/visita/restauração | Sessão e snapshot separados; ramos não alterados no diff E7. | **H6-F-LC** `LC02-sessao-visita-restauracao`, 10 checks/direção. | Q7 `entrar` base + H6-V/Q restaurando/expirada/credenciais/rede. **Fechado por prova histórica delimitada**, sem autenticação remota nova. |
| **LC05** material | `material-pages.js/css` byte a byte iguais; API nova não é consumida. | **H6-F-LC** `LC05-material-confirmado-e-cancelamentos`, 14 checks/direção; H6-Q-módulos. | Q7 base + H6-V/Q tipos/prévias/erros/picker/200%. **Fechado por E7**. Query de câmera/galeria anterior seguida de ações não vira rota completa nativa. |
| **LC06** geração | Eventos/título/nós Recebida, cancelamento e erros inalterados. | **F7-SQL** ciclo novo; **H6-F-LC** `LC06-eventos-cancelamento-erros`, 14 checks/direção. | Q7 base + H6-V/Q estados parciais/longa/erros. **Fechado**; timers locais não são latência de IA. |
| **LC07** aceite | Aceite cancelável/falhas/cinco lições preservados por diff. | **F7-SQL/fronteiras**; **H6-F-LC** `LC07-aceite-cancelavel-e-falhas`, 8 checks/direção. | Q7 base + H6-V/Q longa/aceitando/falhas. **Fechado**; não se afirma aceite real de API. |
| **LC08** biblioteca | Carga/sincronia/erro/vazio e título ativo C equivalentes. | **F7-SQL/fronteiras** conclui/reabre/retoma; **H6-F-LC** `LC08-biblioteca-carga-erro-retorno`, 8 checks/direção. | Q7 base + H6-V/Q/AR estados/hero. **Fechado**; persistência é local. |
| **LC09** mapa/ponte | Balão/ponte/Vale rever por trilha/lição, sem alteração em E7. | **H6-F-LC** `LC09-12-baloes-ponte-vitoria-retorno`, 8 checks/direção; F7 integração central; H6-Q-diálogos. | Q7 base + H6-V-folhas/Q. **Fechado**; base não substitui a folha de balão. |
| **LC10** lição/origem/reinício | Tentativas, origem, apoio, anterior e reinício atual idênticos; wrap/CSS intactos. | **H6-F-LC** `LC10-tentativas-por-trilha-licao-reinicio`, 8 checks/direção; `LC10-16-17-material-origem-por-trilha`; H6-Q-longos/anterior. F7 central integra a lição. | Q7 base + H6-V-fontes/Q-longos/AR. **Fechado por E7**; os 24 cenários/36 PNGs longos continuam R6. |
| **LC11** formatos/parcial | Seis formatos, parcial Associar/Aberta, feedback/retry e sucessores equivalentes em 26 unidades E7. | **H6-F-LC** `LC11-parcial-preserva-acertos`, 7 checks/direção; H6-Q-K5/cores-bancada e F7-SQL. | Q7 base + H6-V/Q dirigidos, associação/aberta 200%. **Fechado por E7**; 120 transições K5 não foram recontadas como R7. |
| **LC12** reforço | Vitória estável/reler/retorno/reabrir sem mudança. | **H6-F1 e F-LC LC09-12**, com tentativa original preservada. | Q7 base + H6-V/Q vencido/variantes. **Fechado por E7**; Resolva SQL condicional/N/A, não omitido para elevar nota. |
| **LC13** explique/envio | Texto/áudio/envio cancelável/erros não mudaram. | **H6-F-LC** `LC13-envio-cancelamento-erro`, 6 checks/direção; H6-F2/F3/Q-teclado; F7 central. | Q7 bases + H6-V/Q enviando/erro/Activity/permissão/transcrição. **Fechado por E7**; nenhum microfone ou novo teste temporal de 60 s. |
| **LC15** explorar/retorno | Ordem/aba/busca/lista/paginação/scroll preservados por diff. | **H6-F-LC** `LC15-ordem-paginacao-historico`, 8 checks/direção; H6-F1–F3. | Q7 bases + H6-V/Q Novas/paginada/seguindo/erro/prévia/público. **Fechado por E7**; restrições de cópia recebem F7/V7 próprios. |
| **LC16** perfil/postagens | Módulo personal íntegro; postar continua seleção de trilhas, não ativação global do cadastro. Contexto de retirada alterado exige prova nova. | **H6-F-LC** `LC16-postagem-moderacao-retirada-desfazer`, 10 checks/direção e Q-módulos/cores; **F7-positivos** callbacks/retirar/cancelar. | Q7 bases + H6-V/Q/AR postagens/legenda/atividade + V7/Q7 afetados. **Fechado**, incluindo R6-F2 por interação nova. |
| **LC17** configurar/compartilhar | Personalização íntegra; os três JS novos vinculam callbacks à operação de origem, aviso único e origem própria/material. | H6-LC17 personalização, 9 checks/direção; **F7-share/async/positivos e Q7-clipboard** para todas as áreas alteradas. | Q7 bases, **V7/AR7** afetados e Q7 aviso; capa histórica H6 por E7. **Fechado no escopo**, inclusive R6-F1/F3 com provas novas. |
| **LC18** consentimento/privacidade | Flags falsas/destinatário/revogação e ramos de consentimento idênticos. | **H6-F-LC** `LC18-consentimento-destinatarios-revogacao`, 8 checks/direção. | Q7 bases + H6-V-folhas/Q destinatário. **Fechado por E7**; provedor real não foi chamado. |

## R6-F1/F2/F3 — prova nova da correção

| Achado histórico | P atual conferida | I R7 final | C R7 e conclusão |
| --- | --- | --- | --- |
| **R6-F1 — callback fora de contexto** | Núcleo/mídia/folha guardam id, página, cenário, destino, status e identidade do render na origem. O mesmo snapshot acompanha Promise/afterClose. | **F7-async 330/330**: três canais e 11 destinos de invalidação nas três direções. **F7-positivos 252/252** inclui sucesso/fallback/cancelar/baixar válidos; **Q7-clipboard 138/138** confirma teclado/foco. | F7 capturas de contexto e V7 fallback/restritos; AR7 três fallbacks válidos. **Fechado no recorte.** Uma escrita elegível já iniciada não é desfeita; exige-se ausência de novos efeitos/feedback após invalidar. |
| **R6-F2 — retirada no registro errado** | Confirmar/retirar/cancelar usam identidade da operação; retirar legado próprio material+Explorar continua permitido. | F7 casos `callback-retirar-*`, `callback-confirmar-*`, `cancelar-revisao-nao-altera-outra-propria`, `revisar-cancelar-confirmar-validos` e `retirada-legado-material-permitida`. Registros antes/depois idênticos após callback inválido; percurso válido continua funcionando. | Capturas F7/positivos e V7 legado/revisão. **Fechado**; não se fechou apenas bloqueando toda retirada. |
| **R6-F3 — nome do arquivo no título** | Removida a promessa absoluta duplicada; aviso central distingue título/trechos/páginas de bruto/fotos/progresso/respostas/explicações e consulta a origem da trilha. | F7 `R6-F3-disclosure-unico-material`: aviso único/ordem/arquivo de outro pedido/revisão; **Q7-aviso 36/36** inclui título nomeado, genérico e extensão sem material. | **V7** 36 divulgações aplicáveis/48 ordens/zero promessa antiga; **AR7** 24 quadros finais abertos. **Fechado na apresentação e no percurso local**; não houve publicação real. |

Nenhum novo médio/alto/crítico permaneceu aberto nos pareceres finais desta candidata. Os brutos das rodadas falhas continuam guardados; não foram reescritos como se a R6 já passasse.

## Evidências novas e históricas, sem somas indevidas

| Alias | Local/artefato | Quantidade e alcance |
| --- | --- | --- |
| **F7-SQL** | `/workspace/work/revisao-fluxos-r7/resultado.json` | **69/69**, 3 cenários: gerar/aceitar/primeira lição/concluir/progresso/reabrir nas três direções. |
| **F7-fronteiras** | `fronteiras-resultados.json` | **111/111**, 6 cenários: metadados/trilhas e cinco lições→5/5→rever→nova sem apagar. |
| **F7-share** | `compartilhar-resultados.json` | **150/150**, 42 cenários: propriedade/origem/menu/URL/handlers/legado e efeitos bloqueados. |
| **F7-async** | `assincronia-resultados.json` | **330/330**, 165 cenários: 11 destinos — outra própria/recebida, sem plano, visitante, inativa, destino/status, Privacidade, render novo, navegar-voltar e outra tela — nos canais comum/mídia/folha. |
| **F7-positivos** | `positivos-resultados.json` | **252/252**, 105 cenários: canais válidos resolve/reject, folha download/cancelar, confirmação/cancelamento/retirada e disclosure. |
| **F7 final** | `notas-e-contagens.json`, [parecer](revisoes/PARECER-FLUXOS-R7.md), scripts | **912/912 asserções em 321 cenários**, 304/107 por direção, zero JS/exceções. Não inclui os 888 checks históricos R6. Harness de close/render foi rechecado e substituído, sem dupla contagem. |
| **Q7** | `/workspace/work/revisao-a11y-r7/matriz.json`, `http-source.json`, `parecer-qa-r7.json`, [parecer](revisoes/PARECER-A11Y-R7.md) | **210 PNGs novos DPR 2**, 35 bases × 3 × 2 larguras; zero problemas métricos, 17 blobs/HTTP corretos e estáveis. `states/expanded=[]`: os lotes anteriores não foram rebatizados. |
| **Q7 aviso/clipboard** | `aviso-compartilhamento.json`, `teclado/resultado.json` | **36 vistas** (18 padrão/18 a 200%) sem problema; **138/138** verificações de teclado, sem pageerrors. Seletor inicial incorreto `.note` foi corrigido para `.publication-note` e o bruto preservado, sem edição de UI. |
| **V7** | `/workspace/work/revisao-visual-r7/resultado.json`, `conferencia-final.json`, [parecer](revisoes/PARECER-VISUAL-R7.md) | **192 vistas/288 PNGs**, 16 casos × 12 combinações; geometria 192/192, divulgação 36/36, erro próprio 12/12, restritos 72/72, ordem aviso→Código 48/48; zero promessa antiga. Nove PNGs abertos pelo revisor. As 12 expectativas amplas de material-erro no raw foram reconciliadas por aplicabilidade, sem apagar o raw. |
| **AR7** | `/workspace/work/revisao-arte-craft-r7/evidencias.json`, `rechecagem-legado.json`, [parecer](revisoes/PARECER-ARTE-CRAFT-R7.md) | **24 quadros finais DPR 2 abertos**, 17 hashes estáveis; três fixtures de legado corrigidas/rechecadas substituem, sem somar. D4 = 9; demais 53 quadros R6 são históricos por E7. |
| **H6-F** | `/workspace/work/revisao-fluxos-r6/{resultado,novos-resultados,integracao-resultados,fronteiras-resultados,riscos-lc-resultados}.json` | **888/888** de regressão histórica, incluindo 372/372 dos 14 LC. Não foram repetidos integralmente nem somados à R7. Complementos R6 que falharam continuam históricos. |
| **H6-V/Q/AR** | Diretórios `revisao-visual-r6`, `revisao-a11y-r6`, `revisao-arte-craft-r6`; matriz R6 | 127 quadros/1524 vistas visuais, longos/fontes/folhas/guards; QA 90 estados/105 ampliados/156 dirigidos/24 longos, 1200 módulos/120 K5/270 cores-anterior; 53 quadros de arte abertos. Resultados preservados com sua fonte, aproveitados somente nas facetas equivalentes E7. |

Asserção, cenário, vista e PNG são unidades diferentes. Há sobreposição entre F/Q/V/AR, entre posições de rolagem e entre lotes; não se publica uma soma como número de fluxos únicos. As notas de autoria ajudam a reproduzir, mas não integram os totais independentes.

## Critérios, mínimo e gates do desenho

Os pareceres finais de fluxo, QA, visual e arte conservam a menor nota competente por faceta. Esta auditoria acrescenta D10 com base nas 18 famílias, 14 LC, equivalência delimitada e fechos novos, não na contagem de imagens.

| Critério | Peso congelado | A | B | C | Prova competente |
| --- | ---: | ---: | ---: | ---: | --- |
| D1 clareza/textos | 12 | 9,0 | 9,0 | 9,0 | F7 e H6 delimitada; contradição corrigida, três variantes de material. |
| D2 ação/autonomia | 12 | 9,0 | 9,0 | 9,0 | F7 positivos/negativos e percurso central; H6 saídas não alteradas. |
| D3 leitura/adaptação | 12 | 9,0 | 9,0 | 9,0 | Q7/V7 afetados + longos/200% H6 por E7. |
| D4 identidade/acabamento | 8 | 9,0 | 9,0 | 9,0 | AR7/V7 + arquiteturas/assets H6 equivalentes. |
| D5 movimento/controle | 10 | 9,0 | 9,0 | 9,0 | CSS/render iguais; medição normal/reduzida H6, não benchmark R7 inventado. |
| D6 acesso observável | 14 | 9,0 | 9,0 | 9,0 | Q7 métricas/clipboard + H6 K5/cores/diálogos/200% por E7. |
| D7 resposta/espera local | 10 | 9,0 | 9,0 | 9,0 | Q7 afetados; H6 leitura/geração/cancelamento equivalentes. |
| D8 recuperação | 10 | 9,0 | 9,0 | 9,0 | F7 falha/fallback válidos e cancelamento; H6 erro/retry preservados. |
| D9 continuidade/confiança | 6 | 9,0 | 9,0 | 9,0 | F7 snapshots/retirada/disclosure e estado local; origem sintética explícita. |
| D10 cobertura/consistência | 6 | 9,0 | 9,0 | 9,0 | Esta matriz: 18 famílias/14 LC P/I/C, sem ausência declarada nem médio aberto no conjunto. |
| **Ponderada de desenho** |**100** |**9,0** |**9,0** |**9,0** | Não normalizada por facetas faltantes; todas têm fonte, escopo e limite. |

O mínimo competente observado por família/faceta é 9,0 no conjunto declarado, como rastreado acima; nenhuma variante de nota inferior foi ocultada por média. Não se atribui 9,5/10: as confirmações disponíveis sustentam a âncora 9, com limites conhecidos, e não uma medida de excelência universal.

| Gate | Veredito no desenho declarado |
| --- | --- |
| **DG1 cobertura** | **Passa:** 18 famílias/35 bases, 127 quadros e folhas/estados presentes em A/B/C; 14 LC com fontes P/I/C e condicionais reais identificadas. |
| **DG2 operação** | **Passa:** tarefas/saídas nomeadas operáveis; ramos novos têm negativos e positivos, sem bloquear o percurso válido para ocultar o erro. |
| **DG3 leitura** | **Passa:** 390/360 e 100/200%, longos H6 equivalentes, afetados R7 sem recorte/overflow/CTA fora. |
| **DG4 acesso/movimento** | **Passa:** métricas/foco/teclado/reduzido do escopo HTML com origem explícita; nenhum leitor/gesto nativo inferido. |
| **DG5 confiança/recuperação** | **Passa:** três médios R6 corrigidos com prova nova; local/sintético explícito, restrições de material/cópia preservadas e operação inválida não altera outro registro. |
| **DG6 revisão independente** | **Passa no desenho:** pareceres competentes da candidata e provas históricas delimitadas, todos os D≥9, nenhum médio/alto/crítico aberto no conjunto. Sem requisito de 9,5 invocado. |

## N/A e limites que não desaparecem com a nota

- **Resolva comigo:** as cinco lições SQL de `src/servidor/ia/falsa.ts` não fornecem `resolucao`; o callback de `apps/mobile/src/resolva-comigo.tsx:216` condiciona ativação a resolução/estado/responder. N/A nesta comparação SQL. Sua vez, reforço, origem e apoio permanecem avaliados; outra lição que oferece resolução exigirá suas provas próprias.
- **Reinício global:** o produto não oferece ação/API de apagar o progresso inteiro por refazer. N/A como reset global; rever nó concluído e reiniciar a tentativa atual com confirmação/cancelamento continuam representados e interagidos.
- **Perfil:** postar é selecionar trilhas para o perfil, com visibilidade/moderação; não há exigência inventada de ativar/desativar publicamente o cadastro inteiro. Email/respostas/progresso não se tornam públicos no desenho.
- **Implementação:** nenhum aparelho React Native/iOS/Android, VoiceOver/TalkBack, gestos/safe area/teclado virtual, seletor/câmera/microfone/OCR, API/IA/email/auth/moderação/servidor ou clipboard/folha nativos reais foi validado por estas provas. Voz ao vivo não é oferecida na bancada. Efeitos locais interceptados não certificam permissões/plataforma ou autenticação real.
- **Branding e pessoas:** o Stu caderno original ainda é asset pendente; o kit antigo é provisório. Não há aprovação da marca final/intro instalada ou pesquisa com estudantes, taxa de conclusão, retenção ou satisfação. **C1–C10 e nota de produto permanecem `null`; uso por pessoas: não realizado.**

Esta ficha fecha o recorte comparativo do desenho com evidências auditáveis. Preserva o que foi corrigido, o que foi repetido agora e o que permanece histórico por equivalência; não transforma essa aprovação em autorização técnica de release ou prova de qualidade do app instalado.
