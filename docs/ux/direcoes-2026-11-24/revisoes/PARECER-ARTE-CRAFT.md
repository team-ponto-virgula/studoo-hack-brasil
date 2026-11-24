# Parecer independente de direção de arte e acabamento

24/11/2026 · candidata R3 `902eca4e3a8e8ac374d79972677a1ed3edc83859` · revisão suplementar solicitada após o reforço de exigência do dono.

## Escopo efetivamente examinado

Foram abertas e comparadas **15 capturas reais**, cinco por direção: `inicio`, `mapa`, `licao`, `conclusao` e `perfil`. Viewport 390 × 844, DPR 2; PNGs de 780 × 1688 em `/workspace/work/revisao-a11y-r3/{jornada|caderno|foco}-{pagina}-390.png`. Leitura adicional de `BRIEF.md`, `PESQUISA.md`, `COBERTURA-E-REVISAO.md`, componentes de `prototipo/app.js`, tokens de `base.css` e estilos de direção. As referências externas foram consideradas conforme o registro da pesquisa; não foram abertas novamente nesta revisão.

Este parecer avalia **D4: identidade, acabamento e coerência**, com observações editoriais relacionadas a D1. Não executou navegação, animação, teclado, zoom, API ou app instalado. Não confirma a cobertura de todas as 35 páginas; complementa os pareceres funcionais e de acessibilidade. Os demais D e todos os C do produto ficam `null` nesta ficha.

O mascote azul arredondado visto nas capturas é **provisório**. Não equivale ao Stu caderno de capa azul e folha dobrada aprovado pelo dono. A indisponibilidade dos PNGs originais impede aprovação do branding final e não é disfarçada como falha de layout. Os mockups não são execução React Native nem evidência de fluidez no iPhone.

## Julgamento independente

As propostas já têm um sistema visual coerente: margens consistentes, hierarquia legível, ícones com mesma linguagem, azul usado para ações e um padrão estável de navegação. A diferença A/B/C aparece na composição, não apenas na paleta. Não há razão visual para reiniciar o trabalho ou acrescentar novas fontes, cores, sombras ou cenários.

O que falta para uma defesa mais convincente é **editar o que não informa** e aproximar o acabamento do momento de aprendizado. O principal achado é uma faixa de pseudométricas na conclusão, compartilhada pelas três direções. A semântica da informação precisa sustentar o tratamento de destaque.

| Direção | D4 nesta candidata | Evidência a favor | Dívida que limita a nota |
| --- | ---: | --- | --- |
| **A · Jornada Azul** | **8,0** | Início acolhedor; próximo conteúdo identificável; percurso espacial com estados concluído/atual/bloqueado claros; botões com relevo contido e Quicksand coerentes com a personalidade. Stu na lição tem uma orientação específica sobre a nota exatamente 7. | AR1: faixa decorativa de conclusão. Há refinamentos baixos de duplicação no início e proporção da celebração. |
| **B · Caderno Claro** | **8,0** | Capa com dobra, borda lateral, papel e nós de índice formam uma metáfora consistente. O mapa parece capítulo de caderno e mantém a clareza de estados. A página de lição tem bom espaço de leitura. | AR1: faixa decorativa de conclusão, particularmente evidente na primeira dobra. A metáfora de página não deve substituir a informação praticada. |
| **C · Foco Vivo** | **8,0** | Início concentra a retomada em um único bloco navy; mapa linear com linha/divisor; títulos Nunito mais firmes; perfil integra avatar e nome sem a faixa vazia de A/B. A diferença de densidade e hierarquia é real. | AR1: faixa decorativa de conclusão. A menor presença de Stu é uma escolha coerente com a tese, mas dá menos acolhimento do que A para o objetivo declarado. |

**Por que 8,0:** AR1 é um achado médio de coerência editorial e visual. O protocolo limita a faceta a 8 enquanto houver achado médio aberto. Esta nota não é uma média de preferências nem uma avaliação de satisfação por pessoas. A correção exige nova captura e conferência antes de mudar a nota; não se atribui 9 antecipadamente.

## Cinco refinamentos, em ordem de prioridade

### AR1 · Retirar pseudométricas da conclusão — média, A/B/C

**Prova:** `caderno-conclusao-390.png` e `foco-conclusao-390.png` mostram três valores grandes: `1`, `SQL`, `Seu`, com legendas `de 5 lições`, `na prática`, `próximo passo`. O mesmo HTML está em `completionContent()` de `prototipo/app.js`, também para A, abaixo da dobra inicial.

`SQL` é o tema e `Seu` é um pronome. O tratamento de três métricas sugere informação equivalente que não existe. O progresso numérico e a próxima lição já estão explicados em componentes próprios imediatamente acima. A faixa adiciona altura e aparenta preencher o final da composição.

**Refino concreto:** remover apenas a `.stats` de `completionContent()`. Preservar a `.stats` do perfil, onde os números representam trilhas, lições e publicações reais do exemplo. Manter no fechamento: resultado do estudo, confirmação, progresso, próxima lição e ideia praticada.

**Conferência:** nas três conclusões, inclusive após rolar, todo bloco de destaque tem conteúdo próprio; nenhum texto `SQL / na prática` ou `Seu / próximo passo` permanece como pseudométrica. A redução não deve apagar `Vale rever`, a origem local da confirmação ou os botões de continuidade.

### AR2 · Tornar o foco do SQL visualmente específico — baixa, A/B/C

**Prova:** as três capturas de `licao` apresentam a consulta inteira no mesmo peso. O texto e o exemplo destacam a inclusão do limite; no código, `>= 7` recebe o mesmo tratamento de `SELECT nome FROM alunos`.

**Refino concreto:** aplicar peso forte ao operador e ao valor relevantes nesse exemplo (`>= 7`), com os tokens existentes. Não colorir cada palavra nem criar mais um painel. Para os demais conceitos, o realce deve acompanhar a parte realmente explicada, sem regra automática que destaque sempre qualquer número.

**Conferência:** leitura continua boa em uma cor e com seleção de texto; a consulta não muda e o contraste do trecho realçado se conserva. O foco visual corresponde ao objetivo da lição, sem depender de animação.

### AR3 · Editar a repetição no início de A — baixa, A

**Prova:** `jornada-inicio-390.png` traz `Continue sua trilha`, `Seu próximo passo está aqui`, o bloco azul `Próxima lição · 2 de 5` e o CTA `Retomar INNER JOIN`. A tarefa permanece clara, mas três mensagens repetem a ideia de continuidade antes do conteúdo útil da biblioteca.

**Refino concreto:** retirar a frase genérica `Seu próximo passo está aqui` do hero de A. Preservar o nome da trilha, Stu, o número/título da próxima lição e o CTA. Não acrescentar novo slogan no lugar. A redução de altura deve vir do conteúdo, sem encolher corpo, alvos ou margens de forma indiscriminada.

**Conferência:** título da trilha e próximo estudo continuam claros; a composição respira e a seção seguinte aparece antes. Manter os tamanhos de leitura e os alvos atuais.

### AR4 · Dar uma proporção mais contida à celebração de A — baixa, A

**Prova:** em `jornada-conclusao-390.png`, a ilustração domina a abertura e `Leve esta ideia` começa junto ao limite inferior da área rolável. B/C mostram mais do resumo da aprendizagem na mesma altura. Isso não é corte de conteúdo nem falha de rolagem; é uma escolha de ênfase a refinar.

**Refino concreto:** testar o Stu da conclusão A com largura de aproximadamente **136 px**, preservando proporção e respiro, em vez dos 164 px atuais. Não reduzir a celebração em todas as telas. A pose deve seguir sendo o primeiro sinal afetivo, com título, progresso e próxima ação próximos.

**Conferência:** comparar antes/depois em 390 e 360; a expressão continua reconhecível e a ideia praticada ganha presença. Recalibrar quando chegar o Stu caderno, cuja silhueta é diferente; não tratar 136 px como medida final do novo asset.

### AR5 · Escrever o vazio de novidades em linguagem concreta — baixa, A/B/C

**Prova:** as três capturas de `perfil` usam `Seu perfil está com você. Compartilhe uma trilha quando quiser.` sob `Suas novidades`. A primeira frase soa como slogan e não informa por que a área está vazia. O controle de privacidade já tem uma entrada própria abaixo.

**Refino concreto:** no vazio deste exemplo, substituir por **`Nenhuma novidade por aqui ainda. Compartilhe uma trilha quando quiser.`**. Manter o convite opcional e não afirmar que compartilhar é obrigatório ou que toda trilha será publicada.

**Conferência:** texto corresponde ao estado vazio, cabe no componente nas três direções e não contradiz a visibilidade escolhida para uma trilha.

## Recomendação de direção

**Recomendo A · Jornada Azul como base principal do Studoo.** É a proposta que conecta mais diretamente a inspiração do Duolingo à tarefa do produto: próximo passo visível, caminho reconhecível, reação junto do conteúdo e encerramento com continuidade. Seu caráter acolhedor aparece na lição, além da tela de entrada. Isso é julgamento de direção de arte, não resultado de teste com estudantes.

**B é a alternativa mais promissora para uma identidade autoral ligada ao novo Stu caderno.** A dobra, a margem e o índice funcionam sem depender do personagem. Ela merece continuar na comparação até testar a arte original. Não basta trocar a imagem antiga para considerar a integração final aprovada.

**C é a alternativa de maior concentração visual.** O início e o perfil são especialmente econômicos. Para a intenção atual de afeto e progressão inspirada no Duolingo, A tem maior aderência; isso não torna C uma versão incompleta.

Não recomendo combinar os três sistemas inteiros. Escolher uma espinha dorsal e manter sua regra de componentes terá mais coerência do que alternar estilos a cada tela.

## Estado do parecer

- **D4 da candidata examinada:** 8,0 em A/B/C; AR1 aberto. AR2–AR5 são refinamentos baixos e localizados.
- **Aprovação global de desenho:** não atribuída por esta amostra de 15 quadros. Consolidar com os outros pareceres e revisar a próxima candidata.
- **Branding com Stu caderno:** pendente de asset original e nova composição.
- **Movimento, execução nativa e uso por pessoas:** não realizados nesta revisão.

Uma nota 9 pode ser defendida quando os destaques tiverem função clara, o sistema continuar consistente após o refino e as provas declaradas forem atualizadas. A cobrança de perfeição aumenta o rigor da revisão; não altera a régua para assegurar um número.
