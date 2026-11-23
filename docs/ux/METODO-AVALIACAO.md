# Método de avaliação de UX do Studoo

Versão 1.0 · 23/11/2026 · escala de 0 a 10 · meta do dono: **mínimo 9,5 por fluxo**, na web e no app.

Este método avalia uma tarefa completa, seus estados e suas saídas, não apenas uma captura bonita. A rodada atual executa **somente a assinatura de abertura da marca no boot (startup/splash)**. Ela não é o tutorial de cinco cenas de `Apresentacao`: o onboarding existente continua como está e recebe somente conferência de regressão adjacente. O inventário abaixo organiza as próximas avaliações; não autoriza implementá-las. Direções e exemplos de repaginação da UI ficam para depois da assinatura de abertura finalizada.

O [modelo de ficha](FICHA-AVALIACAO.modelo.json) começa sem notas e sem testes declarados como executados. Esta documentação, por si só, não atribui nota à intro, ao app nativo ou ao produto inteiro.

## 1. Contratos e unidade de avaliação

As [regras do projeto](../REGRAS-DO-PROJETO.md) e a [spec 07](../specs/07-paridade-web-mobile.md) são a referência: mesma largura, mesma ordem, textos, tamanhos, ícones e comportamento; diferença de plataforma precisa estar na tabela da spec 07. Até 600 px, a ação principal fica visível sem rolar, na largura toda e antes das saídas secundárias do seu conjunto de ações. Textos vêm de `packages/contratos/src/experiencia.ts`.

Também se aplicam as specs [04, experiência](../specs/04-experiencia-ilustrada.md), [05, navegação e movimento](../specs/05-navegacao-mobile-movimento.md), [11, componentes](../specs/11-componentes-do-studoo.md), [12, som](../specs/12-som.md) e [13, Stu](../specs/13-mascote-oficial.md). A identidade é do Studoo: sem copiar aparência de outro produto e sem XP, ranking, sequência de dias, moeda ou medalhas. A nota deste método é ferramenta interna de revisão, não pontuação para estudantes.

Cada ficha fixa antes da revisão: objetivo da pessoa, entrada e saída esperadas, commit, dados e flags, variantes, dispositivos, versões, larguras, conexão, preferências e orçamento de tempo. Mudança relevante no código invalida a evidência afetada; não misturar capturas de commits diferentes como se fossem um par.

O contrato da rodada atual é [`@studoo/contratos/abertura`](../../packages/contratos/src/abertura.ts): marca estática de 180 × 59,14 sobre `#FFFFFF`; uma acomodação opcional de até 320 ms, somente com movimento permitido confirmado, escala máxima 1,015 e deslocamento máximo 2 px; saída por dissolve de 120 ms assim que fontes/imagem/primeiro frame locais estiverem prontos, sem aguardar API e sem tempo mínimo de exposição. O teto da camada React é 900 ms desde sua montagem; a guarda de emergência do splash nativo conta 900 ms desde a execução do módulo JavaScript. O tempo anterior do sistema operacional não entra nessa medição e exige observação em um novo build nativo. Movimento reduzido, falha, interação ou segundo plano encerram a assinatura; preferência ainda desconhecida não autoriza animar. Callback, link direto e retorno com consulta/fragmento fazem bypass. Não repetir ao navegar entre rotas nem ao voltar ao primeiro plano. Prontidão da tela seguinte e teto da assinatura são medidas distintas: a assinatura não pode esconder uma espera de rede.

**Superfícies distintas:** `web`, `app_previa_web`, `ios_nativo` e `android_nativo`. A prévia React Native Web ajuda a conferir layout e contrato; não comprova gestos, foco assistivo, áudio, permissões, armazenamento ou desempenho nativos. Simulador, emulador e aparelho são origens diferentes e devem ser nomeados. Um teste de código não vira uma experiência de uso observada.

## 2. Dez critérios, com pesos fixos

Os pesos somam **100**. Não mudam depois de conhecer as notas. Para cada critério registrar evidência, métrica, resultado esperado, resultado observado e limites; o revisor explica a nota em uma frase verificável.

| ID | Critério | Peso | O que observar e medir |
| --- | --- | ---: | --- |
| C1 | Clareza do valor e dos textos | 12 | O percurso apresenta o que o Studoo oferece e o próximo passo com rótulos concretos e promessas coerentes com conta/visitante e IA. Evidência interna: inspeção dos textos e percurso gravado; compreensão com pessoas reais só é resultado quando observada separadamente. |
| C2 | Ação principal e autonomia | 12 | Começar, avançar, voltar, pular/cancelar e sair levam ao destino esperado, sem espera obrigatória pela animação nem toque duplicado em ação já visível. Um toque na marca ainda opaca somente a dispensa e não aciona um controle oculto ou áudio; durante o dissolve, as ações reveladas já aceitam interação. Medir conclusão sem ajuda, desvios e ações sem resposta. |
| C3 | Hierarquia, leitura e adaptação | 12 | Texto, arte e CTA cabem sem cortes, sobreposição ou rolagem horizontal involuntária; área segura e teclado não cobrem ações. Medir caixas, dobra e leitura com texto ampliado; guardar capturas na mesma largura. |
| C4 | Identidade e acabamento visual | 8 | Stu, marca, paleta, tipografia, ícones e estados têm função e consistência; sem distorção, serrilhado evidente, mudança brusca de escala ou decoração que esconda conteúdo. Evidência: quadros em repouso e vídeo, com ocorrências localizadas. |
| C5 | Movimento e som com controle | 10 | Cada efeito explica uma mudança; não força espera, disputa com leitura nem recomeça sem motivo. Movimento reduzido mantém informação/ações; segundo plano pausa o que deve pausar; som respeita preferência e gesto. Medir duração, interrupção e estado final. |
| C6 | Acessibilidade e foco | 14 | Contraste, nomes/papéis/estados, sequência de leitura, toque, teclado e leitor de tela permitem a mesma tarefa. Medir contraste e alvos; registrar percurso de foco e anúncios, incluindo troca de etapa, diálogos e retorno. |
| C7 | Resposta e espera | 10 | Ação recebe retorno imediato, trabalho longo mostra estado verdadeiro e cancelamento, falha de asset/rede não prende a pessoa. Medir tempos do evento ao retorno e ao destino, partida fria/quente e travamentos, no ambiente identificado. |
| C8 | Feedback, erros e recuperação | 10 | Acerto/erro/carga/vazio/indisponibilidade são distinguíveis sem depender só de cor; repetir/cancelar é seguro e preserva o que deve preservar. Medir recuperação, duplicidade, perdas e erros não tratados. |
| C9 | Continuidade e confiança | 6 | Reabrir/retomar, preferências, consentimentos e dados refletem o estado real; a ilustração não finge progresso salvo. Medir estado antes/depois e persistência conforme contrato, sem expor dados pessoais. |
| C10 | Paridade e integração de plataforma | 6 | Mesma tarefa e estados na web/app, pares em 390×844 e 360×800, com diferenças apenas documentadas na spec 07. Conferir também voltar, safe area, preferência e integração real de cada plataforma; registrar a origem da evidência. |

**Aplicação à assinatura de abertura:** C1 verifica identidade reconhecível e ausência de promessa de carregamento falsa; não exige slogan, explicação de valor, áreas de interesse ou tutorial. C2 verifica passagem imediata e ausência de bloqueio, sem exigir botão ou novo gesto para sair. C3/C4 conferem a marca nas medidas/fundo do contrato; C5/C7 conferem acomodação, prontidão, bypass e teto; C6 confere foco e ausência de anúncio decorativo indevido; C8/C9 conferem falhas, callbacks e não repetição. A abertura não cria progresso, preferência de onboarding nem dado de estudo.

### Âncoras aplicáveis a cada critério

| Nota | Âncora observável |
| ---: | --- |
| 0 | O requisito aplicável falha por completo ou impede a tarefa: conteúdo inacessível, ação sem saída, perda de dados ou comportamento enganoso. Precisa de evidência da falha; ausência de teste é `null`, não zero. |
| 5 | Parte da tarefa funciona, mas exige ajuda, tentativa evitável ou contorno recorrente. Há defeito reproduzível que afeta entendimento, controle ou leitura. |
| 8 | O caminho principal é sólido, mas uma variante relevante ou recuperação tem defeito perceptível. Há dívida concreta a corrigir; não significa “quase 10” sem verificar os outros estados. |
| 9,5 | Todas as verificações aplicáveis do critério têm evidência e cumprem o contrato e as metas declaradas. Não há defeito crítico, alto ou médio aberto. Pode sobrar detalhe de acabamento baixo, localizado, que não altera compreensão, operação ou confiança. |
| 10 | Além de 9,5, o conjunto declarado de variantes e verificações independentes não apresenta defeito aberto nesse critério, inclusive de acabamento; métricas e verificações diretas sustentam a conclusão. É o teto do escopo testado, nunca alegação de perfeição universal. Nota de revisão especializada continua identificada assim, mesmo sendo 10. |

Pode-se usar uma casa decimal entre âncoras, explicando o que avançou e o que falta. **“Gostei”, “parece bom”, teste verde, ausência de reclamação ou evidência ausente não justificam 10.** `9,49` não alcança a meta por arredondamento. Números de usuários, tempos e taxas só entram como resultados quando realmente coletados.

`aplicavel`: precisa ser observado. `nao_aplicavel`: não existe nessa tarefa/variante, com motivo e concordância do consolidador. `nao_exposto`: a flag desliga o recurso no ambiente; não comprova seu funcionamento quando ligado. Falta de aparelho, leitor de tela, rede ou participante é **lacuna de evidência aplicável**, nunca justificativa para remover peso.

## 3. Gates eliminatórios

Cada gate tem `aprovado`, `reprovado`, `pendente` ou `nao_aplicavel`, com evidência e motivo. Falha impede aprovação, independentemente da média. Falta de prova mantém `pendente`; não aprovar por inspeção visual aquilo que exige interação.

| Gate | Condição de aprovação |
| --- | --- |
| G1 · Acesso | O fluxo abre nos modos previstos, permite chegar à ação principal e sair sem login/permissão indevidos, crash, tela vazia ou controle inalcançável. Não exige áudio, animação ou gesto não alternativo para entender/seguir. |
| G2 · Movimento | Redução de movimento preserva conteúdo e ações em estado estático; não há efeito piscante perigoso, animação que prende a navegação ou ciclo que continua indevidamente em segundo plano. Preferência desconhecida/falha usa estado seguro, como a spec 05. |
| G3 · Latência | Cumpre o orçamento declarado e não depende do fim da animação para aceitar ação. Na assinatura: acomodação configurada ≤ 320 ms, dissolve configurado de 120 ms a partir da prontidão local, sem mínimo de exposição, sem aguardar API e camada React limitada a 900 ms desde a montagem; interrupções/bypass não esperam esses tempos. Registrar início, prontidão, começo/fim da saída e causa do encerramento, em boot frio e quente. O teto vale para cada execução, não só para média/p95. Durações configuradas e tempo observado são registros separados. |
| G4 · Foco e acesso assistivo | Tarefa completa por teclado na web e por leitor de tela/toque no nativo; foco visível e nunca escondido pelo rodapé, ordem previsível, sem armadilha ou anúncio de página oculta. Texto a 200% continua operável; contraste AA (4,5:1 texto comum, 3:1 texto grande/elementos aplicáveis), alvos de 44 px e CTA de 48 px conforme specs. |
| G5 · Erros e integridade | Nenhum erro não tratado, ação destrutiva sem confirmação, conclusão falsa, duplicação ou perda indevida. Indisponibilidade de rede/asset/permissão tem saída/repetição segura. Promessas sobre IA, demonstração e persistência correspondem aos dados reais. |
| G6 · Paridade | Pares, textos e percurso equivalentes no mesmo commit; diferenças restantes constam da spec 07, com motivo técnico. Assets e cenas não resolvem apenas uma plataforma. Prévia não aprova integração nativa. |

Cada fluxo registra seus próprios limites antes da medição; os tempos de 320/120/900 ms são específicos da assinatura, não orçamento da geração de trilha ou de uma operação de rede. Uma operação longa pode ter orçamento próprio; isso não permite bloquear o retorno do toque. Um bloqueio reproduzido em qualquer superfície aplicável é bloqueio do fluxo, mesmo com web excelente.

## 4. Evidência e revisão independente

Registrar artefatos reproduzíveis com ID, origem, commit, data, estado/flags, dispositivo/versão, viewport/font scale, movimento/som, conexão, passos e resultado. Cada métrica inclui unidade, amostras, método e orçamento. Logs/capturas compartilhados são sanitizados: sem tokens, chaves, sessões ou dados de pessoas reais. Preferir dados sintéticos, IA falsa e email falso para a rodada local; não chamar isso de prova de IA real ou de login de produção.

Separar evidência de **código/teste**, **captura**, **interação gravada**, **medição** e **observação com pessoa**. Links históricos ajudam a localizar o problema, mas não validam a candidata atual. Guardar a ficha e os artefatos sanitizados acessíveis na tarefa, indicando quando um arquivo bruto depende do workspace.

Três revisores independentes avaliam a mesma candidata, sem editar durante a revisão nem copiar notas entre si. Um autor pode explicar a implementação, mas não é o único aprovador dela. Os pareceres são fechados antes da consolidação e apresentados nesta ordem:

1. **Visual:** C3/C4/C5 e paridade visual. No máximo três achados prioritários, cada um com estado, evidência e efeito na tarefa; depois as notas justificadas.
2. **Fluxo e acessibilidade:** C1/C2/C6/C9, teclado/leitor de tela, compreensão, controle e saídas; mesma forma concisa.
3. **Engenharia e QA:** C7/C8/C10, estados de falha, regressões, métricas e limites da execução nativa; mesma forma concisa.
4. **Consolidador:** confere os seis gates, cobre os dez critérios e publica nota, estado e próximo bloqueio concreto. Toda nota de 9,5 ou mais recebe confirmação de outro revisor ou nova evidência independente.

Cada papel pontua os critérios que examinou. Um critério fora da especialidade ou ainda não visto por aquele revisor fica `null`, sem ser chamado de não aplicável ao fluxo. Para a consolidação, cada critério aplicável precisa de ao menos um parecer competente com prova e da confirmação adicional das notas altas; não é necessário que três especialistas inventem notas para os mesmos dez itens.

Observação com pessoas é uma camada separada da revisão especializada interna. Quando planejada, definir participantes e tarefas conforme o risco, dar o objetivo sem ensinar os controles e registrar conclusão sem ajuda, hesitações/erros e entendimento, com contagens e denominadores. Não há tamanho de amostra universal nem recrutamento obrigatório para aceitar uma revisão interna. Na assinatura, uma futura observação pode verificar reconhecimento da marca e se a abertura atrasa ou confunde a chegada à tarefa seguinte, sem exigir uma explicação do produto. Sem executá-la, registrar **validação empírica não realizada**: a nota é de revisão especializada, não prova de satisfação, compreensão de toda a população ou comportamento em produção.

## 5. Consolidação sem compensação de defeitos

Para o critério `i`, usar a menor nota sustentada pelos pareceres independentes aplicáveis. Uma divergência só muda após reproduzir o caso e registrar a decisão com evidência; não escolher a nota maior por preferência, nem fazer média das opiniões.

Por superfície, com todos os critérios aplicáveis cobertos:

`nota = soma(peso_i × nota_i) / soma(pesos_aplicaveis)`

Se houver exclusão realmente não aplicável, mostrar também o peso excluído e o motivo. Se um critério aplicável estiver sem evidência, a nota dessa superfície é `null`: mostrar cobertura de evidência e achados, sem normalizar a falta para cima. Não transformar critérios sem avaliação em 10. A prévia do app recebe relatório separado e não entra como substituto de iOS/Android.

Publicar duas conclusões distintas:

- **Revisão especializada interna no escopo testado:** lista fechada de superfícies e variantes, com notas próprias e gates por superfície. Sua nota consolidada é a menor nota desse escopo, sem média entre web e prévia. Pode atingir 9,5 e ser aceita internamente se toda a evidência desse escopo estiver completa. Por exemplo, “revisão interna da intro em web e prévia React Native Web”; isso não recebe o nome “app iOS validado”.
- **Entrega multiplataforma completa:** considera web, iOS e Android quando são alvos da entrega. Usa a menor nota delas; se alguma não foi observada, a nota completa é `null` e o estado é **Provisório**, com a lacuna nativa explícita. A prévia não preenche essa falta. A validação empírica com pessoas/produção tem seu próprio estado, sem nota fabricada nem transferência automática de uma avaliação à outra.

Não publicar “Studoo 9,5” a partir da intro: uma nota do produto exigiria avaliar os fluxos do inventário, mantendo seus gates e seus mínimos. A meta continua 9,5 no escopo declarado; seu significado é revisão especializada sustentada, não UX perfeita ou universal.

| Estado | Regra |
| --- | --- |
| Não avaliado | Só há plano/modelo; nenhum parecer executado. |
| Em revisão | Evidências/pareceres ainda estão sendo reunidos. |
| Bloqueado | Algum gate reprovado ou defeito crítico/alto aberto. Nota ponderada não libera a entrega. |
| Provisório | Falta evidência aplicável ao escopo em questão. Na entrega completa, inclui nativo não observado; na revisão interna, inclui uma variante ou tecnologia de acesso declarada no seu próprio escopo e não conferida. Declarar exatamente a lacuna; não chamar a meta desse escopo de atingida. |
| Fora da meta | Evidência completa e gates aprovados, mas nota final abaixo de 9,5 ou algum critério abaixo de 9. |
| Aprovado no escopo | Gates do escopo aprovados; evidência atual completa nesse escopo; três pareceres; nota **≥ 9,5**, nenhum critério abaixo de 9 e nenhum defeito crítico/alto/médio aberto. Citar superfícies/variantes e limites. Sem teste com pessoas, continuar informando “revisão especializada interna; validação empírica não realizada”. |

Gravidade: crítico impede acesso, perde/exibe dados indevidamente ou engana sobre conclusão; alto impede uma variante essencial/tecnologia assistiva; médio causa hesitação, erro ou contorno evitável; baixo é acabamento sem impacto na tarefa. Defeito médio limita o critério afetado a 8 até correção e nova prova. Corrigir e repetir apenas os casos afetados e a regressão necessária; não aumentar nota por adicionar testes que espelham a implementação.

## 6. Inventário e ordem das próximas avaliações

Levantamento por código/specs, **sem executar estes fluxos nesta ficha**. Impacto (I), risco (R) e frequência (F) são estimativas qualitativas A/M/B para organizar trabalho, não analytics. Risco considera acesso, dados, aprendizagem e recuperação; frequência considera cada oportunidade de uso, incluindo primeiro acesso. Flags e conteúdo determinam quais variantes aparecem.

**Ordem:** intro agora; depois P0 (núcleo/acesso/progresso), P1 (risco alto ou tarefa complementar) e P2 (descoberta/relacionamento), com os transversais em cada rodada. Dentro da mesma faixa, priorizar risco, impacto e frequência, nessa ordem. Segurança/privacidade sobe de faixa se surgir falha concreta. Operação de equipe é uma avaliação separada.

| ID / faixa | Jornada e variantes a incluir | I/R/F | Fonte principal |
| --- | --- | --- | --- |
| F01 · atual | Assinatura de abertura no boot: frio/quente, marca estática, acomodação permitida, prontidão local/saída, teto, fonte/imagem com falha, movimento reduzido/desconhecido, interação/background, bypass de OAuth/link direto, sem JS e não repetição. | A/A/A no boot | `packages/contratos/src/abertura.ts` e renderizadores da candidata |
| F02 · P1; regressão adjacente agora | Onboarding/tutorial existente: abrir/rever as cinco cenas, avançar/voltar, pular/fechar, interesse e destino de visitante/conta. Nesta rodada, conferir somente que os caminhos atuais continuam funcionando, sem redesenhar ou confundir com a assinatura do boot. | A/M/A no primeiro uso | `src/app/apresentacao.tsx`, `apps/mobile/src/apresentacao.tsx`, spec 04 |
| F03 · P0 | Entrada/sessão: email/senha, mostrar senha, Google/Apple quando disponíveis, visitante, cancelar provedor, credencial inválida, rede, restaurar/expirar e sair/confirmar. | A/A/A | `src/app/login/entrada.tsx`, `apps/mobile/src/sessao.tsx`, spec 06 de acesso |
| F04 · P0 | Cadastro/recuperação: email/código/senha, reenviar, incorreto/expirado, voltar e ajuda; conforme flags. | A/A/B | `cadastro.tsx`/`recuperar.tsx` nos dois, spec 06 de acesso |
| F05 · P0 | Pedido: objetivo, sugestões/tema, validações/limites, editar/preservar rascunho, aceite de IA quando necessário. | A/A/A | `estudo.tsx` nos dois, specs 03/04 |
| F06 · P0 | Geração/aceite: título/nós/andamento verdadeiro, rolar/acompanhar, cancelar, falha de rede/IA/limite, repetir, ajustar, pronta/expirada, abrir lição 1 e falha da passagem. | A/A/A | `estudo.tsx`/geração nos dois, specs 01/03/04 |
| F07 · P0 | Minhas trilhas/mapa: vazio, lista, abrir/retomar, nós bloqueados/atuais/concluídos, partes/balão, próxima lição, Vale rever, ponte e trilha concluída. | A/A/A | `estudo.tsx`/`caminho.tsx` nos dois, specs 01/05 de navegação |
| F08 · P0 | Aula: conceito/exemplo, conteúdo longo, origem/citações, consultar recursos, etapa anterior/avançar, X/voltar, rodapé/andamento e retorno ao mapa. | A/A/A | `src/app/aula.tsx`, `apps/mobile/src/licao.tsx`, spec 02 |
| F09 · P0 | Exercícios, em fichas separadas: lacuna; múltipla escolha; ordenar por arrasto e alternativa acessível; associar iniciando dos dois lados; verdadeiro/falso e justificativa; resposta aberta e critérios. | A/A/A | Formatos web/app, spec 08 de assuntos, `packages/contratos/src/licao.ts` |
| F10 · P0 | Correção: incompleto, verificar, acerto/parcial/erro, dica, preservar acertos, nova tentativa, consultar/rever, pular, revisão rápida, seguir sem acertar e comprovante expirado. | A/A/A | Aula/exercícios nos dois, spec 02 |
| F11 · P0 | Concluir/salvar/retomar: resumo, progresso no servidor, desbloqueio, voltar, reabrir sessão/outro dispositivo, refazer/recomeçar com confirmação; separar conclusão de andamento parcial. | A/A/A | `estudo.tsx` nos dois; andamento em `src/app/aula.tsx` e `apps/mobile/src/rascunho.ts`; specs 01/02 |
| F12 · P1 | Material: arquivo/câmera/galeria, permissão negada, formatos/tamanho, upload/leitura, prévia/citação, remover/trocar, corrigir/expirar e gerar; OCR real não é comprovado por IA falsa. | A/A/M | Estúdio nos dois, spec 05 adaptativa |
| F13 · P1 | Reforço: outro caminho, explicação/exemplo/desafio, errar/repetir/vencer/reabrir e voltar ao original; Resolva comigo, passos/Sua vez/figuras/fórmulas. | A/A/M | `resolva-comigo.tsx`/estúdio nos dois, specs 02/05/08 |
| F14 · P1 | Prática/multimodal: tarefa/checklist, cronômetro iniciar/pausar/retomar/recomeçar, sem cronômetro, Como foi/mais prática/concluir; frases/transcrição, acorde/batida, diagramas e fórmulas. | A/M/M | Aula/formatos nos dois, specs 02/08/12 |
| F15 · P1 | Explique: texto, gravar após ação explícita, microfone/Activity indisponíveis, negar/parar/limite/segundo plano, revisar transcrição, enviar/retorno/falha/repetir; voz ao vivo onde oferecida. | A/A/M | Estúdio/voz nos dois, specs 05 adaptativa/08 de voz |
| F16 · P1 | Configurar/apagar trilha: nome/descrição, capa padrão/galeria/foto/recorte, tema/visibilidade, salvar/erro por campo, apagar/cancelar e consequência para links. | A/A/B | `configuracoes.tsx` nos dois, spec 10 |
| F17 · P1 | Compartilhar/receber: perfil mínimo, avisos de material, link/perfil/Explorar, copiar/folha/Código Studoo/imagem/apresentação, parar, link próprio/já adicionado/inativo, adicionar e estudar cópia. | A/A/M | Social/compartilhar nos dois, `/t/[codigo]`, specs 09/10 |
| F18 · P1 | Perfil: sem social/visitante e social, nome/cor/resumo/interesses, foto/recorte/remover, salvar/sair sem salvar, alcance, postar/despostar, página pública e novidades. | M/A/M | `perfil.tsx` nos dois; `src/app/postar-no-perfil.tsx` e `apps/mobile/src/postar-perfil.tsx`; specs 09/10 |
| F19 · P1 | Privacidade/segurança: consentir/revogar IA, política, excluir conta, denúncia/protocolo, bloquear/desfazer/desbloquear, lista e conteúdo em moderação, regras/suporte. | A/A/B | Privacidade/segurança nos dois, spec 14, `/privacidade`, `/suporte` |
| F20 · P2 | Explorar/relações: Todos/Seguindo, tema, Em alta/Novas/paginação, vazio/erro, perfil/trilha, estudar/continuar, Valeu/seguir, retorno preservando lista/rolagem. | M/M/M | `comunidade.tsx` nos dois, `/explorar`, `/p/[id]`, spec 10 |
| F21 · transversal | Som: música/efeitos, gesto inicial, carregar/erro, preferência persistida, silencioso iOS e segundo plano; nenhum efeito obrigatório para compreender. | M/M/A | `som.tsx`/players nos dois, spec 12 |
| F22 · transversal | Navegação/acesso: abas, histórico/voltar/gesto, teclado, safe areas, scroll, texto ampliado, foco/leitores de tela, movimento reduzido, menus/folhas/confirmações, offline e sessão expirada. | A/A/A | Specs 05 de navegação/07/11, componentes nos dois |
| F23 · equipe | Operação restrita: acesso negado, filas de denúncia/publicação/foto/capa, manter/remover/aprovar e responder suporte. Só web/equipe; não é lacuna do app do estudante. | A/A/B | `/equipe/moderacao`, spec 14 |

Verificar as flags reais de `/api/auth/config` na ficha; flags desligadas não provam defeito nem aprovação de um recurso. As specs podem conter diagnósticos históricos: conferir estado no código e na execução da candidata. Gaps documentados que não podem sumir da avaliação: páginas públicas/suporte no navegador do app (P20/P22), voz ao vivo ausente do binário nativo (V1) e andamento parcial da aula por um dia na web versus enquanto o app está aberto (spec 02). Nenhum deles autoriza prometer sincronia de rascunho ou inventar uma nota nativa.

## 7. Roteiro da rodada atual: somente assinatura de abertura

1. Fixar commit, renderizadores e contrato de abertura; registrar quais rotas recebem a assinatura, quais fazem bypass e qual tela deve aparecer depois. Separar boot frio/quente, estado de sessão e cache local. Não alterar nem pontuar como nova intro o tutorial `Apresentacao`.
2. Registrar marca e transição na web e na prévia do app em 390×844 e 360×800; acrescentar 390×667, web 768/1440, áreas seguras e movimento reduzido. Conferir 180 × 59,14, proporção e fundo branco; não exigir cenas, legenda, slogan ou CTA dentro da marca.
3. Medir início/prontidão local/saída/fim em frio e quente. Forçar prontidão imediata e tardia, falha de fonte/imagem e API lenta/offline: sem tempo mínimo, sem espera de 320 ms para concluir e nunca aguardar a API. Verificar o teto de 900 ms e registrar causa do encerramento; confirmar que só há dissolve de 120 ms quando apropriado.
4. Interagir por toque/tecla durante a assinatura; alternar movimento reduzido, falha/ausência da preferência e segundo plano antes/depois de ready. Conferir saída sem bloqueio, limpeza de timers e ausência de repetição em rota, foreground e remontagem de rotina. No nativo, distinguir o splash do sistema da assinatura React; a combinação não pode somar uma espera de marca indevida.
5. Abrir callbacks OAuth, links diretos, consultas/fragmentos e rotas de estudo: preservar destino, sessão e parâmetros, sem assinatura interceptando. Na web sem JavaScript, conferir HTML utilizável sem overlay que retenha a pessoa. Conferir teclado/foco, árvore de acessibilidade, leitura da tela seguinte e ausência de foco/controles escondidos; a marca decorativa não cria uma etapa anunciada; a marca opaca consome somente o gesto de dispensa, e controles já revelados aceitam o primeiro gesto da tarefa.
6. Repetir as integrações aplicáveis em iOS/Android quando houver execução nativa. Sem ela, manter notas/gates nativos pendentes e entrega completa Provisória. Fazer apenas smoke de regressão do onboarding já existente (abrir pelo caminho de sempre e sair/continuar com o comportamento atual); não redesenhar suas cinco cenas, interesses ou ações.
7. Executar os checks exigidos pelas regras do projeto e receber os três pareceres; corrigir só os achados da assinatura e repetir os casos afetados. Publicar nota interna do escopo conferido, tempos efetivamente medidos, evidências, lacunas nativas e validação empírica não realizada. Testes sustentam contratos/regressão; não criar testes apenas para repetir a implementação.

Próximas jornadas só começam depois da intro finalizada ou de nova instrução explícita do dono. Nenhuma nota ou resultado é preenchido por este roteiro.
