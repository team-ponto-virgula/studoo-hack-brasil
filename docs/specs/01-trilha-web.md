# Trilha de estudo na web

O plano aceito mostra o progresso total e um caminho único de lições, na ordem de aprendizado, sem agrupar por assunto (ver a [spec 03](03-trilha-ao-vivo.md#ordem-da-trilha)). Cada caminho distingue a lição disponível, as concluídas e as seguintes. O botão da lição disponível inicia ou retoma a trilha e tem um nome acessível com o título da lição, a posição e o estado (por exemplo, "Lição 3 de 5, atual").

A próxima lição vem de `proximaLicaoId` da API. A conclusão usa os registros do plano. Depois da primeira lição de SQL, a trilha marca a lição de `WHERE` como concluída, oferece a lição seguinte do caminho (`INNER JOIN`) e exibe uma de cinco lições concluídas.

Confira o caminho em tela larga e móvel. Aceite o plano, abra a primeira lição do caminho, conclua a primeira lição e recarregue. Reabra o plano e confirme que o mesmo fluxo continua na lição seguinte.

## Balão da lição no mapa: sempre inteiro na tela (pedido do dono, 20/11)

Palavras do dono: "Quero que nessa parte não deixe ficar cortado. Sempre que eu clicar na trilha, ele automaticamente sincronizar na tela, ficar no espaço certinho, ir até a trilha." Vale para web, Android e iPhone e entra na candidata do TestFlight. Ainda não implementado.

**Hoje** (captura do dono, trilha recebida, iPhone): o balão de uma lição bloqueada abre com o topo (título e "fechar") atrás do cabeçalho preso da trilha. Esse cabeçalho tem "SUA TRILHA", o título, "Esta trilha é de …", "Ver o link original" e a engrenagem, uns 260 px nessa tela. A web rola com `scrollIntoView({ block: 'nearest' })` (`src/ui/caminho.tsx`), e a folga de cima (`scroll-margin-block: 24px …`, `src/ui/caminho.css`) não conta o cabeçalho, que muda de altura entre a trilha própria e a recebida.

**Área livre:** vai do fim do cabeçalho preso da trilha até o começo da cápsula das abas. As duas medidas são as de verdade, tiradas na hora: elas mudam com o tipo de trilha, o texto ampliado, a quebra do título e a cápsula. Nada de número fixo. No iPhone, a área conta as áreas seguras e a barra do Safari (`visualViewport` na web). No computador, sem cápsula, a área vai até a borda de baixo da janela.

**A regra:**
- **Ao tocar em qualquer lição do mapa** (atual, concluída ou bloqueada), o nó e o balão aberto, juntos, ficam inteiros na área livre, com folga de 16 px em cima e 16 px embaixo.
- **Se já cabem**, a tela não se mexe.
- **Se não cabem**, a tela rola o mínimo para caber, nos dois sentidos.
- **Se o conjunto é mais alto que a área livre**, o topo do balão (título e "fechar") tem prioridade: ele fica 16 px abaixo do cabeçalho, e o resto do balão segue pela rolagem.
- A rolagem é suave, na rolagem padrão da plataforma (cerca de 300 ms). Com movimento reduzido, é imediata.
- O foco vai para o balão sem uma segunda rolagem (`preventScroll`), depois que a tela para.
- **"Mostrar a lição atual no mapa"** fecha o balão, leva o nó atual para a mesma área livre e abre o balão dele, com a mesma regra.
- **A abertura do mapa no nó atual** usa a mesma área livre, para o nó nunca nascer atrás do cabeçalho.
- O balão nunca fica atrás da cápsula. A reserva do fim da rolagem (spec 05) garante espaço para o último nó e o balão dele.

**Spec 07:** nenhuma diferença de plataforma. No app, a área livre vem da medida do cabeçalho (`onLayout`) e da reserva da cápsula.

**Aceite** (390 na web e no app, trilha própria e trilha recebida, que tem o cabeçalho mais alto; quadros antes e depois do toque):

| # | Passos | Esperado |
|---|---|---|
| M1 | Toca na primeira lição visível, logo abaixo do cabeçalho | A tela desce até o balão aparecer inteiro, com o título e o "fechar" 16 px ou mais abaixo do cabeçalho |
| M2 | Toca numa lição do meio que já cabe | A tela não se mexe |
| M3 | Toca na última lição, perto da cápsula | A tela sobe até o balão terminar 16 px ou mais acima da cápsula |
| M4 | Toca numa lição bloqueada e em "Mostrar a lição atual no mapa" | O nó atual e o balão dele inteiros na área livre |
| M5 | Texto ampliado (200%), balão mais alto que a área | O título e o "fechar" visíveis abaixo do cabeçalho |
| M6 | Movimento reduzido | Mesmo lugar, sem animação |
| M7 | 1440 | Mesma regra, até a borda de baixo da janela |

Teste de cada dev: depois do toque, o topo do balão fica a 16 px ou mais do fim do cabeçalho medido, e o fim do conjunto fica a 16 px ou mais do começo da cápsula. O teste vale nas duas alturas de cabeçalho.
