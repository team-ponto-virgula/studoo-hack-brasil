# Notas do beta para o TestFlight e para a revisão da Apple (rascunho)

**Estado:** revisado em 20/11 para o ramo de entrega `release/testflight-cloud` (`6afc19c`). Ele descreve os fluxos do build e o que o servidor publicado (`4a60291`) oferecia em 20/11: `/api/auth/config` com `google: true`, `visitante: true` e `comunidade: true`, e com `apple`, `cadastro` e `recuperacao` em `false`. Os itens que dependem de ligar algo no servidor estão marcados com [operador]. Antes de colar no App Store Connect, apague o que continuar desligado.

Regras deste texto:
- Nenhuma credencial aqui. A conta de demonstração vai só no campo "Informações de acesso" (Sign-In Information) do App Store Connect.
- Nenhum contato inventado. O endereço de suporte é o `/suporte` da origem publicada [operador].
- Nenhum prazo de resposta prometido.

---

## Português (Brasil)

### O que testar (TestFlight)

O Studoo monta uma trilha de estudo com lições curtas a partir do que você quer aprender. Neste beta, teste:
1. Entrar com o Google ou pela conta de demonstração, ou tocar em "Experimentar sem conta". [operador: só se estiverem ligados no servidor, acrescente "com a Apple" e "criar uma conta por e-mail (código de 6 dígitos)"]
2. Criar uma trilha: em "Nova trilha", escreva o que quer aprender ou toque numa ideia, depois "Montar minha trilha" e "Começar a lição 1".
3. Fazer uma lição: conceito, exemplo e exercício com retorno. Erre um exercício de propósito e toque em "Ver outro jeito de entender": em 3 passos, o Studoo mostra a ideia por outro caminho e leva você de volta ao exercício.
4. Explorar trilhas de outras pessoas, denunciar e bloquear pelo "•••", e desbloquear em Perfil, "Pessoas bloqueadas".
5. Pedir ajuda em Perfil, "Ajuda", ou na tela de entrada.
Conte o que travou ou confundiu pelo "Enviar comentário" do TestFlight.

### Notas para a revisão (App Review)

- **Acesso:** use a conta de demonstração das Informações de acesso. Também é possível entrar com o Google ou tocar em "Experimentar sem conta" (conta temporária). [operador: acrescente "entrar com a Apple" e "criar uma conta por e-mail" só se estiverem ligados no servidor]
- **IA:** o servidor do Studoo usa GPT-6 Luna da OpenAI para gerar trilhas e lições. Antes de enviar dados, o app pede permissão para usar a OpenAI. O pedido e o material passam pela verificação de segurança antes da geração. A permissão pode ser desligada em Perfil, "Privacidade e dados". [operador: confirme que o servidor anuncia `ia: openai` e que o aviso do app cita a OpenAI]
- **Conteúdo de outras pessoas:** a aba "Explorar" mostra trilhas que outras pessoas publicaram, com nome e foto. Em cada trilha e em cada perfil, o "•••" tem "Denunciar" e "Bloquear".
  - O bloqueio vale nos dois sentidos e pode ser desfeito em Perfil, "Pessoas bloqueadas".
  - Fotos, capas e textos sinalizados passam pela revisão da equipe do Studoo antes de aparecer para outras pessoas.
  - As regras da comunidade estão na política de privacidade.
- **Suporte:** Perfil, "Ajuda", "Falar com o suporte", ou "Precisa de ajuda? Fale com o suporte" na tela de entrada. O endereço é `<origem>/suporte` [operador].
- **Excluir conta:** no Perfil, em "Privacidade e dados", "Excluir conta".

### Roteiro breve (cerca de 5 minutos)

1. Entre com a conta de demonstração.
2. Em "Nova trilha", toque numa ideia (por exemplo, "Inglês para conversar em viagens"), depois "Montar minha trilha". Aceite o aviso de IA, se ele aparecer. Espere a proposta ficar pronta e toque em "Começar a lição 1".
3. Avance pela lição e responda ao exercício.
4. Abra "Explorar". Num cartão de outra pessoa, toque em "•••", "Denunciar", escolha um motivo e envie. Depois toque em "•••", "Bloquear" e confirme.
5. Em Perfil, abra "Pessoas bloqueadas" e toque em "Desbloquear". Em "Ajuda", toque em "Falar com o suporte".

---

## English (U.S.)

### What to Test (TestFlight)

Studoo builds a study path of short lessons from what you want to learn. In this beta, please try:
1. Signing in with Google or with the demo account, or tapping "Experimentar sem conta" (Try without an account). [operator: only if enabled on the server, add "with Apple" and "creating an account by email (6-digit code)"]
2. Creating a path: in "Nova trilha" (New path), type what you want to learn or tap an idea, then "Montar minha trilha" and "Começar a lição 1".
3. Taking a lesson: concept, example and an exercise with feedback. Answer an exercise wrong on purpose and tap "Ver outro jeito de entender" (See another way to understand): in 3 steps, Studoo explains the idea another way and takes you back to the exercise.
4. Browsing other people's paths in "Explorar", reporting and blocking from the "•••" menu, and unblocking in Profile, "Pessoas bloqueadas" (Blocked people).
5. Getting help from Profile, "Ajuda" (Help), or from the sign-in screen.
Please tell us what got stuck or felt confusing through TestFlight's "Send Feedback".

### Notes for App Review

- **Access:** please use the demo account in the Sign-In Information. You can also sign in with Google or tap "Experimentar sem conta" (a temporary account). [operator: add "sign in with Apple" and "create an account by email" only if enabled on the server]
- **AI:** Studoo’s server generates paths and lessons with OpenAI’s GPT-6 Luna. The app asks for permission before sharing data with OpenAI. The server screens the request and study material for safety before generating a path. Permission can be turned off in Profile, "Privacidade e dados" (Privacy and data). [operator: confirm the server reports `ia: openai` and the app notice names OpenAI]
- **Content from other people:** the "Explorar" (Explore) tab shows paths other people published, with their name and photo. On every path and every profile, the "•••" menu has "Denunciar" (Report) and "Bloquear" (Block).
  - Blocking works both ways and can be undone in Profile, "Pessoas bloqueadas".
  - Photos, covers and flagged text are reviewed by the Studoo team before other people can see them.
  - The community rules are in the privacy policy.
- **Support:** Profile, "Ajuda", "Falar com o suporte" (Contact support), or "Precisa de ajuda? Fale com o suporte" on the sign-in screen. The address is `<origin>/suporte` [operator].
- **Delete account:** in Profile, under "Privacidade e dados", "Excluir conta" (Delete account).
- The app interface is in Brazilian Portuguese.

### Short test script (about 5 minutes)

1. Sign in with the demo account.
2. In "Nova trilha", tap an idea (for example, "Inglês para conversar em viagens"), then "Montar minha trilha". Accept the AI notice if it appears. Wait for the proposal to finish and tap "Começar a lição 1".
3. Go through the lesson and answer the exercise.
4. Open "Explorar". On another person's card, tap "•••", "Denunciar", pick a reason and send. Then tap "•••", "Bloquear" and confirm.
5. In Profile, open "Pessoas bloqueadas" and tap "Desbloquear". In "Ajuda", tap "Falar com o suporte".

---

## O que depende de conta ou de operador (conferir antes de enviar)

- No servidor publicado: `STUDOO_COMPARTILHAR=1` e `STUDOO_COMUNIDADE=1`; a origem em HTTPS; o provedor de IA e a chave; a lista da equipe que acessa `/equipe/moderacao`; a caixa do `/suporte`; o contato da política (`STUDOO_CONTATO_PRIVACIDADE`).
- Conteúdo de outras pessoas já aprovado no Explorar, para o revisor ter o que denunciar e bloquear: perfis de demonstração (`STUDOO_COMUNIDADE_DEMO=1`) ou publicações reais aprovadas.
- Pessoas para responder às denúncias e aos pedidos do suporte. O texto não promete prazo.
- No App Store Connect: a conta de demonstração nas Informações de acesso; a URL de suporte (`<origem>/suporte`) e a da política (`<origem>/privacidade`); o questionário de classificação etária com conteúdo gerado por usuários; a categoria. Não há evidência no repositório de que a categoria infantil foi escolhida.
- Os itens de acesso pendentes em `docs/QA-TESTFLIGHT-ACESSO.md` (Apple, Google, cadastro por e-mail e notificações da Apple).
- **Entrar com a Apple (regra 4.8 da Apple):** o build oferece "Continuar com Google". Para a revisão, a Apple pede também uma opção de login com as mesmas garantias de privacidade, como "Entrar com a Apple". Em 20/11, `apple` estava em `false` no servidor publicado. Ligue o login com a Apple antes de enviar para a revisão, ou decida com o dono antes do envio.
- **Verificado em 20/11, depois da troca:** `/privacidade` e `/suporte` respondem 200 no servidor publicado.
