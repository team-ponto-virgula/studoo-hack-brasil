# Proposta de repaginação do Studoo

23/11/2026 · estudo de direção após a [rodada da intro](../RESULTADO-INTRO.md). **Proposta, não interface já implementada no produto.** As simulações são locais, com dados sintéticos; não chamam IA, não autenticam e não salvam progresso.

## Decisão proposta

Recomendo **A — Clareza que ensina** para o primeiro piloto de geração e conclusão. Ela torna o objetivo, a trilha proposta e a próxima lição mais fáceis de localizar com menor mudança na identidade existente. B explora mais o caderno e o acolhimento; C enfatiza síntese e leitura. Essa recomendação é julgamento de projeto a verificar, não resultado de teste com estudantes/jurados.

[Comparar os protótipos](index.html) · [A](direcao-a.html) · [B](direcao-b.html) · [C](direcao-c.html).

| Direção | Organização e branding | Vantagem a testar | Custo / risco |
| --- | --- | --- | --- |
| **A · Clareza que ensina** | Branco, azul do Studoo, cabeçalho curto, uma área principal e ações ordenadas. Quicksand nos títulos e Nunito no conteúdo. Stu acompanha o contexto. | Encontrar e executar a próxima ação sem disputar atenção com vários blocos. | Pode parecer contida demais se retirarmos também o caráter do Stu. Não eliminar os estados de ajuda e recuperação. |
| **B · Caderno vivo** | Creme/lavanda como superfícies, ritmo editorial e Stu mais presente. Azul continua sendo ação, não decoração em todo lugar. | Reforçar reconhecimento e acolhimento sem perder leitura ou maturidade. | Arte e superfícies podem consumir a dobra; limitar o espaço da ilustração e testar com texto ampliado. |
| **C · Estúdio essencial** | Composição clara, azul profundo e contraste tipográfico; menos camadas, mascote concentrado no feedback. | Dar fluidez a sessões de leitura e apresentar o projeto com maior síntese. | Pode enfraquecer a personalidade e a continuidade visual com o mundo ilustrado atual. |

As três preservam o logo e não redesenham o mascote. **A arte dos protótipos é provisória:** o kit no repositório contém o Stu azul arredondado, diferente do novo Stu caderno dos dois PNGs do dono. Os originais continuam visíveis na conversa, mas não estão disponíveis como arquivos locais nesta retomada. [Referências e diferença de assets](../REFERENCIAS-DO-STU.md). A integração final deve usar os originais do caderno; não considerar o personagem provisório uma escolha de branding aprovada.

## Arquitetura da interface

Organizar cada tela nesta ordem: **onde estou → o que preciso decidir → conteúdo necessário → ação principal → alternativas**. Uma ação visualmente dominante por estado; ajuda e saídas continuam acessíveis e reconhecíveis. A confirmação de progresso vem do servidor, sem uma ilustração fingir que algo foi salvo.

| Responsabilidade | Componentes propostos | Integração com o que existe |
| --- | --- | --- |
| Identidade e orientação | Cabeçalho de contexto, título/descrição, indicador de etapa quando necessário | Reusar `Logo`, `Stu`, mensagens e ícones do contrato; evitar animações simultâneas. |
| Decisão | Campo de objetivo, sugestões, resumo da proposta, lista de lições | Extrair unidades de apresentação de `Pedido` e da prévia em `src/app/estudo.tsx` e seus equivalentes mobile, sem reescrever cliente/API. |
| Ação | Área de ação principal + alternativas ordenadas | Reusar `Botao`/`AcaoPrincipal` da web e controles equivalentes do app. Mesma ordem em 390/360; no app, respeitar teclado/safe areas da spec 07. |
| Resposta | Estado de geração verdadeiro, erro com recuperação, aviso de sincronização, conclusão e próxima lição | Preservar cancelar/ajustar/proposta expirada, falhas de aceite e duplicidade. Não substituir o fluxo real por um timer ou porcentagem inventada. |
| Continuidade | Cartão de retomada e resumo do que foi concluído | Servidor confirma lição concluída; rascunho parcial respeita os limites distintos já documentados. Não prometer sincronização de rascunho entre dispositivos. |

A divisão por responsabilidade reduz disputa visual e facilita revisão de componentes. A lógica de estudo, sessão, consentimento e persistência deve ser preservada enquanto a apresentação muda. Evitar uma migração completa de componentes e estados no mesmo commit.

## Fundação visual

Manter uma fonte de tokens compartilhada para valores semânticos: `fundo`, `superficie`, `texto`, `textoSecundario`, `acao`, `foco`, `borda`, `sucesso`, `aviso`, `erro`. Mapear CSS e tema React Native a esses papéis; evitar dois catálogos de números que divergem. As variações de cada protótipo são hipóteses, não mudanças aprovadas nos contratos atuais.

- **Paleta:** azul profundo `#0B1B5C`, azul de ação `#2563FF`, branco; creme/lavanda com função de superfície. Verde e laranja comunicam estado, com texto e ícone; não depender só de cor.
- **Tipografia:** fontes locais Quicksand/Nunito como ponto de partida; hierarquia curta em torno de 32/24/17/14, linha de corpo confortável e rótulos legíveis. Não trocar família tipográfica apenas para aparentar novidade; avaliar leitura de fórmulas, nomes longos e escala do sistema.
- **Espaço e forma:** escala pequena de 4/8/12/16/24/32; cantos consistentes por papel. Agrupar informação relacionada e remover contêineres que apenas repetem outra borda.
- **Movimento:** uma mudança de foco por vez, transições breves e interrompíveis; movimento reduzido entrega o mesmo estado. Evitar ciclos de mascote, mapa, logo e shimmer disputando a mesma tela.
- **Controles:** alvos de pelo menos 44 px, ação principal de pelo menos 48 px, foco visível e contraste AA. Rodapé não cobre conteúdo, teclado ou saída. Essas medidas precisam ser verificadas no produto integrado, além do protótipo.

Não introduzir XP, rankings, sequência de dias, moedas ou medalhas. A banca deve entender a aprendizagem demonstrada e a recuperação de erros, além do acabamento visual.

## Ordem de implementação e revisão

| Etapa | Entrega concreta | Critérios que decidem avanço |
| --- | --- | --- |
| 1 · Escolher e preparar piloto | Fixar uma direção, tokens semânticos, componentes de ação/estado e textos do contrato em web e app. | C3/C4/C6/C10; pares em 390×844 e 360×800, texto ampliado, teclado/safe area. |
| 2 · Gerar e aceitar SQL | F05/F06: objetivo, geração real, cancelar, proposta, ajustar, aceitar, expiração, erro de rede e repetição segura. | C1/C2/C7/C8; ação e retorno verdadeiros, sem espera decorativa. |
| 3 · Concluir e retomar | F11, com regressão F08–F10: primeira lição, retorno, confirmação do servidor, mapa/progresso e reabertura. | C5/C8/C9; somente exibir “salvo” após confirmação; retomada verificada. |
| 4 · Expandir núcleo | Minhas trilhas/mapa, aula, exercícios/correção, acesso e preferências. | Gates antes de média; risco, impacto e frequência do inventário determinam ordem. |
| 5 · Expandir complementares | Material, reforço, Explique, perfil, compartilhamento, comunidade e segurança. | Fichas separadas por tarefa, mantendo os transversais de acessibilidade, rede, som e navegação. |

Acesso quebrado, perda de progresso, erro sem saída ou leitor de tela bloqueado têm prioridade sobre acabamento. Os demais fluxos já estão inventariados no método; não receberam notas fictícias nesta proposta.

## Como escolher e avaliar

Primeiro comparar os quatro estados com o mesmo conteúdo nos três protótipos. Depois integrar **uma** direção no piloto e observar tarefas sem ensinar os controles: pedir uma trilha de SQL, ajustar/aceitar, estudar/concluir a primeira lição e reabrir o progresso. Registrar conclusão sem ajuda, hesitações, erros, recuperação e compreensão do que ficou salvo; definir amostra e aparelhos conforme disponibilidade/risco, sem inventar um número universal de participantes.

Usar a mesma ficha e os três pareceres independentes. A meta é **≥9,5 por fluxo, nenhum critério abaixo de 9, gates aprovados e nenhuma falha média/alta/crítica aberta**. Mock bonito não demonstra C7/C8/C9 ou integração nativa. Nesta proposta, a nota de UX global das três direções é `null`: há exploração visual, não validação do produto ou pesquisa com pessoas.

Para jurados, a demonstração deve percorrer objetivo → proposta → aprendizagem → conclusão → progresso reaberto. Mostrar a função de cada escolha visual, um erro recuperado e evidência de persistência; não transformar velocidade da IA falsa, animação ou estatística sintética em promessa de produção.

## Abrir e reverter

Na raiz do repositório: `node scripts/qa/previa-direcoes.mjs`. Abra `http://localhost:8084`; cada direção também funciona em sua página própria. Os links e controles apenas mudam o estado do estudo local. Encerrar o servidor encerra a prévia; nenhum dado do Studoo é alterado. A implementação atual permanece na porta 3000.

Quando uma direção for escolhida, criar commits Conventional Commits por ação: tokens, unidade de interface com paridade, integração de geração, integração de conclusão e evidências/revisão. Não substituir toda a aplicação numa única mudança.
