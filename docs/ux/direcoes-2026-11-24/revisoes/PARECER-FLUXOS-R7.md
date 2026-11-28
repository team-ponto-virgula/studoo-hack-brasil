# Revisão independente de fluxos — R7

24/11/2026 · candidata `f0c9b7fb3fb962827fd743096fee935b4873ed29` · sem edição das fontes de interface.

**Os três médios da R6 estão fechados no recorte conferido.** A rodada final passou em **912/912 asserções**, com 321 cenários, sem exceções ou erros JavaScript. D1/D2/D8/D9 recebem **9,0 por direção** nas facetas descritas. Não há nota global neste parecer: a consolidação visual, de acesso, movimento e cobertura permanece própria dos respectivos revisores. Isso não atribui nota ao aplicativo instalado.

## Fonte, comparação e limites

Li `NOTAS-COMPARTILHAR-R7.md` e o diff `28b003e..f0c9b7f`. A comparação de objetos Git confirma **somente três JS alterados e 23 arquivos idênticos** dentro do runtime do protótipo. As mudanças estão em contexto de cópia/folha/confirmação/retirada/cancelamento e no aviso de compartilhamento. A jornada, o módulo material, a personalização e os estilos não foram modificados nesse diff.

| Arquivo | SHA-256 antes/depois da coleta R7 |
| --- | --- |
| `app.js` | `c966f5b7eeeaefb50986651611c01d3c21050d31b02061f8c57c9da940b1815e` |
| `media-pages.js` | `91976dcd188ff8a7402a9e1e3791584ccb9e3888294317eb8ae048d7a0f76c8c` |
| `social-pages.js` | `b6ab28dba376a6f6e22b598a60e36911480dd4e76a89d243ba817fe770656b27` |
| `material-pages.js` | `5fbfd822ad40d4c9f3a58425e139662f5e386b90ac387739c8b50f86b63ccbe9` |
| `personal-pages.js` | `a2ac757d552a0498ab66ec1a4fd52b02c4ad13d37e4437a2bc2e83c8a892027e` |

Todos ficaram estáveis. Chromium **156.0.8078.79**, Playwright, contextos isolados. Ciclo SQL e fronteiras de trilha em **390×844**; compartilhamento, callbacks e novos riscos em **360×800**. Clipboard, diálogos, arquivos e publicação são fixtures locais identificadas. Capturei a API real do factory para controlar Promise, callback e efeitos, sem substituir a implementação ou editar o protótipo. Não houve envio, IA, email, áudio, OAuth real, teste com pessoas ou execução nativa.

## Execuções novas desta candidata

| Suíte final R7 | Cenários | Asserções | Passaram | Falharam |
| --- | ---: | ---: | ---: | ---: |
| Ciclo central SQL | 3 | 69 | 69 | 0 |
| Metadados e cinco lições | 6 | 111 | 111 | 0 |
| Fronteiras de compartilhamento | 42 | 150 | 150 | 0 |
| Contexto assíncrono ampliado | 165 | 330 | 330 | 0 |
| Positivos, cancelamentos, callbacks e aviso | 105 | 252 | 252 | 0 |
| **Total R7** | **321** | **912** | **912** | **0** |

Cada direção recebeu **107 cenários e 304 asserções**, todas positivas, com **zero `pageerrors` e exceções nas rodadas finais**. A matriz contém repetições deliberadas entre endpoints e direções; 321 cenários não significam 321 telas distintas. Contagens de autoria e resultados históricos da R6 não foram somados.

## R6-F1 · contexto assíncrono e folha — fechado

Os três caminhos foram repetidos separadamente: `copy-link` do núcleo, `media-code-copy` e cópia da folha pelo `afterClose`. A matriz nova usa onze invalidações:

- outra própria; recebida; ausência de plano;
- visitante; sessão inativa;
- mudança de destino; mudança de status;
- Privacidade; Mapa;
- navegar e voltar à tela original; nova renderização com os mesmos campos.

Nos dois handlers com Promise, conferi resolução e rejeição depois de cada invalidação. Na folha, conferi o clique após mudar o contexto. A escrita inicial iniciada enquanto a própria era elegível continua sendo contada; exige-se ausência de nova chamada, sucesso, fallback ou seleção tardia no outro contexto. **As 330 asserções da matriz passaram.** Navegar e voltar não revalida o token da operação anterior.

Os casos positivos também passaram: uma única escrita válida com a URL demonstrativa; sucesso no mesmo quadro; fallback comum com URL e saída; fallback de mídia com campo selecionado; cópia válida pelo fechamento da folha. Download válido prepara um Blob/ação de download; cancelar não copia nem baixa. Recebida e material com destino inválido continuam sem efeito de QR/clipboard/Blob, inclusive depois de um QR permitido ter sido preparado em outro contexto.

**Provas:** `assincronia-contexto.cjs` / `assincronia-resultados.json`; `fronteiras-compartilhar.cjs` / `compartilhar-resultados.json`; `positivos-contexto.cjs` / `positivos-resultados.json`.

## R6-F2 · retirada e registro correto — fechado

Repeti o caso da R6: iniciar retirada em uma própria, ativar recebida durante o diálogo e confirmar o callback anterior. A recebida conserva o status e os metadados anteriores.

A suíte nova compara os registros antes/depois dos callbacks de confirmação **e** retirada após outra própria, recebida, falta de plano, visitante, sessão inativa, destino, status, cenário, render novo e navegar/voltar. Os callbacks inválidos não modificam os registros. Quando a origem passa a ser material no mesmo registro com destino Explorar, a nova publicação é impedida; a retirada continua permitida, conforme a exceção necessária para encerrar esse legado.

Os positivos distinguem proteção de bloqueio indevido: confirmar no contexto válido entra em revisão; cancelar o diálogo conserva o estado anterior; retirar a própria válida conserva trilha/progresso; cancelar e depois retirar uma própria de material com destino Explorar legado funciona. Cancelar revisão antiga não limpa o status de outra própria. Um **novo toque** em Cancelar depois de redesenhar a mesma revisão permanece válido e restaura seu status anterior.

**Provas:** casos `retirada-nao-altera-outra-trilha`, `confirmacao-revalida-origem-e-trilha`, `callback-confirmar-*`, `callback-retirar-*`, `cancelar-revisao-nao-altera-outra-propria`, `cancelar-apos-novo-quadro-da-mesma-revisao` e `retirada-legado-material-permitida`.

## R6-F3 · aviso de nome do material — fechado

Na própria com `materialReference.nome='revisao.pdf'`, título `revisao.pdf para a prova` e `file` de outro pedido, a folha agora mostra um único disclosure de origem. Ele afirma corretamente que o título contém o nome e distingue título/trechos/páginas de arquivo bruto/fotos/progresso/respostas/explicações.

A promessa absoluta “Arquivo, nome e fotos não são publicados” está ausente. O disclosure aparece **antes de Ver Código Studoo**, continua na revisão e não atribui à trilha o arquivo do pedido posterior. O caso executou cinco verificações por direção.

**Prova:** `R6-F3-disclosure-unico-material` em `positivos-resultados.json`, com capturas de base e revisão nas três direções.

## Integração SQL e continuidade conferidas novamente

O percurso central novo percorreu as cinco cenas de apresentação, cadastro com validações de email/código/senha, pedido SQL com PDF escolhido/lido/conferido/confirmado, consentimento, geração cancelável conservando objetivo/material, aceite e primeira lição. Resposta incompleta/erro/reforço/acerto, tentativa original, explicação opcional, cancelar gravação de exemplo, enviar, concluir **1/5**, reload e retomar **INNER JOIN** passaram nas três direções.

Os casos de metadados repetiram descrições próprias em trilha criada/recebida/existente, alternância, salvar/reload, cancelamento e exclusão sem herança indevida. O percurso das cinco lições repetiu WHERE, INNER JOIN, AND, filtro com junção e LEFT JOIN; cada conclusão teve seu progresso, a home parou em 5/5 e ofereceu criar/rever sem inventar uma sexta lição. Rever e criar outra conservaram a concluída.

## Evidência histórica mantida com esse nome

Não repeti as 888 asserções da R6 somente para manter o número. `equivalencia-r6.json` registra os objetos Git idênticos, os três arquivos alterados e a referência às provas antigas. O diff do núcleo foi lido; os caminhos novos de compartilhamento e o ciclo integrado foram exercitados novamente.

| LC anterior | Situação nesta rodada |
| --- | --- |
| 02 | Snapshot conta/visita/restauração é prova **R6 histórica**, sem alteração desse fluxo no diff. Novos negativos de compartilhamento com visitante/sessão inativa foram executados em R7. |
| 05/06/07 | Material, geração e aceite são **R6 históricos**; o caminho PDF → geração/cancelamento → proposta/aceite foi executado novamente no ciclo central. As falhas/limites completos não foram rebatizados como execução R7. |
| 08/09 | Biblioteca e balões/ponte são **R6 históricos**. Novo percurso R7 repetiu home 5/5, mapa concluído, rever e preservar o estudo ao criar outra. |
| 10/11/12/13 | Tentativas completas, parciais, reforço, áudio/limite e envio são **R6 históricos**. O ciclo central repetiu erro/reforço/retorno/explicação/conclusão; a fronteira nova repetiu normalização parcial e preservação de outra tentativa. O limite de 61.000 ms não foi executado de novo nesta rodada. |
| 15 | Ordenação/paginação/Back/rolagem de Explorar são **R6 históricos**, sem mudança no diff. Propriedade/recebidas e acesso às folhas foram testados novamente. |
| 16 | Postagem pessoal/capa/foto são **R6 históricos**. Callback de retirada/confirmação/cancelamento de compartilhamento foi reexecutado e ampliado em R7. |
| 17 | Configurações/galeria são **R6 históricos**. Metadados, restrições, link/perfil/Explorar, QR, cópia/folha/download, aviso material e contextos foram executados novamente. |
| 18 | Consentimento/revogação/destinatários/segurança completos são **R6 históricos**. Consentimento no ciclo SQL e Privacidade como destino de invalidação foram executados novamente. |

Essa herança é evidência de regressão por equivalência da mudança, não nova prova nativa, nem uma alegação de que todas as variantes foram clicadas outra vez.

## Adaptações transparentes de bancada

Dois ajustes de expectativa foram necessários; os negativos iniciais ficaram preservados:

- Na R6, um callback bloqueado também redesenhava a tela. A fixture de `afterClose` mudava estado sem render e esperava que o callback removesse o QR do DOM antigo. A R7 corretamente não faz render tardio. O roteiro agora exige zero efeitos do callback, **renderiza explicitamente o novo estado** e confirma que ele não reutiliza QR/folha. As seis rechecagens passaram em 24/24 asserts.
- O evento `close` da folha é assíncrono. Três verificações iniciais leram o contador antes do callback; duas tentaram resolver uma Promise ainda não criada. O roteiro agora espera a chamada efetiva ao clipboard antes de resolver/rejeitar. Os seis pares de direção/desfecho passaram em 18/18; esses casos substituem os anteriores, sem entrar duas vezes no total.

As fontes de produto não foram alteradas para corrigir o harness. Todos os asserts de propriedade, efeitos e integridade foram mantidos.

## Notas do recorte competente

| Critério | A | B | C | Evidência e limite |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza e contexto | 9,0 | 9,0 | 9,0 | Aviso único e verdadeiro, origem ativa, próximo passo e contagens coerentes nos percursos; sem teste de compreensão com pessoas. |
| D2 · ação e autonomia | 9,0 | 9,0 | 9,0 | Válidos continuam operáveis; cancelamentos/retiradas respeitam alvo e quadro; contextos antigos não iniciam nova ação. |
| D8 · feedback e recuperação | 9,0 | 9,0 | 9,0 | Sucesso/fallback válidos preservados e respostas tardias bloqueadas; ciclo de erro/reforço/retomada continua operável. |
| D9 · continuidade e confiança | 9,0 | 9,0 | 9,0 | Origem/visibilidade, metadados, progresso e alvo dos callbacks conservados; simulação e limites explícitos. |
| Demais D, D10 integral e nota global | `null` | `null` | `null` | Este parecer não substitui visual, movimento, acessibilidade nem a consolidação da matriz completa. |

**Menor nota competente: 9,0.** Nenhum achado crítico/alto/médio permanece aberto nas facetas e contextos examinados. DG2/DG5 passam nesse recorte; o fechamento dos gates globais pertence à consolidação dos pareceres da mesma candidata. Não há base aqui para 9,5 ou perfeição universal.

**Produto web/iOS/Android: C1–C10 `null`. Uso com pessoas: não realizado.** As notas de desenho não autorizam inferir persistência de servidor, leitor de tela, hardware, binário ou TestFlight.

## Artefatos

`/workspace/work/revisao-fluxos-r7/`: roteiros e JSONs finais das cinco suítes; `notas-e-contagens.json` com hashes/notas/contagens por direção; `equivalencia-r6.json`; capturas e arquivos `antes-render-explicito`, `antes-evento-close` e `rechecagem`. As fontes ficaram congeladas até o fim da coleta e foram liberadas ao autor depois dela. Os resultados R6 permanecem históricos.
