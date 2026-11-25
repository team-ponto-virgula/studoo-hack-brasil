# Conferência da proposta de login

**25/11/2026 · artefato HTML isolado, sem mudança no aplicativo.**

## Composição e layout

Capturas feitas com Playwright e Chromium `/usr/bin/chromium`, em contexto mobile com toque, DPR 2 e movimento reduzido. As dimensões abaixo são CSS pixels; os PNGs têm o dobro da resolução. Captura de página inteira pode incluir rolagem, não apenas a área visível do aparelho.

| Estado | Viewport | Página | Botão principal: topo / altura | Resultado |
| --- | --- | --- | --- | --- |
| E-mail | 390×844 | 390×844 | 361 / 56px | Ação visível sem rolar; sem rolagem horizontal |
| E-mail | 360×800 | 360×807 | 357 / 56px | Ação visível sem rolar; 7px de rolagem vertical no fim |
| Senha | 390×844 | 390×844 | 426 / 56px | Ação visível sem rolar; sem rolagem horizontal |
| Senha | 360×800 | 360×800 | 422 / 56px | Ação visível sem rolar; sem rolagem horizontal |
| Texto a 200%, e-mail | 360×800 | 360×1304 | 575 / 77px | Rolagem vertical natural; sem rolagem horizontal |
| Sem Apple/Google | 360×800 | 360×800 | 357 / 56px | E-mail disponível; bloco de alternativas ausente |

Medidas completas em [medidas.json](prototipo/capturas/medidas.json). A simulação de texto a 200% altera a fonte raiz do protótipo; não equivale a um teste de Dynamic Type, VoiceOver, TalkBack ou teclado de aparelho.

Houve revisão visual independente dos PNGs, sem notas: a primeira revisão identificou que a senha repetia social/cadastro/visitante e enfraquecia a progressão. A proposta foi ajustada para manter esse menu na primeira etapa e oferecer retorno por “Outras formas de entrar”. A segunda revisão não apontou regressão visual nem outro problema estrutural comprovado. Isso não representa aprovação do dono ou pesquisa com pessoas usuárias.

## Contraste e integridade

- Texto principal `#17213d` sobre branco: **15,89:1**.
- Texto secundário `#626b7e` sobre branco: **5,35:1**.
- Branco sobre botão `#2854f4`: **5,73:1**.
- Placeholder `#687286` sobre campo `#fafbfe`: **4,68:1**, arredondado.
- Cálculo por luminância relativa sRGB; não é uma auditoria completa WCAG.
- `node --check` passou no JavaScript do protótipo.
- Logo e Stu têm os mesmos SHA-256 dos originais do repositório; nenhuma edição na arte.

## Interações do protótipo

Uma revisão independente executou **20/20 verificações**, dez grupos em cada largura (390 e 360px), sobre HTML/CSS/JS estáveis, conferidos por hash antes e depois:

- E-mail vazio/inválido, senha vazia e foco no campo correspondente.
- E-mail → senha sem chamada de rede; retorno para alterar e-mail preservando o valor.
- Mostrar/ocultar senha, com rótulo e estado acessíveis.
- Senha sem repetir o menu inicial; retorno por “Outras formas de entrar”.
- Sete diálogos ilustrativos, fechamento por Escape e devolução do foco.
- Envio ilustrativo sem autenticação: limpa a senha e explica que é um estudo.
- Flags opcionais desligadas juntas e provedores desligados individualmente, mantendo e-mail disponível.
- Texto a 200%, inclusive e-mail longo e diálogos, sem rolagem horizontal.

[Registro com resultados, hashes e requisições](prototipo/capturas/resultado-interacoes.json). Não houve erro JavaScript nem chamada API/OAuth. O servidor estático respondeu 404 à requisição automática de `/favicon.ico`; isso não afetou as imagens ou as interações. Duas asserções da rodada inicial checavam o foco antes do evento assíncrono de fechamento do diálogo; a rodada final aguardou esse evento e confirmou o retorno nas duas larguras, sem mudança de implementação.

## Limites

Não foram executados build nativo, emulador, autenticação real, teste de sessão/progresso, envio TestFlight ou mudança em produção. Não se afirma paridade de implementação web/React Native: o objetivo desta rodada é revisar uma proposta mobile antes de aplicá-la aos dois clientes.
