# C · Estúdio essencial

**Proposta, sem alterações no produto.** [Abrir protótipo](direcao-c.html). Dados sintéticos, nenhuma API ou autenticação, nenhum progresso gravado em conta. O seletor externo abre Pedido, Geração, Proposta e Conclusão; o percurso interno permite responder um exercício SELECT, concluir 1 de 3 e abrir uma amostra de WHERE.

Para abrir um estado diretamente, usar `?estado=pedido|geracao|proposta|conclusao`. Valores fora dessa lista abrem Pedido; o estado atual fica em `body[data-estado]` para a galeria e as capturas.

## Tese

Dar ao Studoo a clareza de um espaço de trabalho pessoal: a tarefa ocupa o centro, o contexto permanece legível e a próxima ação tem prioridade. A maturidade vem de escala tipográfica, alinhamento e intervalos, sem impor modo escuro. Stu entra no feedback da conclusão, como presença pontual de acolhimento.

**Gap de arte:** a imagem usada é do kit atual, provisória, e não representa o novo Stu caderno dos PNGs fornecidos na conversa. A referência final continua sendo o caderno de capa azul, folha dobrada e óculos com os dois “o” do logo. Os PNGs originais precisam ser disponibilizados como arquivos antes de uma integração fiel; este protótipo não redesenha nem substitui a referência. O banner externo identifica essa limitação.

## Tokens e componentes

| Camada | Proposta |
| --- | --- |
| Marca | Navy `#0B1B5C`; azul `#2563FF` reservado ao CTA; logo oficial e Stu provisório do kit atual, sem redesenho. |
| Base | Branco `#FFFFFF`; fundo `#F4F5F7`; texto `#17233E`; texto secundário `#5A6579`; divisores `#D9DEE8`; contorno de campo `#7B86A0`. |
| Tipografia | Nunito variável para corpo e títulos, 15–18 px no corpo, auxiliares a partir de 12 px e 29–42 px nos títulos. Quicksand fica no marcador SQL. Fontes locais `/marca/*.woff2`. |
| Forma | Grade de 4 px, margens móveis de 18–20 px, raio de 8–12 px, divisores finos e nenhuma elevação no caminho principal. |
| Ação | Uma ação azul por estado, mínimo 50 px; alternativas abaixo dela no mobile, alvos a partir de 44 px e foco de 3 px. Rodapé fora da região rolável. |
| Movimento | Estados imediatos, sem espera nem animação de progresso fictícia. Preferência de movimento reduzido respeitada; sem som ou animação em ciclo. |

## Reorganização proposta

- **Pedido:** objetivo em primeiro plano, expectativa curta e CTA persistente; explicação do processo aparece ao lado apenas quando há largura. Neste recorte, o objetivo SQL é somente leitura e identificado como exemplo fixo, para não sugerir geração personalizada inexistente. Upload, interesses e ajustes avançados ficam fora deste recorte, sem inventar controles que não funcionam.
- **Geração:** sequência textual de trabalho, sem percentagem ou prazo inventado. A simulação declara que não está gerando e oferece avançar ou voltar. Uma implementação real precisará usar estados reais da geração, cancelamento e recuperação.
- **Proposta:** lista editorial das três lições SELECT, WHERE e ORDER BY. O próximo passo tem destaque; o plano inteiro continua visível. “Rever meu objetivo” retorna ao objetivo fixo desta comparação.
- **Conclusão:** evidência do que foi praticado, progresso 1 de 3 e WHERE como próximo passo. Sem XP, ranking, medalhas ou confete. Voltar ao plano mantém SELECT concluída durante esta sessão da página; recarregar reinicia a demonstração.
- **Moldura:** navegação lateral discreta no desktop. No mobile, logo, contexto e conteúdo, sem uma segunda barra de navegação competindo com a ação da tarefa.

## Tradeoffs

Nunito também nos títulos reduz a alternância tipográfica e oferece uma leitura mais editorial; a menor presença de Quicksand e de Stu pode reduzir o reconhecimento afetivo da identidade. É hipótese de direção, não mudança aprovada da marca. A lista transmite sequência com mais clareza, mas reduz a personalidade do mapa ilustrado atual. A proposta não decide remover o mapa nem o envio de materiais do produto: ambos exigem comparação de tarefas antes da implementação.

O rodapé de ação protege o CTA na dobra, enquanto o conteúdo longo rola separadamente. Isso precisa de conferência de teclado virtual, texto ampliado e áreas seguras antes de portar para o app. O protótipo HTML mostra comportamento web; não é prova de integração nativa nem de persistência entre dispositivos.

## Avaliação e evidências

Aplicar o [método de avaliação](../METODO-AVALIACAO.md), com três pareceres independentes e notas `null` até existir evidência suficiente. Não há nota global atribuída a esta direção.

Conferências efetivamente executadas neste HTML, em Chromium headless em 23/11/2026: quatro estados em 390×844 e 360×800, sem transbordamento horizontal ou vertical e sem rolagem interna com texto padrão; CTA de 50 px integralmente na viewport e botões visíveis com alvos de pelo menos 44 px. Após ampliar todos os auxiliares para pelo menos 12 px, os oito estados foram repetidos; a menor fonte renderizada é 12 px e o banner continua cabendo nos seus 110 px. Percurso local Pedido → Geração → Proposta → SELECT com erro/acerto → Conclusão → plano com 1/3 → WHERE passou, sem erro de JavaScript; Escape fechou o diálogo e devolveu foco ao CTA. Também foi conferido o fluxo com movimento reduzido, o fallback de query inválida e a proposta em 1440×1000.

Uma revisão independente calculou os pares principais: branco/azul 4,88:1, branco/navy 15,84:1, texto secundário/branco 5,88:1 e contorno do campo/branco 3,65:1. Isso sustenta esses pares, não certifica toda a acessibilidade. Seus dois achados — edição de objetivo sem geração correspondente e ressalva pequena sobre persistência — foram tratados com objetivo fixo identificado e ressalva de 12 px. Leitor de tela, texto ampliado, teclado virtual, pessoas reais e execução nativa continuam pendentes.

| Critérios | Hipótese a verificar | Evidência necessária |
| --- | --- | --- |
| C1/C2 | Objetivo e próximo passo se entendem sem ajuda; voltar preserva o contexto. | Percurso de criação, exercício e retomada; observação de compreensão registrada separadamente. |
| C3/C4 | Hierarquia e baixa decoração melhoram leitura sem perder Studoo. | Pares em 390×844 e 360×800, desktop e comparação com as outras direções. |
| C5/C6 | Menos movimento, foco visível, AA e alvos adequados preservam a tarefa. | Medição de contrastes/alvos, teclado e diálogos, leitor de tela, 200% de texto e movimento reduzido. |
| C7/C8/C9 | Espera e conclusão representam o estado verdadeiro. | Simulação local é só demonstração; integração real, falhas, cancelamento e salvamento continuam pendentes. |
| C10 | A mesma organização funciona na web e no app. | Implementação candidata em ambos, pares na mesma largura e conferência nativa; pendente. |

Estado inicial: **proposta em revisão**. Nenhuma avaliação empírica com pessoas, integração de API ou validação nativa foi executada neste artefato.
