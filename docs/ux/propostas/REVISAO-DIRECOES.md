# Revisão visual independente das três direções

Revisor: agente `revisao_ios`, sem autoria dos protótipos. **23/11/2026.** Escopo: Proposta e Conclusão em **390×844 e 360×800**, nas três direções. Examinei as doze capturas individuais, os dois comparativos e os HTMLs, e medi novamente contraste textual e dobra no Chromium. São exemplos locais com dados sintéticos; não são a interface integrada da web ou do app.

**Recomendação: começar o piloto por A — Clareza que ensina.** A sequência em linguagem de tarefa, a leitura arejada e a ação evidente oferecem o ponto de partida mais consistente entre os exemplos. É julgamento de projeto, não resultado de observação com estudantes nem nota global de UX. As três direções continuam úteis como hipóteses distintas; não recomendo misturá-las antes de conferir um percurso real.

## Até três achados

1. **A: hierarquia mais direta; sem defeito visual médio confirmado neste recorte.** A lista explica o que a pessoa fará antes de apresentar o comando SQL. A conclusão distingue o que foi concluído, a posição na trilha e o próximo passo. A ação de 52 px tem boa folga em ambas as alturas e aparece antes da saída secundária. O espaço livre exige disciplina para textos reais maiores; não deve ser preservado encolhendo fonte. No piloto, comparar “Ver minha trilha” com a continuação direta oferecida por B/C para decidir qual saída corresponde melhor à intenção após concluir.
2. **B: acolhimento bem resolvido, com maior consumo de altura; sem defeito visual médio confirmado neste recorte.** O creme e a folha branca agrupam o plano sem excesso de bordas; o personagem tem presença contextual. Os CTAs de 50 px cabem inteiros, inclusive com a faixa externa de protótipo. A conclusão em 390×844 termina a ação principal em 780,6 px, oferecendo menos reserva que A para texto ampliado, tradução ou área segura. Esse é um risco de adaptação a testar no renderizador real, não uma falha demonstrada nas capturas atuais.
3. **C: boa síntese do aprendizado; auxiliares pequenos corrigidos e conferidos.** A conclusão explica concretamente o SELECT praticado e coloca a próxima lição junto do andamento; a composição favorece leitura técnica. A menor presença de Quicksand/Stu reduz a continuidade com a identidade atual. A versão inicial tinha auxiliares de 9–10 px; o autor elevou-os a pelo menos 12 px, inclusive nas regras móveis. Repeti os quatro casos Proposta/Conclusão em 390/360: fonte textual visível mínima de **12 px**, contraste preservado e CTA inteiro, sem rolagem horizontal. A captura adicional da conclusão em 360 confirma que a nota de progresso cabe sem disputar com a ação.

## Contraste e dobra observados

A medição independente inicial está em [revisao-visual-metricas.json](capturas/revisao-visual-metricas.json). Foram **12 combinações**: duas telas × duas larguras × três direções. A repetição dos **quatro casos finais de C**, após o ajuste de fontes, está em [revisao-visual-c-final.json](capturas/revisao-visual-c-final.json), coletada às 21:00 UTC. Não houve rolagem horizontal; a ação principal ficou inteira na viewport em todas. As medidas finais de C mantiveram as posições iniciais.

| Direção | Altura da ação | Final do CTA Proposta / Conclusão em 390×844 | Final do CTA Proposta / Conclusão em 360×800 |
| --- | ---: | ---: | ---: |
| A | 52 px | 642,2 / 683,0 px | 603,4 / 631,8 px |
| B | 50 px | 746,0 / 780,6 px | 704,0 / 728,0 px |
| C, após o ajuste dos auxiliares | 50 px | 784,0 / 784,0 px | 740,0 / 740,0 px |

O menor contraste textual encontrado nas combinações visíveis examinadas foi **4,88:1**, branco sobre o azul `#2563FF`, usado também no CTA. Os demais pares textuais calculados cumpriram o limiar aplicável de 4,5:1 para texto comum ou 3:1 para texto grande. O cálculo sRGB usa cores computadas e composição sobre os fundos dos ancestrais; não é uma auditoria completa de acessibilidade, foco, texto sobre imagens, pseudoelementos ou leitura por tecnologia assistiva. Tamanho pequeno continua sendo risco de leitura mesmo quando o contraste passa.

## Branding e limites para a implementação

**A arte é provisória nas três propostas.** O kit local mostra o Stu azul arredondado. A referência enviada na conversa é o novo **Stu caderno, de capa azul, folha dobrada e óculos com os dois “o” do logo**. Os banners avisam dessa diferença; nenhuma captura prova integração fiel dos PNGs originais, que não estão disponíveis como arquivos locais nesta cópia. Não foi inventado ou aprovado um personagem substituto. A decisão de direção pode avançar; a aprovação final de branding exige integrar a arte de origem e rever suas proporções nas mesmas larguras.

“Progresso salvo” e “1 de 3” são conteúdo ilustrativo dos exemplos. No produto, a confirmação de salvamento depende da resposta real do servidor e precisa de estado para falha/nova tentativa. As capturas não comprovam persistência, geração real de trilha, aprendizagem, teclado virtual, áreas seguras ou paridade nativa. O HTML do protótipo não substitui esse trabalho.

**Sem nota global de UX ou aprovação do produto.** Esta revisão compara qualidade visual e riscos de três hipóteses. A próxima prova é implementar uma direção em geração/aceite SQL → primeira lição → conclusão → reabertura do progresso, seguindo os contratos, pares web/app e o método de avaliação. Nenhum HTML ou código do produto foi alterado por esta revisão.
