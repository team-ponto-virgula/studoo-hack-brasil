# Cobertura das direções — R5

24/11/2026 · candidata formal **`5ad1225f586af063d58f694d4ebe705fcabca081`**. A [matriz R4](MATRIZ-COBERTURA.md) permanece histórica. Esta ficha não rebatiza suas provas nem altera os requisitos do [protocolo](COBERTURA-E-REVISAO.md).

**Estado final da R5: as 14 ausências de representação da R4 receberam desenho e provas novas, mas a candidata completa não foi aprovada.** As cinco suítes de fluxo terminaram com **885/888 asserções positivas em 105 cenários**; as três falhas são a submissão de material ao Explorar. Há ainda republicação indevida de cópias recebidas, falhas médias de foco/reflow e uma combinação demonstrativa incoerente de exercício parcial. Captura, representação e interação permanecem discriminadas abaixo; nenhuma nota global 9 foi atribuída.

## Unidade e proveniência

Continuam **35 IDs de página, sem adições**, distribuídos nas mesmas **18 famílias** da matriz R4. Novos materiais, postagens, capas, respostas parciais e estados de espera são subestados dos IDs existentes; não se contam como páginas novas. A/B/C preservam as mesmas tarefas, com composições próprias.

Esta é uma bancada HTML com dados sintéticos, não o app React Native ou a produção web. P significa representação na fonte, I significa interação local comprovada, C significa captura. **C não implica I.** Abrir uma query de estado não prova cancelar, repetir ou recuperar esse estado.

Fontes examinadas: `prototipo/app.js`, módulos `material-pages.js`, `personal-pages.js`, mídia/social e estilos, mais `NOTAS-JORNADA.md`, `NOTAS-MATERIAL.md` e `NOTAS-PERSONAL.md`. As notas de autoria ajudam a localizar ramos; não substituem provas independentes.

## Inventário das 18 famílias

| Família | IDs de página — inalterados | Representação-base A/B/C | Captura-base A/B/C |
| --- | --- | --- | --- |
| P01 | `boasvindas`, `apresentacao`, `interesses` | Projetadas | Capturadas |
| P02 | `entrar` | Projetada | Capturada |
| P03 | `cadastro`, `codigo`, `senha`, `recuperar` | Projetadas | Capturadas |
| P04 | `pedido`, `consentimento` | Projetadas | Capturadas |
| P05 | `material` | Projetada; subfluxo novo | Capturada |
| P06 | `geracao` | Projetada; eventos novos | Capturada |
| P07 | `proposta` | Projetada; aceite/erro novos | Capturada |
| P08 | `inicio` | Projetada; carga/sincronia novas | Capturada |
| P09 | `mapa` | Projetada; balão/ponte novos | Capturada |
| P10 | `licao` | Projetada; fontes/apoio/retomada novos | Capturada |
| P11 | `exercicio` | Projetada; parcial novo | Capturada |
| P12 | `reforco` | Projetada; vitória estável nova | Capturada |
| P13 | `explique`, `retorno` | Projetadas; envio/erro novos | Capturadas |
| P14 | `conclusao` | Projetada | Capturada |
| P15 | `explorar`, `previa`, `publico` | Projetadas; Novas/paginação novas | Capturadas |
| P16 | `perfil`, `editar`, `foto` | Projetadas; postagens/atividade novas | Capturadas |
| P17 | `configurar`, `compartilhar`, `codigostudoo` | Projetadas; capa/tema novos | Capturadas |
| P18 | `preferencias`, `privacidade`, `ajuda`, `denunciar`, `bloqueados` | Projetadas; destinatário local novo | Capturadas |

“Projetada/capturada” nesta tabela refere-se à base. O fechamento dos subestados está na tabela seguinte. Não se deduz aprovação integral de uma família por haver sua página-base.

## Auditoria dos 14 LC da R4

Todos os ramos de representação abaixo foram conferidos na fonte R5. Os aliases F/V/Q/AR identificam provas no fim do documento. As capturas V abrangem A/B/C ×390/360 ×100/200%; folhas abertas têm evidência separada V-folhas. **F-LC está finalizado**: 369/372, três falhas de material→Explorar. “Fechamento do recorte” significa P+I+C na situação nomeada, não aprovação automática de todas as combinações ou do produto.

| LC / família | Representação nova conferida | Captura independente | Interação comprovada e pendência atual |
| --- | --- | --- | --- |
| **LC02 / P02** | Sessão restaurando/expirada, credencial rejeitada e rede com texto/destino de conta. `app.js:112–113,201–204`; snapshot da conta separado da visita. | V: `entrar/restaurando`, `expirada`, `credenciais`, `rede`. | **Recorte P/I/C fechado.** F-LC `LC02-sessao-visita-restauracao`: 10 checks por direção; sessão expirada, visita separada, estudo visitante, snapshot, reentrada e tentativa/explicação da conta restauradas. F1/F2 cobrem os gates de conta. Não é autenticação remota. |
| **LC05 / P05** | Módulo `material-pages.js`: estados específicos, limites de material, leitura/cancelamento, prévia/citação e conservação do confirmado. Não usa o validador da foto de perfil. | V: câmera/galeria, carregando/lendo/prévia, nove retornos de erro/expiração/permissão; V-folhas: escolher arquivo. AR: prévia/erro360. | **Recorte P/I/C fechado.** F-LC `LC05-material-confirmado-e-cancelamentos`: 14 checks por direção; seletor, leitura/cancelamento, citação página2, conferir, excessivo conservando anterior, câmera, descarte, remoção e CSV. Q-novos exercitou as nove recuperações e foco nos callbacks. Não valida arquivo/OCR nativos. |
| **LC06 / P06** | `generationContent()` e eventos 300/650/1100 ms; título, dois/cinco nós “Recebida”, espera longa e erros próprios. | V: parcial/espera longa/erros; V-eventos: 12 quadros/15 verificações; AR: parcial390/longa360. | **Recorte P/I/C fechado.** F-LC `LC06-eventos-cancelamento-erros`: 14 checks por direção; ordem das chegadas, cancelar sem evento tardio, proposta após evento, rede/IA/limite com saídas e cancelamentos, espera longa sem criação indevida. Não se afirma latência real nem clique em cada combinação possível de retry. |
| **LC07 / P07** | Aceite pendente cancelável, aceite-erro, falha de abertura e proposta longa com capítulos/conteúdo próprio. `app.js:72,110–111,206–208`. | V: aceitando/aceite-erro/falha-abrir/expirada/longa. | **Recorte P/I/C fechado.** F-LC `LC07-aceite-cancelavel-e-falhas`: 8 checks por direção; pendente sem registro/duplicação, cancelar sem cópia, confirmação posterior, duplicada/cancelar, cinco lições/capítulos, saída de erro e abrir após falha. Não se transforma um botão inspecionado em todo ciclo de servidor. |
| **LC08 / P08** | Carregando/sincronizando e erro contextual, sem conclusão inventada. | V: carregando/sincronizando/vazio/erro/longa. | **Recorte P/I/C fechado.** F-LC `LC08-biblioteca-carga-erro-retorno`: 8 checks por direção, incluindo conservar registros, recuperar e retomar. O ensaio inicial de C supôs o título do layout A; foi preservado e substituído por integridade de activeTrack/progresso/CTA. Não era perda de dados. |
| **LC09 / P09** | Balão nomeado; ponte por trilha/lição; reabrir desafio; ponte e Vale rever independentes. | V: `mapa/ponte-vale-rever`, concluída/Vale rever; V-folhas: balão atual. | **Recorte P/I/C fechado.** F-LC `LC09-12-baloes-ponte-vitoria-retorno`: 8 checks por direção; bloqueado explica, atual nomeia próximo passo, vitória estável, reler, retorno conservando original, ponte própria e reabertura após reload. Q-novos confirma Escape/foco nos balões. |
| **LC10 / P10/P14** | Origem [1], citação/modal, apoio, anterior e reinício confirmado só da tentativa atual; tentativas por trilha+lição; origem no registro da trilha. | V: retomada; V-folhas: apoio/reinício; V-fontes e Q-nome160 registram a falha longa. | **Representação/percurso preenchidos; reflow médio aberto.** F-LC `LC10-tentativas-por-trilha-licao-reinicio`: 8 checks por direção, cancelar/confirmar sem apagar outras tentativas/progresso; caso `LC10-16-17-material-origem-por-trilha` confirma origem, pedido posterior e remoção sem apagar citação. Nome160 continua cortado no cartão/modal. |
| **LC11 / P11** | Parcial aplicável a associação e aberta, acertos mantidos e critérios atendido/rever. | V: associar/aberta parcial; AR: associação360. **Também capturou combinação inválida lacuna+parcial**, registrada abaixo. | **Percurso funcional preenchido; inconsistência e foco abertos.** F-LC `LC11-parcial-preserva-acertos`: 7 checks por direção; dois pares conservados/desativados, reload/corrigir restante, aberta/critério/continuar. Q-novos comprova K5 em verificar/retry. A fixture genérica parcial não pode ser tratada como estado válido de lacuna atômica. |
| **LC12 / P12** | Vitória estável, reler, voltar com tentativa preservada, reabrir pelo mapa. | V: reforço/vencido; AR: vitória390. | **Recorte P/I/C fechado.** F-LC `LC09-12-baloes-ponte-vitoria-retorno` cobre releitura/retorno/reabertura persistida; F1 percorre erro/desafio/correção. Resolva comigo é N/A nesta comparação SQL, fundamentado abaixo. |
| **LC13 / P13** | Enviando cancelável, erro contextual, texto conservado, repetir/concluir sem explicar; áudio ilustrativo com limite de **60 s**. | V: enviando/envio-erro/Activity/permissão/transcrição/gravando. | **Recorte P/I/C fechado.** F-LC `LC13-envio-cancelamento-erro`: 6 checks por direção; pendente sem duplicação, cancelar evita retorno, erro/retry conservam texto, novo envio e permissão negada. F2/F3 e Q-teclado cobrem áudio/histórico e relógio61.000 ms, sem microfone/IA. |
| **LC15 / P15** | Em alta/Novas, paginação de fixtures e memória de ordem/aba/busca/lista/rolagem. | V: novas/paginada/seguindo/vazio/erro; prévia/público. | **Recorte P/I/C fechado.** F-LC `LC15-ordem-paginacao-historico`: 8 checks por direção; ordenar, acrescentar sem duplicar, título recebido, Back com busca/ordem/página/scroll, trocar ordem e seguir/vazio/voltar. F1–F3 complementam cópia/bloqueio/denúncia. |
| **LC16 / P16** | Sem social/social, postagens de **trilhas próprias**, moderação/retirada/desfazer, contador/atividade sintéticos. | V: sete estados pessoais; V-folhas: confirmação; AR: aprovado390/novidades360. | **Postagens preenchidas; foco de cor médio aberto.** F-LC `LC16-postagem-moderacao-retirada-desfazer`: 10 checks por direção; confirmar/cancelar, pendente, retirar/desfazer preservando cópia/progresso/moderação, fixtures e recebida ausente na seleção. Q-novos confirma estados/limites, mas 30 mudanças de cor perdem foco. A seleção correta não aprova o atalho de republicação por outro menu (LC17). |
| **LC17 / P17** | Capa/tema por trilha, prévia/cancelar/aplicar/Padrão e erros por campo; rascunhos próprios. | V: capa e quatro erros por campo; V-folhas: capa selecionada; AR: capa390. | **Personalização preenchida; restrições de compartilhamento médias abertas.** F-LC `LC17-capa-tema-drafts-isolados`: 9 checks por direção; 13 capas/12 temas, cancelar/aplicar/Back/isolamento/validação. Q-novos confirma foco/estados de capa. Falha material→Explorar em F-LC e cópia recebida republicável em probe separado impedem fechamento integral de P17/DG5. |
| **LC18 / P18** | Flags IA/email/API falsos, `iaNecessario=false`; destinatário local antes de consentir e em Privacidade. | V-folhas: destinatário no consentimento/Privacidade; bases. | **Recorte P/I/C fechado.** F-LC `LC18-consentimento-destinatarios-revogacao`: 8 checks por direção; solicitar/abrir/recusar/consentir sem mudar flags, destinatário, cancelar revogação/revogar, preservar estudos e pedir nova permissão. Nenhum provedor real foi chamado. |

**Situação comum A/B/C:** as 14 ausências de desenho têm P e C novas, com interações independentes nomeadas. LC10/LC11/LC16/LC17 mantêm defeitos relevantes abertos na qualidade/consistência dessas representações. “Recorte fechado” nas outras linhas não aprova automaticamente todos os critérios D, a matriz completa ou recursos ausentes nas fixtures. Não foram somadas provas de autoria aos resultados independentes.

**Limites de observação preservados:** no F-LC, câmera/galeria com material anterior foram abertas por query e tiveram suas ações exercitadas; isso não afirma que cada rota completa de troca foi percorrida. Erros cuja saída foi inspecionada não se convertem em chamadas de API ou todos os ciclos de retry. A QA R5 não repetiu o título técnico longo da R4 em lote separado; seus105 quadros com `s=longa` não o aprovam. O parecer visual conferiu título80 em seu conjunto próprio, com a proveniência dessa suíte. Esses recortes devem continuar distinguíveis na regressão seguinte.

## Provas independentes disponíveis

| Alias | Artefato da R5 | Alcance e limite |
| --- | --- | --- |
| **F1** | `/workspace/work/revisao-fluxos-r5/resultado.json` e `revisar-regressao.cjs` | Finalizado: **147/147**, 12 cenários, três direções, 390 px; zero falhas/exceções. |
| **F2** | Mesma pasta: `novos-resultados.json` e `novos-fluxos.cjs` | Finalizado: **207/207**, 33 cenários; inclui seis formatos, revisão, mídia/código/social/visitante. |
| **F3** | `integracao-resultados.json` e `regressoes-integracao.cjs` | Finalizado: **51/51**, 12 cenários; descrição, foto, denúncia e áudio. |
| **F4** | `fronteiras-resultados.json` e `fronteiras-e-trilha-completa.cjs` | Finalizado: **111/111**, 6 cenários; descrições/trilhas e curso até 5/5. F1–F4 totalizam **516 asserções**, não 516 variantes. |
| **F-LC** | `riscos-lc-resultados.json`, `riscos-lc.cjs`, `notas-e-contagens.json` | Finalizado, fonte estável: **369/372**, 42 cenários em360. Com F1–F4: **885/888 asserções/105 cenários**, 296 por direção, zero exceções/JS. LC08 foi rechecado com integridade de registro/CTA; ensaio anterior e rechecagem preservados. |
| **F-cópias** | `copias-probe.json`, `copias-probe.cjs` | Três reproduções separadas de cópia recebida republicável. **Não somadas** às 888 asserções. |
| **V** | `/workspace/work/revisao-visual-r5/casos.json`, `resultado.json` | Finalizado, 17 hashes estáveis: **128 quadros ×3 direções ×2 larguras ×2 escalas = 1536 vistas/PNGs**. Conteúdo padrão sem falha de overflow/rodapé ou JS. |
| **V-folhas** | Mesma pasta: `folhas.json` | Finalizado: **9 folhas ×12 combinações =108 vistas**; balão, apoio, reinício, destinatários, capa, confirmação de postagem e picker. Sem overflow/rodapé/caseerrors nos casos examinados. |
| **V-eventos** | `eventos.json` | 12 capturas, **15 verificações** de chegada de conteúdo/cancelamento; sourceStable/sameAsMainCapture verdadeiros. |
| **V-longos/fontes** | `longos.json`, `fontes.json` | **360 vistas de dados longos, 24 falhas** na lição com nome de material sem espaços; **12 casos** de fonte/dialog confirmam o problema. Não transformar sucesso do conteúdo padrão em aprovação desses dados. |
| **Q** | `/workspace/work/revisao-a11y-r5/matriz.json` | Finalizado: **210 bases DPR2, 90 estados, 105 páginas ampliadas**; hashes estáveis. A seleção de estados é menor que V; não somar conjuntos sobrepostos como variantes únicas. |
| **Q-teclado** | `teclado/resumo.json`, `foto-guards.json`, `limite-audio.json` | Fonte estável: **186/186** dirigidos, **42/42** guards de foto, sem achado aberto neste recorte; relógio de áudio controlado. Não aprova seletor nativo. |
| **Q-novos** | `novos-modulos/resultados-resolvidos.json`, `RELATORIO-NOVOS-MODULOS-R5.md` | Finalizado: **1.200 registros efetivos, 1.164 positivos/36 negativos** (30 de cor, seis de Associar/K5). `rechecagens.json` tem78 positivos:24 substituem expectativas do harness e54 são adicionais; não somar78 novos. Fonte17/17 estável. |
| **Q-K5** | `novos-modulos/exercicios-foco.json` | **120 transições** confirmam perda de foco: errado/retry/correto dos seis formatos e retries parciais. Seis acertos de Associar sobrepõem Q-novos; não somar novamente. |
| **Q-estados novos/nome** | `estados-novos.json`, `material-nome160.json` | 150 estados diretos e51 a200%, sem problema métrico padrão; nome160 em seis casos/12 capturas falha na origem/modal. Não equivalem a percursos funcionais. |
| **AR** | [Parecer de arte R5](revisoes/PARECER-ARTE-CRAFT-R5.md); `/workspace/work/revisao-arte-craft-r5/evidencias.json` | **42 PNGs novos abertos**, hashes estáveis; D4=9 no recorte, dois baixos abertos. Não aprova R6 futura nem a matriz inteira. |

As suítes de autoria de material, personalização e jornada estão registradas nas respectivas notas. Elas validam a autoria e ajudam a reproduzir estados; seus números não entram na soma independente acima. As provas V/Q/F/AR têm sobreposições: não produzir um total de “fluxos únicos” somando todos os registros. Falhas iniciais de seletor/expectativa foram preservadas; a R5 não herdou resultados positivos de rodadas antigas.

## Achados que impedem aprovação integral

1. **Material enviado ao Explorar — médio, P17/LC17.** Criar trilha a partir de PDF, conferir sua origem, abrir Compartilhar pelo mapa e escolher Explorar permite enviar e guardar `visibility=explorar`, `publicationStatus=pendente`, apesar da restrição. Reproduzido em A/B/C: três falhas do F-LC. A aprovação simulada não precisa chegar para o comportamento já contrariar a regra. Não é alegação de publicação/vazamento real no servidor.
2. **Cópia recebida republicável — médio, P15/P17.** A seleção de Postar no perfil oculta a cópia corretamente, mas menu do mapa→Compartilhar permite publicar a mesma cópia em revisão. Três reproduções em F-cópias. Um gate correto em um caminho não aprova os demais caminhos de entrada.
3. **Nome válido de material sem espaços — médio, P10/LC10, D3/D6.** Nome de160 caracteres transborda no cartão Origem e no diálogo [1], em texto100/200%. Apoio expandido e cabeçalho do título são casos diferentes e passaram; não generalizar seu sucesso.
4. **K5 — médio, P11/LC11, D6.** Verificar e Tentar de novo substituem o controle sem sucessor focável; foco fica em BODY e Tab volta à saída da lição. A resposta e os acertos permanecem visualmente, mas teclado perde posição. Evidência Q-K5, seis formatos nas seis combinações.
5. **Troca da cor — médio, P16/LC16, D6.** Trocar para cinco cores muda prévia/estado, porém a restauração encontra avatar não focável antes do botão `data-hue`; foco fica em BODY. Trinta falhas em Q-novos. Cor atual preserva foco e não prova a troca.
6. **Parcial genérico incoerente — P11/LC11, clareza/consistência.** A bancada oferece `exercicio&s=parcial` sem formato; o quadro é a lacuna atômica, mas o feedback fala “complete sua explicação” e “0 de3 pares corretos”. Confirmado em V `jornada-exercicio-parcial-100-390.png` e no texto renderizado do JSON; também foi aberto pelo revisor de arte. Normalizar a demonstração para Associar/Aberta ou limitar a combinação aplicável; não inventar parcial para uma resposta atômica. O percurso real parcial desses dois formatos passou, o que não valida essa combinação oferecida.

O [parecer de arte](revisoes/PARECER-ARTE-CRAFT-R5.md) mantém os dois refinamentos **baixos** de pilha fixa de ações e legenda repetida da fixture. Eles são distintos dos médios de reflow, foco e restrição acima; nenhuma correção futura recebe aprovação antecipada.

## Condicionais e N/A reconciliados

- **Resolva comigo:** as cinco lições SQL de `src/servidor/ia/falsa.ts` (WHERE, INNER JOIN, AND, filtro+junção e LEFT JOIN) não fornecem `resolucao`. O recurso é condicionado a esses dados e ao callback: `apps/mobile/src/resolva-comigo.tsx:216` retorna `ativo:false` sem resolução/estado/responder. N/A nesta comparação SQL; Sua vez, reforço, origem e apoio continuam no escopo. Não é aprovação do recurso quando outra lição o oferece.
- **Reinício global da trilha:** N/A; a fonte de produção consultada não fornece ação de apagar todo o progresso por “refazer”. Rever nó concluído abre a lição. Reinício da tentativa atual existe no produto e está em LC10, com confirmação/cancelamento; não foi excluído.
- **Perfil:** postar significa selecionar **trilhas** para o perfil, com visibilidade/moderação. Não existe botão global de publicar/despublicar cadastro a exigir. Visitante não ganha controles de postagem e cópias recebidas permanecem fora da seleção de publicação.
- **IA/provedores:** flags locais declaram IA falsa, email falso, API falsa, `iaNecessario=false` e destinatário simulador local. Google/Apple são cenas de acesso simuladas. A lista de provedores reais e a sessão remota não são inferidas de uma cena.
- **Nativo e voz ao vivo:** câmera/galeria/seletor, OCR, microfone, AppState, permissões/folha nativa, VoiceOver/TalkBack e APIs não foram executados. Voz ao vivo não é oferecida nesta bancada. A representação local dos erros/permissões continua no escopo e está separada desses limites.
- **Arte final:** Stu caderno original segue pendente. O personagem provisório e a composição HTML não aprovam branding final, intro nativa, desempenho ou uso por estudantes.

## Gates neste retrato

- **DG1/D10 integral:** a ausência de representação dos14LC foi preenchida e os percursos nomeados terminaram. A combinação demonstrativa incoerente e os defeitos relevantes impedem usar essa constatação como aprovação integral de consistência/cobertura. D10 global permanece **null** nesta ficha, com cada prova e limite explícitos.
- **DG2:** os percursos positivos nomeados têm prova; não se afirma aprovação de todos os caminhos por um contador de asserções.
- **DG3:** **reprovado** pelo nome longo da origem/modal; exige nova candidata e nova prova.
- **DG4:** **reprovado** por K5 e troca de cor, embora os186 checks dirigidos comuns e42 guards de foto passem. Não usar a primeira suíte para apagar a falha dos novos módulos.
- **DG5:** **reprovado** pelas restrições de material/cópia recebida; estado pendente de moderação não legitima a submissão indevida.
- **DG6/nota global:** **sem aprovação**, pois há médios abertos. A nota D4=9 no recorte de arte não é nota global da direção. Não arredondar nem usar média entre propostas para ocultar uma variante.

Uma candidata posterior deve guardar fonte e novas provas próprias. Esta ficha continua sendo R5 mesmo quando existirem alterações ou capturas R6 no workspace.
