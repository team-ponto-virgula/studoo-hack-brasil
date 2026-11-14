# Navegação mobile e movimento

## Experiência

Depois de criar a primeira trilha, a web em celular e o app têm dois destinos ao alcance do polegar: **Meus planos** e **Novo plano**. A seleção tem fundo azul claro e uma animação curta no ícone. A navegação fica fora da aula, da apresentação e da geração, que têm suas próprias ações. Em desktop, a web mantém a barra lateral.

Em Meus planos, **Seu próximo passo** destaca a primeira trilha em andamento na ordem da lista. Se nenhuma foi iniciada, destaca a primeira não concluída. **Retomar trilha** abre o caminho e permite continuar pela lição disponível. A contagem de lições concluídas soma os planos salvos; não é XP nem uma métrica inventada. Se todos foram concluídos, o destaque convida a revisar ou criar outro assunto.

A ação de criar plano não fica duplicada no rodapé de Meus planos. Nas outras telas, a ação principal fica acima da navegação. As áreas seguras são respeitadas. Ao digitar, a navegação some; na web, a ação do formulário volta ao fluxo da página. No app, arrastar o conteúdo fecha o teclado.

## Movimento e acessibilidade

- Botões nativos têm uma resposta de escala curta no conteúdo, sem alterar a posição ou o tamanho da área de toque. Soltar ou cancelar o toque retorna ao tamanho normal. Ações ocupadas não aceitam novos toques.
- A seleção da navegação anima uma vez, com escala de 0,85 a 1. Os rótulos e o estado selecionado continuam disponíveis para tecnologia assistiva.
- `apps/mobile/src/movimento.ts` compartilha uma consulta de preferência e duas assinaturas nativas entre todos os componentes. Não cria um listener por árvore, confete ou botão.
- O app suspende o movimento ao entrar em segundo plano. Ao retornar, respeita a preferência atual. Uma resposta assíncrona antiga não sobrescreve um evento novo de acessibilidade.
- Sem resposta da preferência, as animações aguardam. Se a consulta falhar, a interface usa o estado estático. Tremores e pulos interrompidos voltam à posição neutra.
- Na web, animações CSS são pausadas em abas ocultas. Movimento reduzido preserva conteúdo, progresso, seleção e ações sem os efeitos de movimento.
- A entrada lateral das telas não cria rolagem horizontal temporária.

## Paridade e verificação

Web e app usam os mesmos textos de retomada e a mesma prioridade de planos. Não há mudança em API, contratos ou banco, nem dependência nativa nova. O mascote não foi substituído nesta mudança.

Verificados nesta implementação:

- `npm run typecheck` e `npm run typecheck --workspace=@studoo/mobile`.
- `npm run test:paridade`: quatro casos, incluindo os textos de retomada.
- `npm run test:movimento`: quatro casos com eventos nativos simulados, cobrindo compartilhamento/limpeza de assinaturas, segundo plano, corrida da consulta e falha da preferência. Incluído no CI.
- `npm run build`.
- Fluxo em Chromium: entrada, apresentação, pedido, geração, aula, resposta incorreta, tentativa correta, conclusão, trilha, planos e retomada. Web com IA falsa e banco local; prévia do app em React Native Web com API simulada.
- Web em 360, 390, 768 e 1440 px; prévia do app em 360 e 390 px. Movimento reduzido, teclado e ausência de erros JavaScript conferidos no navegador.

Capturas e vídeo local ficam em `artifacts/ux-mobile/`. Não foi executado em emulador ou aparelho Android; teclado nativo, TalkBack e desempenho físico ainda precisam dessa validação. Isso segue a regra atual de verificação do projeto.
