# Trilha de estudo na web

O plano aceito mostra o progresso total e um caminho único de lições, na ordem de aprendizado, sem agrupar por assunto (ver a [spec 03](03-trilha-ao-vivo.md#ordem-da-trilha)). Cada caminho distingue a lição disponível, as concluídas e as seguintes. O botão da lição disponível inicia ou retoma o fluxo e tem um nome acessível que inclui o título do fluxo.

A próxima lição vem de `proximaLicaoId` da API. A conclusão usa os registros do plano. Depois da primeira lição de SQL, a trilha marca a lição de `WHERE` como concluída, oferece a lição de `AND` em Consultas e exibe uma de quatro lições concluídas. Junções mantém sua própria retomada.

Confira o caminho em tela larga e móvel. Aceite o plano, abra a primeira lição do caminho, conclua a primeira lição e recarregue. Reabra o plano e confirme que o mesmo fluxo continua na lição seguinte.
