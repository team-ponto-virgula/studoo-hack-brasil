# Revisão independente de fluxos — R5

24/11/2026 · candidata `5ad1225f586af063d58f694d4ebe705fcabca081` · somente leitura das fontes de interface.

**A candidata ainda precisa de correção.** A regressão anterior passou em 516/516 asserções. A ampliação independente encontrou dois problemas médios de compartilhamento nas três direções: material pode ser submetido ao Explorar e cópia recebida pode ser compartilhada novamente pelo menu do mapa. A quantidade de testes positivos não encerra esses problemas.

## Fonte e superfície

Chromium **156.0.8078.79**, Playwright, contextos novos por cenário. Regressão em **390×844**; novos riscos de fluxo em **360×800**. Eventos, conta, material, gravação, publicação e armazenamento são sintéticos e locais. Não houve API, IA, email, microfone, OAuth real, teste com pessoas ou execução React Native/iOS/Android. Os HTMLs autossuficientes foram abertos por HTTP; não se testou nem contornou `file://`.

| Arquivo | SHA-256 antes/depois |
| --- | --- |
| `app.js` | `730e325477a440f59ebd5eb9581af73ceb0c4dd89e332466f1341ae5edd2995b` |
| `material-pages.js` | `5fbfd822ad40d4c9f3a58425e139662f5e386b90ac387739c8b50f86b63ccbe9` |
| `media-pages.js` | `38dec9a5115332ec0c7ad4ba1e8ca9ea9ca443cb2c19181aca950458051c8cd3` |
| `personal-pages.js` | `451547b6e876aaa528a81ccb78b1e05b7d1e137bbbcb7a3b9082975fd8b08ff1` |
| `social-pages.js` | `572a52154ab2a2d6aa681dfe6ee57b110826d8a12f461400e603039625e46a58` |

Os cinco arquivos ficaram estáveis durante a coleta. As notas de autoria de jornada, material e personalização e a matriz histórica R4 foram lidas como contexto; as suas contagens não entram nas minhas.

## Execuções e contagem

| Suíte final | Cenários | Asserções | Passaram | Falharam |
| --- | ---: | ---: | ---: | ---: |
| Regressão principal | 12 | 147 | 147 | 0 |
| Novos fluxos herdados da R2 | 33 | 207 | 207 | 0 |
| Integração herdada da R3 | 12 | 51 | 51 | 0 |
| Metadados e cinco lições | 6 | 111 | 111 | 0 |
| Riscos LC da R5 | 42 | 372 | 369 | 3 |
| **Total R5** | **105** | **888** | **885** | **3** |

Cada direção recebeu **35 cenários e 296 asserções: 295 positivas e uma negativa**, sem exceções ou `pageerrors`. As três falhas formais reproduzem R5-F1. R5-F2 foi reproduzido em um diagnóstico separado nas três direções; não o somei ao total de asserções nem contei novamente as reproduções de R5-F1. Há regressões repetidas entre suítes: 888 asserções não significam 888 tarefas ou variantes únicas.

## Achados

### R5-F1 · médio · material submetido ao Explorar · A/B/C

**Reprodução:** objetivo SQL novo → escolher PDF → aguardar leitura → conferir prévia → Usar este material → gerar/aceitar → Compartilhar → No Explorar → Revisar publicação → confirmar o diálogo.

**Observado:** a trilha ativa conserva `deMaterial:true` e `materialReference.nome:'revisao-sql.pdf'`, mas passa a `visibility:'explorar'` e `publicationStatus:'pendente'`. A interface trata o destino proibido como solicitação válida. É um estado local de desenho; não se publicou conteúdo de verdade.

**Efeito:** a proposta contradiz a restrição de [spec 10](../../../specs/10-comunidade.md), que diz “Trilha feita de material não vai para o Explorar”, também expressa em `experiencia.ts` por `materialFora`/`explorar_material`. A confirmação genérica não explica nem bloqueia essa condição.

**Correção sugerida:** derivar a origem de `tracks[activeTrack]`; impedir o destino Explorar tanto na escolha quanto nos handlers de revisão/confirmação/salvar visibilidade, com motivo e alternativa Perfil/link. Remover ou trocar o material de um pedido posterior não deve mudar a origem já comprometida da trilha.

**Prova:** `riscos-lc-resultados.json`, caso `LC10-16-17-material-origem-por-trilha`, nas três direções, contém o registro e o texto da tela. Captura adicional `jornada-material-enviado-explorar-probe.png`.

### R5-F2 · médio · cópia recebida compartilhada novamente · A/B/C

**Reprodução:** Prévia recebida → Adicionar cópia → menu da trilha no mapa → Compartilhar → No Explorar → Revisar → confirmar.

**Observado:** o registro `recebida-sql-sem-complica--o` passa a `visibility:'explorar'` e `publicationStatus:'pendente'`. O módulo de configurações informa que a cópia recebida não pode ser compartilhada; o menu do mapa permite alcançar o fluxo oposto.

**Efeito:** contradição de propriedade e visibilidade no próprio desenho. O contrato `compartilhar.ts`, comentário de `recebida`, exige “sem Compartilhar nem Postar”; `configuracoes.tsx` também explicita que não se compartilha de novo. O teste de seleção pessoal passou porque a cópia está corretamente ausente de Postar no perfil, mas isso não protege o outro caminho.

**Correção sugerida:** usar a mesma regra de propriedade no menu, na entrada da folha e nos handlers; oferecer voltar à cópia privada. Revalidar que nomes, respostas, progresso e personalização da cópia continuam preservados.

**Prova:** `copias-probe.cjs`/`copias-probe.json` e capturas `jornada|caderno|foco-copia-recompartilhada-probe.png`, três reproduções completas a 360×800.

### R5-L1 · baixo · contexto da trilha ativa em C

O cartão ativo de Foco mostra a próxima lição, mas omite o nome da trilha. Os registros e a retomada estão corretos; a pessoa precisa inferir qual estudo está ativo quando várias trilhas compartilham os mesmos títulos de lição. Recomendo um rótulo curto com o nome da trilha, mantendo a hierarquia centrada no próximo passo. Não é perda de dados nem falha de retomada.

## Riscos novos efetivamente interagidos

Os nomes abaixo correspondem aos casos de `riscos-lc-resultados.json`, executados em A/B/C a 360×800.

| LC | Caso e prova |
| --- | --- |
| 02 | `sessao-visita-restauracao`: conta personalizada e tentativa → quadro expirado → visita sem trilhas/material/tentativas da conta → trilha própria de visitante → snapshot da conta intacto → reentrada e restauração dos dados privados. Estado restaurando também concluído. |
| 05 | `material-confirmado-e-cancelamentos`: cancelar seletor/leitura, invalidar eventos atrasados, PDF com duas páginas/citação, confirmação explícita, excesso de tamanho preservando anterior, cancelar câmera/galeria, descartar escolha, cancelar/confirmar remoção, CSV com tabela. Câmera/galeria com material anterior foram abertas como quadros identificados por query, não como prova de seletor nativo nem de todas as rotas de troca. |
| 06 | `eventos-cancelamento-erros`: título antes dos nós, dois/cinco nós por relógio, proposta depois do evento, cancelar invalida chegada posterior, rede/IA indisponível/limite e espera longa com saída preservando pedido. |
| 07 | `aceite-cancelavel-e-falhas`: pendente sem novo registro, toque duplicado desativado, cancelar/repetir, duplicada/cancelar, cinco lições e capítulos da proposta longa, falha de aceite e recuperação da abertura da primeira lição. |
| 08 | `biblioteca-carga-erro-retorno`: carregando/sincronizando/erro → recuperar sem duplicar nem alterar progresso → reload → retomar INNER JOIN. |
| 09 | `baloes-ponte-vitoria-retorno`: nó bloqueado e nó atual com balão nomeado, cancelamento, ponte persistente da trilha/lição. A regressão anterior também repetiu mapa completo 5/5. |
| 10 | `tentativas-por-trilha-licao-reinicio`: duas trilhas e duas lições com respostas/explicações próprias; cancelar e confirmar reinício; limpar só a tentativa atual, conservar outra lição, outra trilha e progresso; reload. Origem/apoio também conferidos no caso de material. |
| 11 | `parcial-preserva-acertos`: dois pares corretos mantidos e desativados ao tentar de novo/reload; corrigir restante; aberta parcial com dois critérios e resposta conservada até acerto. As seis variantes completas permanecem na regressão de 207 asserts. |
| 12 | `baloes-ponte-vitoria-retorno`: vencer em quadro estável, reler/revencer, retornar à seleção original, mapa/reload/reabrir a ponte e retornar novamente. |
| 13 | `envio-cancelamento-erro`: envio pendente identificado, cancelar sem retorno tardio, erro preservando campo, repetir e chegar ao retorno, permissão negada sem gravação. A suíte de integração conferiu o limite atual com avanço lógico de **61.000 ms**, encerrando o áudio e mantendo o rascunho com transcrição revisável. A prova histórica de 181.000 ms da R4 não foi reclassificada como prova do contrato atual de 60 s. |
| 15 | `ordem-paginacao-historico`: Em alta/Novas com ordem diferente, paginação sem repetição, busca, prévia do item selecionado, Back conservando busca/ordem/página/rolagem, troca de ordem e Todos/Seguindo. |
| 16 | `postagem-moderacao-retirada-desfazer`: confirmar/cancelar postagem, pendente privado, cancelar/confirmar retirada, preservar moderação/progresso e desfazer; fixtures aprovado/recusado/retirado identificadas; cópia recebida ausente da seleção de postagem. |
| 17 | `capa-tema-drafts-isolados`: 13 opções de capa e 12 temas, cancelar/aplicar sem comprometer texto, duas trilhas com aparência própria, Back/reload descartando prévia de aparência, validação de email em descrição, correção sem alterar a outra cópia. Os dois caminhos inválidos de compartilhamento acima permanecem abertos. |
| 18 | `consentimento-destinatarios-revogacao`: destinatário local antes de consentir, recusar, consentir sem alterar flags falsas, consultar em Privacidade, cancelar e confirmar revogação, novo pedido exigindo novo consentimento. |

O caso integrado de material ainda confirmou que aceitar copia a origem para a trilha, mudar o arquivo de um pedido posterior não altera a citação da lição e remover a entrada não apaga a referência salva. Esses resultados positivos não corrigem o destino indevido de publicação.

## Adaptações e limites do harness

Os ensaios iniciais estão preservados fora do Git com sufixos `adaptacao-inicial`, `harness-inicial`, `harness-segundo` e `antes-lc08`. A contagem final usa somente as rodadas identificadas na tabela.

- O seletor antigo `pick-file` virou `material-open-file`; agora há escolha de fixture, leitura, prévia e confirmação antes de verificar o material. O rótulo de áudio mudou para “sem microfone”.
- Aceite e envio aguardam o pendente local de 650 ms; o reforço exige atravessar o quadro vencido; interesses usam `artes`; cancelamento explícito de configurações usa `personal-cancel-plan`. Back conserva o rascunho textual conforme o novo desenho.
- Na ampliação, só se avança para explicação depois da verificação correta; os erros novos usam ações próprias (`accept-plan`, `send-explanation`), não o antigo `retry-scenario`. A inicialização do armazenamento foi feita por ações de UI. Os erros de geração têm nota explicativa, não a classe/semântica de alerta presumida pelo primeiro harness.
- A busca “SQL” retorna cinco dos seis exemplos: “Primeiros filtros e joins” não contém esse termo. O assert de retorno preserva a lista filtrada real, sem exigir seis resultados incompatíveis com a busca.
- O primeiro assert LC08 supunha o nome da trilha no cartão em todas as composições. A rechecagem de C exigiu o mesmo registro ativo, título/progresso persistidos e CTA de retomada, sem impor o layout de A/B. Passou em **8/8**; o JSON final substitui esse caso, sem somá-lo duas vezes. Os três falsos iniciais e a rechecagem permanecem acessíveis.

Não foram removidos asserts de integridade para alcançar a meta. Os dois defeitos de compartilhamento continuam registrados como falhas reais. Os quadros acessados por query provam representação e ações daquele estado; não provam um erro recebido da rede nem um evento de sessão de produção.

## Notas do recorte independente

| Critério | A | B | C | Fundamentação |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza e contexto | 8,0 | 8,0 | 8,0 | Textos da propriedade e da publicação contraditos por ações disponíveis; não há teste de compreensão com pessoas. |
| D2 · ação e autonomia | 8,0 | 8,0 | 8,0 | Avanço/volta/cancelamentos funcionam, mas a proposta permite completar dois caminhos proibidos pelo contrato. |
| D8 · feedback e recuperação | 9,0 | 9,0 | 9,0 | No recorte clicado, feedback, parciais, reinício, descarte, temporizadores e recuperação preservam dados e oferecem saídas. Esta nota não aprova teclado/foco. |
| D9 · continuidade e confiança | 8,0 | 8,0 | 8,0 | Snapshot, tentativas, metadados e citações conservados localmente; R5-F1/F2 impedem confiança na visibilidade proposta. |
| D10 integral | `null` | `null` | `null` | Este parecer não consolida variantes visuais/teclado da matriz completa. As 14 LC foram ampliadas, mas os dois caminhos inválidos impedem aprovação integral. |
| Demais D / nota global | `null` | `null` | `null` | Dependem dos pareceres competentes da mesma fonte e do fechamento dos achados. |

DG5 e o fechamento de DG6 permanecem pendentes pelos dois médios. A candidata não atinge a meta de todos os critérios ≥9. **Produto web/iOS/Android: C1–C10 `null`; uso com pessoas: não realizado.**

## Artefatos

Todos os roteiros, JSONs, logs e capturas deste revisor ficam em `/workspace/work/revisao-fluxos-r5/`:

- `revisar-regressao.cjs` / `resultado.json`;
- `novos-fluxos.cjs` / `novos-resultados.json`;
- `regressoes-integracao.cjs` / `integracao-resultados.json`;
- `fronteiras-e-trilha-completa.cjs` / `fronteiras-resultados.json`;
- `riscos-lc.cjs` / `riscos-lc-resultados.json`, mais `riscos-lc-rechecagem-lc08.json` e histórico;
- `copias-probe.cjs` / `copias-probe.json`;
- **`notas-e-contagens.json`**, com fonte, hashes antes/depois, notas, falhas e contagens separadas por direção.

As revisões R1–R4 permanecem históricas. Nenhuma nota anterior foi substituída silenciosamente; nenhum resultado desta bancada foi transferido ao aplicativo instalado ou ao TestFlight.
