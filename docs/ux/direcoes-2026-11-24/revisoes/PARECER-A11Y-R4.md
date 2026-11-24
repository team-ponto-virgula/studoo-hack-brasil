# R4 — geometria, reflow e foco da candidata

Candidata **`a6f2e09b559b3c531b66fbc404839d661d304f48`**, examinada em 24/11/2026. Revisão somente leitura do protótipo HTML. Fontes estáveis durante os roteiros; nenhuma candidata posterior foi testada nesta rodada.

**Resultado:** email nas notas e foco original da leitura de foto foram corrigidos. Permanecem dois achados médios: um título técnico longo é cortado no cabeçalho da lição, e um foco escolhido no cabeçalho durante a leitura da imagem se perde ao renderizar. D3/D6 continuam em 8; a meta não está aprovada nesta candidata.

## Fonte e execução

| Arquivo | SHA-256 R4 |
| --- | --- |
| `app.js` | `5bfbd13c1b5856f01f36a0a96bac741000d22ea656e029457f1e18d4999d13ee` |
| `accessibility.css` | `72989cbcbaf419faf790ee5a3bfb63465ffca5fd47fef21563ba6d0ba01b6f93` |
| `media-pages.js` | `38dec9a5115332ec0c7ad4ba1e8ca9ea9ca443cb2c19181aca950458051c8cd3` |
| `directions/jornada.css` | `cf20e039dd9f3b2e71464b82e482346d30e8d662cd5eba17340f90d6733267b3` |

O capturador descobriu recursivamente os 13 HTML/JS/CSS presentes no protótipo desta candidata e registrou hashes antes/depois. `sourceStable` foi verdadeiro. Treze é o total encontrado nesta fonte, não uma lista que dispense módulos adicionados futuramente.

| Conjunto | Escopo observado |
| --- | --- |
| Capturas canônicas | **210 PNGs novos:** 35 páginas × três direções × 390×844/360×800, DPR2 real: 780×1688/720×1600 pixels. Métricas em pixels CSS. |
| Estados de desenho | **90 vistas** em 360×800: variantes de exercício, erro/acerto, salvamento, expiração, permissão/Activity, gravação/transcrição, Vale rever, conclusão e publicação. |
| Texto a 200% | **105 vistas:** 35 páginas × três direções em 360×800, com conteúdo longo. Não é repetição dos 120 casos completos de formatos da R2. |
| Emails longos | **18 casos:** código principal, código expirado e recuperação enviada × três direções × 100%/200% em 360. |
| Título técnico longo | **Seis casos:** lição × três direções × 100%/200% em 360. |
| Teclado e movimento | **186/186 checks dirigidos positivos**; guards da foto **36/42**, com seis reproduções do mesmo K4b. |

As 90 variantes e 105 vistas ampliadas são conferências físicas do desenho, não prova de todos os fluxos de negócio. As capturas canônicas são da fonte R4 e não devem receber etiqueta de uma candidata posterior. A coordenação pediu encerramento após as provas úteis; não executei o complemento amplo de dados longos inicialmente planejado e não o incluo nas contagens.

## Métricas canônicas

| Medida | A | B | C |
| --- | ---: | ---: | ---: |
| Menor alvo do app | 44 px | 44 px | 44 px |
| Menor CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto renderizado | 12 px | 12 px | 12 px |
| Menor contraste normal examinado | 5,417:1 | 5,254:1 | 5,318:1 |

Nas 210 vistas canônicas: zero erros JavaScript, controles sem nome, alvos abaixo de 44 px, auxiliares abaixo de 12 px, contraste reprovado, recorte/overflow horizontal ou controle de rodapé fora da viewport. As 90 variantes e 105 vistas ampliadas também passaram nessas métricas. Isso não inclui os dados diferentes do cabeçalho longo descritos abaixo.

Os 210 PNGs foram produzidos novamente, entre 20:51:23 e 20:53:43 UTC. Variantes e texto ampliado usam DPR1, explicitado nos registros; somente o conjunto canônico é DPR2. Contrastes são de cores computadas e fundos efetivos, sem transferir a prova a artes raster ou leitores de tela.

## Correções confirmadas

- Email longo do código principal, código expirado e recuperação enviada: **18/18** casos passaram sem corte ou overflow. Os 12 casos de notas que falhavam na R3 foram fechados; o texto completo permanece legível a 200%.
- K1/K2/K3 continuaram positivos: diálogos nomeados e retorno ao acionador; foco no item ordenado e anúncio de posição; início da gravação focando Parar, com parada/cancelamento devolvendo textarea e preservando rascunho.
- K4 original: após sucesso ou erro de decode da imagem, o foco retorna deliberadamente ao controle. Navegação, cancelamento, mudança de formato e foco fora de `#app` foram respeitados.
- O detalhe de grade da Conclusão B não voltou a aparecer na vista ampliada desta candidata; as estatísticas dessa conclusão foram removidas.
- Os seletores da bancada continuam com alvos de pelo menos 44×44 px.

## R4-A1 — título sem espaços é cortado no cabeçalho da lição

**Médio · D3 · três direções, 100% e 200% em 360.** O título técnico de exemplo `SQL_BibliotecasComunitarias_ConsultasRelacionadas` aparece em `.context small`. Ao contrário dos títulos e corpos já protegidos, esse cabeçalho não quebra o token. A moldura oculta a parte que excede a largura.

O documento e a área principal não ganham overflow horizontal; o recorte está no próprio cabeçalho, demonstrando por que medir somente `document.scrollWidth` ou `.app-main` não bastaria. O texto do título aparece nos ranges fora da viewport, nas seis reproduções. A captura foi feita na lição; não se afirma ter repetido todas as páginas que reutilizam esse cabeçalho.

**Correção sugerida:** permitir encolhimento e quebra no contexto do cabeçalho e seus textos, preservando o título e o controle de sair. Repetir título técnico e título com espaços nas duas larguras e escalas, sem ocultação ou redução artificial de texto.

Provas: `titulo-cabecalho.json` e `titulo-cabecalho-{direção}-{100|200}.png`.

## K4b — um novo foco no cabeçalho se perde ao concluir a leitura

**Médio · D6 · três direções × duas larguras.** Durante o decode controlado da fixture HTTP, focar **Meu perfil**, no cabeçalho (`data-go="perfil"`). Ao resolver a leitura, `render(false)` remove o botão e não o restaura: a identificação de foco considera `data-action`, `choice` e outros, mas não `data-go`. O foco fica em BODY com documento focado; Tab seguinte chega a Voltar.

O ramo original de sucesso/erro, o cancelamento, a navegação e o foco fora do app passaram. Das 42 verificações dos guards, somente as seis variantes desse caso falharam. Não é motivo para apagar ou reabrir os resultados positivos dos outros guards.

**Correção sugerida:** preservar a identidade/ocorrência do controle realmente focado antes da renderização local, incluindo `data-go`, e repetir o caso com o cabeçalho e outro controle. Não puxar foco após navegação/cancelamento.

A prova usa fixture própria em HTTP para executar o ramo de leitura local; não comprova o seletor nativo nem sua abertura por teclado. Nenhum `file://` ou política foi contornado. Provas: `teclado/foto-guards.json` e capturas associadas.

## Movimento e resposta local

Entrada normal única de 180 ms, uma iteração; preferência reduzida do sistema/app mantém conteúdo e ações com animação `none` e duração 0 s. Selecionar resposta não recomeça a entrada. Geração: pendência em **2,6–8,3 ms**, proposta em **1608,2–1615,7 ms**, por timer demonstrativo nominal de 1600 ms; cancelamento conserva objetivo e impede retorno tardio.

São medições locais do protótipo no host Cloud, não latência de API/IA, pintura física ou desempenho em aparelho. A presença de um estado na matriz não prova permissão, áudio, upload ou persistência nativos.

## Notas e gates deste parecer

| Critério | A | B | C | Escopo |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Compreensão completa não avaliada por esta especialidade. |
| D2 | null | null | null | Controles dirigidos/rodapés, sem aprovação de todo o domínio. |
| D3 | 8,0 | 8,0 | 8,0 | R4-A1 médio aberto. |
| D4 | null | null | null | Identidade/acabamento com parecer visual. |
| D5 | 9,0 | 9,0 | 9,0 | Movimento e controle observáveis novamente conferidos. |
| D6 | 8,0 | 8,0 | 8,0 | K4b médio aberto. |
| D7 | 9,0 | 9,0 | 9,0 | Resposta/espera/cancelamento locais medidos. |
| D8 | null | null | null | Subfluxos conferidos; sem revisão completa de todos os erros/recuperações. |
| D9 | null | null | null | Sem aprovação de confiança/persistência do produto. |
| D10 | null | null | null | 35 bases não aprovam todos os subestados das 18 famílias. |

**DG3/DG4 continuam reprovados; DG1/D10 não são aprovados por esta matriz canônica.** A auditoria de cobertura identificou representações adicionais para uma próxima rodada. Não há nota global ou meta 9 aprovada nesta R4.

Não foram executados React Native, aparelho, leitor de tela, teclado virtual, IA/API real ou microfone. O seletor real de arquivo permanece sem validação; a fixture prova apenas o ramo de leitura local. C1–C10 do produto e provas nativas permanecem separados.

## Arquivos preservados

Em `/workspace/work/revisao-a11y-r4/`: `matriz-final.cjs`, `matriz.json`, `resumo.json`, 210 PNGs canônicos DPR2, variantes e ampliadas; `notas-email.cjs`/`email-notas.json`; `titulo-cabecalho.cjs`/`titulo-cabecalho.json`; `teclado/RELATORIO-TECLADO-R4.md`, `resultado.json`, `resumo.json`, `foto-guards.json`, scripts e capturas. Os dados são sintéticos.

Esta revisão terminou antes de liberar a fonte. O parecer foi escrito somente a partir dos resultados gravados da R4; não mistura testes de futuras alterações.
