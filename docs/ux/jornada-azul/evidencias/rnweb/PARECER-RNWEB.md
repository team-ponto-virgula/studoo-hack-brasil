# Jornada Azul — parecer independente da prévia do app

A jornada examinada passou com API MOBILE real local e PostgreSQL sintético. **Não houve execução em iOS/Android.** Este parecer não herda a nota dos protótipos.

- Base FA4: `fa4be429992037cdaa1be055f52be6a529d32f76`: **95/95 verificações, 44 PNGs e 43 chamadas de API**, com fonte estável. A inspeção encontrou depois o CTA estreito de Explique; os dois quadros correspondentes são o antes.
- Focal R2: `b3e97e7cbe7d6b8b711216070453a13ebcad36e3`: **32/32 verificações, 8 PNGs e 23 chamadas de API**, com fonte estável. Continuar mede 350×56 em 390 e 320×56 em 360. Somente `apps/mobile/src/licao.tsx` mudou no conjunto RN/assets.
- As provas FA4 são históricas e aproveitadas por equivalência explícita em [fontes.json](fontes.json). Não foram chamadas de novas nem rebatizadas. Os conjuntos se sobrepõem: não somar verificações, capturas e chamadas como testes funcionais.

## Percurso executado

Visitante → pedido SQL → gerar cinco lições → aceitar → conceito/exemplo → resposta errada `>` → reforço → corrigir `>=` → explicar por texto → retorno automático → concluir 1/5 → mapa → recarregar → abrir INNER JOIN.

Também foram examinados início/retomada, perfil visitante, confirmação e cancelamento da troca de conta, Explorar, Seguindo visitante, prévia e perfil público sintéticos. A R2 repetiu de forma focal acerto, Explique, conclusão e retomada; não repetiu Explorar/comunidade.

## Achados e decisão

O enunciado grande foi corrigido para 22/30 e o preenchimento SQL para nevoa sobre navy: contraste computado **12,806:1**. A ação de Pedido, a barra de progresso, Seguindo e a pílula de 44 px estão visíveis nos quadros FA4. O achado médio final era Continuar com 109,52 px no retorno compacto. R2 fecha esse caso, mantendo o primário inteiro no mobile. Não restou crítico, alto ou médio aberto no escopo examinado.

D1, D2, D8 e D9 recebem **9 nas facetas declaradas** em [avaliacao.json](avaliacao.json). Os demais critérios e a nota global ficam sem nota neste parecer, para não extrapolar a competência e a execução. Arte, acessibilidade, movimento e cobertura dependem dos demais pareceres.

## Limites e segurança dos artefatos

SecureStore e APIs de foco sem implementação web receberam adaptações apenas no harness; o hostname HTTPS sintético foi interceptado para a API local. Isso não valida TLS, cofre, acessibilidade ou aparelho nativos. IA e email são falsos; microfone, câmera, seletores e compartilhamento do sistema não foram acionados.

Cadastro e recuperação ficaram fora desta execução: o email falso só é habilitado em origem loopback, e o hostname sintético não é loopback. O aviso dev `ariaHidden` do adaptador SVG está registrado; a coleta calma aguardou a dispensa normal do aviso de música. O Stu e o mascote atuais foram aprovados pelo dono e preservados; não houve alteração de assets nesta implementação. Não houve pesquisa com estudantes.

O pacote público contém apenas PNGs de conteúdo sintético, JSONs em whitelist, fontes/hashes e este parecer. **Não contém tokens, cookies, credenciais, corpos de login ou setup de conta.** O [manifesto SHA](manifesto-sha256.json) permite conferir cada arquivo.
