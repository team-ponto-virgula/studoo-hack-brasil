# Matriz de cobertura — 18 famílias e 35 páginas

24/11/2026 · retrato da candidata R4 **`a6f2e09b559b3c531b66fbc404839d661d304f48`**. Auditoria documental independente do [protocolo](COBERTURA-E-REVISAO.md), renderer, roteiros e resultados R1–R4. Não modifica requisitos, pesos ou notas anteriores.

**Resultado: as 35 páginas-base existem e foram capturadas em A/B/C, mas a cobertura integral dos subestados declarados permanece parcial.** Os percursos exercitados passaram; isso não fecha as lacunas de representação listadas abaixo. DG1/D10 integral continuam pendentes. Não se atribui uma nota 9 por quantidade de telas ou asserções.

## Como ler

- **P-base:** página-base projetada na fonte. Não significa que todos os subestados da família estejam projetados.
- **I-rec:** interação comprovada no recorte indicado. Não significa que todos os caminhos, erros e retornos da família foram executados.
- **C-base:** página-base capturada em 390×844 e 360×800, DPR 2, na R4.
- **C-est:** há capturas adicionais de estados próprios, discriminadas na segunda tabela; sua abertura direta não comprova recuperação interagida.
- **Pendente de representação:** o estado/controle exigido não foi encontrado no renderer, ou um retorno genérico não representa adequadamente aquela situação.
- **Pendente de observação:** o estado existe, mas não há prova suficiente do percurso correspondente nas suítes auditadas.
- **N/A com motivo:** ramo não oferecido pelo cenário ou pelo produto consultado, com justificativa expressa. Não é uma exclusão para melhorar a nota.

A/B/C significam Jornada Azul, Caderno Claro e Foco Vivo. Todas usam a mesma fonte de comportamento; a evidência de uma direção não foi presumida nas outras: os roteiros citados repetem as três. Nenhuma célula significa aprovação de React Native, web de produção ou servidor.

## Inventário sem dupla contagem

| Família | IDs de página atribuídos à família | Qtde. | A | B | C |
| --- | --- | ---: | --- | --- | --- |
| P01 · Entrada/apresentação | `boasvindas`, `apresentacao`, `interesses` | 3 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| P02 · Sessão | `entrar` | 1 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| P03 · Cadastro/recuperação | `cadastro`, `codigo`, `senha`, `recuperar` | 4 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P04 · Pedido/consentimento | `pedido`, `consentimento` | 2 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| P05 · Material | `material` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P06 · Geração | `geracao` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P07 · Proposta | `proposta` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P08 · Minhas trilhas | `inicio` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P09 · Mapa | `mapa` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P10 · Conceito/exemplo | `licao` | 1 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| P11 · Exercício | `exercicio` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P12 · Reforço | `reforco` | 1 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| P13 · Explicação/retorno | `explique`, `retorno` | 2 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P14 · Conclusão/retomada | `conclusao` | 1 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P15 · Explorar/recebida/público | `explorar`, `previa`, `publico` | 3 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P16 · Perfil/edição/foto | `perfil`, `editar`, `foto` | 3 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| P17 · Configurar/compartilhar/código | `configurar`, `compartilhar`, `codigostudoo` | 3 | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est | P-base / I-rec / C-base+est |
| P18 · Preferências/segurança | `preferencias`, `privacidade`, `ajuda`, `denunciar`, `bloqueados` | 5 | P-base / I-rec / C-base | P-base / I-rec / C-base | P-base / I-rec / C-base |
| **Total** | **35 IDs únicos, 18 famílias** | **35** | **35 bases** | **35 bases** | **35 bases** |

Consentimento também é consultado por P18, retorno por P14 e foto por P16; não se contam novamente como novas páginas. Seis formatos de exercício, cinco cenas da apresentação e estados de publicação são variantes desses IDs, não novos IDs de página.

## O que foi interagido e capturado por família

Aliases dos roteiros e diretórios estão na seção de evidências. Os nomes entre crases são casos reais nos JSONs, não nomes propostos para testes futuros.

| Família | Interação comprovada em A/B/C na R4 | Captura adicional comprovada | Cobertura ainda não demonstrada integralmente |
| --- | --- | --- | --- |
| P01 | F1 `percurso-central`: cinco cenas distintas, avanço e interesses; entrada/cadastro. F2 `visitante-e-suporte`: entrada visitante. | Bases e leitura ampliada. | Voltar/pular/fechar existem; não confundir cinco cenas percorridas com teste de todas as saídas em cada cena. |
| P02 | F2 `visitante-e-suporte`: visitante e gates; F1 transições de conta sintética. | Base; recortes de teclado citados em Q4 complementar. | **LC02:** sessão restaurando/expirada e credencial rejeitada próprias. Provedores têm diálogo local cancelável; não estão ausentes, mas não equivalem a OAuth real. |
| P03 | F1 `percurso-central`: email inválido, código incorreto/correto, senha curta/válida; `recuperacao-e-perfil`: recuperação/redefinição; `recuperacao-de-cenarios`: reenviar expirado e reload. | `codigo/expirada`; V4 também código principal/expirado e recuperação enviada com email longo, 100/200%, ambas larguras. | Sem alegação de entrega de email, token real ou disponibilidade de provedor. Outras saídas específicas ficam pendentes de observação, não automaticamente aprovadas pelo caso feliz. |
| P04 | F1 `percurso-central`: objetivo, material, consentimento, cancelar geração preservando pedido/material, gerar/aceitar. F4 amplia criação e descrições. | Bases; dados longos em V4; texto 200% em Q4. | Objetivo de 800 caracteres é representável; conteúdo longo real e caminhos consentir/recusar/revogar não se deduzem de um parágrafo genérico anexado à página. |
| P05 | F1 `percurso-central`: selecionar fixture e conservá-la no cancelamento de geração. | `material/permissao` e base. | **LC05:** tipo/tamanho/leitura/carregamento de material e permissão com contexto específico. Testes de upload/2 MB da **foto de perfil** não cobrem material. |
| P06 | F1 `percurso-central` e teclado R3: cancelamento preserva objetivo/material e não retorna tardiamente; transição local para proposta. | `geracao/rede`; base estática. | **LC06:** chegadas progressivas de título/nós, espera longa própria, IA indisponível/limite. Texto `s=longa` é conteúdo anexado, não estado de espera. |
| P07 | F1: aceitar e entrar WHERE, recuperar proposta expirada/reload; F4: criar nova trilha preserva registros anteriores. | `proposta/expirada`; base e leitura ampliada. | **LC07:** aceite pendente, falha ao abrir, partes/títulos longos da proposta. Diálogo de trilha repetida existe; execução de todas suas decisões continua um recorte separado. |
| P08 | F1/F3/F4: voltar ao início, alternar cópias, não duplicar, apagar com confirmação preservando outra, 5/5 sem próxima fictícia. | `inicio/vazio`; V4 `concluida.json`: início 5/5 em A/B/C, duas larguras e 100/200%. | **LC08:** carregando/sincronia próprios. Menu global da trilha existe no mapa; não declarar sua ausência completa por não haver menu em cada item da biblioteca. |
| P09 | F1 pausa/volta; F2 `pular-e-rever`; F4 revisão do WHERE após 5/5. | `mapa/vale-rever`, `mapa/concluida`; bases. | **LC09:** balão do nó e ponte de reforço no mapa. Atual, concluído, bloqueado, partes e Vale rever já existem. “Disponível” não exige inventar outro estado se corresponde ao atual aberto. |
| P10 | F1 conceito→exercício, pausa/retomada; F4 curso de cinco lições. | Bases; AR4: consulta e destaque `>= 7` conferidos nas três. | **LC10:** etapa anterior, fonte/citação expansível e recurso/apoio condicional; aviso de retomada com reinício somente da lição, conforme fonte real. |
| P11 | F2 `seis-formatos`: erro/acerto/avanço dos seis; ordenação por setas; F1 incompleto e reforço no recorte; F4 cinco lições centrais. | Cinco formatos além de lacuna; lacuna erro/acerto; texto ampliado conforme Q4. | **LC11:** feedback parcial e identificação/preservação visual dos acertos por item. Erro/acerto binários não cobrem parcial. Incompleto em uma variante não aprova automaticamente as seis; dica tem desenho, sem percurso completo comprovado aqui. |
| P12 | F1 `percurso-central`: outro caminho, novo exemplo, desafio errado/certo e retorno conservando tentativa original. | Base do reforço. | **LC12:** vitória própria e reabertura da ponte concluída; Resolva comigo/Sua vez condicional aos dados realmente oferecidos. Toast de volta não substitui quadro de vitória declarado. |
| P13 | F2 áudio integrado/histórico; F3 timer/limite: gesto, cancelar, parar, rascunho, transcrição revisável, Activity indisponível, retorno sem IA, Back/Forward e limite lógico. | `explique/gravando`, `transcricao`, `permissao`, `activity`; retorno-base. | **LC13:** falha/repetição do envio da explicação com contexto próprio não demonstradas. Limite usa relógio simulado; nenhum microfone foi aberto. AppState/permissão nativa e voz ao vivo fora da oferta não são aprovados por esses checks. |
| P14 | F1 1/5, salvamento recuperado/reload e INNER JOIN; F2 Vale rever→revisão; F4 5/5→rever→nova trilha sem apagar anterior. | `salvando`, `salvar-erro`, `vale-rever`; V4 conclusão 5/5; AR4 antes/depois das três conclusões. | Reiniciar **trilha inteira** é N/A nesta base: não existe ação/API consultada para apagar progresso global. Rever nó concluído é real e existe; reinício da lição retomada continua em LC10. |
| P15 | F1 seguir/bloquear/desbloquear/cópia; F2 denúncia por cartão, visitante; F3 denúncia direta/ocultação do alvo; F4 cópia nova/existente/alternância. | Explorar vazio; prévia `link-inativo` e `ja-adicionada`; público-base. | **LC15:** Novas/paginação; retorno preservando tema/lista/rolagem não foi comprovado integralmente. Aprovação/entrada direta de prévia não prova o retorno a todas as origens. |
| P16 | F1 edição/descarte/Back; F2 `foto-interesses-cor`; F3 `foto-draft-ida-volta`; M4 valida factory de imagem separadamente. | Bases; AR4 perfil/vazio novo; Q4 complementar terminou e preservou o achado K4b de foco/concorrência. | **LC16:** variantes sem social/social, postar/retirar trilhas do perfil, alcance/novidades preenchidas. Perfil atual tem 0 trilhas públicas e vazio fixos. Os testes de foto não aprovam esses estados sociais. |
| P17 | F2 código/clipboard permitido e negado, cancelar folha local, publicação pendente/retirada; F3/F4 nome/descrição por trilha, cancelar, reload, cópia, não herdar/excluir metadados. | Seis estados de publicação: revisar/pendente/erro/reprovada/retirada/aprovada. Código-base. | **LC17:** escolha/salvamento de capa/tema. Estados de moderação capturados por query não equivalem a todos os ciclos funcionais. QR decodificado na factory M2 é prova histórica isolada, não escaneamento nativo da R4. |
| P18 | F1 bloquear/desbloquear, confirmação `EXCLUIR` e cancelar; F2 denúncia motivo obrigatório/revisão/editar/protocolo/ocultação; visitante e suporte preservam identidade. | Cinco bases; estados de switches/foco nos recortes de teclado. | **LC18:** lista de destinatários da IA, condicional a `ia.necessario`; não inventar revogação individual Google/Apple. Confirmação final de exclusão, sair, consentir/revogar e cada retorno ainda precisam provas próprias onde aplicáveis. |

## Lacunas de representação para a próxima candidata

As linhas de fonte abaixo pertencem à candidata a6f2e09; mudam se houver correção. “Não encontrado” é conclusão de inspeção de ramos, ações e dados, não resultado presumido de uma URL desconhecida. Abrir uma query não suportada e ver a base não cria o estado que falta.

| ID | Requisito real e localização | Evidência/reprodução na fonte congelada | Prova necessária após a correção |
| --- | --- | --- | --- |
| LC02 | P02: restaurar, expirar sessão, credencial rejeitada. `prototipo/app.js:12–20,163–164,187,231`. | Startup lê localStorage diretamente; login aceita qualquer email bem formado/senha ≥8. `p=entrar&s=expirada` usa o texto de **proposta** expirada e recupera para pedido. | Estados de sessão com contexto e destinos de sessão; credencial rejeitada recuperável; restaurar/expirar sem perder estudos locais. |
| LC05 | P05: tipo/tamanho, lendo/carregando e permissão de material. `app.js:91,200`. | Arquivo/galeria recebem fixture imediatamente; câmera usa diálogo. `media-pages.js` valida `media-photo-file`, que pertence à foto do perfil. | Representação local específica de material válido/inválido/excessivo/lendo/negado, conservar objetivo, trocar/remover/repetir. Não precisa implementar OCR real nesta bancada. |
| LC06 | P06: construção progressiva e espera longa/IA/limite. `app.js:93,180`. | Título e duas linhas completos; timer de 1600 ms abre proposta. `scenarioContent('longa')` só anexa parágrafo. | Eventos sintéticos identificados fazendo chegar conteúdo real do exemplo, espera controlável e estados/saídas próprios; cancelar sem evento tardio. |
| LC07 | P07: aceite pendente, falha de abertura, lista longa com partes. `app.js:49,94,201`. | Aceite altera estado e abre lição na mesma ação; lista curta fixa; conteúdo longo genérico não amplia os dados da proposta. | Pending/erro/retentar conservando proposta e aceite; dados longos próprios; não inventar número de lições vindo de API. |
| LC08 | P08: carregando/sincronia. `app.js:89`. | Somente vazio ou conteúdo completo; erro genérico não desenha carga/sincronia próprias. | Carga, falha e recuperação com trilhas/progresso existentes preservados. |
| LC09 | P09: balão do nó e ponte. `app.js:95,134,243`. Produção: `apps/mobile/src/caminho.tsx:1077,1729–1778`. | Atual/concluído abrem lição diretamente; bloqueado retorna toast; mapa não guarda ponte do reforço. | Balão com estado/destinos; ponte feita e Vale rever coexistindo; rever sem nova comemoração ou apagamento. |
| LC10 | P10/P14: anterior, fontes/recursos e reinício da lição retomada. Produção: `apps/mobile/src/licao.tsx:480–503,805–808,825–835,863–887`; `estudio-adaptativo.tsx:780–792`. | Protótipo `app.js:96` tem fonte em texto estático e um avanço; não representa aviso/confirmar/cancelar reinício de uma lição em curso. | Recurso e fonte quando os dados os oferecem, ida/volta preservando tentativa; reinício apenas da lição com consequência clara e cancelamento preservando rascunho. |
| LC11 | P11: parcial e preservação de acertos. `app.js:137–147,204`. Produção: `apps/mobile/src/licao.tsx:554,764–767`. | Retorno só `acerto`/`erro`; associar usa seletores sem marca de itens certos. | Parcial identificável por texto/estado, corrigir apenas o que falta, manter acertos e tentativa, nos formatos em que a avaliação oferece itens. |
| LC12 | P12: vitória e reabertura; exemplo guiado quando oferecido. `app.js:98,207`; produção `estudio-adaptativo.tsx:660–776,808–842`. | Reforço termina com retorno direto ao exercício e toast; não há quadro estável de desafio vencido/reaberto. | Vitória legível, próximo passo, reler explicação/exemplo e voltar conservando tentativa; não exigir cena decorativa que atrase a ação. |
| LC13 | P13: falha/repetição de envio. `app.js:99–100,210`. | `send-explanation` valida comprimento e abre retorno; erro genérico fala “pedido/conexão”. Não há retorno contextual de envio que conserve a explicação para tentar novamente. | Pending/erro/repetir/cancelar locais próprios, mantendo texto/transcrição; sem alegar avaliação ou microfone real. |
| LC15 | P15: Novas/paginação/retorno. `app.js:102,152`; produção `apps/mobile/src/comunidade.tsx:704–708,750–753,821–828`. | Há Todos/Seguindo/Tecnologia/busca e uma lista “Em alta”; não há Novas, cursor ou Ver mais. | Listas distintas e paginação local identificada, vazio/erro/cancelamento; voltar preservando tema, aba, lista e rolagem. |
| LC16 | P16: modos sociais, trilhas postadas no perfil e novidades. `app.js:108–109`. | Perfil próprio é sempre o mesmo modo; número público é constante 0; novidades sempre vazias. Editar muda nome/foto/interesses/cor, sem selecionar/postar/retirar trilhas do perfil. | Visitante/sem social/social próprios; postar/retirar trilhas com retorno; alcance/novidades sintéticos plausíveis; email/material privados. |
| LC17 | P17: capa/tema. `app.js:111,218`. | Clicar Capa e tema só abre `Manter esta capa`; não existe escolha ou rascunho de capa/tema. | Escolher/conferir/cancelar/salvar por trilha; recarregar/trocar de trilha sem herdar indevidamente. |
| LC18 | P18: destinatários da IA quando necessário. Protótipo `app.js:92,113`; produção `apps/mobile/src/privacidade.tsx:38–54` e `consentimento-ia.tsx`. | Consentimento/privacidade não oferecem Ver quem recebe/ListaProvedores. O produto oferece isso quando `ia.necessario`. | Manifesto da flag e estado simulado coerente: se necessário, destinatários/políticas e consentir/revogar; se falso, explicar IA simulada sem inventar provedor. |

**Reconciliação de P16:** em `postar-perfil.tsx`, “Postar no perfil” se refere a selecionar e publicar trilhas no perfil. Não há exigência de um interruptor para publicar/despublicar o cadastro inteiro. LC16 mantém a lacuna de postagens/visibilidade e de novidades/alcance, sem inventar essa função.

**Priorização:** não foi identificado P0 de execução nesta auditoria documental. As faltas de material/geração, parcial do exercício, Explorar e capa/tema são prioridades de completude para a próxima candidata; os demais itens continuam declarados e não foram removidos da matriz. Falta de representação impede concluir DG1 mesmo se o caso feliz funciona.

## Evidências e proveniência

| Alias | Evidência existente no fechamento desta ficha | O que comprova e o que não comprova |
| --- | --- | --- |
| **F1** | `/workspace/work/revisao-fluxos-r4/resultado.json`, `revisar-regressao.cjs`: **147/147**, 12 cenários, finalizado. | Percurso central, recuperação, perfil, comunidade/segurança e cenários citados; 390 px, três direções. |
| **F2** | Mesma pasta: `novos-resultados.json`, `novos-fluxos.cjs`: **207/207**, 33 cenários, finalizado. | Seis formatos, revisão, áudio, foto, código/clipboard, denúncia/publicação, visitante, descrição, HTML via HTTP. |
| **F3** | `integracao-resultados.json`, `regressoes-integracao.cjs`: **51/51**, 12 cenários, finalizado. | Alvo da denúncia, draft composto, descrição por trilha e timer/limite com relógio simulado. |
| **F4** | `fronteiras-resultados.json`, `fronteiras-e-trilha-completa.cjs`: **111/111**, 6 cenários, finalizado. | Descrições criada/recebida/existente; cinco lições até 5/5, rever e criar sem apagar anterior. **F1–F4 = 516 asserções/63 cenários**, não 516 variantes únicas. |
| **Q4** | `/workspace/work/revisao-a11y-r4/matriz.json`, `matriz-final.cjs`: finalizado, hashes estáveis, commit a6f2e09. | **210 bases DPR2**, **90 vistas de estados** em 360 e **105 vistas ampliadas** em 360. Existência/dimensões dos 210 PNGs também conferidas nesta auditoria. Medições DOM não equivalem a executar todo fluxo funcional. |
| **Q4 complementar** | Encerramento comunicado pelo revisor da R4: `email-notas.json` **18/18**; `teclado/resumo.json` **186/186**, mais guards **36/42**; `titulo-cabecalho.json` com **6 falhas**. | Fonte a6f estável. K4b permanece em concorrência/foco; título sem espaços falha no cabeçalho em 100/200%360. O complemento amplo de 108 dados longos/formatos **não foi executado novamente** e não entra no total. Não herdar verificações R3 como R4. |
| **V4** | `/workspace/work/revisao-visual-r4/resultado.json`: fonte a6f, finalizado, **570 vistas**, hashes estáveis; `emails-conclusao.json`, `motion.json`, `concluida.json`. | Bases, variantes selecionadas e ampliação; as contagens sobrepõem Q4 e não se somam como páginas únicas. Abertura direta de estado é captura, não teste de seu ciclo. |
| **AR4** | [Parecer de arte R4](revisoes/PARECER-ARTE-CRAFT-R4.md); `/workspace/work/revisao-arte-craft-r4/evidencias.json`. | **20 PNGs novos abertos**, cinco refinos fechados; D4 9,0 apenas na amostra de arte. Não substitui D10. |
| **M4/M2** | [Notas de mídia](NOTAS-MEDIA.md); `/workspace/work/revisao-media-r4/resultado.json` e `foco-resultados.json`; harness histórico `/workspace/work/revisao-media-r2/`. | 145 checks R4 da factory, incluindo 78 de foco/corridas. QR decodificado historicamente na factory M2; não é prova nativa nem salvamento integrado por si só. |
| **Histórico R1–R3** | [Pareceres de fluxo](revisoes/PARECER-FLUXOS-R1.md), [R2](revisoes/PARECER-FLUXOS-R2.md), [R3](revisoes/PARECER-FLUXOS-R3.md); visual/a11y e diretórios correspondentes. | Conservam defeitos, correções e limites de cada fonte. Não rebatizar capturas antigas nem somar verificações antigas ao total R4. |

## Manifesto de disponibilidade e limites

- **Canais:** esta é uma bancada HTML com viewport mobile. Produção web, React Native, iPhone e Android têm contratos e provas próprios. A intro nativa distribuída é um trabalho separado; estas páginas de apresentação não aprovam seu boot.
- **Dados:** sintéticos e locais, sem PostgreSQL, sincronização de conta ou API. Reload/continuidade medidos significam localStorage do protótipo. Confirmação de conclusão no desenho é explicitamente exemplo local.
- **IA/email:** falsos. Não houve inferência, transcrição, email ou avaliação por serviço real. Na próxima candidata, explicitar os ramos de `ia.necessario` e lista de destinatários; não tratar o protótipo como configuração remota de produção.
- **Comunidade/compartilhar/visitante:** oferecidos demonstrativamente na bancada, com gates de visitante; sem afirmar que as flags de um binário real estão habilitadas. Cadastro/recuperação e Google/Apple são cenas locais, sem autenticação externa.
- **Nativo N/A nesta superfície:** câmera, galeria/seletor nativo, OCR real, microfone, sessão/Keychain, folha nativa, VoiceOver/TalkBack, gestos e AppState precisam de implementação/aparelho. A representação visual local de permissão/erro continua necessária onde declarada; N/A técnico não dispensa desenhá-la.
- **Voz ao vivo:** não é oferecida nesta bancada e não se afirma presente no binário. N/A para a comparação corrente; gravar/transcrever por exemplo continua no escopo P13.
- **Recomeço:** não há exigência de apagar progresso da trilha inteira. Fonte real `apps/mobile/src/caminho.tsx:1777` refaz um nó chamando abertura; `estudo.tsx:688` obtém a lição. Já o reinício confirmado da **lição retomada** existe em `licao.tsx:480–503`; está em LC10 e não foi excluído.
- **Arte:** Stu caderno original ainda indisponível; assets provisórios explicitados. Aprovação de composição não aprova branding final.

## Gates e uso desta matriz

**DG1 e D10 integral: pendentes por lacunas de representação.** DG2/DG5 têm evidência positiva nos percursos citados, sem cobrir automaticamente as situações ausentes. DG3/DG4 não recebem aprovação integral: o fechamento de QA R4 preservou K4b e seis falhas de título sem espaços no cabeçalho. DG6 não pode aprovar a direção completa ignorando lacunas desta matriz.

Na próxima candidata, manter este retrato da R4, acrescentar fonte nova e fechar cada LC com estado próprio, interação e captura pertinentes em A/B/C. Uma variante desconhecida permanece pendente. Nota global de desenho e C1–C10 do produto não são atribuídas por esta ficha.
