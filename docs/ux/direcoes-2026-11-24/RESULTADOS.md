# Três direções — resultados e limites

**R6 em construção; a meta global ainda não foi aprovada.** A meta continua sendo pelo menos 9 em cada D1–D10 e na pior variante obrigatória, com os pesos e gates do [protocolo](COBERTURA-E-REVISAO.md) preservados.

## Fechamento R5

A candidata `5ad1225f586af063d58f694d4ebe705fcabca081` completou as representações das 14 lacunas da R4, com novas revisões de [fluxo](revisoes/PARECER-FLUXOS-R5.md), [visual](revisoes/PARECER-VISUAL-R5.md), [QA/acessibilidade](revisoes/PARECER-A11Y-R5.md) e [arte](revisoes/PARECER-ARTE-CRAFT-R5.md). A [matriz R5](MATRIZ-COBERTURA-R5.md) separa representação, interação, captura e exclusões fundamentadas.

O fluxo teve **885/888 asserções em 105 cenários**; três falhas são material pessoal enviado ao Explorar, repetidas em A/B/C. A republicação de cópias recebidas foi confirmada em três probes adicionais separados. Visual produziu 1536 vistas e complementos; QA produziu 210 PNGs DPR2 novos, matrizes e teclado. As contagens se sobrepõem e não são uma soma de testes funcionais. Fontes permaneceram estáveis durante as coletas.

**Seis achados mantêm a nota global `null`:** material permitido no Explorar; cópia recebida republicável; nome longo de material cortado no cartão/diálogo; foco perdido ao verificar/repetir uma resposta; foco perdido ao trocar cor; combinação inválida de parcial com lacuna na bancada. D3/D6 ficaram em 8 e as facetas de confiança/ação afetadas também não atingiram a meta. D4 de arte permaneceu em 9, com refinamentos baixos registrados. A R6 corrige os casos e exige nova prova; não altera os resultados históricos.

## Fonte e estado da revisão

A candidata **R4 `a6f2e09b559b3c531b66fbc404839d661d304f48`** foi congelada durante a coleta. Todos os pareceres mantêm sua fonte, contagens e limites; as alterações posteriores não aprovam retroativamente a R4.

| Revisão independente R4 | Verificação efetivamente feita | Resultado no recorte |
| --- | --- | --- |
| [Fluxos](revisoes/PARECER-FLUXOS-R4.md) | 516/516 verificações em 63 cenários; descrição por trilha, rascunhos, visitante, histórico, cinco lições e retorno ao início 5/5. | D1/D2/D8/D9 = 9,0 A/B/C; D10 e aprovação integral pendentes. |
| [Visual](revisoes/PARECER-VISUAL-R4.md) | 570 vistas da matriz, 48 alvos de email/conclusão, 24 vistas de trilha concluída, 60 casos longos e probes de movimento. | D3/D4/D5 = 9,0 A/B/C no recorte visual; D10 = 8,0 pelas omissões de cobertura. |
| [Arte e acabamento](revisoes/PARECER-ARTE-CRAFT-R4.md) | 20 capturas novas abertas, com fonte estável; cinco achados R3 conferidos novamente. | D4 = 9,0 A/B/C; recomenda A. Sem aprovação de branding final ou uso por pessoas. |
| [QA/acessibilidade](revisoes/PARECER-A11Y-R4.md) | 210 PNGs DPR2, 90 estados e 105 páginas a 200% sem falha nas métricas; teclado 186/186; guards de foto 36/42. | D3/D6 continuam em 8: título longo sem espaços no cabeçalho e foco num controle `data-go` durante decode da foto. Relatório e JSON detalhados preservados com a fonte R4. |

Esses conjuntos têm finalidades diferentes. Não somar capturas, asserts e rodadas sobrepostas para alegar uma quantidade de testes funcionais. Os bons resultados de um recorte não anulam falhas de outro.

## O que a R5 precisa fechar

Além dos dois defeitos de QA, a auditoria exige completar representações de material e leitura, geração progressiva/espera, sessão expirada, aceite pendente, carga/sincronia, balão do mapa, recurso/citação e retorno da lição, feedback parcial, desafio vencido, falha ao enviar explicação, ordenação/paginação de Explorar, perfil social e escolha de capa/tema. A auditoria vincula cada lacuna ao protocolo e às fontes reais; não exige reset global de trilha ou integrações ausentes da plataforma.

**DG1 reprovado; nota consolidada A/B/C = `null` na R4.** Faltas de representação dentro do desenho serão corrigidas e revistas. Não serão excluídas para elevar a nota.

## O que é esta entrega

São **35 páginas-base por direção**, seis formatos de exercício e subestados navegáveis, usando eventos e armazenamento locais. Não há API, login externo, email, IA, microfone ou banco reais. “Progresso confirmado” descreve somente o exemplo local do protótipo. Leitura a 200%, foco/teclado e movimento medidos aqui pertencem ao navegador da bancada.

As notas C1–C10 do produto integrado, a execução iPhone/Android, leitor de tela/teclado/safe area nativos e a validação com pessoas continuam sem nota. Os assets do personagem são o kit atual provisório; o Stu caderno original ainda exige integração e revisão.

A correção da intro foi distribuída separadamente no **TestFlight interno 0.1.0 (7)**; o [registro do build 7](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/8ae72bb5e45516660a25ae79d1a3518a42bbf18b/docs/beta/BUILD-7-INTRO-BOOT.md) contém as provas. As três direções não fazem parte desse IPA. Não houve execução do build em iPhone físico nesta máquina.

Fontes: [pesquisa adicional](PESQUISA.md), [brief](BRIEF.md), [A](DIRECAO-A.md), [B](DIRECAO-B.md), [C](DIRECAO-C.md), [histórico de pareceres](revisoes/). Para reabrir a bancada, veja o [índice da entrega](README.md).
