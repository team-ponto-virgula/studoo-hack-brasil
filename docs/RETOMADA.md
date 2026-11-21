# Retomada: pausa de 21/11/2026

O dono pediu para parar por aqui ("termine o que está fazendo e os bots, depois commit e push"). Prazo do hackathon: **30/11/2026**.
A equipe está em pausa: nenhuma tarefa nova até o dono pedir. Este guia só registra o estado; não retoma, não faz merge e não publica nada.

## Onde recomeçar

- **Branch inicial:** `integracao/testflight-2026-11-20`.
- **Commit-base das entregas:** `77e3429ab6e6c179019e0f0d60c2c7eb6c9e2495` (publicado no site em 21/11, 17:16 UTC). Este guia entra em um commit próprio logo depois dele, só com `docs/RETOMADA.md`.
- **Abrir a worktree certa:**
  ```bash
  git -C /var/lib/openbot/OpenBot/Shared/studoo fetch origin
  git -C /var/lib/openbot/OpenBot/Shared/studoo worktree list   # já existe: studoo-worktrees/integracao-testflight-2026-11-20
  # ou, para uma cópia nova:
  git -C /var/lib/openbot/OpenBot/Shared/studoo worktree add /var/lib/openbot/OpenBot/Shared/studoo-worktrees/retomada -b retomada/21-11 origin/integracao/testflight-2026-11-20
  ```
- **Cuidado:** a branch local `feat/hackathon-integracao` (worktree `studoo-worktrees/integracao`, `d9be93c`) está **320 commits atrás** do remoto. Não use essa cópia nem faça push dela; a referência certa do site é `origin/feat/hackathon-integracao`.

## Ramos de entrega (remoto, ao pausar)

| Ramo | SHA | Papel |
|---|---|---|
| `feat/hackathon-integracao` | `77e3429` | Ramo que o Dokploy publica (o autoDeploy por push não dispara; o deploy é manual). **Não foi movido na pausa.** PR rascunho #85. |
| `integracao/testflight-2026-11-20` | `77e3429` + commit deste guia | Ramo de integração. Fica um commit de documentação à frente do ramo do site, de propósito. |
| `release/testflight-cloud` | `877e66d` | Ramo da Apple (o Miguel gera e envia o build com as contas dele). O app novo só entra aqui no **pedido do build 4**. Build 3 está no TestFlight. |

## O que está no ar no site (verificado em 21/11)

- Matemática desenhada, "Resolva comigo" e gráficos de função (`2bab6aa`, 14h UTC).
- Refino da web: conserto dos enfeites do mapa (`50401e0`), entrada larga com cartão, cabeçalho do mapa, ordem das opções (`8a6ba14`, 16:49 UTC) e o conserto da "trilha pronta" que não voltava à lição 1 com movimento ligado (`77e3429`, 17:16 UTC).
- Conferência do `77e3429` no site: Verificação do GitHub no PR #85 passou; saúde e login 200; `/api/mobile/sessao` por POST sem `Origin` 401 (com `Origin` 403 é proteção correta); login errado 401; agendamento `studoo-verificar` 7 de 7 etapas ok; "trilha pronta" medida com a IA real e movimento ligado: 7 de 7 repetições certas (4 em 1280 px, 3 em 390 px; antes 0 de 6).

## Frentes com trabalho ainda não integrado (todas commitadas e enviadas ao remoto na pausa)

| Frente | Branch | Último commit | O que tem a mais que o `77e3429` |
|---|---|---|---|
| Web e servidor | `feat/refino-web` | `aa4d7eb2d69a1dbf06f60bd25607a269028c7260` | 3 commits: `9c5111b` (Ensine ao Stu sem IA reconhece o exemplo), `74bc1af` (trilha recebida sem nome; estado curto do compartilhar vem do servidor; item 31 no contrato), `aa4d7eb` (textos "1º" e "1º em alta" no contrato) |
| App | `feat/refino-app` | `e753df4e1dd6f8984af5ce5e8ea09d6de10c01e7` | 13 commits sobre `0f775e1`: P1 do lote 1, itens 4, 10, 14 (aviso da música: fecha na hora ao abrir o balão e não bloqueia toque), 19, 20, 23, 24, 25, 29, 31, 32, 34, P1-8, P2-1, P2-3 e banca P0-3 |
| QA nativo | `qa/android-maestro-partida` | `17db6603cff3a48cdce5e180b4c038ff18ecaf64` | Repetição da partida do Maestro (`272087e`) e fluxo 98 da ponte e do Ensine ao Stu |
| Design (só docs) | `docs/refinamento-ui` | `ee85828b6d15f3844821a98621e996abdc264e6c` | Spec 16 (refinamento) e spec 07 P33 |
| Design (só docs) | `docs/matematica-resolva-comigo` | `92aac6803e200325dc5612fcaf995d37160a28e6` | Spec 15. **Parte de `877e66d` (base antiga): pode conflitar** com versões dela que já entraram |
| Matemática | `feat/contrato-visuais-matematica`, `feat/web-matematica-fase2`, `feat/app-matematica-fase2` | `e0cf50a`, `26f5ab0`, `9cc2edb` | Já integradas no `2bab6aa`; ficam como histórico |

Outras 40 e poucas branches antigas (`docs/*`, `feat/*`, `qa/*`, `fix/*`) foram enviadas ao remoto só para não se perderem; `git ls-remote --heads origin` lista todas. Nenhuma worktree tinha alteração sem commit e não havia stash.

## Primeira ação pendente

1. **Integrar a web:** juntar `feat/refino-web` (`aa4d7eb`) na branch de integração, rodar os testes abaixo, enviar a `feat/hackathon-integracao` (com a autorização do dono de 21/11 para o site), publicar no Dokploy e repetir a conferência da seção "O que está no ar". O app não é afetado.
2. **App:** o Mobile 2 junta `aa4d7eb` no `feat/refino-app`, troca os auxiliares locais (`estadoCurtoDoCompartilhar`, `nomeDeQuemCompartilhou`, `mensagens.emAlta.posicao`) pelos do contrato (`estadoDoCompartilhamento`, `recebidaTemNome`, `comunidade.posicao`, `posicaoSelo`, `configuracoes.recebidaSemNome`, `MarcasCompartilhar.link.moderacao`). Esperar conflito pequeno em `package.json` (linha `test:estudio:interface`, junte as listas de arquivos) e em `packages/contratos/src/experiencia.ts`. O texto `estudio.ensinoDica` foi mudado pelo Mobile 2 (`4ffe84a`); a web não deve duplicar.
3. **Congelar o app na noite de 25/11**, rodar o teste nativo, e só então pedir o **build 4** ao Miguel (meta 26 a 27/11) e levar o app a `release/testflight-cloud`.
4. Antes do build 4, mostrar ao dono antes e depois de cada item de tela, dizendo a origem da captura (navegador, prévia web do app, simulador, emulador).

## Pendências por frente

**Web e servidor (Web & API):** a lista completa está em `docs/specs/16-refinamento-ui.md` e na lista da banca (`Agents/agent-0d5cc678-3b46-4a91-b42d-d2b3b2ef2e9f/evidencias/banca-21-11/LISTA-PRIORIZADA.md`). Resumo: 14 aviso da música no alto (fecha ao abrir o balão, não bloqueia toque fora, só "Desligar" responde); 15 mapa até 767 px sem barra da marca e selo de sincronia no cabeçalho; 16 pílula "1º" na capa do Em alta; 17 capa só com tema e "Exemplo" na linha de informação; 18 navegação lateral única a partir de 1024 px; 19 política de privacidade só em Ajuda; 20 "Excluir conta" secundário; 33 e banca P1-3 navegação do visitante (entre 768 e 1023 px a web não tem "Nova trilha" nem "Explorar"); 30 legenda do gráfico só com o que está desenhado; 31 resto (botão do alto do mapa com a comunidade mostrando o estado, junto com o 26); 26 "Compartilhar" e engrenagem de 44 px no alto do mapa; 24 e 25 (rodapé do acerto com Explique aberto; passos do Explique); 27 "De onde veio esta ideia" na ponte; lote 1 (4, 5, 6, 7, 8, 10); P2 (11, 12, 21, 22, botões tracejados do material); tirar o selo "Exemplo/Demonstração" da apresentação; banca P2 (placeholder a 200%, axe, rótulos da proposta em 390 px). A **12b da matemática** (módulo, interseção, raiz, função no Resolva comigo) está estacionada. Decisão do Designer registrada: no item 1 da spec 16, a lição 1 fica inteira no alto da área (sem céu vazio).

**App (Mobile 2):** 31 espera o `moderacao` do contrato (já está no `feat/refino-web`); 11 e P2 22 ficam para depois do build; capturas "depois" da prévia de 24, 25, 31 e 34 não foram feitas (o percurso automático trava no verdadeiro ou falso); P1-8 e P2-1 só se provam no aparelho; roteiros nativos em `Agents/agent-75dcf08c-af48-4482-8edd-603fe2fa04e5/evidencias/refino-app/roteiro-nativo-p0.md` e `roteiro-nativo-p1.md`; em 320×568 o balão do nó atual fica atrás da faixa alta do mapa (anterior a esta frente); "1º em alta" passa a vir do contrato (`aa4d7eb`).

**QA (Mobile & QA):** banca lote 2 ("Resolva comigo" passo a passo, Explorar e compartilhar com conta); rodada nativa nova com `272087e` e `17db660` (Android depois da partida, capturas 98 e 99 no iPhone); iPhone da rodada `44920181903` não teve 40 e 41 (aba Explorar não apareceu) nem 62 (protocolo da denúncia); o "Fundo: FALHA" do verificador de som é provável falso positivo, **não conferido**.

**Design (Designer):** auditoria do Android da rodada `44920181903`; matemática no aparelho nativo (leitor de tela, texto grande); F3 a F5 da spec 15 na tela real; conferência visual dos itens da spec 16 quando os devs entregarem. As worktrees `design-*` ficam até a integração; depois ele as remove.

**Som (Sound Designer):** sem pendência conhecida. Ao pausar, o agente **não respondeu**: a ferramenta dele não estava instalada (aviso "Pi CLI is not installed", corrigir em Configurações do OpenBot). As worktrees dele (`som`, `musica`, `regra-som-unico`, `design-som-lofi`, `web-geracao-som*`) estavam limpas e cobertas por branches no remoto.

**Apple e Miguel:** sem novidade: chave do "Sign in with Apple", conta de demonstração para o revisor e revisão do beta externo continuam pendentes.

## Testes: o que se sabe e o que não foi executado

Comandos (raiz do repositório; `apps/mobile` tem o seu): `npm run typecheck` (raiz) e `npm run typecheck` dentro de `apps/mobile`; suítes `npm run test:dominio`, `test:formatos`, `test:paridade`, `test:estudio:interface`, `test:movimento`, `test:google-mobile`, `test:email`, `test:ia` (as suítes que usam banco, como `test:estudio` e `test:privacidade`, precisam do Postgres local). Verificação completa no GitHub: PR #85 (`Verificação`). Teste nativo: workflow `Capturas nativas` (`gh run list --workflow "Capturas nativas"`).

**Resultado conhecido, conferido pelo Lead:**
- `77e3429` (cópia de teste `f610a24`, árvore idêntica): tipos da raiz e do app sem erro; domínio 18, formatos 268, paridade 5, interface 427, movimento 4, Google 15, e-mail 3 e IA 120 passaram; Verificação do GitHub passou.
- `feat/refino-app` até `28a2b04` juntado ao `8a6ba14`: tipos sem erro; interface 436 de 436; os 3 arquivos novos (`refino-p1-mobile` 14, `consentimento-ia-mobile` 13, `som-controle-mobile` 9) passaram. Esses testes precisam do carregador: `node --import tsx --test …` (sem ele, `consentimento-ia-mobile` falha por sintaxe TypeScript).
- Prova com IA real em servidor local no `8a6ba14` (4 assuntos, 42 lições): 0 falhas.

**Resultado informado pelos agentes, não repetido pelo Lead:**
- `feat/refino-web` `aa4d7eb`: tipos limpos; interface 431, formatos 268, paridade 5, domínio 18, IA 124, estudio com banco 80, privacidade 4.
- `feat/refino-app` `e753df4`: tipos limpos; interface 435, formatos 268, paridade 5, Google 15, visitante 6. O `test:estudio` (com banco) falhou uma vez e passou 79 de 79 na repetição: **instável**, investigar o teste.

**Não executado ou sem resultado ao pausar:**
- Teste nativo: as rodadas `44923807240` (`50401e0`) e `44926124145` (`b714cb0`) estavam em andamento e na fila no GitHub; resultado desconhecido (`gh run view <id>`). A rodada `44920181903` falhou (iPhone 52 de 54; o Android não passou; conserto da partida do Maestro em `272087e`, ainda sem confirmação).
- Nada do app foi provado em aparelho: capturas do app são da prévia web (desenho, não nativo). iPhone e Android reais ficam para a rodada nativa e para o Miguel.
- A 12b da matemática e o fundo do som (item acima) não foram testados.

## Para o dono ou o Lead decidir

- Ainda exigem aprovação explícita: merge em `development` ou `main`, exclusões, chaves e gastos novos, infraestrutura nova e mudanças de configuração no GitHub.
- A conta de teste dos agentes (`agentes@example.test`) tem 4 trilhas "Frações: do primeiro passo à soma" que não foram criadas pelo Lead e não foram apagadas.
- Ferramentas de verificação do Lead (fora do repositório): `Agents/agent-4691054c-93ff-4268-8bda-d6e67a31f15e/ferramentas/` (`juntar-tudo.sh`, `rodar-suites.sh`, `e2e-real.sh`, `e2e-producao.mjs`, `capturar-mapa-producao.mjs`, `capturar-criacao-producao.mjs`). A senha de teste fica só no cofre do Lead e nunca em arquivo versionado.
