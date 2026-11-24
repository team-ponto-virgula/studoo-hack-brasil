# Perfil e configurações — subfluxos locais da R5

Autoria do módulo `personal-pages.js/css`, integrado pelo autor da jornada. O módulo propõe estados e transições de desenho; não chama API, não publica conteúdo, não envia imagens e não executa React Native.

## Reconciliação com o produto

- **Postar no perfil significa escolher trilhas**, conforme `apps/mobile/src/postar-perfil.tsx`. Não foi inventada uma ação de publicar o cadastro inteiro. Conteúdo em revisão não é apresentado como público; apenas trilhas próprias aprovadas contam em “trilhas públicas”. Cópias recebidas não entram na seleção.
- Retirar do perfil retorna a visibilidade para “Só com o link”, conserva a moderação e oferece desfazer. Não apaga a trilha, o progresso, a capa ou o estado do link. Cancelar a confirmação não muda nada. A retirada de quem está no Explorar explicita também essa consequência.
- A confirmação da postagem distingue trilha de respostas, progresso, explicações e email. Origem de material vem de **`tracks[id].deMaterial/materialReference`**, não do arquivo de um pedido posterior. Trechos citados, páginas e título podem aparecer; arquivo bruto e fotos não vão. Esta seleção oferece somente o destino Perfil, sem contornar a proibição de material no Explorar.
- Capa e tema usam os **12 IDs/cores da galeria e os 12 temas** do contrato, além da opção Padrão. O desenho das miniaturas é uma representação CSS própria. Nenhuma foto nova é enviada; não se alega conferência de upload, recorte ou moderação de capa nativa.
- Nome da trilha tem 3–80 caracteres; descrição é opcional, até 140, sem sites/email e caracteres invisíveis. Erros aparecem associados ao campo e oferecem repetir preservando o valor. Os limites vieram de `packages/contratos/src/comunidade.ts` e `compartilhar.ts`.

## Estado e interação

`tracks[id].cover/tema` pertencem à trilha. Nome/descrição continuam nos campos já usados pelo renderer. `personalPlanDraft` e `personalAppearanceDraft` carregam `trackId`; uma nova trilha não herda a prévia da anterior. Abrir capa conserva o rascunho de nome/descrição; cancelar a capa não o descarta; cancelar as configurações restaura os campos comprometidos. Back descarta e persiste o descarte da prévia de aparência, conservando o rascunho textual para a volta.

As escolhas de capa e tema mantêm foco e rolagem; a indicação de seleção tem espaço reservado para evitar salto da grade. Entrar nas sub-telas começa no topo e foca o título; cancelar/aplicar a capa devolve foco ao acionador, e repetir um campo devolve foco ao campo. Editor e recorte de foto existentes não foram substituídos por este módulo.

Os estados `perfil-pendente/aprovado/recusado/retirado` da bancada são **fixtures explícitas**. A entrada inicializa o registro próprio mostrado nesse estado, somente no armazenamento local; assim, retirar e desfazer operam no mesmo status exibido. Uma ação de postagem normal sempre pede confirmação e entra em revisão. Visitantes não inicializam essas fixtures nem ganham controles de postagem.

`sem-social` é uma variação local da apresentação com comunidade indisponível; edição e preferências permanecem. `novidades` inicializa uma trilha própria aprovada de exemplo e mostra sua atividade sintética identificada; contador e títulos correspondem ao registro, sem alegar alcance ou uso real. Os interesses são apresentados pelos rótulos do contrato, mantendo compatibilidade com os dados antigos da bancada.

## Execuções do autor

Bancada HTTP em Chromium/Playwright, 3 direções × 390×844/360×800. Testes não são aprovação independente, nem prova nativa.

- `revisar.cjs`: **588/588 checks positivos**, seis pares, zero `pageerrors`; percurso de configurações, duas trilhas com dados distintos, validação/recuperação por campo, recarga, postagem/cancelamento/retirada/desfazer, fixtures coerentes de moderação, material, seleção/foco e alvos/rodapés a 200%. Resultado final em `/workspace/work/revisao-personal-r5/resultado.json`.
- `fronteiras.cjs`: **102/102 checks positivos**, seis pares, zero `pageerrors`; postagem no registro não ativo sem alterar a trilha ativa, retorno/contagem pública, cópias privadas, Browser Back/rascunho/reload/cancelar, visitante com fixture forçada. Resultado em `fronteiras.json`.
- `atividade-campos.cjs`: **78/78 checks positivos**, seis pares, zero `pageerrors`; atividade e contador coerentes com a trilha própria aprovada de exemplo, título correspondente, rótulos de interesse, repetição isolada de tema/capa e Padrão armazenado como `null`, sem aprovação pela variante de visitante. Nenhuma requisição POST foi feita nesses percursos.
- A rodada extra inicial encontrou **seis falhas reais**: descarte da prévia de capa em memória sem persistir no Back. O ajuste chama `save()` no descarte; a nova prova dos seis pares passou. O arquivo `fronteiras-antes-persistir-back.json` permanece como histórico.
- O primeiro ensaio do harness tentou ler localStorage antes da primeira ação que o inicializa. Essa falha de bancada, com zero checks de produto, está preservada em `resultado-harness-inicial.json`; o roteiro foi corrigido. Rodadas intermediárias continuam identificadas, sem somar seus checks ao resultado final.

Os hashes antes/depois dos dois arquivos do módulo são registrados em cada resultado. A jornada comum ainda estava sendo integrada durante estes testes; a candidata completa deve ser congelada e passar pelas revisões independentes de fluxo, visual e acessibilidade. Este documento não atribui nota D1–D10, não aprova branding final e não transfere resultados para o app instalado.

Fonte final do módulo, estável nas três suítes: JS `451547b6e876aaa528a81ccb78b1e05b7d1e137bbbcb7a3b9082975fd8b08ff1`; CSS `d4fbe86e9123dadcea1f94d2dcc68dae91d311190dddf38c934625e42e099fc3`. As contagens acima são de suítes distintas e não somam rodadas históricas ou capturas como se fossem testes novos.
