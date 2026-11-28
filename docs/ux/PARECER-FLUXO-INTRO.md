# Parecer independente — fluxo e acessibilidade da abertura

Revisor: agente `revisao_cli`, sem autoria da assinatura de abertura. Parecer fechado em **23/11/2026, 20:42 UTC**, antes de consultar notas dos outros revisores. Referência: [método 1.0](METODO-AVALIACAO.md).

**Candidata web:** `f0c2b6d578df755ac0c7b592fc103808e979505f`. Superfície avaliada: **web**, Next em produção local, Chromium **156.0.8078.79**, Linux Debian 13. A evidência compartilhada foi coletada em 23/11 às 20:38 UTC. Inspecionei o código, os resultados e o roteiro de reprodução; examinei as capturas e reproduzi separadamente teclado/árvore de acessibilidade e a saída do onboarding existente.

O escopo assistivo desta revisão é **teclado e árvore de acessibilidade do Chromium**, conforme G4 web. Não houve execução com leitor de tela real, pessoa participante, iPhone ou Android. Não atribuo notas à prévia React Native Web ou ao nativo neste parecer.

## Até três achados prioritários

1. **Bypass anterior à hidratação — corrigido na web.** A versão inicial produzia a camada no HTML de `/login?erro=google_invalido` e `/?retorno=1`; confirmei isso por GET local. Na candidata, o proxy informa elegibilidade ao servidor e o bootstrap trata fragmento/consumo da aba. Os casos `query-bypass-without-javascript`, `direct-route-without-javascript` e `hash-bypass-before-app-bundle` passaram. O caso de navegação completa na mesma aba comprova a não repetição nesse contexto; não foi um login real com provedor OAuth.
2. **Ação já revelada durante o dissolve — corrigido na web.** O listener anterior ainda consumia o gesto na fase `saindo`. Agora a camada deixa de participar do hit testing e esse evento segue para a interface. O caso `visible-action-during-exit-first-click` abriu o onboarding com o primeiro clique. Consumir o toque na **capa opaca** é o comportamento acordado: dispensa a marca, sem ativar botão oculto nem liberar áudio; isso não é um defeito de autonomia. O caso específico registrou zero chamadas de reprodução de áudio.
3. **Limite da aprovação assistiva e de plataforma — permanece explícito.** Teclado e semântica Chrome foram observados; leitor real e integração nativa não. A prévia do app recebe conferência separada, inclusive quanto ao destino após a marca. Não transfiro a aprovação web para essa superfície, nem uso testes de controlador como prova nativa. Esta é uma lacuna de evidência aplicável à entrega completa, sem nota nativa inventada.

Não restou defeito médio, alto ou crítico **reproduzido na assinatura web dentro deste escopo**. Isso não afirma ausência universal de defeitos.

## Evidências examinadas

- **WEB-24:** [browser-web.json](evidencias/intro-2026-11-23/browser-web.json), 24/24 cenários. Conferi o roteiro `/workspace/work/intro-ux/browser-qa.cjs`: inclui relógio controlado para estados, interrupções e falhas; o vídeo usa relógio normal. Os controles de teste não fazem parte do fluxo de produção.
- **WEB-IMAGEM:** [390×844](evidencias/intro-2026-11-23/web-390x844.png), [360×800](evidencias/intro-2026-11-23/web-360x800.png) e [movimento reduzido](evidencias/intro-2026-11-23/web-reduced-motion.png). Marca identificável, sem promessa de carregamento, progresso ou conteúdo inexistente; a tela de entrada continua sendo o destino.
- **WEB-VÍDEO:** [abertura fria e retornos na mesma aba](evidencias/intro-2026-11-23/web-abertura.webm). Os tempos brutos constam do JSON; não os trato como desempenho de aparelho nativo ou de produção remota.
- **FLUXO-TAB-01 — reprodução independente:** contexto novo em 390×844, fontes mantidas pendentes com o relógio controlado. Antes do Tab, a árvore do corpo continha apenas o `alert` vazio do runtime; não havia marca, formulário ou ação oculta exposta. O primeiro Tab dispensou a assinatura e focou um botão visível, com nome **“Som: música ligada, efeitos ligados”**, alvo **44×44 px** e contorno sólido de **3 px**. Depois, a árvore expôs `main`, título, E-mail, Senha e ações nomeadas. A intro não recebeu foco nem exigiu foco de retorno.
- **FLUXO-RETORNO-02 — reprodução independente:** em 360×800 e movimento reduzido, “Ver como funciona” abriu o onboarding existente; Escape voltou à entrada e devolveu o foco ao botão **“Ver como funciona”**, visível. O tutorial não foi redesenhado nem pontuado como nova assinatura.
- **CÓDIGO-09:** `npm run test:abertura` passou **9/9** na revisão inicial do controlador. Esses testes sustentam idempotência, limite, interrupção e elegibilidade puros; os resultados de interação acima sustentam a integração web atual. Inspecionei também a manutenção dos filhos montados, ausência de chamadas de autenticação no controlador e separação da chave de consumo da abertura em relação ao onboarding.

As reproduções independentes não enviaram credenciais, não autenticaram em provedor externo e não modificaram contas ou dados de estudo.

## Notas parciais sustentadas

As notas abaixo usam a âncora **9,5** do método para as verificações aplicáveis observadas nesta revisão especializada. Não são uma nota consolidada do fluxo ou do produto; notas altas ainda precisam da confirmação independente prevista no método.

| Critério | Nota web | Justificativa verificável |
| --- | ---: | --- |
| C1 · Clareza | **9,5** | A marca identifica Studoo sem texto de espera, falsa conclusão ou promessa de produto. Capturas e árvore da tela seguinte preservam a identidade; não atribuo reconhecimento ou compreensão observados em pessoas. |
| C2 · Autonomia | **9,5** | Interação dispensa a capa opaca imediatamente; Tab e Escape têm saída; controle já revelado responde ao primeiro clique durante o dissolve. Prontidão, fallback e falhas não exigem completar a animação ou um gesto obrigatório. |
| C6 · Acessibilidade e foco | **9,5** | No escopo Chrome teclado/AX, a marca decorativa e os controles ocultos não são anunciados pela árvore; Tab chega a controle nomeado, visível e com foco de 3 px. O destino expõe os campos e ações, e o smoke adjacente devolve foco corretamente. O teste de texto a 200% cobre intro dispensada e formulário seguinte, sem afirmar acessibilidade do produto inteiro. |
| C9 · Continuidade | **9,5** | As provas de navegação/recarga na mesma aba e background não repetem a assinatura; consultas, fragmentos e links seguem sem interceptação. O controlador não cria progresso, sessão ou preferência do onboarding. Retorno OAuth foi simulado como navegação completa na mesma aba, sem validar o provedor real. |

C3/C4/C5/C7/C8/C10: **não pontuados por este parecer**; devem ser consolidados pelos revisores responsáveis, sem preencher lacunas com 10.

## Gates e conclusão do parecer

- **G1 e G4 web:** aprovados no escopo de abertura, teclado e árvore Chrome observado acima. A experiência com leitor de tela real continua não executada.
- **G2/G3/G5/G6:** as evidências relevantes foram examinadas, mas este parecer não substitui o fechamento de engenharia, movimento e paridade pelos revisores responsáveis.
- **Prévia do app, iOS e Android:** sem aprovação ou nota neste parecer. Splash do sistema, leitores nativos, gesto/voltar, desempenho e destino efetivo precisam de suas próprias evidências.

Conclusão: parecer favorável aos **quatro critérios web** no escopo delimitado, com os dois defeitos iniciais corrigidos e reproduções independentes de foco/retorno. **Não é aprovação multiplataforma nem consolidação da meta 9,5. Validação empírica com pessoas não realizada.**
