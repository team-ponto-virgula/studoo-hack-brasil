# Método de avaliação de UX do Studoo

Versão 1.2 · 24/11/2026 · escala de 0 a 10 · meta do dono: **mínimo 9,5 por fluxo**, nas superfícies aplicáveis.

Este método avalia uma tarefa completa, seus estados e suas saídas, não apenas uma captura bonita. **Por instrução expressa do dono em 24/11/2026, F01 é somente a assinatura de abertura no boot dos apps iOS e Android. A intro não existe no site.** React Native Web é prévia complementar do código mobile, não uma implementação da intro para a web. A assinatura não é o tutorial de cinco cenas de `Apresentacao`: o onboarding existente continua como está e recebe somente conferência de regressão adjacente. O método geral continua aplicável aos fluxos web/app do inventário; o inventário não autoriza implementá-los.

O [modelo de ficha](FICHA-AVALIACAO.modelo.json) começa sem notas e sem testes declarados como executados. Esta documentação, por si só, não atribui nota à intro, ao app nativo ou ao produto inteiro.

As notas e medições da implementação web anterior são históricas, fora do escopo atual de F01. Não entram na consolidação mobile e não substituem evidência de iOS/Android. Ausência da intro no site é o comportamento pedido, não defeito de paridade.

**Pedido de suavização registrado antes da nova avaliação — 24/11/2026:** o dono pediu a assinatura “Óculos em foco” mais suave e um pouco menos rápida antes de distribuir. A v2 passa ao ritmo padrão de **880 ms de movimento + 160 ms de saída = 1040 ms**, com mínimo adaptativo de **680 ms**, margem de **48 ms** e deadline absoluto de **1400 ms**. A curva simétrica `[0.42, 0, 0.58, 1]`, os marcos `[0, 0.26, 0.40, 0.56, 0.90, 1]` e a inclinação de −5°/+2° substituem o ritmo anterior; a arte e a geometria ficam em 210 × 69. Os dez critérios, pesos e meta 9,5 permanecem iguais. Mídias, medições, checks e notas do ritmo anterior não aprovam esta candidata; precisam de identificação e evidência novas.

**Orçamento do ritmo suave:** antes de mover, escolher uma única duração por `min(880, restante − 160 − 48)`, entre **680 e 880 ms**. Se não couberem 680 ms, dispensar por limite com PNG integral antes do movimento. Dissolve e margem não ampliam o deadline único módulo JS + 1400 ms. O histórico do ritmo 560/120/900 está separado na seção 8; não se alteram notas para compensar a mudança.

## 1. Contratos e unidade de avaliação

As [regras do projeto](../REGRAS-DO-PROJETO.md) e a [spec 07](../specs/07-paridade-web-mobile.md) são a referência: mesma largura, mesma ordem, textos, tamanhos, ícones e comportamento; diferença de plataforma precisa estar na tabela da spec 07. Até 600 px, a ação principal fica visível sem rolar, na largura toda e antes das saídas secundárias do seu conjunto de ações. Textos vêm de `packages/contratos/src/experiencia.ts`.

Para F01 vale a exceção explícita P33 da spec 07, registrada em 24/11: abertura apenas nos apps nativos por decisão do dono. Essa instrução prevalece sobre a regra geral de paridade e não muda o contrato das outras jornadas.

Também se aplicam as specs [04, experiência](../specs/04-experiencia-ilustrada.md), [05, navegação e movimento](../specs/05-navegacao-mobile-movimento.md), [11, componentes](../specs/11-componentes-do-studoo.md), [12, som](../specs/12-som.md) e [13, Stu](../specs/13-mascote-oficial.md). A identidade é do Studoo: sem copiar aparência de outro produto e sem XP, ranking, sequência de dias, moeda ou medalhas. A nota deste método é ferramenta interna de revisão, não pontuação para estudantes.

Cada ficha fixa antes da revisão: objetivo da pessoa, entrada e saída esperadas, commit, dados e flags, variantes, dispositivos, versões, larguras, conexão, preferências e orçamento de tempo. Mudança relevante no código invalida a evidência afetada; não misturar capturas de commits diferentes como se fossem um par.

O contrato visual mobile da rodada é [`abertura-motion.json`, versão 2](../../packages/contratos/src/abertura-motion.json), com o ciclo em [`@studoo/contratos/abertura`](../../packages/contratos/src/abertura.ts):

- Logo de **210 × 69** sobre `#FFFFFF`. A launch screen do sistema é estática e igual aos quadros inicial e final da marca React.
- Coreografia **“Óculos em foco”, até 880 ms**, somente com movimento permitido confirmado. Antes de iniciar, escolher uma única duração de **680–880 ms** por `min(880, restante − 160 − 48)`; 160 ms são reservados ao dissolve e 48 ms à passagem de frames. Se o resultado for menor que 680 ms, dispensar por limite antes do movimento, com PNG integral; não começar uma coreografia incompleta. A duração escolhida não muda durante o gesto. Os óculos se destacam, ampliam e fazem um gesto de foco/reflexo; palavra e sorriso se recolhem e retornam à composição oficial. Os marcos, a curva simétrica, as inclinações de −5°/+2°, transformações e opacidades vêm do JSON vigente; não usar os limites de escala/deslocamento da acomodação da v1 para esta coreografia nova.
- Saída por dissolve de **160 ms somente depois de duas condições**: coreografia concluída e fontes/imagem/primeiro frame locais prontos. As condições podem chegar em qualquer ordem; sinal repetido não reinicia a sequência ou o prazo. No caminho padrão, com recursos locais prontos e orçamento suficiente, a duração nominal é **880 + 160 = 1040 ms**. No adaptado, a sequência de 680–880 ms conserva marcos/forma e mantém o dissolve de 160 ms; essa reserva não estende o deadline.
- **Deadline absoluto único: início do módulo JS + 1400 ms.** A guarda do splash nativo e o controlador React compartilham esse prazo. Na montagem, o controlador recebe apenas `max(0, deadline − agora)`; não ganha outros 1400 ms. Ready, re-render e saída não reiniciam o prazo. Montagem após a expiração encerra sem timer extra. O limite pode interromper sequência/dissolve tardios; o boot anterior ao módulo JS é medido separadamente.
- **Preferência pendente (`null`) não é dispensa imediata:** mantém o PNG estático, sem iniciar a coreografia, limitado pelo mesmo deadline. Se os recursos locais ficarem prontos antes da resposta, `pronto(false)` encerra sem aguardar 880 ms. Se a consulta falhar, o hook usa o estado de movimento reduzido (`true`) e encerra. Movimento reduzido conhecido, tecnologia assistiva, interação, falha, contexto/segundo plano e retornos dispensam imediatamente. Callback/link direto preserva o destino. Nenhuma API entra na condição de saída.
- Não repetir em navegação ou foreground; o consumo vive no processo do app. Não há intro a exigir do site.

O asset dos [óculos em alta resolução](../../apps/mobile/assets/marca/abertura-oculos-hd.png) deriva do ícone oficial de 1024 px para reduzir aliasing na ampliação de 2,15×. A marca completa original em repouso permanece em 210 px. Essa intenção precisa de conferência visual do renderer; o arquivo novo não é, por si só, aprovação de acabamento ou desempenho.

Essa é uma regra de avaliação definida pelo brief, não declaração de implementação ou medição nativa já concluída. Depois de iniciada, recursos prontos não antecipam a duração da coreografia escolhida com movimento permitido confirmado. Com preferência ainda pendente, porém, a prontidão encerra o PNG estático sem esperar a sequência; não há coreografia de 880 ms nesse estado. A regra de exposição intencional não retarda as dispensas.

**Superfícies distintas:** `web`, `app_previa_web`, `ios_nativo` e `android_nativo`. A prévia React Native Web ajuda a conferir layout e contrato; não comprova gestos, foco assistivo, áudio, permissões, armazenamento ou desempenho nativos. Simulador, emulador e aparelho são origens diferentes e devem ser nomeados. Um teste de código não vira uma experiência de uso observada.

**Aplicabilidade de F01:** `ios_nativo` e `android_nativo` são obrigatórias; `app_previa_web` é complementar; `web` é `nao_aplicavel` pela instrução de 24/11. Falta de execução nativa mantém notas `null` e a entrega mobile Provisória. A web continua sendo uma superfície válida do método para as outras jornadas.

## 2. Dez critérios, com pesos fixos

Os pesos somam **100**. Não mudam depois de conhecer as notas. Para cada critério registrar evidência, métrica, resultado esperado, resultado observado e limites; o revisor explica a nota em uma frase verificável.

| ID | Critério | Peso | O que observar e medir |
| --- | --- | ---: | --- |
| C1 | Clareza do valor e dos textos | 12 | O percurso apresenta o que o Studoo oferece e o próximo passo com rótulos concretos e promessas coerentes com conta/visitante e IA. Evidência interna: inspeção dos textos e percurso gravado; compreensão com pessoas reais só é resultado quando observada separadamente. |
| C2 | Ação principal e autonomia | 12 | Começar, avançar, voltar, pular/cancelar e sair levam ao destino esperado, sem espera não prevista ou irrecusável pela animação nem toque duplicado em ação já visível. Um toque na marca ainda opaca somente a dispensa e não aciona um controle oculto ou áudio; durante o dissolve, as ações reveladas já aceitam interação. Medir conclusão sem ajuda, desvios e ações sem resposta. |
| C3 | Hierarquia, leitura e adaptação | 12 | Texto, arte e CTA cabem sem cortes, sobreposição ou rolagem horizontal involuntária; área segura e teclado não cobrem ações. Medir caixas, dobra e leitura com texto ampliado; guardar capturas na mesma largura. |
| C4 | Identidade e acabamento visual | 8 | Stu, marca, paleta, tipografia, ícones e estados têm função e consistência; sem distorção, serrilhado evidente, mudança brusca de escala ou decoração que esconda conteúdo. Evidência: quadros em repouso e vídeo, com ocorrências localizadas. |
| C5 | Movimento e som com controle | 10 | Cada efeito explica uma mudança; não impõe espera irrecusável, disputa com leitura nem recomeça sem motivo. Movimento reduzido mantém informação/ações; segundo plano pausa o que deve pausar; som respeita preferência e gesto. Medir duração, interrupção e estado final. |
| C6 | Acessibilidade e foco | 14 | Contraste, nomes/papéis/estados, sequência de leitura, toque, teclado e leitor de tela permitem a mesma tarefa. Medir contraste e alvos; registrar percurso de foco e anúncios, incluindo troca de etapa, diálogos e retorno. |
| C7 | Resposta e espera | 10 | Ação recebe retorno imediato, trabalho longo mostra estado verdadeiro e cancelamento, falha de asset/rede não prende a pessoa. Medir tempos do evento ao retorno e ao destino, partida fria/quente e travamentos, no ambiente identificado. |
| C8 | Feedback, erros e recuperação | 10 | Acerto/erro/carga/vazio/indisponibilidade são distinguíveis sem depender só de cor; repetir/cancelar é seguro e preserva o que deve preservar. Medir recuperação, duplicidade, perdas e erros não tratados. |
| C9 | Continuidade e confiança | 6 | Reabrir/retomar, preferências, consentimentos e dados refletem o estado real; a ilustração não finge progresso salvo. Medir estado antes/depois e persistência conforme contrato, sem expor dados pessoais. |
| C10 | Paridade e integração de plataforma | 6 | Mesma tarefa e estados na web/app, pares em 390×844 e 360×800, com diferenças apenas documentadas na spec 07. Conferir também voltar, safe area, preferência e integração real de cada plataforma; registrar a origem da evidência. |

**Aplicação à assinatura v2:** C1 verifica identidade reconhecível e ausência de promessa de carregamento falsa; não exige slogan, áreas de interesse ou tutorial. C2 verifica dispensa a qualquer momento e ausência de bloqueio; a duração escolhida de 680–880 ms no caminho permitido é parte do brief, com dispensa estática quando faltar o orçamento mínimo. C3/C4 conferem marca de 210 × 69, fundo, recortes e igualdade entre launch screen/frame inicial/frame final. C5/C7 distinguem coreografia permitida de PNG estático com preferência pendente, conferem duas condições de saída, dissolve e deadline absoluto compartilhado. C6 confere foco e dispensa por tecnologia assistiva; C8/C9 conferem falhas, callbacks e não repetição. A abertura não cria progresso ou preferência de onboarding.

Em F01, C10 compara composição, estados e comportamento entre iOS/Android, com diferenças obrigatórias do sistema registradas; a prévia complementa a inspeção. Não exige uma intro equivalente no site e não herda notas da implementação web histórica.

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
| G3 · Latência | Coreografia de até 880 ms só com movimento permitido confirmado. Antes de iniciar: `min(880, restante − 160 − 48)`, faixa 680–880 ms; resultado menor que 680 dispensa por limite com PNG integral antes do movimento. Saída de 160 ms após sequência e recursos locais prontos; nominal padrão 1040 ms. Deadline único `início do módulo JS + 1400 ms`, compartilhado por splash e React; montagem recebe só o restante, nunca novos 1400 ms. Sem API await. Preferência `null` mantém PNG estático sem sequência; ready antes da resposta encerra por `pronto(false)`. Falha de consulta usa reduzido; reduced/tecnologia assistiva/falha/contexto/interação/retornos dispensam imediatamente. Registrar origem/deadline, montagem/restante, preferência, sequência, ready e saída. Configuração, simulação e observação não são a mesma prova. |
| G4 · Foco e acesso assistivo | Tarefa completa por teclado na web e por leitor de tela/toque no nativo; foco visível e nunca escondido pelo rodapé, ordem previsível, sem armadilha ou anúncio de página oculta. Texto a 200% continua operável; contraste AA (4,5:1 texto comum, 3:1 texto grande/elementos aplicáveis), alvos de 44 px e CTA de 48 px conforme specs. |
| G5 · Erros e integridade | Nenhum erro não tratado, ação destrutiva sem confirmação, conclusão falsa, duplicação ou perda indevida. Indisponibilidade de rede/asset/permissão tem saída/repetição segura. Promessas sobre IA, demonstração e persistência correspondem aos dados reais. |
| G6 · Paridade | Pares, textos e percurso equivalentes nas superfícies aplicáveis do mesmo commit; diferenças restantes constam da spec 07. Em F01, a comparação obrigatória é iOS/Android e a ausência no site é a exceção P33 pedida em 24/11. Nos demais fluxos permanece a regra geral web/app. Prévia não aprova integração nativa. |

Cada fluxo registra seus limites antes da medição; os limites de coreografia 680–880 ms, dissolve 160 ms, reserva de frames 48 ms e deadline 1400 ms são específicos da assinatura v2, não orçamento da geração de trilha ou de uma operação de rede. A troca de brief da v1 foi registrada antes de atribuir novas notas; não reinterpretar seus resultados como aprovação da v2. Uma operação longa pode ter orçamento próprio; isso não permite bloquear o retorno do toque.

## 4. Evidência e revisão independente

Registrar artefatos reproduzíveis com ID, origem, commit, data, estado/flags, dispositivo/versão, viewport/font scale, movimento/som, conexão, passos e resultado. Cada métrica inclui unidade, amostras, método e orçamento. Logs/capturas compartilhados são sanitizados: sem tokens, chaves, sessões ou dados de pessoas reais. Preferir dados sintéticos, IA falsa e email falso para a rodada local; não chamar isso de prova de IA real ou de login de produção.

Separar evidência de **código/teste**, **captura**, **interação gravada**, **medição** e **observação com pessoa**. Links históricos ajudam a localizar o problema, mas não validam a candidata atual. Guardar a ficha e os artefatos sanitizados acessíveis na tarefa, indicando quando um arquivo bruto depende do workspace.

Para “Óculos em foco”, identificar também a versão do contrato em cada artefato. **Filme de conceito gerado em Python** mostra a direção visual, mas não executa o componente nem prova readiness, cancelamento, foco ou latência. **Prévia React Native Web** executa o componente mobile no navegador e é complementar. **Gravação nativa** exige build/OS/dispositivo identificados, incluindo a passagem da launch screen; ainda está pendente nesta mudança de brief. Uma mídia não assume a origem da outra.

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

- **Revisão especializada interna no escopo testado:** lista fechada de superfícies e variantes, com notas próprias e gates por superfície. Sua nota consolidada é a menor nota desse escopo, sem média entre superfícies. Pode atingir 9,5 e ser aceita internamente se toda a evidência desse escopo estiver completa. Em F01, uma revisão apenas da prévia recebe o nome “revisão complementar React Native Web”; não recebe o nome “app iOS/Android validado” e não conclui o aceite mobile.
- **Entrega multiplataforma completa:** considera somente os alvos aplicáveis da entrega. Em F01 são iOS e Android; web é não aplicável e a prévia é complementar. Nas outras jornadas, web/iOS/Android entram conforme o escopo. Usa a menor nota dos alvos obrigatórios; se algum não foi observado, a nota completa é `null` e o estado é **Provisório**, com a lacuna explícita. A prévia e as notas web históricas não preenchem a falta nativa. A validação empírica com pessoas/produção tem seu próprio estado, sem nota fabricada nem transferência automática de uma avaliação à outra.

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
| F01 · atual; só mobile | Assinatura v2 “Óculos em foco” em iOS/Android: logo 210, coreografia permitida até 880 ms; duração 680–880 escolhida antes de iniciar por `min(880, restante − 160 − 48)`, senão dispensa estática por limite. Saída 160 ms após sequência + recursos em qualquer ordem; deadline único módulo JS + 1400 compartilhado por splash/React. Preferência pendente fica estática e ready sem resposta encerra sem coreografia. Launch screen igual aos frames inicial/final, falhas, acessibilidade, contexto, retornos e não repetição. RN Web complementar; site sem intro. | A/A/A no boot | `packages/contratos/src/abertura-motion.json`, ciclo `abertura.ts`, `apps/mobile/src/abertura.tsx`, layout mobile; P33 |
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

## 7. Roteiro da rodada atual: assinatura de abertura só no mobile

1. Fixar commit, contrato v2, plugin e build mobile; anexar a mudança de brief antes dos pareceres. Registrar rotas/retornos elegíveis e destino. iOS/Android são obrigatórios, RN Web complementar e site não aplicável. Separar boot frio/quente, sessão e cache; não mudar o tutorial `Apresentacao`.
2. Conferir conceito visual e depois componente, sem misturar suas origens. Em iOS/Android, comparar launch screen estática, frame 0 e frame final em 210 × 69 sobre branco, nas medidas lógicas 390×844/360×800 e áreas seguras. Conferir os óculos e demais camadas nos marcos do JSON. Python é conceito; RN Web é prévia; nenhuma dessas mídias é gravação nativa.
3. Medir início do módulo JS/deadline único, montagem React/restante recebido, sequência, recursos, saída e remoção. Cobrir montagem tardia e após expiração, as duas ordens de ready/sequência, sinais repetidos e chegada perto do cap. Registrar restante no início, duração escolhida e cálculo `min(880, restante − 160 − 48)`. Cobrir padrão 880/1040 ms, compressão 680–880, fronteira mínima e dispensa estática quando não couber 680; sem alterar forma/marcos ou começar meio gesto. Ready sozinho não corta a duração escolhida depois do início. A montagem não soma outro prazo de 1400 ms; o cap não reinicia para terminar dissolve. API não entra na condição. Boot anterior ao módulo é medição separada.
4. Cobrir separadamente preferência pendente: PNG estático, sem coreografia; ready antes da resposta encerra por `pronto(false)` e falta de ambos termina no deadline. Não exigir dispensa imediata só por `null`. Cobrir consulta que falha (fallback reduzido), reduced conhecido, tecnologia assistiva, toque em diferentes marcos, falha de asset e contexto: dispensas imediatas sem 880 ms. Conferir limpeza, sinais tardios ignorados e não repetição.
5. Abrir callbacks OAuth, links diretos e rotas de estudo no app: preservar destino, sessão e parâmetros sem interceptação da assinatura. Conferir VoiceOver/TalkBack, foco e leitura da tela seguinte, controles não ocultos e botão Voltar do Android. A marca decorativa não cria uma etapa anunciada; a marca opaca consome somente o gesto de dispensa, e controles já revelados aceitam o primeiro gesto da tarefa. Simulação de retorno não prova login com provedor real.
6. Sem execução nativa aplicável, manter notas/gates de iOS/Android pendentes e entrega mobile Provisória; a prévia não fecha essas lacunas. Fazer apenas smoke de regressão do onboarding mobile existente, sem redesenhar suas cinco cenas, interesses ou ações. Conferências históricas da intro web ficam fora da nota de F01; não exigir casos de SSR, bootstrap ou site sem JS como aceite da intro mobile.
7. Executar os checks pertinentes ao contrato e ao app e receber os três pareceres; corrigir só os achados da assinatura e repetir os casos afetados. Publicar notas e tempos efetivamente medidos por superfície, com limites nativos e validação empírica não realizada. Testes sustentam contratos/regressão; não criar testes apenas para repetir a implementação. Ausência de intro no site pode ser conferida como regressão da remoção, separada da nota mobile.

Próximas jornadas só começam depois da intro finalizada ou de nova instrução explícita do dono. Nenhuma nota ou resultado é preenchido por este roteiro.

## 8. Histórico do contrato de F01, sem aprovação transferida

**24/11/2026, antes do pedido de suavização:** o contrato de produto `6ef71a9` (integrado à release `4523a2e`) usava sequência padrão 560 ms, mínimo 360 ms, dissolve 120 ms, margem 32 ms, nominal 680 ms e deadline 900 ms. A adaptação era `min(560, restante − 120 − 32)`; rotação −8°/+3°, curva `[0.22, 1, 0.36, 1]` e marcos `[0, 0.18, 0.34, 0.50, 0.88, 1]`. Este bloco conserva decisões anteriores e não define os parâmetros vigentes.

**Mudança de brief registrada antes da avaliação:** em 24/11, o dono pediu uma assinatura em que os óculos participem do movimento. F01 passa à **versão 2, “Óculos em foco”**. Essa solicitação substitui explicitamente a regra anterior de “sem exposição mínima”: com movimento permitido confirmado, a coreografia intencional dura até 560 ms, pode ser comprimida antes do início quando o orçamento restante for menor e pode ser dispensada a qualquer momento. Não se alteram os dez critérios, seus pesos ou a meta 9,5 para favorecer a versão nova. Notas, tempos, checks e mídias da v1 não aprovam a v2.

**Refinamento de latência, antes da avaliação consolidada:** a coordenação relatou uma medição exploratória do renderer com sequência inicial de 640 ms em que o cap de 900 ms cortou o dissolve em 77 ms. A sequência padrão foi reduzida para **560 ms**, nominal **680 ms**, mantendo cap, marcos, história e curva. Um diagnóstico posterior informou apenas 542 ms restantes no início de um boot frio: a duração é agora escolhida antes do movimento por `min(560, restante − 120 − 32)`, entre **360 e 560 ms**. Se não couberem 360 ms, dispensa por limite antes de mover, preservando o PNG integral. O exemplo relatado de 542 ms permite 390 + 120 e reserva 32 ms. É correção de orçamento, sem mudar pesos/meta nem aprovar o nativo.

As capturas, 603 testes de interface, 17 de abertura e medições associadas ao contrato anterior são históricas para a nova candidata. Podem documentar o que ocorreu, sem aprovar o ritmo suave, atribuir nota nativa ou substituir seus gates.
