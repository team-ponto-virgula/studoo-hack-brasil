# Parecer visual independente — R1

Revisor: `revisao_visual_r1` · candidata **62ef474f34a31e2e0a0d5bb0cc2fa721b709fc5f** · 24/11/2026. Escopo: desenho do protótipo HTML mobile, não execução do produto em React Native, iPhone ou Android. Nenhuma fonte do protótipo foi editada por este revisor.

**Resultado da rodada: meta de 9 ainda não atingida.** Há defeitos médios em reflow, movimento local e cobertura de subestados. As três direções são reconhecíveis além da paleta e já sustentam uma comparação de projeto; isso não aprova os fluxos ausentes nem a integração do novo Stu caderno.

## Evidência efetivamente produzida

- Chromium **156.0.8078.79**, Linux, `/usr/bin/chromium`, Playwright. Captura principal entre **19:48:59 e 19:50:24 UTC**.
- **228 vistas normais/de estados:** 32 páginas + 6 estados adicionais por direção, em 390×844 e 360×800, para Jornada Azul, Caderno Claro e Foco Vivo. Estados adicionais: exercício incorreto/correto, falha ao salvar, permissão indisponível, biblioteca vazia e proposta expirada.
- **192 conferências de geometria a 200%:** todas as 32 páginas, nas duas larguras e três direções. Fontes ampliadas pela raiz para 32 px; não se reduziu escala de captura para fazer caber.
- **60 casos de conteúdo longo:** início, pedido, proposta, mapa e perfil, nas duas larguras, 100%/200% e três direções. Nome sintético `NinaComNomeCompridoSemEspacos`, título de trilha longo e objetivo de até 800 caracteres.
- **276 capturas principais**, pranchas de inspeção das 32 páginas por direção, capturas adicionais dos casos longos e medição separada de movimento. Foram examinadas as 12 pranchas e, em tamanho original, início/mapa, exercício com erro, conclusão, perfil e casos de reflow prioritários.
- **Zero pageerrors** na captura principal, todos os botões de rodapé inteiros nas 420 vistas principais e nos 60 casos longos. Isso não é prova de todos os controles, contraste ou teclado: a conferência especializada de acessibilidade continua separada.
- Hashes dos sete arquivos de HTML/JS/CSS iguais antes/depois. O complemento longo também confirmou `sourceStable: true` e `sameAsR1: true`.

Os artefatos estão fora do Git em `/workspace/work/revisao-visual-r1`: `resultado.json`, `longos.json`, `overflow200.json`, `motion.json`, scripts e PNGs. A primeira tentativa pela porta 3013 parou por conexão recusada; seu log foi preservado em `harness-conexao-3013.log`. Não foi contado como defeito do produto. A execução completa usou a porta 3012.

Hashes de referência: `app.js` = `32987017a0f36af58adb72eaa94fcb64f51260f2751ebdef2c1f895fae45ef43`; A CSS = `b7bce47a0238054802eb1c3b3db583ebd879745cba0bc33766f6f1ce6f239c28`; B CSS = `781e22ae783a0d7a1b7af77fbc793826010212b13c5b0c8dd419395495de635d`; C CSS = `7e79f3a66db34001b3f6e33cd51cee932755415bf9cf0eb41418ac3e23c0ecb6`. Os demais hashes estão no resultado principal.

## Três prioridades de correção

### V1 · D3 — conectores e reflow precisam preservar a leitura

**Médio; A e B.** Em A, o conector inclinado que sai do nó INNER JOIN atravessa o rótulo “Praticando”; a ligação de Filtro + junção também passa pela separação “Desafio”. A repetição entre capítulos dá aparência de erro de desenho e disputa com os títulos de grupo. Evidência: `jornada-mapa-390.png` e par 360. Interromper o traço no último nó de cada parte; a alternância dos nós pode continuar dentro da parte.

A 200% em 360 px, há overflow horizontal interno em **Interesses, Explorar, Perfil público e Meu perfil** nas duas direções A/B. A página externa não transborda, mas o conteúdo rolável excede sua largura: no perfil público, o menu “...” termina em **378,5 px (A)** / **376,5 px (B)**; em Explorar, o badge “Demonstração” chega a **375 px (A)** / **388 px (B)**. Os grupos de métricas e a palavra “curiosidade?” também excedem a área. Evidência: `overflow200.json` e PNGs `*-200-360.png`.

O caso de nome longo piora o problema mesmo em 100%: o início A tem `scrollWidth` **544 px**, perfil A **575 px**, perfil B **609 px**, para uma área de 360/390 px. A 200%, esses valores chegam a 1068/1017/1084 px. Corrigir mínimos de flex/grid, permitir quebra de nomes/títulos e reorganizar badge/menu/estatísticas quando faltar espaço. Não resolver com truncamento ou fonte menor. **C não apresentou overflow nas suas 140 vistas principais nem nos seus 20 casos longos**; serve de referência para o reflow.

### V2 · D5 — uma escolha local reanima a página inteira

**Médio; A, B e C.** Ao tocar a opção `>=` no exercício, o renderer recria `.screen.screen-enter`. O título se desloca **5 px** e a opacidade de toda a área vai de **0,7 para 1** por **180 ms**, mesmo sem troca de página/etapa. Isso se repete a cada seleção; um efeito adequado à entrada de uma tela passa a disputar com a leitura e a escolha local.

Probe observado: A/B, título `153,5 → 158,5 → 153,5 px`; C, `152,3 → 157,3 → 152,3 px`. Foco da opção permaneceu correto. Com `prefers-reduced-motion: reduce`, não houve animação ou deslocamento; esse caminho passou. Evidência: `motion.json`. Aplicar entrada apenas na navegação ou mudança de etapa e manter a área estável em seleção, toggle, seguir e operações locais equivalentes.

### V3 · D10 — algumas variantes declaradas ainda são avisos ou estão ausentes

**Médio; A, B e C.** A cobertura das 32 páginas-base é equivalente entre as direções, porém o protocolo exige também subframes navegáveis. No renderer R1, o exercício só avança após acerto, sem desenho de “pular/seguir sem acertar” e seu estado “Vale rever”. “Gravar minha explicação” abre somente o aviso de indisponibilidade; não há o desenho de gravando/parar/revisar transcrição. Essas lacunas correspondem a P11/P13/P14, não somente à falta de execução nativa.

O Código Studoo também é representado por texto de implementação futura em um diálogo, em vez de uma prévia visual do código. Completar as variantes declaradas ou manter a matriz explicitamente parcial; 32 páginas-base, sozinhas, não autorizam D10 ≥9 nem “todos os fluxos aprovados”. Os exemplos podem continuar locais e identificados como simulação, sem acionar câmera/microfone reais.

## Notas desta competência

Notas do desenho observado, com o limite de cada faceta. Não existe nota global calculada por este parecer: D1/D2/D6/D7/D8/D9 não foram avaliados integralmente aqui e permanecem `null` neste revisor. D10 considera a lacuna confirmada; sua aprovação posterior depende da matriz completa e dos outros pareceres.

| Critério | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo | Evidência e limite |
| --- | ---: | ---: | ---: | --- |
| D3 — hierarquia/leitura/adaptação | 8,0 | 8,0 | 9,0 | A/B têm os casos médios V1; C passou a geometria normal, 200% e conteúdo longo examinados. Não representa teclado/safe area nativos. |
| D4 — identidade/acabamento do desenho | 9,0 | 9,0 | 9,0 | Sistema de componentes consistente nas 32 páginas e diferenças de composição observáveis. A nota cobre o desenho com o kit provisório, sem aprovar a arte final do novo Stu. |
| D5 — movimento com controle | 8,0 | 8,0 | 8,0 | V2 reproduzido nas três; caminho de movimento reduzido passou. |
| D10 — cobertura/consistência | 8,0 | 8,0 | 8,0 | Páginas-base equivalentes, mas V3 impede aprovar a cobertura declarada. Sem prova de paridade web/RN. |

## Leitura comparativa das direções

**A — Jornada Azul:** é a interpretação mais próxima da inspiração no Duolingo: botão tátil, próximo passo evidente e mapa com nós. O texto e as ações permanecem Studoo. É a melhor candidata quando a prioridade é progressão e companhia, desde que o conector e o reflow sejam corrigidos. O header e a área da lição repetem o indicador de progresso; reduzir essa duplicação é um refinamento de baixo risco.

**B — Caderno Claro:** materialidade aparece na folha com dobra, nas lombadas/capas e no agrupamento do mapa, não apenas no creme. A leitura e a proposta têm estrutura editorial mais serena. A conclusão em 360 permite rolar até detalhes secundários; o CTA continua inteiro. Não reduzir tipografia para encaixar essas métricas na primeira dobra.

**C — Foco Vivo:** hero de continuidade e perfil com navy, módulos mais compactos, títulos Nunito e lista sem caixas extras dão uma direção contemporânea distinta. Foi a mais robusta nos casos de reflow examinados. A menor presença do personagem é uma escolha de proposta, não evidência de preferência das pessoas.

As três têm uma base visual convincente no escopo de proposta. Não há medição de compreensão, preferência, satisfação, retenção ou fluidez em aparelho. Notas C do produto e avaliação nativa permanecem `null`. A aprovação visual do novo Stu caderno depende dos originais e de nova evidência; este parecer não a concede.

**Próxima rodada necessária:** corrigir V1/V2/V3, congelar a nova candidata e repetir os casos afetados com os hashes novos. Manter os resultados R1 como histórico, sem substituir notas silenciosamente nem arredondar 8 para 9.
