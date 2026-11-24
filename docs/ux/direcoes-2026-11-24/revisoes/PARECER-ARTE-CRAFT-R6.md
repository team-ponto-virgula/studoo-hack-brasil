# Direção de arte e acabamento — R6

24/11/2026 · candidata formal **`28b003e6c29728e1fd8c96f14efbb497353b0d10`**. As fichas [R4](PARECER-ARTE-CRAFT-R4.md) e [R5](PARECER-ARTE-CRAFT-R5.md) permanecem históricas. Nenhuma fonte de UI foi modificada nesta revisão.

**D4 = 9,0 em A/B/C no recorte examinado.** Os dois refinamentos baixos de arte da R5 foram corrigidos. A revisão não encontrou novo defeito de composição nos quadros abertos. Isso não aprova a candidata completa: os achados de compartilhamento e texto de privacidade registrados por fluxo/visual mantêm D1/D9 e a consolidação pendentes de correção e nova prova.

## Prova nova e alcance

Foram capturados e **abertos 53 PNGs novos**, a DPR 2, em Chromium **156.0.8078.79**, depois do carregamento das fontes e da entrada inicial. A fonte estava congelada durante a coleta: **17 arquivos HTML/JS/CSS têm hashes idênticos antes/depois**. Não se rebatizaram imagens R5.

| Conjunto | Viewport e texto | Quadros |
| --- | --- | ---: |
| Início, mapa, lição, conclusão e perfil × A/B/C | 390×844, 100% | 15 |
| Parcial genérico normalizado para associação × A/B/C | 390×844, 100% | 3 |
| Associação parcial × A/B/C | 360×800, 100/200% | 6 |
| Postagem aprovada e identificação compacta × A/B/C | 390×844 a 100%; 360×800 a 200% | 6 |
| Capa selecionada × A/B/C | 390×844, 100% | 3 |
| Nome de material de 160 caracteres no cartão e diálogo × A/B/C | 360×800, 100/200% | 12 |
| Compartilhamento de material próprio/cópia recebida × A/B/C | 390×844/360×800, 100% | 6 |
| Início de C com título da trilha | 360×800, 100/200% | 2 |
| **Total** | | **53** |

Artefatos: `/workspace/work/revisao-arte-craft-r6/capturar.cjs`, `evidencias.json` e os 53 PNGs. O JSON registra fonte, navegador, textos, caixas do rodapé, assets e ausência de overflow horizontal/exceções nas fixtures deste conjunto. São capturas dirigidas de dados sintéticos; a presença de um estado por query não é prova de chegar até ele ou recuperá-lo.

Nos cartões de origem a 200%, a captura inicial mostra o topo da lição; o diálogo aberto mostra a região rolada. O julgamento do reflow completo do cartão, apoio e diálogo usa também as provas dirigidas independentes de [visual](PARECER-VISUAL-R6.md) e [QA](PARECER-A11Y-R6.md). Não se deduz a leitura de um trecho que ficou fora da viewport pela imagem inicial.

## Julgamento por direção

| Direção | D4 | Racional observável |
| --- | ---: | --- |
| **A · Jornada Azul** | **9,0** | A organização espacial do mapa, relevo moderado dos controles e Stu contextual tornam a continuidade evidente e acolhedora. Título Quicksand, respiros e CTA se repetem de forma coerente. A conclusão conserva o Stu de 112 px e o resumo aprendido, sem a antiga faixa de pseudométricas. A leitura do exemplo destaca apenas `>= 7`, mantendo o restante do SQL sereno. |
| **B · Caderno Claro** | **9,0** | Página com dobra, margem, índice e divisores compõem uma linguagem reconhecível além da cor. O papel não compete com as informações. Material, capa e postagem conservam o mesmo sistema. O espaço livre na conclusão separa compreensão e continuidade; não exige acrescentar indicadores sem função. |
| **C · Foco Vivo** | **9,0** | Hero navy, títulos Nunito e mapa linear concentram a atenção. O hero agora identifica a trilha ativa antes da lição, inclusive em 360/200%, eliminando a ambiguidade apontada na R5. A densidade permanece menor sem perder a tarefa nem o botão de retomada. |

As propostas continuam distinguíveis por composição: A trabalha caminho e companhia; B, página e índice; C, blocos e listas. Tipografia e ícones formam famílias consistentes dentro de cada uma. Os estados novos não parecem componentes de outro produto encaixados entre as páginas.

As três alcançam a âncora 9 no recorte de acabamento, sem evidência que justifique 9,5/10. A nota não é uma declaração de perfeição, compreensão por estudantes ou preferência empírica.

## Antes/depois dos detalhes examinados

| Achado anterior | Estado R6 e prova |
| --- | --- |
| **R5-AR1 — Etapa anterior no rodapé fixo de quatro ações** | **Fechado no desenho examinado.** A ação fica no conteúdo, junto ao progresso, antes da tarefa. Em 390 e 360 o rodapé conserva Tentar de novo como principal e duas saídas secundárias. Em 200% os textos refluem e o conteúdo pode rolar. O rótulo e a presença da ação foram preservados; foco/retorno pertencem às provas Q/F, não à captura. |
| **R5-AR2 — segundo aviso de fixture com peso de conteúdo principal** | **Fechado no desenho examinado.** “Estado de exemplo: aprovado” é uma legenda compacta. O aviso sobre respostas, progresso, explicações e email permanece explícito, assim como a ausência de publicação real. O cartão mantém o estado e a retirada. |
| **Foco — ausência do nome da trilha no cartão ativo** | **Fechado.** “SQL para a prova” aparece sobre INNER JOIN no hero, sem transformar a descrição da lição em outro título concorrente. Confirmado em 390/360 e texto 200%. |
| **Capa — deslocamento de seleção de 1,4 px** | **Fechado pelas medições independentes.** V-motion registra 24 probes com delta 0; Q-capas mede 12 seleções por Enter, com top/scroll/largura/altura em 0 e foco/estado corretos. A medição bruta desta coleta AR inclui auto-scroll do clique (-27/-29 px) e **não é usada** para atribuir estabilidade de layout. Os três quadros selecionados foram abertos para conferir hierarquia e estado. |
| **Parcial genérico incongruente com lacuna** | **Representação corrigida.** A entrada genérica agora mostra “Relacione os conceitos”, com dois pares mantidos, check e texto; não promete parcial para a lacuna atômica. Os quadros 390/360/200 foram abertos. Interação/reload ficam discriminados na matriz. |
| **Nome de material de 160 caracteres sem espaços** | **Leitura corrigida nos casos novos de visual/QA.** Os quadros abertos mostram quebra no nome e no diálogo sem esticar a página. Não foi removida a origem para fazer o conteúdo caber. O cartão pode exigir rolagem vertical, como o restante da lição. |

## Achados de outras competências e limites

A revisão de fluxo encontrou retornos assíncronos antigos de clipboard/folha depois de mudar de contexto e uma retirada que altera o registro errado; a revisão visual/fluxo encontrou texto contraditório sobre o nome do arquivo aparecer no título compartilhado. Os três afetam continuidade/confiança e clareza, não se encerram pela aparência correta dos quadros restritos. A [matriz R6](../MATRIZ-COBERTURA-R6.md) conserva essas pendências e seus casos exatos. Uma candidata futura deve ter sua própria fonte e prova; esta ficha não a aprova antecipadamente.

**A · Jornada Azul continua sendo a recomendação principal** para Studoo com inspiração no Duolingo: caminho, desafio único, reação contextual e próximo passo têm maior continuidade com o pedido. B é a alternativa mais próxima da metáfora do futuro Stu caderno; C favorece concentração. Isso é recomendação de direção de arte, não resultado de teste com usuários. Escolher uma estrutura principal será mais coerente do que alternar as três linguagens entre páginas.

O novo Stu caderno original continua pendente como asset. O personagem antigo é provisório; esta nota não aprova branding final. A superfície é HTML mobile com estado local: não foram aprovados intro instalada, React Native, iPhone/Android, teclado virtual, safe areas, leitores de tela nativos, desempenho de boot ou persistência real. Essas competências não recebem nota por transferência.
