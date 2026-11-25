# Revisão independente de arte · Jornada Azul

**Cópias acessíveis das provas:** [seleção de arte e caso transitório](evidencias/arte/LEIA-ME.md), [RN Web](evidencias/rnweb/PARECER-RNWEB.md), [web R1](evidencias/web/README.md) e [web R2](evidencias/web-r2/PARECER-R2.md). Os caminhos absolutos abaixo identificam as origens da coleta nesta tarefa; as seleções publicadas conservam fontes, limites e hashes.

25/11/2026 · **revisão de implementação, fechamento visual R2 por amostra**. Implementação em `/workspace/work/studoo-jornada-azul`, web em 3020 e prévia React Native Web em 8091. Fontes congeladas: R1 `fa4be429992037cdaa1be055f52be6a529d32f76`; R2 `b3e97e7cbe7d6b8b711216070453a13ebcad36e3`. Os quadros R1 não foram rebatizados como coleta R2.

**A composição observada forma uma família própria do Studoo. C4 e as facetas visuais de C3 recebem 9,0 no conjunto examinado.** Os cinco achados iniciais, a sobreposição na confirmação e o CTA compacto do Explique receberam correções conferidas. Permanece uma dívida baixa e transitória do aviso no conteúdo já rolado, descrita em AR8. A nota 9 da direção HTML R7 não foi transferida à implementação.

## Escopo e critério

Foram lidos [SISTEMA](SISTEMA.md), [INVENTARIO](INVENTARIO.md), [PLANO](PLANO.md), as regras do repositório e os trechos pertinentes das specs 07/11. A avaliação é de **C4 e das facetas visuais de C3**, não de comportamento completo, acessibilidade nativa ou persistência por inferência da imagem.

O **Stu, a logo e a intro atuais estão aprovados pelo dono e permanecem preservados**. Não foram geradas imagens, redesenhados assets ou solicitada nova aprovação de personagem. Seu encaixe nas telas foi examinado; a abertura instalada tem ficha e provas próprias.

Capturas efetivamente abertas nesta etapa:

| Superfície | Amostra observada | Origem e limite |
| --- | --- | --- |
| React Native Web | Entrada, pedido, proposta, mapa, conceito, exemplo, exercício, erro/acerto, reforço, conclusão, retomada, perfil visitante/público, Explorar, Seguindo visitante, prévia pública e confirmação de entrar. Exercício e feedback foram reabertos depois dos primeiros fixes. | `/workspace/work/qa-jornada-native/rnweb-*.png`,390×844/360×800. São capturas de RN Web/Chromium; o diretório não constitui execução iOS/Android. Vários arquivos são atualizados pela QA em andamento; não se apresentam como uma coleta congelada. |
| Web do produto | Pedido/proposta, perfil, folha de postar e denúncia. O arquivo chamado conceito desta amostra mostra o esqueleto de carregamento; não foi tratado como lição carregada. | `/workspace/work/qa-jornada-web/sql-390-preliminar/` e `perfil/`. Conteúdo, flags e posições de rolagem variam; não são pares de paridade só por terem 390 px. |
| Web de componentes reais | Abertura do catálogo, ações, campos, retomada, estados, feedback, espera e confirmação. Oito PNGs capturados e abertos a DPR 2. | `/workspace/work/qa-jornada-arte/catalogo-preliminar*.png` e JSON/script; rota de desenvolvimento `/sistema-ui`. Estados locais de bancada, sem alteração dos dados do produto. Seis fontes locais conferidas antes/depois permaneceram estáveis; isso não é um manifesto de toda a candidata. |
| RN Web congelada R1 | Exercício, erro e acerto nas duas larguras; retomada 390; conclusão 390; pedido 360; Seguindo visitante 360/390; retorno do Explique 390. | `/workspace/work/qa-jornada-native/final/`, `resultado.json` com fonte estável e SHA R1. A QA registra 44 PNGs/95 checks/43 chamadas de API; esses números pertencem à sua execução. Esta revisão abriu a amostra listada e não afirma ter inspecionado os 44 PNGs. |
| Web final e SQL histórico identificado | Pedido 360 a 100/200% e 390 a 200%, retomada 360, Configurações 390, menu 360, proposta 360 a 200% e confirmação de foto 360. Exercício SQL nas duas larguras, erro 390 e acerto 360 da coleta 0442. | `pedido-pin-final-fa4be42/`, `config/final-fa4be42-*`, `texto200-final-fa4be42/`, `perfil/18-confirmacao-final-fa4be42-360.png`; SQL em `sql-{360,390}-candidata-0442/`. A coleta SQL antecede os últimos refinos de Pedido/menu/progresso; seus arquivos de aula foram conferidos contra a R1. |
| Focais R2 | Confirmação real de bancada 390/360 × 100/200%, quatro PNGs novos capturados e abertos. Retorno do Explique RN Web nas duas larguras, primeiro durante o aviso e depois da sua dispensa normal. | `/workspace/work/qa-jornada-arte/r2/confirmacao.json`: 11 hashes estáveis e iguais ao commit, zero `pageerrors`. `/workspace/work/qa-jornada-native/final-r2/` e `rodada-r2-aviso-transitorio/`: coleta do auditor, fonte R2 estável. As duas capturas calmas não apagam o estado transitório preservado. |

O primeiro script do catálogo procurou `dialog`, mas a confirmação usa corretamente `alertdialog`. A expectativa do harness foi corrigida; os arquivos iniciais permanecem em `tentativa-inicial/`. Esse falso negativo não foi classificado como defeito da UI.

O diff R1→R2 foi lido: três arquivos de runtime mudaram (`licao.tsx`, `aula.css`, `aviso.css`), além de documentação/teste. O alcance é o CTA compacto até 600 px e a precedência da música diante de modal/menu. `/workspace/work/qa-jornada-arte/r2/equivalencia.json` registra o diff completo e nove unidades pertinentes idênticas. A continuidade visual dos quadros não afetados é herança explícita; não uma nova execução integral.

## Julgamento de arte

Há coerência além da paleta. A mesma face/degrau dos botões acompanha pedido, exercício e conclusão; campos e superfícies partilham raios e margens; Quicksand diferencia títulos e Nunito sustenta leitura; seleções, progresso e retorno usam texto/ícone além da cor. A navegação flutuante repete a linguagem das superfícies sem disputar com a tarefa.

O Stu cumpre papéis contextuais: acolhe no pedido, acompanha o caminho e reage à tentativa/conclusão. Não se tornou uma marca d'água repetida nos controles. O cenário do mapa comunica caminho, enquanto a lição volta ao fundo de leitura. A presença de paisagem no mapa, por si só, não foi classificada como defeito de identidade nem como justificativa para trocar assets aprovados.

Uma segunda leitura somente de arte abriu sete quadros RN Web de 390 px e um quadro do catálogo, sem identificar novo problema concreto além dos já encaminhados. Confirmou os pontos focais próprios de pedido, retomada e conclusão e a ligação entre anatomia, tipo, margem e ações; não atribuiu nota integral com fonte em edição.

O espaço livre no pedido e no exemplo não exige inventar mais indicadores ou ações. O risco real observado foi a escala de um enunciado longo ocupar a área da interação, já distinguido abaixo de uma simples preferência de densidade.

| Faceta | Nota nesta etapa | Alcance |
| --- | ---: | --- |
| C4 · coerência/acabamento do conjunto visual observado | **9,0 na amostra observada** | A família é reconhecível e consistente na amostra. Não é nota integral das 44 famílias nem nota transferida do protótipo. |
| C3 · facetas visuais de leitura/hierarquia nos casos observados | **9,0 na amostra observada** | Enunciado, código, confirmação, vazio, progresso e CTA do Explique reabertos. Nenhum achado médio/alto permanece nessa amostra; AR8 é baixo, transitório e não impede continuar. Não é certificação de todos os formatos a 200%, teclado nativo ou 44 famílias. |
| C3/C4 integrais do produto | **null** | Esta ficha não inspecionou todas as 44 famílias, seus formatos/variantes nem teclado de aparelho. Os quadros e probes declarados abaixo são o alcance da nota. |
| Nativo, movimento/intro instalada e pesquisa com pessoas | **null/não executados por esta revisão** | Screenshot RN Web não certifica essas competências. |

O 9 se sustenta em hierarquia de tarefas distintas, tipografia com papéis claros, anatomia compartilhada, correção dos defeitos concretos e conferência dos afetados. Não se atribuem 9,5/10 ou perfeição universal: a cobertura desta revisão e a dívida baixa não sustentam isso. A consolidação deve considerar a menor faceta competente, sem compensar um problema de leitura com uma boa ilustração.

## Achados priorizados e estado

### AR1 · Enunciado usava a escala de título principal

**Médio · C3 · fechado no recorte observado.** Em 360 px, a pergunta SQL em 30/36 ocupava nove linhas e o campo ficava sob o rodapé. A mesma instrução em 22/30 passou a ocupar cinco linhas; nas novas capturas RN Web 360/390, pergunta, consulta e campo aparecem juntos. O texto da API foi conservado.

Provas reabertas: `/workspace/work/qa-jornada-native/final/rnweb-aula-exercicio-{360,390}.png`, R1 congelada, e `/workspace/work/qa-jornada-web/sql-{360,390}-candidata-0442/05-exercicio.png`. A coleta web é anterior aos últimos refinos de Pedido/menu/progresso; seus hashes antes/depois são estáveis e `aula.tsx`/`aula.css` correspondem à R1. Na R2, o único diff de aula acrescenta a regra de CTA compacto do Explique. Isso não certifica teclado virtual nem todos os formatos a 200%.

### AR2 · Operador preenchido quase desaparecia no SQL

**Médio · C3/C6 visual · fechado no recorte observado.** O preenchimento usava `acaoEscura` #173B9C sobre `texto` #15275B: contraste nominal aproximado de 1,45:1. O problema aparece tanto no erro (`>`) quanto no acerto (`>=`), justamente no conteúdo necessário para compreender a diferença entre os operadores.

A correção aplica `nevoa` #EDF3FF e opacidade 1 somente no código. Foram reabertos erro e acerto RN Web da R1 em 360/390, e os quadros web `06-feedback-erro.png` em 390 e `07-feedback-correto.png` em 360 da coleta 0442; o operador agora é legível. A QA registrou as cores computadas e contraste de 12,81:1 em `sql-contraste-computado.json`. A regra é restrita ao contexto de código; não certifica todos os formatos claros/fórmulas apenas por compartilhar o tema.

### AR3 · Confirmação web empilhava a ação principal depois da saída

**Médio · C3/ação · fechado no componente observado.** No catálogo web 390, “Continuar de onde parei” ficava acima do primário “Recomeçar”. A spec 11 determina ação principal em cima quando as ações empilham; o app já alternava para confirmar/cancelar em `CartaoConfirmacao`.

Antes: `catalogo-preliminar-dialogo-390.png`. Depois: `/workspace/work/qa-jornada-arte/r2/web-confirmacao-{390,360}-{100,200}.png`, quatro PNGs novos efetivamente abertos. O probe `r2/confirmacao.json` confirmou 4/4 ordens DOM/visual com primário em cima, foco inicial explícito na ação segura e ausência de overflow horizontal. Onze hashes antes/depois iguais à R2. O componente é real, mas o conteúdo é local à bancada `/sistema-ui`; não se declara operação destrutiva executada no produto. A confirmação de remover foto do produto também foi aberta em `perfil/18-confirmacao-final-fa4be42-360.png`.

### AR4 · Primário estreito no vazio de Seguindo

**Médio · C3/aplicação do contrato C05 · fechado no consumidor RN Web observado.** Antes, em `rnweb-explorar-seguindo-visitante-360.png`, “Entrar ou criar conta” ocupava cerca de 211 px dentro de uma superfície de cerca de 320 px. Até 600 px, a regra exige o primário na largura útil. O agrupamento de ações/texto em `comunidade.tsx` usava `alignItems:'flex-start'`, mantendo o botão estreito.

Os PNGs R1 `/workspace/work/qa-jornada-native/final/rnweb-explorar-seguindo-visitante-{360,390}.png` foram reabertos: o primário ocupa a largura útil do cartão, acima da alternativa. A falha equivalente na web não foi afirmada sem seu par; este fechamento não se estende a todos os consumidores de vazio.

### AR5 · Barra de retomada curta; próximo conceito depende dos dados

**Baixo · acabamento · largura fechada na amostra.** Antes, em `rnweb-inicio-retomada-390.png`, a barra de progresso tinha aproximadamente 40 px de largura total, embora o cartão tivesse espaço útil maior. Dar à barra largura suficiente melhora a leitura visual da proporção; contagem e porcentagem já tornavam o estado entendível. A tarefa continuava operável.

Depois: `final/rnweb-inicio-retomada-390.png` e web `pedido-pin-final-fa4be42/retomada-360.png` foram abertos. O progresso agora ocupa a largura útil; a QA web mede 308/278 px dentro de cartões 350/320 com 20 px internos. O elemento web é `<progress>`; ausência de um atributo literal `role` não implica ausência de semântica.

A primeira observação sugeria também nomear INNER JOIN no cartão. A leitura do contrato reconcilia o alcance: `PlanoResumo` contém id, título, progresso, capa e tema, mas não o título da próxima lição; esse dado está em `PlanoDetalhe`. Portanto a ausência não é classificada como falha de implementação quando só o resumo está disponível. Exibir o conceito pode ser um refino quando o detalhe real já estiver em memória; não se exige nova consulta nem ampliação de API para produzir a nota. A bancada usa um exemplo local e não prova disponibilidade do dado na lista do produto.

### AR6 · Aviso de música sobre o título da confirmação a 200%

**Médio · C3 · fechado no focal R2.** Na R1, o primeiro gesto padrão abriu o aviso de música sobre o `alertdialog`. Em 360 px a 200%, o aviso ocupava y8–146 e o título y106–274: interseção de **278 × 40 px**. Não era preciso alterar preferências ou injetar um estado impossível para reproduzir. Provas: `qa-jornada-arte/final/web-confirmacao-360-200.png` e `final/aviso-sobre-dialogo.json`.

A R2 dá precedência visual à janela: o aviso de música fica oculto enquanto há modal/menu e reaparece, se ainda vigente, ao fechar. Quatro contextos frescos (390/360 × 100/200%) confirmaram aviso oculto durante o diálogo e visível após Escape, sem alterar a ordem/foco seguro. Os quatro PNGs `qa-jornada-arte/r2/web-confirmacao-*.png` foram abertos; o título está desobstruído. Isso é um fix do produto, não ocultação feita no harness. O comportamento de todos os menus pertence à QA dos seus consumidores, não é inferido dessa confirmação.

### AR7 · Continuar compacto no retorno de Explique

**Médio · C3/aplicação do contrato C05 · fechado no consumidor RN Web R2 observado.** O auditor encontrou o primário com aproximadamente 110 px, ao lado de “Mandou bem!”, em `final/rnweb-explique-retorno-390.png`. A R2 conserva a linha compacta somente acima de 600 px. Em mobile, o retorno conciso fica acima de Continuar, na largura útil e com pelo menos 52 px.

Foram abertos `final-r2/rnweb-explique-retorno-{360,390}.png` e os mesmos estados preservados com aviso transitório. O botão mede **320/350 × 56 px**, está no viewport e permanece livre. O auditor registra 32 checks, oito capturas e 23 chamadas de API no focal R2 calmo; esta revisão não reconta esses checks como seus. A regra web correspondente foi lida no diff; sua interação é conferida pela QA web.

### AR8 · Aviso transitório sobre ação secundária no conteúdo rolado

**Baixo · composição transitória · permanece registrado.** Nos PNGs R2 de `rodada-r2-aviso-transitorio/rnweb-explique-retorno-{360,390}.png`, o aviso do primeiro gesto ainda está dentro dos seus sete segundos e cobre parte de “Enviar minha explicação”. O POST de ensino já terminou, a página foi rolada até o feedback e Enviar voltou disponível. O botão está em y42–98, parcialmente sob o cabeçalho; o aviso ocupa a faixa y70–116. O principal **Continuar permanece totalmente livre**. Não houve necessidade de ligar música artificialmente.

A spec 16 §14 declara que o aviso não deve cobrir campo/botão; a mesma seção permite que etapa nova venha sem o vão anterior. A cobertura parcial dessa ação já usada é uma dívida visual observada. Foi classificada como baixa porque é transitória, resolve-se sem mover o conteúdo e não impede o próximo passo; não foi reclassificada como inexistente por capturar depois dos sete segundos. Os quadros calmos e transitórios ficam separados. Não é a sobreposição de título de AR6, que foi corrigida.

O acompanhamento está no [plano](PLANO.md#acompanhamento-residual-da-revisão-r2): tratar o ciclo contextual do aviso ao entrar no retorno, sem alterar preferência/áudio nem deslocar o conteúdo na saída. `/workspace/work/qa-jornada-arte/r2/ar8-metadados.json` preserva fonte antes/depois, viewport, hashes dos quatro PNGs abertos e geometria dos controles. Todos correspondem à R2 estável. C15 integral continua sem aprovação; não foi criada uma exceção silenciosa na spec.

## Limites do fechamento

A revisão de arte não viu todos os seis formatos, origem/material, QR/compartilhar, todas as variantes de conta/moderação ou todos os consumidores das 44 famílias. Foram vistos configuração/capa e menu na amostra descrita, sem se estender essa observação a todas as suas variantes. A bancada central não fecha consumidores por associação. O teclado virtual, áreas seguras reais, áudio, permissões e animação instalada dependem de execução em aparelho; RN Web não a substitui.

A revisão de perfil/community e de fluxo tem escopo próprio registrado pelos respectivos revisores. Esta ficha não reconta suas interações como se tivessem sido executadas pelo revisor de arte. Nenhum componente foi editado nem commit criado por esta revisão.
