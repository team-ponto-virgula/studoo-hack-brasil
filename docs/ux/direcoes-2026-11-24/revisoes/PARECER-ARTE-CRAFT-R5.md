# Direção de arte e acabamento — R5

24/11/2026 · candidata formal congelada **`5ad1225f586af063d58f694d4ebe705fcabca081`**. Revisão somente leitura das fontes de UI; os pareceres [R3](PARECER-ARTE-CRAFT.md) e [R4](PARECER-ARTE-CRAFT-R4.md) permanecem históricos.

**D4 = 9,0 em A/B/C no recorte examinado.** Os novos estados mantêm o sistema visual das propostas. Dois refinamentos baixos permanecem abertos e estão descritos abaixo. Esta aprovação de acabamento não encerra a matriz de cobertura nem a falha de conteúdo longo encontrada pela revisão visual.

## Evidência nova

Foram capturados e **abertos 42 PNGs reais novos**, todos a DPR 2, depois de fontes carregarem e de a entrada inicial terminar:

| Conjunto, repetido em A/B/C | Viewport | Quadros |
| --- | --- | ---: |
| Início, mapa, lição, conclusão e perfil | 390×844 | 15 |
| Geração parcial | 390×844 | 3 |
| Geração em espera longa | 360×800 | 3 |
| Material: prévia e formato inválido | 360×800 | 6 |
| Capa e tema | 390×844 | 3 |
| Trilhas aprovadas no perfil | 390×844 | 3 |
| Perfil com novidades | 360×800 | 3 |
| Associação com resposta parcial | 360×800 | 3 |
| Reforço com desafio vencido | 390×844 | 3 |
| **Total** | | **42** |

Chromium **156.0.8078.79**. Os 14 arquivos JS/CSS examinados, incluindo os módulos de material e personalização e os três CSS de direção, têm hashes idênticos antes/depois da captura. Nenhuma imagem estava sem carregar; zero exceções JavaScript e nenhum overflow horizontal nas **42 fixtures normais deste conjunto**. Isso não cobre o nome de material de 160 caracteres sem espaços que falhou em outra suíte.

As provas estão em `/workspace/work/revisao-arte-craft-r5/`: `capturar.cjs`, `evidencias.json` e os 42 PNGs. Os dados registram fonte, navegador, hashes, títulos, textos, caixas dos botões e carregamento dos assets. Não se reutilizaram capturas R4 como se fossem R5.

Também foram lidos `NOTAS-JORNADA.md`, `NOTAS-MATERIAL.md`, `NOTAS-PERSONAL.md` e os ramos correspondentes do renderer. As notas dos autores descrevem intenção/provas de autoria; não foram tratadas como aprovação independente de todas as interações.

## Avaliação de acabamento

| Direção | D4 | Evidência e julgamento |
| --- | ---: | --- |
| **A · Jornada Azul** | **9,0** | A progressão espacial, botões com relevo, títulos Quicksand e Stu contextual continuam formando uma família. Os novos materiais e a personalização usam os mesmos ritmos e ações. A conclusão mantém Stu de 112 px, resumo e continuidade sem a antiga faixa de pseudométricas. |
| **B · Caderno Claro** | **9,0** | Papel, margem lateral, divisores e mapa como índice se mantêm coerentes quando entram prévia de material, capas e postagens. A materialidade apoia a leitura sem textura concorrente. O conteúdo informativo continua legível e o novo fluxo não vira um sistema visual separado. |
| **C · Foco Vivo** | **9,0** | Blocos navy, títulos Nunito mais firmes e composição linear continuam a tese de concentração. Na geração, a descrição do objetivo recebe foco e a lista recebida fica subordinada. Perfil, materiais e novas ações preservam a mesma hierarquia. |

As notas iguais não significam propostas indistintas. A tem caminho e companhia; B usa página/índice; C concentra conteúdo em blocos e listas. Essas diferenças continuam reconhecíveis além da paleta.

O título da trilha aparece **uma vez na geração**, no cabeçalho; o hero passa a explicar o objetivo. Os nós recebidos usam livro e rótulo **“Recebida”**, sem check que sugeriria lição concluída. Esse cuidado melhora a relação entre informação e forma.

Na associação parcial, check e texto “Correspondência correta · mantida” identificam o que foi preservado, sem depender só do verde. No reforço vencido, título estável, resumo e volta à questão tornam o resultado compreensível. O espaço branco dessa vitória é uma escolha de concentração, não um motivo para acrescentar métricas ou uma nova ilustração sem função.

As miniaturas de capa usam uma representação CSS própria dos IDs do contrato. Não são novas imagens finais da marca ou prova de upload/moderação de capa. O Stu caderno original segue pendente; o personagem mostrado permanece provisório.

## Dois refinamentos baixos, abertos na R5

### R5-AR1 · Reduzir a pilha fixa de saídas no exercício

**Baixo · A/B/C.** Nas três capturas de associação parcial em 360×800, o rodapé contém quatro ações: Tentar de novo, Ver outro jeito de entender, Seguir sem acertar e Etapa anterior. A primeira começa em y = **576** e a última termina em y = **784**; com o respiro, a região fixa ocupa perto de 30% da altura. Tudo cabe e a tarefa funciona, mas sobra menos área para ler os pares e o retorno.

**Refino proposto:** levar **Etapa anterior** para o conteúdo junto do andamento, preservando seu rótulo, destino e alvo. A fonte de produção já apresenta a ação antes do conteúdo da etapa em `apps/mobile/src/licao.tsx:805–808`. Manter Tentar de novo como CTA primário, antes das saídas secundárias.

**Nova prova necessária:** quadro de erro/parcial em 390/360 e texto ampliado, foco/teclado e voltar preservando tentativa. Este parecer não atribui aprovação à alteração futura.

### R5-AR2 · Consolidar a identificação da fixture de postagem

**Baixo · A/B/C.** Em `perfil/perfil-aprovado`, a origem demonstrativa é explicada no aviso inicial, num segundo bloco “Estado de moderação simulado” e de novo no cartão aprovado. Os textos são verdadeiros e as ações estão acessíveis; a repetição dá ao metadado de revisão uma ênfase próxima à própria trilha.

**Refino proposto:** tornar a identificação do estado forçado uma legenda compacta. Preservar o aviso sobre respostas/progresso/email e deixar explícito que a aprovação/publicação é local. Não ocultar a simulação para deixar o quadro mais bonito.

**Nova prova necessária:** comparar as três postagens aprovadas/pendentes e suas saídas; confirmar que a origem sintética e o estado ainda são entendíveis e que não houve publicação automática. Não se transfere esta nota à composição futura.

Os dois achados são localizados e de gravidade baixa. Não justificam reiniciar o sistema visual nem criar outra direção. Eles impedem afirmar ausência de qualquer detalhe aberto; por isso não se atribui 9,5 ou 10.

## Limites e recomendação

A revisão visual independente encontrou uma **falha média de reflow em nome de material válido com 160 caracteres sem espaços**, na origem da lição. Esse dado não fazia parte das 42 fixtures normais desta inspeção; sua prova pertence ao parecer visual/QA R5. A nota D4 acima não o apaga, não aprova D3/D6 e não encerra DG3. A candidata completa permanece em revisão.

**Mantenho A · Jornada Azul como recomendação principal** para a intenção declarada de Studoo com inspiração no Duolingo. B continua uma alternativa forte para dialogar com o futuro Stu caderno; C é a opção de maior concentração. Escolher uma estrutura principal e seus componentes será mais coerente do que alternar as três linguagens entre páginas.

Esta ficha não mediu animação, leitor de tela, safe area, teclado virtual, desempenho ou comportamento instalado. As páginas são HTML com dados locais. Não há aprovação do novo branding, integração web/React Native ou uso por estudantes. A consolidação dos 14 LC e das provas de cobertura pertence à [matriz R5](../MATRIZ-COBERTURA-R5.md), sem herdar notas a partir destas capturas.
