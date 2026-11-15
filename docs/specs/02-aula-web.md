# Aula por etapas (web e app)

A aula mostra uma etapa de cada vez, com uma barra de andamento no topo e a ação principal no rodapé. O número de etapas muda de lição para lição (`etapasDaLicao`, em `packages/contratos/src/licao.ts`, usado pelas duas plataformas):

1. **Conceito**, no balão do Stu, com a origem do conteúdo.
2. **Exemplo resolvido** ou **demonstração** (habilidades práticas). O exemplo pode trazer um recurso desenhado pelo app (diagrama de acorde com som, linha do tempo ou a foto do material), um passo a passo e frases para ouvir e repetir.
3. **De um a três exercícios**, cada um com o próprio retorno. Os formatos estão em `docs/specs/08-aprender-qualquer-assunto.md`.
4. **Prática no mundo real**, quando a lição pede: a tarefa, uma lista para conferir, uma dica e um cronômetro. Na volta, a pessoa conta como foi (consegui, quase lá, ainda não), o Stu responde e só então a lição pode ser concluída.

Depois da resposta, o rodapé vira o painel de retorno: verde no acerto, com confete, ou âmbar no erro, com o exercício tremendo. O retorno pode trazer um aviso (acento, deslize de digitação, justificativa errada) e, no ordenar e no associar, quantos itens já estão certos. No erro, dá para tentar de novo ou continuar. **Continuar** avança para a próxima etapa; na última, registra a conclusão e mostra o resumo (tempo, tentativas, etapas e, se houver, a prática). Se o comprovante expirar, a aula volta ao último exercício.

A avaliação envia o índice do exercício (`indice`, 0 por padrão, para clientes antigos). A conclusão aceita a prática (`pratica`), guardada em `RegistroEstudo.pratica`.

Para conferir: gere “Quero aprender violão do zero”, avance até o exemplo do Lá menor, toque em **Ouvir o acorde**, responda ao exercício e faça a prática com o cronômetro. Na lição seguinte, ordene os movimentos da troca de acorde. Em “Inglês para conversar em viagens”, ouça as frases e faça o exercício de escuta (**Mostrar o texto** revela a frase). O exemplo de SQL continua: preencha `>=` na primeira lição.
