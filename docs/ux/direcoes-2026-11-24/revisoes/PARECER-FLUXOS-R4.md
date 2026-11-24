# Revisão independente de fluxos — R4

24/11/2026 · candidata `a6f2e09b559b3c531b66fbc404839d661d304f48` · revisão sem edição do protótipo. Os pareceres R1–R3 e suas falhas permanecem no histórico.

**O conjunto interagido passou sem achados médios abertos:** 516 asserções positivas nas três direções. D1/D2/D8/D9 atingem 9,0 nesse recorte. Isso não aprova a cobertura integral: a auditoria de estados obrigatórios P05/P06/P15 mantém D10/DG1 e a nota global pendentes para uma próxima candidata.

## Fonte congelada

| Arquivo | SHA-256 antes/depois |
| --- | --- |
| `app.js` | `5bfbd13c1b5856f01f36a0a96bac741000d22ea656e029457f1e18d4999d13ee` |
| `media-pages.js` | `38dec9a5115332ec0c7ad4ba1e8ca9ea9ca443cb2c19181aca950458051c8cd3` |
| `social-pages.js` | `572a52154ab2a2d6aa681dfe6ee57b110826d8a12f461400e603039625e46a58` |

Chromium **156.0.8078.79**, Playwright, 390×844, contextos novos por cenário. Os três hashes ficaram estáveis. Sem API, IA, email, microfone, dados de produção ou execução nativa. As fontes HTML autossuficientes foram abertas por HTTP; não contornei a política de `file://`.

## Execuções finais desta candidata

| Suíte | Cenários | Asserções | Passaram | Falharam |
| --- | ---: | ---: | ---: | ---: |
| Regressão principal | 12 | 147 | 147 | 0 |
| Novos fluxos da R2 | 33 | 207 | 207 | 0 |
| Integração adicional da R3 | 12 | 51 | 51 | 0 |
| Metadados e trilha completa | 6 | 111 | 111 | 0 |
| Total R4 | 63 | 516 | 516 | 0 |

Cada direção recebeu **172 asserções em 21 cenários**, sem exceções ou `pageerrors`. A contagem descreve asserções executadas, com regressões em diferentes suítes; não significa 516 tarefas ou variantes únicas. Não somei rodadas antigas nem adicionei subconjuntos já incluídos na tabela.

A primeira execução da última suíte encontrou três verificações de texto por direção sensíveis à caixa: o CSS transforma “Trilha concluída” em maiúsculas no `innerText`. Os estados, 5/5 e os destinos dos botões já estavam corretos. Preservei essa rodada, normalizei apenas a comparação textual e repeti a suíte sem alterar a fonte. Não foi classificada como defeito do produto.

## O que foi validado novamente

Cadastro e recuperação, geração/cancelamento com objetivo e material preservados, consentimento, aceite, WHERE, resposta incompleta/erro/acerto, reforço e tentativa original, seis formatos de exercício, “Vale rever”, explicação opcional, conclusão, progresso local e retomada de INNER JOIN. Edição/descarte, histórico, Seguindo, bloqueio, denúncia, compartilhamento, publicação pendente/retirada, identidade de visitante, QR/clipboard e HTMLs autossuficientes conservaram os resultados positivos das correções anteriores.

O áudio de exemplo foi conferido por gesto, cancelar/parar/transcrição, indisponibilidade e Browser Back/Forward. O temporizador é encerrado ao sair; voltar não reabre a gravação. O limite foi conferido com relógio **simulado** avançado em 181.000 ms, não por espera real de três minutos ou gravação nativa. Clipboard permitido e negativa controlada pertencem apenas ao navegador isolado; não são prova do sistema iOS/Android.

O recorte permite ir/voltar da foto mantendo nome e enquadramento no mesmo draft, cancelar um novo enquadramento sem apagar o anterior e salvar/restaurar o perfil. A denúncia pela prévia direta e pelo cartão usa o título público exibido e oculta o alvo correto.

## Fechamento de R3-F1 e fronteiras de dados

O novo roteiro realizou **14 verificações por direção**:

- Personalizou a descrição da trilha A e criou C por outro objetivo SQL: C recebeu a descrição do exemplo, sem herdar a descrição privada; A e seu progresso permaneceram.
- Salvou a descrição própria de C e conferiu reload. Adicionou a cópia recebida B: B também começou com a descrição do exemplo, sem herdar A/C.
- Salvou a descrição de B; alternou A/C/B e recuperou o texto próprio de cada registro; cancelar uma alteração de A não mudou seu conteúdo salvo.
- Adicionar B já existente conservou o ID, a descrição e a quantidade de trilhas. Cancelar/apagar B, seguido de reload, preservou A/C e suas descrições.

Não houve herança indevida em nenhum dos caminhos exercitados. R3-F1 está fechado nesta candidata pelo teste integrado, não somente por leitura da atribuição no código.

## Cinco lições e home concluída

O roteiro realizou **23 verificações por direção**, começando de uma sessão de exemplo nova: gerou/aceitou e respondeu às cinco lições — WHERE, INNER JOIN, AND, filtro com junção e LEFT JOIN. Cada acerto levou à conclusão correspondente; o progresso parou em 5/5.

Após a quinta lição, o mapa apresentou cinco nós concluídos e nenhum próximo nó. A home exibiu trilha concluída e 5/5, com “Criar outra trilha” e “Rever esta trilha”; não apresentou uma sexta lição nem “Retomar LEFT JOIN”. Reload manteve esse estado local. Rever abriu WHERE sem apagar os cinco passos; criar outra abriu o objetivo preservando a trilha concluída.

## Notas do conjunto interagido

| Critério | A | B | C | Fundamentação |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza de contexto | 9,0 | 9,0 | 9,0 | Títulos, alvos, descrição por trilha e próximo passo coerentes nos roteiros executados. É revisão de desenho, sem teste de compreensão com pessoas. |
| D2 · ação e autonomia | 9,0 | 9,0 | 9,0 | Ações, cancelamentos, histórico, edição composta e destinos ao terminar a trilha funcionam sem contorno no recorte. |
| D8 · feedback e recuperação | 9,0 | 9,0 | 9,0 | Erro/reforço, revisão, expiração, descarte e salvamento recuperados, sem perda indevida nas situações exercitadas. |
| D9 · continuidade e confiança | 9,0 | 9,0 | 9,0 | Identidade, progresso, draft e descrições isolados/preservados; origem local/sintética mantida explícita, sem simular validação de servidor. |
| D10 integral / DG1 | `null` | `null` | `null` | A matriz obrigatória ainda aponta estados P05/P06/P15 sem representação/prova suficiente; 35 páginas-base não encerram essa cobertura. |
| Demais critérios integrais | `null` | `null` | `null` | Este parecer não substitui avaliações visual, de movimento e de acessibilidade/360 px da mesma candidata. |

A nota 9 se aplica às facetas e casos descritos, sem promover a proposta inteira. As lacunas globais de material (formato/tamanho/leitura), geração com eventos/espera longa e Explorar (Novas/paginação) precisam de representação e nova prova. Por isso a **nota global permanece `null`**; não se atribui 9 a D10 por existência de páginas ou por testes de lógica. Produto web/iOS/Android e métricas de uso reais continuam sem nota derivada deste protótipo.

## Evidências preservadas

Diretório `/workspace/work/revisao-fluxos-r4/`: `revisar-regressao.cjs`/`resultado.json`; `novos-fluxos.cjs`/`novos-resultados.json`; `regressoes-integracao.cjs`/`integracao-resultados.json`; `fronteiras-e-trilha-completa.cjs`/`fronteiras-resultados.json`. Logs, capturas de home 5/5 e registros restantes, além da rodada inicial de comparação textual, permanecem separados. Nenhuma fonte do protótipo foi alterada por este revisor.
