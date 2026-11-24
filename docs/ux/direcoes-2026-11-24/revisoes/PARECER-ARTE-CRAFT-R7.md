# Direção de arte e acabamento — R7

24/11/2026 · candidata formal **`f0c9b7fb3fb962827fd743096fee935b4873ed29`**. Revisão pontual, somente leitura das fontes de UI. Os pareceres [R5](PARECER-ARTE-CRAFT-R5.md) e [R6](PARECER-ARTE-CRAFT-R6.md) permanecem históricos.

**D4 = 9,0 em A/B/C no escopo de desenho examinado.** O aviso de material agora é único e coerente com o título; fallback e restrições mantêm hierarquia e saídas claras. Nenhum achado novo de arte foi confirmado. A consistência dos callbacks e as notas de confiança dependem das provas de fluxo/QA, discriminadas na [matriz R7](../MATRIZ-COBERTURA-R7.md); não se aprovam por screenshot.

## O que mudou e como foi conferido

O diff `28b003e..f0c9b7f` muda **três arquivos de runtime**: `app.js`, `media-pages.js` e `social-pages.js`. A leitura do diff confirma mudanças nos snapshots de contexto de compartilhar/clipboard/folha/retirada e no aviso central. **Os outros 14 HTML/JS/CSS são idênticos à R6**, incluindo estilos de base, acesso e das três direções, material e personalização. Nenhum CSS, asset ou tipografia foi alterado. A revisão visual também compara sete assets/fontes com seus objetos Git R6.

Portanto, as 53 imagens abertas na R6 continuam **provas históricas da R6**, aproveitadas por equivalência explícita dos componentes não afetados. Não foram renomeadas como capturas R7. Cabeçalho, ritmo, botões, mapa, conclusão sem pseudométricas, Stu A de 112 px, SQL `>= 7`, capas, legenda compacta e Etapa anterior no corpo mantêm a avaliação anterior. Os trechos afetados receberam a prova nova abaixo.

## Capturas novas e limites

**24 quadros finais novos foram capturados e abertos**, a DPR 2, Chromium 156.0.8078.79, em 390×844/360×800. Todos os 17 hashes de runtime permaneceram iguais antes/depois da coleta; nenhuma exceção JS, asset sem carregar ou overflow horizontal foi observado neste conjunto.

| Conjunto × A/B/C | Dimensão/texto | Quadros finais |
| --- | --- | ---: |
| Material com `revisao.pdf` no título: topo e região do aviso | 390×844, 100% | 6 |
| Mesmo aviso com texto ampliado | 360×800, 200% | 3 |
| Revisão de publicação de material | 390×844, 100% | 3 |
| Fallback válido após rejeição controlada de clipboard | 390×844, 100% | 3 |
| Cópia recebida: Compartilhar e Código Studoo | 360×800, 100% | 6 |
| Legado material+Explorar: restrição e recuperação oferecida | 390×844, 100% | 3 |
| **Total** | | **24** |

Artefatos: `/workspace/work/revisao-arte-craft-r7/evidencias.json`, `capturar.cjs`, `rechecagem-legado.json`, `rechecar-legado.cjs` e PNGs. A fixture inicial de legado omitia visibilidade/status no estado ativo e produziu três quadros comuns de link. A fixture foi corrigida, **sem alterar UI**; os três originais e o JSON inicial estão em `adaptacao-inicial/`. As três rechecagens substituem esses registros, não se somam às 24 vistas finais; os hashes coincidem com a coleta principal.

As queries de material, revisão e restrição conferem representação, composição e texto. O fallback teve toque real em Copiar e uma rejeição local controlada: uma chamada elegível por direção abriu o diálogo na mesma tela/trilha. Isso não prova invalidação após trocar contexto, cancelamento de chamada de plataforma ou clipboard instalado. O recorte funcional correspondente pertence aos outros pareceres.

## Julgamento e antes/depois

| Direção | D4 | Julgamento atual |
| --- | ---: | --- |
| **A · Jornada Azul** | **9,0** | O aviso usa o mesmo ritmo das superfícies acolhedoras. Título, escolhas e CTA continuam separados; a remoção da nota duplicada reduz repetição. A arquitetura de caminho e companhia permanece equivalente à R6. |
| **B · Caderno Claro** | **9,0** | Papel, margem, divisores e campos mantêm unidade. O aviso central recebe tratamento informativo subordinado, sem disputar com o título da trilha. A conclusão e o índice preservam a composição já examinada. |
| **C · Foco Vivo** | **9,0** | A lista mais compacta conserva os níveis de leitura e o hero da trilha segue identificado. O texto completo do aviso não rompe o sistema de blocos; fallback/restrição usam a mesma linguagem. |

**Copy do material, R6-F3 — apresentação corrigida.** O título `revisao.pdf para a prova` corresponde à mensagem “O título traz o nome do seu arquivo”. A mesma nota informa o que segue — título, trechos citados e páginas — e o que permanece privado — arquivo bruto, fotos, progresso, respostas e explicações. A promessa absoluta “Arquivo, nome e fotos não são publicados” desapareceu. Nas três direções há **um único aviso de material** na base; a ordem DOM coloca **Ver Código Studoo depois dele**, com prova adicional de reflow da revisão visual/QA. As capturas roladas mostram a leitura do aviso; texto 200% pode requerer rolagem vertical, sem redução de fonte para forçar a primeira dobra.

**Fallback e restrições.** O fallback conserva título, link demonstrativo com quebra e ações distintas. Cópias recebidas não apresentam link/QR de republicação e mantêm Voltar à minha cópia/Explorar trilhas. O legado material+Explorar explica a restrição e oferece escolher link, parar ou voltar; não finge uma nova aprovação. Espaço livre nesses quadros curtos mantém concentração, sem necessidade de inserir métricas ou ilustração decorativa.

As notas iguais continuam refletindo sistemas diferentes, não apenas três paletas: A usa caminho e companhia; B usa página/índice; C usa blocos e listas. **Mantenho A como recomendação principal** para o pedido Studoo com inspiração no Duolingo; B é forte para a metáfora do futuro Stu caderno; C favorece concentração. Trata-se de recomendação de arte, não preferência medida com estudantes.

Não há base para 9,5/10 ou “perfeito” universal. O novo Stu caderno original ainda não está disponível como asset; o kit antigo é provisório. A nota não aprova branding final, intro instalada, React Native, iPhone/Android, safe area/teclado/leitor nativo, desempenho, servidor ou pesquisa com pessoas. Esses resultados permanecem separados da aprovação do desenho HTML.
