# Cobertura das direções — R6

24/11/2026 · candidata formal **`28b003e6c29728e1fd8c96f14efbb497353b0d10`**. As matrizes [R4](MATRIZ-COBERTURA.md) e [R5](MATRIZ-COBERTURA-R5.md) permanecem históricas. Pesos, requisitos e âncoras do [protocolo](COBERTURA-E-REVISAO.md) não foram alterados.

**As 14 lacunas de representação da R4 têm P/I/C no recorte declarado nas três direções; a candidata R6 continua sem aprovação integral.** As seis pendências da R5 foram corrigidas e repetidas, mas a ampliação das fronteiras de compartilhamento encontrou **três médios novos**: retorno assíncrono fora de contexto, retirada no registro errado e promessa contraditória sobre o nome do material. Não há nota global 9 nem aprovação antecipada de uma candidata posterior.

## Unidade e fonte

P = representação conferida na fonte; I = interação local com efeito/destino comprovado; C = captura. **Abrir uma query ou inspecionar um elemento não equivale a percorrer o fluxo.** Uma falha também pode ter P/I/C: cobertura observada não significa comportamento aprovado.

São os mesmos **35 IDs de página em 18 famílias**, A/B/C. Material, capas, postagens e espera são subestados, não novas páginas. A matriz visual R6 tem **127 quadros distintos**: o parcial genérico foi normalizado para Associar e deduplicado com esse caso. Essa diferença em relação aos 128 da R5 não removeu um requisito real; não se exige parcial de uma lacuna atômica. Associar e Aberta conservam parciais próprios.

Fontes lidas: `prototipo/app.js`, módulos material/personal/social/mídia e estilos, notas de jornada/material/personalização e `NOTAS-COMPARTILHAR-R6.md`. A confirmação de fonte da QA inclui 17 blobs HTML/JS/CSS e seus bytes servidos por HTTP. Visual e arte também conservaram 17 hashes antes/depois. As notas de autoria explicam intenção e reprodução, mas seus contadores não foram somados às provas independentes.

Esta é uma **bancada HTML mobile**, em Chromium 156.0.8078.79, com dados sintéticos, IA/email/API falsos e persistência local. Não é execução do produto web/React Native, autenticação remota, publicação real ou prova de paridade nativa.

## Inventário-base preservado

Todas as bases abaixo estão projetadas e novamente capturadas em A/B/C. As interações e os limites dos subestados estão na tabela LC e nas fontes F/Q; nenhuma família é aprovada só pela captura-base.

| Família | IDs de página | Base A/B/C | Prova de captura nova |
| --- | --- | --- | --- |
| P01 | `boasvindas`, `apresentacao`, `interesses` | P + C | V/Q canônicos |
| P02 | `entrar` | P + C | V/Q; LC02 |
| P03 | `cadastro`, `codigo`, `senha`, `recuperar` | P + C | V/Q canônicos e estados |
| P04 | `pedido`, `consentimento` | P + C | V/Q; LC18 |
| P05 | `material` | P + C | V/Q; LC05 |
| P06 | `geracao` | P + C | V/Q; LC06 |
| P07 | `proposta` | P + C | V/Q; LC07 |
| P08 | `inicio` | P + C | V/Q; LC08; AR |
| P09 | `mapa` | P + C | V/Q; LC09; AR |
| P10 | `licao` | P + C | V/Q; LC10; AR |
| P11 | `exercicio` | P + C | V/Q seis formatos; LC11; AR |
| P12 | `reforco` | P + C | V/Q; LC12 |
| P13 | `explique`, `retorno` | P + C | V/Q; LC13 |
| P14 | `conclusao` | P + C | V/Q; F1/F4; AR |
| P15 | `explorar`, `previa`, `publico` | P + C | V/Q; LC15 |
| P16 | `perfil`, `editar`, `foto` | P + C | V/Q; LC16; AR |
| P17 | `configurar`, `compartilhar`, `codigostudoo` | P + C | V/Q; LC17; AR |
| P18 | `preferencias`, `privacidade`, `ajuda`, `denunciar`, `bloqueados` | P + C | V/Q; LC18 |

## Auditoria dos 14 LC — representação, interação e captura

Os aliases do fim da ficha apontam os artefatos R6, separados dos históricos. F-LC terminou **372/372 em 42 cenários**; os médios surgiram nos complementos F-share/F-async/F-copy. Cada linha refere-se às três direções, sem transformar essas asserções em centenas de variantes únicas.

| LC / família | P — representação atual | I — percurso novo e limite | C — prova nova / estado |
| --- | --- | --- | --- |
| **LC02 / P02** | Restaurando/expirada; credencial rejeitada/rede; snapshot da conta separado da visita. | F-LC `LC02-sessao-visita-restauracao`: 10 checks/direção; visita separada, retorno à conta e tentativa/explicação restauradas. F1/F2 complementam destinos/conta. **P/I/C fechado no recorte local.** Não é autenticação de servidor. | V `entrar/restaurando`, `expirada`, `credenciais`, `rede`; Q canônico/estados. |
| **LC05 / P05** | Material próprio, limites, nove erros, leitura cancelável, prévia/citação e conservação do confirmado. | F-LC `LC05-material-confirmado-e-cancelamentos`: 14 checks/direção; leitura, cancelamento, conferir, erro preservando anterior, câmera/descarte/remoção e CSV. Q-módulos repete formatos/limites, recuperações, callbacks e foco. **P/I/C fechado no recorte.** Câmera/galeria com material anterior tiveram abertura direta por query e ações; não se afirma cada rota completa de troca ou seletor/OCR nativo. | V material: leitura/prévia, câmera/galeria, erros; V-folhas picker; Q dirigido e módulos. |
| **LC06 / P06** | Título e nós que chegam; rótulo Recebida/livro sem check concluído; espera longa; rede/IA/limite e cancelamento. | F-LC `LC06-eventos-cancelamento-erros`: 14 checks/direção; ordem de eventos, cancelar sem chegada tardia, proposta após chegada e saídas dos erros. **P/I/C fechado no recorte.** Timers locais de 300/650/1100 ms não são latência de IA. V não repetiu o lote cronometrado R5; a prova nova de eventos é F-LC. | V estados de geração, Q comum; capturas não são usadas como prova temporal. |
| **LC07 / P07** | Aceite pendente cancelável, erro/falha de abertura e proposta longa em partes/cinco lições. | F-LC `LC07-aceite-cancelavel-e-falhas`: 8 checks/direção; cancelar sem cópia/duplicação, confirmar depois, duplicada/cancelar e abrir após erro. **P/I/C fechado no recorte.** Não declara servidor ou todos os ciclos de retry possíveis. | V proposta/aceitando/aceite-erro/falha-abrir/expirada/longa; Q. |
| **LC08 / P08** | Carga/sincronia, erro contextual, vazio/lista e 5/5; hero C identifica a trilha ativa. | F-LC `LC08-biblioteca-carga-erro-retorno`: 8 checks/direção; conservar registro, recuperar e retomar. F4 percorre cinco lições→home concluída→rever→nova sem apagar. **P/I/C fechado.** Identidade de registro/progresso/CTA não depende de A/B/C mostrarem a mesma frase de layout. | V/Q início em cinco estados; AR home ×3 e C 360/200%. |
| **LC09 / P09** | Balão nomeado, bloqueio explicado, ponte por trilha/lição, Vale rever e reabertura independentes. | F-LC `LC09-12-baloes-ponte-vitoria-retorno`: 8 checks/direção; nó bloqueado/atual, vitória estável, reler/voltar e reabrir após reload. Q-módulos confirma Escape/retorno do balão. **P/I/C fechado no recorte.** | V mapa/ponte-Vale-rever/concluída; V-folhas balão; Q; AR mapa ×3. |
| **LC10 / P10/P14** | Origem [1], citação/apoio, anterior e reinício confirmado da tentativa atual; referência guardada na trilha. Nome de 160 caracteres quebra no cartão/modal. | F-LC `LC10-tentativas-por-trilha-licao-reinicio`: 8 checks/direção; confirmar/cancelar sem apagar outras tentativas. Caso `LC10-16-17-material-origem-por-trilha` conserva origem após outro pedido/remoção. Q-longos abre cartão/apoio/diálogo e Escape; Q-anterior exerce o controle no corpo. **P/I/C e reflow R5 fechados no recorte.** Reset global é N/A abaixo. | V-fontes 12 combinações, V-longos 360 vistas; Q-longos 24 cenários; AR fonte de 160 caracteres + diálogos e lição. |
| **LC11 / P11** | Seis formatos; parcial somente Associar/Aberta; acertos preservados com check/texto; genérico normalizado. | F-LC `LC11-parcial-preserva-acertos`: 7 checks/direção; dois pares conservados/desativados, reload/corrigir restante e critérios da aberta. Q-K5: 120 transições; VF campo: 6 casos/12 transições; Q-bancada: 66 verificações. **P/I/C fechado; K5 e combinação incoerente R5 corrigidos.** Não se cria parcial para lacuna atômica. | V 127 quadros inclui os dois parciais aplicáveis; Q 156 dirigido; AR genérico 390 e associação 360/200%. |
| **LC12 / P12** | Desafio vencido estável, releitura, retorno com tentativa e reabertura pelo mapa; Sua vez e apoio. | Mesmo caso F-LC LC09-12; F1 erro→outro caminho→correção. **P/I/C fechado no recorte SQL.** Resolva comigo é condicional/N/A pelas fontes reais abaixo; não foi aprovado por omissão conveniente. | V reforço/vencido e variantes; Q canônico/estados. |
| **LC13 / P13** | Envio pendente cancelável, erro/retry conservando texto; alternativas de escrita e estados de áudio. | F-LC `LC13-envio-cancelamento-erro`: 6 checks/direção; cancelar sem retorno tardio, conservar/repetir envio, permissão negada. F2/F3 e Q-teclado repetem ramos locais de gravação/parar/texto/indisponibilidade. **P/I/C fechado no recorte.** O limite de 60 s é contrato; a QA temporal R5 não foi recontada como nova prova R6. Nenhum microfone real. | V enviando/envio-erro/Activity/permissão/transcrição/gravando; Q. |
| **LC15 / P15** | Em alta/Novas, paginação e memória de aba/busca/ordem/lista/scroll; perfil público/prévia próprios. | F-LC `LC15-ordem-paginacao-historico`: 8 checks/direção; acrescentar sem duplicar, receber, Back conservando contexto, mudar ordem e Seguindo/vazio/voltar. F1–F3 complementam seguir/bloquear/denunciar. **P/I/C fechado no recorte de exploração.** A cópia recebida continua estudável; os efeitos assíncronos de compartilhar são avaliados em LC17. | V explorar/novas/paginada/seguindo/vazio/erro, prévia/público; Q. |
| **LC16 / P16** | Postar **trilhas próprias** no perfil, sem social/social, pendente/aprovada/recusada/retirada/desfazer, contador/atividade locais; legenda de fixture compacta. | F-LC `LC16-postagem-moderacao-retirada-desfazer`: 10 checks/direção; confirmar/cancelar, retirar/desfazer preservando estudo, recebida fora da seleção. Q-módulos confirma estados e Q-cores 144 casos centrais com foco exato. **P/I/C preenchido; cor/legenda R5 fechadas.** Isolamento de retirada entre registros falha em F-share/R6-F2: não se estende o sucesso estável à retirada pendente com troca de trilha. | V estados pessoais, V-folhas confirmação; Q cores; AR aprovado 390/200 e perfil ×3. |
| **LC17 / P17** | Capa/tema por trilha, erros por campo, rascunhos; helper de propriedade/origem, material+Explorar desabilitado, recebida sem link/QR e legado recuperável. | F-LC `LC17-capa-tema-drafts-isolados`: 9 checks/direção; cancelar/aplicar/Back/isolamento/validação. F-share repete metadata, menu, URL, handlers e ausência de efeitos; restrições R5 fechadas. **P/I/C presente, qualidade aberta:** R6-F1/F2/F3 impedem aprovar compartilhamento/contexto. Guards de estado e callbacks após uma mudança são provas diferentes. | V-guards 216 vistas/verificações; V-folhas capa; Q 12 seleções delta 0; AR capa ×3 e material/recebida ×3. F-async tem capturas dos defeitos. |
| **LC18 / P18** | IA/email/API falsos, `iaNecessario=false`; destinatário simulador local explícito antes de consentir e em Privacidade. | F-LC `LC18-consentimento-destinatarios-revogacao`: 8 checks/direção; abrir/recusar/consentir, destinatário, cancelar/revogar/preservar estudos e solicitar de novo. **P/I/C fechado no recorte.** Nenhum provedor real foi chamado. | V-folhas destinatário/Privacidade e bases; Q diálogos/teclado. |

**O que esta tabela fecha:** ausência de desenho e observação declarada dos 14 LC. **O que continua aberto:** o isolamento e a confiança dos efeitos de compartilhamento, além de todos os limites nativos/servidor/usabilidade explicitados. A aprovação não se obtém somando capturas nem renomeando uma restrição como fora de escopo.

## Provas independentes desta candidata

| Alias | Artefato R6 | Quantidade, resultado e limite |
| --- | --- | --- |
| **F1–F4** | `/workspace/work/revisao-fluxos-r6/`: `resultado.json`, `novos-resultados.json`, `integracao-resultados.json`, `fronteiras-resultados.json` | 147/147, 207/207, 51/51, 111/111: **516 asserções/63 cenários**. Scripts correspondentes preservados. São execuções, não 516 variantes. |
| **F-LC** | Mesma pasta: `riscos-lc-resultados.json`, `riscos-lc.cjs` | **372/372, 42 cenários**, três direções em 360 px; sete suítes finais mantêm hashes estáveis. Rechecagens de expectativas R6 substituem registros iniciais e não se somam. F1–F4+F-LC = **888/888** na regressão. |
| **F-share** | `compartilhar-resultados.json`, `compartilhar-rechecagem.json`, script | **144/150 em 42 cenários**. Seis falhas efetivas: fallback fora de contexto e retirada no registro errado, três direções. Adaptadores e rechecagens iniciais preservados; não contam como novos cenários. |
| **F-async** | `assincronia-resultados.json`, `assincronia-rechecagem.json`, script | **69/120 em 60 cenários**. Promises/afterClose resolvidos após mudar trilha/página: 51 falhas efetivas. Rechecagem de “Selecionar…” substitui a expectativa correspondente; não a soma. |
| **F-copy / total** | `material-nome-probe.json`, `notas-e-contagens.json` | Diagnóstico textual separado da contagem: contradição de nome. Total das sete suítes: **1101/1158 positivas, 57 negativas, 207 cenários**, zero exceções/pageerrors; 386 checks/69 cenários por direção. Não são 57 defeitos distintos. |
| **V** | `/workspace/work/revisao-visual-r6/casos.json`, `resultado.json`, `conferencia-final.json` | **127 quadros × 3 direções × 2 larguras × 2 escalas = 1524 vistas/PNGs**; zero falhas métricas no conteúdo padrão. 17 hashes estáveis/cruzados. Amostra declarada de pranchas/individuais aberta; não todos os 1524 individualmente. |
| **V-longos/fontes** | `longos.json`, `fontes.json` | **360 vistas longas** e **12 combinações com cartão/modal/apoio**, sem falha. Nome de 40, título de 80, arquivo de 160 e objetivo de 800 caracteres, entre outros dados. Fecha o recorte longo R5 sem truncamento. |
| **V-folhas/guards/motion** | `folhas.json`, `guards.json`, `motion.json` | **108 vistas de nove folhas**, **216 vistas + 216 verificações de estados** e **24 probes de movimento**, todos positivos; capa delta 0. Guards não exercitam a Promise pendente defeituosa. |
| **Q** | `/workspace/work/revisao-a11y-r6/matriz.json`, `http-source.json`, `parecer-qa-r6.json` | **210 PNGs DPR 2**, 90 estados e 105 ampliados, todos sem problema métrico; 17 blobs estáveis e iguais ao HTTP. Estados/capturas não são ciclos funcionais. |
| **Q-dirigidos/longos** | `variantes-direcionadas.json`, `conteudo-longo.json` | **156 vistas** (42 normais/114 ampliadas); **24 cenários/36 PNGs** título de 80/material de 160 caracteres, sem falha. O título técnico antes não observado pela QA foi realmente repetido, sem usar `s=longa` como substituto. |
| **Q-teclado/bancada** | `teclado/resultado.json`, `foto-guards.json`, `bancada-parcial.json` | **186/186 comuns**, **42/42 guards de foto**, **66/66 bancada/parcial**. Não incluem nova prova física de seletor/microfone nem recontam os 60 s históricos. |
| **Q-módulos/K5/cores/capas** | `novos-modulos/resultados-resolvidos.json`, `exercicios-foco.json`, `vf-campo.json`, `cores-etapas.json`, `capas-estabilidade.json`, subparecer | **1200/1200** efetivos; **120/120** K5; **6 casos/12 transições** VF; **270/270** cor/anterior (144 centrais + 72 pré-condições + 54 verificações); **12/12** seleções de capa. Sobreposições explícitas: seis acertos Associar e algumas seleções/ações anteriores. 24 rechecagens literais substituem expectativas, não são 24 novas. |
| **AR** | [Arte R6](revisoes/PARECER-ARTE-CRAFT-R6.md); `/workspace/work/revisao-arte-craft-r6/evidencias.json` | **53 PNGs novos abertos**, DPR 2, 17 hashes estáveis; D4 = 9 no recorte. Corrige dois baixos R5 e confirma título Foco/composição. Não promove screenshot a percurso. |

V/Q/F/AR se sobrepõem. Não existe soma válida de seus registros como “todos os fluxos únicos”. Provas de autoria não entram nesses totais. As fontes dos pareceres [visual](revisoes/PARECER-VISUAL-R6.md), [QA](revisoes/PARECER-A11Y-R6.md) e [fluxo](revisoes/PARECER-FLUXOS-R6.md) são a mesma candidata; cada especialidade registra notas e limites próprios.

## Achados abertos da R6

1. **R6-F1 — respostas assíncronas fora de contexto, médio, P17/LC17.** Iniciar cópia/folha numa trilha própria e trocar de trilha/página antes de resolver a Promise ou fechar a folha permite toast, status ou diálogo do contexto anterior. O handler comum reproduz em própria diferente, recebida, Privacidade e Mapa; mídia/afterClose também falham em própria diferente/Privacidade/Mapa. A mídia bloqueia recebida/material inválido, o que não aprova os demais destinos. F-async registra 51 falhas, não 51 defeitos independentes. O primeiro efeito começou após gesto numa própria elegível; o defeito é o callback tardio, sem alegação de cópia/publicação real de dados.
2. **R6-F2 — retirada no registro errado, médio, P16/P17.** `retirada-nao-altera-outra-trilha`: iniciar a retirada na própria, mudar para recebida e confirmar altera `publicationStatus` da cópia ativa para `retirado`. O percurso estável retirar/desfazer em F-LC passa; a mudança de contexto em F-share não. A confirmação precisa pertencer ao registro que a originou.
3. **R6-F3 — promessa contraditória sobre nome, médio, D1/D9.** Com título `revisao.pdf para a prova`, a folha diz “Arquivo, nome e fotos não são publicados” e depois explica que “O título traz o nome do seu arquivo”. V `copy-material.json` + 3 PNGs e F-copy reproduzem A/B/C. O segundo aviso corresponde ao título visível; a promessa absoluta do primeiro precisa ser alinhada. Nenhum dado foi enviado na bancada.

Os seis achados R5 foram repetidos e fechados no recorte: material não é submetido ao Explorar; cópia recebida não gera nova publicação/link/QR pelos caminhos imediatos; nome de 160 caracteres quebra no cartão/diálogo; K5 e troca de cor preservam sucessor; parcial genérico é Associar. **Fechar essas restrições imediatas não fecha os três novos casos assíncronos/textuais.**

## Condicionais e limites preservados

- **Resolva comigo:** as cinco lições SQL em `src/servidor/ia/falsa.ts` — WHERE, INNER JOIN, AND, filtro+junção e LEFT JOIN — não fornecem `resolucao`. `apps/mobile/src/resolva-comigo.tsx:216` condiciona ativação a resolução/estado/responder. N/A nesta comparação SQL, com motivo na produção; Sua vez, reforço, origem e apoio continuam avaliados. Não aprova o recurso quando oferecido por outra lição.
- **Reinício global:** N/A, sem ação/API real de apagar o progresso inteiro ao refazer. Nó concluído abre a lição; reinício da tentativa atual existe com confirmação/cancelamento e permanece em LC10.
- **Perfil:** Postar no perfil seleciona trilhas e sua visibilidade/moderação. Não existe obrigação de um botão global de publicar/despublicar o cadastro. O email não se torna público; cópia recebida fica fora da seleção de postagem.
- **Nativo/servidor:** câmera/galeria/seletor, OCR, microfone, AppState, permissões/folha física, VoiceOver/TalkBack, teclado/safe area e API/IA/email/moderação reais não foram executados. A representação local de erros e controles continua no escopo. Voz ao vivo não é oferecida nesta bancada. QR e clipboard locais não são uma folha nativa instalada.
- **Arte e pessoas:** novo Stu caderno original continua pendente; kit antigo provisório. Nenhuma nota de branding final, app instalado, intro, paridade de renderizadores, TestFlight, compreensão/retensão/satisfação de estudantes ou produção é transferida desta ficha. C1–C10 do produto continuam `null`.

## Gates e conclusão do retrato

| Gate/faceta | Estado R6 |
| --- | --- |
| **DG1 — representação da matriz** | As 18 famílias/35 bases e os 14 LC têm desenho e captura A/B/C, com exclusões condicionais justificadas acima. Não há ausência nova de representação confirmada; a cobertura observada tem interação nomeada e seus limites. Isso não equivale a aprovação da consistência integral. |
| **DG2 — operação** | **Sem aprovação integral:** retirada/callback fora de contexto. Os 888 checks de regressão positivos não anulam o complemento que falha. |
| **DG3 — leitura** | **Passa no conjunto declarado de desenho:** 390/360, 100/200% e dados longos reexecutados, nome de 160 caracteres/cartão/modal corrigidos, sem médio aberto de leitura nas provas V/Q. |
| **DG4 — acesso/movimento** | **Passa no conjunto declarado:** alvos/contraste, foco/teclado, K5/cores, anterior no corpo e movimento reduzido têm provas novas. Não aprova leitor/gesto nativo. |
| **DG5 — confiança/recuperação** | **Sem aprovação:** R6-F1/F2/F3 médios. Simulação explícita e ausência de envio real não legitimam contexto ou promessa incorretos. |
| **D10 integral** | **`null` nesta ficha:** P/I/C das lacunas documentado, mas a consistência do estado entre registros continua com defeitos observados. Não se herda 9 a partir da quantidade de vistas. |
| **DG6 / nota global** | **Sem aprovação; global `null`.** Fluxo sustenta D1/D2/D8/D9 = 8; visual/arte/QA sustentam 9 em suas facetas. Usa-se a menor nota competente, sem média que esconda médios. |

Esta ficha encerra a R6 com fonte histórica, provas e falhas explícitas. Uma candidata posterior precisa repetir os casos afetados e a regressão necessária, preservando estes resultados; não precisa produzir uma nova contagem de telas para esconder ou apagar o que foi encontrado.
