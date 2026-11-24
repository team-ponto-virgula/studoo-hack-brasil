# Parecer visual independente — R5

Revisor: `revisao_visual_r1` · candidata **5ad1225f586af063d58f694d4ebe705fcabca081** · 24/11/2026. Fontes congeladas durante a coleta. [R4](PARECER-VISUAL-R4.md) e o histórico anterior permanecem intactos. Este revisor não editou a UI nem criou commit.

**Resultado: D3 = 8,0 nas três direções por um nome de material que transborda na fonte da lição e no diálogo de origem. D4 e D5 = 9,0 no recorte observado. D10 e a nota completa permanecem `null` até a auditoria das 14 lacunas e a conciliação com os percursos independentes.** O avanço de representação é verificável; a quantidade de queries capturadas não fecha todos os ciclos funcionais.

## Fonte, ambiente e coleta

Chromium **156.0.8078.79**/Playwright em Linux, viewport 390×844 e 360×800, DPR 1. Texto padrão e raiz ampliada de 16 para 32 px. É uma bancada HTML de desenho mobile com dados sintéticos: sem React Native, dispositivo, microfone, câmera/OCR, OAuth, IA, email ou API reais. Os 17 arquivos HTML/JS/CSS/fornecedor mantiveram hashes idênticos antes/depois da captura principal e dos complementos com hashes. Os complementos também conferem igualdade com o baseline principal.

| Evidência independente R5 | Execução | Resultado |
| --- | --- | --- |
| `resultado.json`, `casos.json`, `capturar.cjs` | **128 quadros × 3 direções × 2 larguras × padrão/200% = 1536 vistas e PNGs.** As 35 bases continuam 35, com estados/formatos adicionais discriminados. | Zero exceções JS, overflow de documento/área principal, overflow interno nos componentes selecionados ou CTA de rodapé fora da viewport com o conteúdo padrão. Total observado confere com `128×12`; nenhuma direção ficou incompleta. |
| `longos.json`, `longos.cjs` | **360 vistas:** 15 páginas/estados × A/B/C × 390/360 × padrão/200% × duas formas de título. | **24 falhas**, todas na lição com o mesmo nome de material longo; nenhuma outra página falhou nas medidas. Zero JS. Cabeçalho `.context` sem transbordamento nos dois títulos. |
| `fontes.json`, `fontes.cjs` | **12 combinações**, com captura da fonte rolada à vista e do diálogo aberto em cada combinação. | Fonte e diálogo falham nas 12. Confirmam o achado médio abaixo; não são 24 defeitos diferentes. Zero JS. |
| `folhas.json`, `folhas.cjs` | **108 vistas:** nove folhas/expansões × A/B/C × 390/360 × padrão/200%. | Zero exceções/casos incompletos, overflow de documento/conteúdo/diálogo/detalhes ou CTA fora. As folhas foram abertas por controles reais da bancada. |
| `eventos.json`, `eventos.cjs` | **12 quadros de geração**, quatro momentos por direção em 390 px; **15 verificações**, incluindo cancelamento após a chegada das cinco lições. | Todos passaram. Objetivo → título → duas → cinco lições por eventos locais; ícones de livro, sem check de conclusão; cancelamento conserva o objetivo e não retorna tardiamente. Relógio simulado, sem medir IA/rede. |
| `motion.json`, `motion.cjs` | **24 probes:** resposta, interesse, cor e capa × A/B/C × movimento normal/reduzido. | Sem reanimação da tela, alteração da opacidade, posição do título ou rolagem. A capa tem o detalhe baixo de 1,40625 px descrito abaixo. Entrada de navegação: 180 ms normal, `none`/0 ms reduzido, nas três direções. |

Esses blocos têm sobreposição e não se somam como telas únicas, testes de produto ou pessoas. Os quadros de `resultado.json` vêm do `scenarioMap` da bancada, acrescidos de câmera/galeria, recuperação enviada, cinco formatos além da lacuna e parciais de associar/aberta. Um estado capturado por query comprova representação; não comprova envio, cancelamento ou recuperação de seu ciclo.

Os dados longos incluem nome público com 40 caracteres sem espaços, resumo de 160, objetivo de 800, título de 80 sem espaços e outra frase longa, descrição de 140, email sintético de 138 e nome de arquivo de **160**. O primeiro título respeita o limite da trilha; o caso em frase também funciona como estresse de leitura. Nenhum campo foi publicado ou enviado.

Foram abertas **15 pranchas novas** de oito quadros cada, cinco grupos por direção, mais capturas individuais: fonte e diálogo cortados; geração progressiva; destinatário no consentimento; balão de nó ampliado; confirmação de postagem; capa selecionada ampliada; exercício parcial ampliado. As pranchas cobrem 40 estados por direção, não uma inspeção visual individual de todos os 1536 PNGs. As medidas DOM têm seu próprio alcance declarado na tabela.

Todos os artefatos desta revisão estão em `/workspace/work/revisao-visual-r5/`. O `resultado.json` conserva os 17 pares de SHA-256. Exemplos antes = depois:

| Arquivo | SHA-256 |
| --- | --- |
| `app.js` | `730e325477a440f59ebd5eb9581af73ceb0c4dd89e332466f1341ae5edd2995b` |
| `accessibility.css` | `8e8c619517a1107d2409db4789d28569b32782e5e4aa75743abd8ee833b44497` |
| `material-pages.js` | `5fbfd822ad40d4c9f3a58425e139662f5e386b90ac387739c8b50f86b63ccbe9` |
| `material-pages.css` | `0d7ff01e360c956700f84faa3051f7412a7d2f3042ef8f369fb02283c4ba456f` |
| `personal-pages.js` | `451547b6e876aaa528a81ccb78b1e05b7d1e137bbbcb7a3b9082975fd8b08ff1` |
| `personal-pages.css` | `d4fbe86e9123dadcea1f94d2dcc68dae91d311190dddf38c934625e42e099fc3` |

A liberação da fonte foi comunicada ao root após o último complemento. A abertura posterior dos PNGs e a redação usam apenas provas salvas desta candidata.

## Prioridades

### V1-R5 — nome de material corta fonte e diálogo

**Médio · D3 · A/B/C · aberto.** Seed: referência de material da trilha com `nome = 'n'.repeat(156)+'.pdf'`, 160 caracteres, dentro do limite da validação local. Abrir `p=licao&s=retomada`, rolar até “Fonte do seu material” e tocar “Conferir origem [1]”. O `.source-card small` e o parágrafo do diálogo não quebram a palavra longa. O arquivo aceito é identificado só pelo início, com o restante cortado horizontalmente; ter o botão acessível não resolve a leitura da origem.

| Local | Medida padrão | Medida a 200% |
| --- | --- | --- |
| Área principal A/B/C | Largura 360/390; `scrollWidth` entre **1247 e 1250** | `scrollWidth` entre **2422 e 2425** |
| Nome em `.source-card small` | Largura entre 247 e 280; texto com `scrollWidth` **1174** | Mesmo espaço de caixa; texto com `scrollWidth` **2349** |
| Diálogo de origem | Largura 328/340; `scrollWidth` **1469**; parágrafo 1445 | `scrollWidth` **2915**; parágrafo 2891 |

`fontes.json` reproduz as 12 combinações. As 24 falhas do bloco longo repetem duas formas de título com o mesmo arquivo; a causa é o material, não `.context`. O cabeçalho de 80 caracteres agora quebra dentro de 276/306 px, inclusive ampliado.

Recomendação: permitir quebra de nomes sem espaços nos textos da fonte, do apoio que repete o nome e dos diálogos correspondentes, conservando conteúdo, tamanho da fonte e ícone. Verificar o diálogo como contêiner próprio: `documentElement.scrollWidth` continua correto mesmo quando seu parágrafo corta. Retestar a fonte e sua folha nas 12 combinações, com regressão de fonte curta, recurso expandido e cabeçalho longo. Evidências abertas: `fonte-caderno-100-360.png`, `fonte-dialog-jornada-200-360.png` e pares.

### B1-R5 — peso das ações fixas no retorno parcial

**Baixo · D3/D4 · A/B/C.** No parcial, a ação principal e três saídas fixas deixam pouca área para ler a tentativa em 360 px com texto ampliado. Não há overflow ou ação inacessível nas caixas medidas, mas o conteúdo do retorno fica longe da primeira dobra. Recomenda-se colocar “Etapa anterior” junto ao progresso/conteúdo, mantendo recuperação e saída claras. Evidência aberta: `foco-exercicio-parcial-associar-200-360.png`; as pranchas do grupo 3 mostram o padrão nas três direções. É refinamento de hierarquia, separado do médio V1-R5.

### B2-R5 — repetição de avisos nas fixtures de postagem

**Baixo · D4 · A/B/C.** Introdução, bloco de privacidade e bloco de moderação repetem a natureza de exemplo antes de mostrar uma única trilha. O contrato permanece compreensível, mas uma legenda compacta da fixture reduziria repetição sem esconder que a postagem é simulada. As pranchas do grupo 5 comprovam os quatro estados. Na seleção de capa existe ainda um detalhe de 1,40625 px na posição do cartão, presente nos seis probes de capa: o título, a rolagem e a opacidade ficam estáveis. Não bloqueia escolha/leitura; reservar exatamente a altura de rótulo/ícone e borda melhora o acabamento.

## Cobertura: avanço observado e limite da nota

O confronto abaixo usa as 14 LCs da [matriz histórica R4](../MATRIZ-COBERTURA.md) e as notas de autoria [Jornada](../NOTAS-JORNADA.md), [Material](../NOTAS-MATERIAL.md) e [Pessoal](../NOTAS-PERSONAL.md) como roteiro, sem converter as asserções dos autores em aprovação independente.

| LC | Representação nova observada por este revisor | Evidência R5 |
| --- | --- | --- |
| LC02 | Restaurando, expirada, credencial e rede com contexto de sessão. | `casos.json`/grupo 1. |
| LC05 | Câmera/galeria; preparação/leitura/prévia; limites de formato, bytes, páginas, texto/CSV; erros/permissão; picker e limites abertos. | Matriz principal, grupo 2 e folhas LC05. |
| LC06 | Título e nós progressivos, espera longa, IA indisponível/limite e cancelamento sem chegada tardia. | Grupo 1 e `eventos.json`. |
| LC07 | Aceitando, erro de aceite, falha de abertura e proposta longa por dados próprios. | Matriz principal/grupo 3. |
| LC08 | Carregando, sincronizando e falha próprias. | Matriz principal/grupo 3. |
| LC09 | Ponte e Vale rever juntos; balão nomeado do nó atual aberto por toque. | Grupo 3 e folha LC09. |
| LC10 | Retomada/reinício confirmado, fonte aberta, apoio expandido e retorno anterior oferecido. | Matriz, fontes e folhas LC10. A fonte longa falha em D3. |
| LC11 | Parcial de associação com pares corretos marcados; aberta com critérios. | Casos específicos `f=associar/aberta&s=parcial`, grupo 3. |
| LC12 | Quadro estável de desafio vencido e saídas para reler/questão original. | Matriz principal/grupo 3. |
| LC13 | Enviando cancelável e erro contextual com repetição; gravação/transcrição permanecem representadas. | Matriz principal/grupo 4. Não houve gravação real. |
| LC15 | Em alta/Novas e lista paginada distintas. | Matriz principal/grupo 4. Preservar filtros/rolagem após retorno requer o percurso de fluxos. |
| LC16 | Sem social, novidades coerentes com o registro de exemplo, seleção de trilha para postagem e quatro estados de moderação. Confirmação aberta. | Grupos 4/5, folha LC16. |
| LC17 | Capa/tema, seleção e erros por campo. | Matriz principal/grupos 4/5, folha LC17 e probes. Isolamento por trilha exige o percurso competente. |
| LC18 | Destinatário local antes do consentimento e na privacidade; flags explícitas IA/API/email falsos. | Folhas LC18 e `STUDOO_FLAGS` da fonte. Não é destinatário de produção. |

**Não foi confirmada nova ausência de representação nesta amostra visual.** As faltas que limitaram D10 na R4 receberam novos quadros. Ainda assim, abrir esses estados não comprova cancelar/retentar/retomar de cada família, nem fecha sozinho DG1. D10 integral fica `null` neste parecer até a auditoria documental independente das 14 LCs e a conciliação com fluxo/QA. A nota histórica 8,0 da R4 é preservada no documento da R4; não é transferida automaticamente nem promovida para 9 pela contagem de capturas.

## Notas e pesos congelados

| Critério | Peso | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo |
| --- | ---: | ---: | ---: | ---: |
| D1 — valor/textos | 12 | `null` | `null` | `null` |
| D2 — ação/autonomia | 12 | `null` | `null` | `null` |
| D3 — hierarquia/leitura/adaptação | 12 | **8,0** | **8,0** | **8,0** |
| D4 — identidade/acabamento | 8 | **9,0** | **9,0** | **9,0** |
| D5 — movimento com controle | 10 | **9,0** | **9,0** | **9,0** |
| D6 — acesso observável | 14 | `null` | `null` | `null` |
| D7 — resposta/espera | 10 | `null` | `null` | `null` |
| D8 — feedback/recuperação | 10 | `null` | `null` | `null` |
| D9 — continuidade/confiança | 6 | `null` | `null` | `null` |
| D10 — cobertura/consistência integral | 6 | `null` | `null` | `null` |

D4 considera a composição observada: A preserva Stu e caminho por partes; B mantém folha/margem/marca de página e ritmo editorial; C prioriza bloco navy, hierarquia compacta e pouca decoração. As novas famílias usam o mesmo sistema de espaços, ícones e tipografia em cada direção; não se resumem a três paletas. Os baixos localizados não deformam a arte nem impedem a tarefa. D5 tem medição nova e distingue entrada de navegação de atualizações locais; não é avaliação empírica de fluidez/boot em iPhone.

A nota ponderada das direções é **`null`**; não se normalizam os pesos para preencher critérios de outra competência. DG3 é reprovado no caso V1-R5; DG1/DG6 integrais não recebem aprovação deste parecer. C1–C10, paridade de renderizadores, nativo/TestFlight, uso por pessoas, retenção e satisfação permanecem **`null`/não realizados**.

O novo Stu caderno ainda não está integrado: o kit exibido é provisório e os PNGs originais não pertencem a esta superfície. A nota de composição D4 não aprova o branding final. As três propostas continuam candidatas de desenho, sem declaração de produto pronto ou meta global atingida.
