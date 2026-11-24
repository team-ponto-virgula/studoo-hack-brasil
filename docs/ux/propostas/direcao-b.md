# Direção B — Caderno vivo

Uma experiência acolhedora, com organização de caderno e clareza de ferramenta de estudo. O creme se inspira na folha do Stu caderno, referência enviada pelo dono na conversa; o azul preserva a marca e indica ação. O personagem participa dos momentos em que pode orientar ou reconhecer um passo, sem disputar com campos, conteúdo ou botões.

[Protótipo interativo](direcao-b.html): Pedido → Geração → Proposta → Conclusão, com retomada ilustrada em WHERE. Todo o conteúdo é sintético e as transições são locais. O botão que inicia a primeira lição simula sua conclusão; não representa uma aula executada. “Salvo” é um exemplo visual abrangido pela faixa persistente de dados sintéticos, sem escrita ou comprovação de persistência.

## Organização e componentes

1. Cabeçalho pequeno: marca e contexto. A hierarquia pertence à tarefa, não à navegação.
2. Pedido com uma pergunta, um único campo e explicação curta do que acontecerá. A própria pessoa confere a proposta antes de estudar.
3. Geração com estados escritos e cancelamento. A aplicação real deve usar os eventos do servidor; não adotar percentuais ou tempos inventados do protótipo.
4. Proposta em uma folha: título, escopo e três lições. O fio vertical mostra ordem, sem parecer ranking. A ação principal vem antes de ajustar o pedido.
5. Conclusão com aprendizado concreto, andamento da trilha e próxima lição. Um único bloco substitui a dispersão entre celebração, status e retomada.

Componentes candidatos: `CabecalhoDeTarefa`, `PerguntaDeEstudo`, `FolhaDaTrilha`, `LinhaDeLicao`, `AndamentoDaGeracao`, `ResumoDoPasso` e `AcoesDaTarefa`. Uma definição de espaçamento, textos, estados e tamanhos deve servir à web e ao app. Essas propostas não estão instaladas no produto.

## Tokens propostos

| Papel | Valor | Uso |
| --- | --- | --- |
| Marca/texto principal | `#0B1B5C` | Títulos, texto de destaque e foco |
| Ação | `#2563FF` | Único CTA principal, passo atual, informação ativa |
| Azul de leitura | `#204ED2` | Microtextos sobre creme: 6,28:1. O azul principal sobre creme daria 4,49:1, abaixo de AA para texto pequeno |
| Caderno | `#FFF4E7` | Fundo contínuo, reconhecível sem simular textura física |
| Papel | `#FFFFFF` | Campo, proposta, resumo |
| Acolhimento secundário | `#E9E7FF` | Navegação da bancada e agrupamentos discretos |
| Texto secundário | `#535C77` | Explicações, metadados |
| Sucesso | `#17653F` sobre `#E9F6EE` | Conclusão confirmada e lição concluída |
| Tipografia | Quicksand 700 / Nunito 400–900 | Títulos 30/28 px; subtítulos 22/17 px; corpo 16/19 px; rótulos 12–14 px |
| Ritmo | 6 / 12 / 18 / 22 px | Espaço conforme função; cartões de 18 px de raio |
| Interação | CTA 50 px, secundário 44 px | Largura total no celular, foco de 3 px |

Fontes e logo vêm dos arquivos oficiais existentes. **A arte de personagem exibida é provisória: o kit atual mostra o mascote azul arredondado, não o novo Stu caderno dos anexos.** Os PNGs originais do caderno não estão disponíveis nesta cópia; a legenda externa deixa essa diferença explícita. A referência final é o caderno de capa azul, folha dobrada e óculos formados pelos dois “o” da marca. Não foi redesenhado, exportado ou substituído por uma arte inventada. O protótipo não redesenha a marca nem muda a família tipográfica. O refinamento está na hierarquia, no espaço, na relação entre a folha e o Stu e na distribuição dos pesos.

## O que ganha e o que exige cuidado

A direção aproxima a interface do mascote sem transformar o app em brinquedo. A distinção entre fundo creme e folha branca agrupa informação com pouca borda. O caminho fica legível de cima para baixo e cada etapa possui uma decisão principal.

Em telas com material técnico denso, o creme deve recuar: fundo branco e tipografia de leitura precisam ter prioridade. Repetir o Stu em todos os cartões criaria ruído; esta direção reserva uma pose por estado. Textos ampliados podem exigir rolagem, e teclado/áreas seguras precisam ser testados nos renderizadores reais. Bordas claras são separadores de grupos, não o único indicador de uma ação ou estado.

## Revisão pelo método

C1/C2: conferir compreensão do pedido, da proposta e da próxima ação. C3/C4: medir dobra, quebra de títulos e contraste, comparando as duas larguras e os renderizadores. C5: entrada opcional de 160 ms; movimento reduzido mantém tudo estático, sem som. C6: foco visível, nomes, controle por teclado e tecnologias assistivas. C7/C8: geração lenta, cancelamento preservando pedido, falha e nova tentativa. C9: “salvo” só depois da confirmação real, reabertura e retomada no servidor. C10: mesmos estados e componentes na web e no app.

Não atribuir nota global de UX a este mock. A seleção da direção deve ser seguida pela implementação de um percurso completo, pelas provas do método e pelos pareceres independentes. Voz nativa, teclado, Safe Area, persistência e desempenho não são comprovados pelo HTML.

## Conferência executada no protótipo

Chromium headless, 23/11/2026: quatro estados em 390×844 e 360×800, sem erro JavaScript ou rolagem horizontal; a ação principal mede 50 px de altura e fica inteira na dobra em todos os oito casos, incluindo a faixa externa de arte provisória. Consulta de estado inválida volta ao Pedido. O percurso local Pedido → Geração → Proposta → Conclusão → WHERE e retorno à trilha funcionou; cancelar preservou o texto digitado e a trilha ilustrativa passou a destacar a segunda lição. Movimento reduzido e entrada por teclado foram conferidos no browser. Contrastes sRGB calculados: CTA branco/azul 4,88:1, texto secundário/creme 6,11:1 e borda do campo/branco 3,11:1; o microtexto azul sobre creme foi escurecido para 6,28:1. Isso verifica o HTML conceitual, sem aprovar o aplicativo, persistência ou acessibilidade nativa.
