# R2 — QA, acessibilidade e resposta do protótipo

Candidata **`31fb42736d15d75ed75d7c1cf046f01d81a9251d`**, revisada em 24/11/2026. Código e CSS permaneceram congelados durante as execuções. Revisão independente em Chromium headless, com três direções e dados sintéticos locais. Não houve alteração da fonte por este revisor.

**Resultado:** as correções principais da R1 foram comprovadas, mas a R2 ainda não atinge 9 em D3/D6. Permanecem dois achados médios novos — email longo e foco ao iniciar gravação — e dois detalhes baixos. D5/D7 sustentam 9,0 apenas nas facetas locais efetivamente observadas. Não há nota global nem validação nativa.

## Fonte e cobertura

| Fonte principal | SHA-256 R2 |
| --- | --- |
| `app.js` | `2ebf5cf30fca4f4b29e9af91a658c0692d85a809e16ae38f5f922a1bb62a6a15` |
| `accessibility.css` | `a05379e9a26e42a6a3f8dfdb06df35e2f730b85cd00fab2c962b8ddbaabe6d95` |
| `media-pages.js` | `35aa4f8a274a8b4b7857bc33a7b6da9a2580fc18fddcb0a3ae6d6f072021d42a` |
| `media-pages.css` | `61b5426cd3d4a8d3c06618bd3475d4fe7622e46b56f54d7a70e8c48444eb9e3c` |
| `social-pages.js` | `572a52154ab2a2d6aa681dfe6ee57b110826d8a12f461400e603039625e46a58` |
| `social-pages.css` | `8badea9270eee1c0345407ea069d3ad25fbf699bd01192838380cbc10ea6ddfe` |

O manifesto bruto registra hashes antes/depois de todos os 13 arquivos HTML/JS/CSS examinados, incluindo temas, índice e gerador QR. Os hashes foram estáveis. Os três HTMLs de entrega também foram comparados ao conteúdo do commit congelado e coincidiram.

| Conjunto | Execução e limite |
| --- | --- |
| Canônicas | **210 vistas:** 35 páginas × três direções × 390×844/360×800, com PNG e métricas. |
| Estados | **90 vistas em 360×800:** erros/acertos, seis formatos, espera/falha ao salvar, expiração, permissão/Activity, gravação/transcrição, Vale rever, trilha concluída e estados de publicação. |
| Texto a 200% | **120 casos únicos:** 105 páginas/direções e 15 formatos adicionais. Não somar novamente os 105 da matriz às mesmas páginas de outro roteiro. |
| Dados longos | **60 vistas:** dez páginas × três direções × texto 100%/200%, com nome, resumo, objetivo, título e email de exemplo longos. |
| HTMLs de entrega | **18 vistas por HTTP:** seis em cada bundle, incluindo as três páginas novas e perfil ampliado. Abertura direta por `file://` não foi acessada nem contornada. |
| Teclado e resposta | **312/318 checks positivos:** regressão 138/138; novos fluxos 174/180. As seis falhas são o mesmo achado de foco ao gravar, nas três direções e duas larguras. |

O texto a 200% foi obtido por `font-size` de raiz 32 px contra 16 px padrão. Não equivale a Dynamic Type, teclado virtual, zoom físico ou escala nativa. Os tempos são de um protótipo local, sem API/IA/microfone reais.

## Métricas positivas

| Medida nas vistas canônicas | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo |
| --- | ---: | ---: | ---: |
| Menor dimensão de alvo do app | 44 px | 44 px | 44 px |
| Menor altura de CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto renderizado | 12 px | 12 px | 12 px |
| Menor contraste de texto normal nos fundos efetivos examinados | 5,417:1 | 5,254:1 | 5,318:1 |

As 210 vistas canônicas tiveram zero erros JavaScript, alvos abaixo de 44 px, controles sem nome, auxiliares abaixo de 12 px, contraste de texto reprovado, overflow horizontal interno/externo ou controle de rodapé fora da viewport. As 90 variantes também passaram nas métricas aplicáveis. As falhas abaixo surgiram na ampliação/dados longos e na interação, e não são anuladas por esses resultados canônicos.

O contraste foi calculado a partir das cores computadas e fundos ancestrais, com mínimo estrito de 4,5:1 para texto normal e 3:1 para texto grande. Controles desabilitados foram identificados separadamente. Isso não certifica contraste de toda arte raster nem acessibilidade completa.

## Correções da R1 conferidas

- **Reflow prioritário:** Verdadeiro/Falso cabe a 200% nos três temas; Explorar, Perfil próprio, Perfil público e Interesses da R1 não repetem seus cortes nos casos-base da R2. Restou o detalhe baixo B1 em Conclusão, descrito abaixo.
- **Diálogos nomeados:** Mapa abre `dialog "Esta trilha"`; Perfil público abre `dialog "Cuidar deste espaço"`. Árvore acessível e Escape/retorno ao acionador passaram nos seis pares.
- **Ordenação:** o foco acompanha “Ler a tabela” ao mover para cima/baixo, e o status anuncia item e posição. Limites preservam foco e informam o limite. Seis pares passaram.
- **Seleção sem reentrada:** escolher uma resposta conserva foco e `aria-pressed`, sem repetir a animação de entrada da tela.

Os registros da R1 foram preservados. As expectativas de Tab no harness agora permitem o trânsito ao chrome do navegador apenas quando o documento perde foco; nenhum controle do fundo de um diálogo recebe foco.

## R2-A1 — email longo não quebra na confirmação de código

**Médio · D3/D6 · três direções, texto normal e 200%.** Endereço sintético usado: `nina.maria.albuquerque.estudante.de.programacao@example.test`. A frase “Enviamos um código para…” fica fora da largura, impedindo conferir o destinatário completo. A `.lead` não permite quebra do endereço.

| Direção | `app-main.scrollWidth`, texto 100% | Texto 200% | Largura disponível |
| --- | ---: | ---: | ---: |
| A | 493 px | 967 px | 360 px |
| B | 523 px | 1026 px | 360 px |
| C | 523 px | 1026 px | 360 px |

**Correção sugerida:** aplicar quebra segura a textos com dados longos, sem truncar/ocultar o endereço ou diminuir o texto ampliado. Repetir código, recuperação e demais mensagens que exibem email, mantendo ações e rascunho. Provas: `complemento.json` e `dadoslongos-*-codigo-{100,200}.png`.

Os outros 54 casos de nome, resumo, objetivo e título longos não reproduziram overflow ou corte nas métricas examinadas.

## R2-A2 — iniciar a gravação remove o foco do controle

**Médio · D6 · três direções × duas larguras.** Em Explique ao Stu, preencher texto, focar “Gravar minha explicação” e pressionar Enter. O botão é removido e o foco fica em `BODY`, com `document.hasFocus() === true`. O Tab seguinte chega a “Sair da lição”, em vez de manter a pessoa nos controles de gravação.

Esse caso difere do trânsito ao chrome nativo reconciliado na R1: aqui o foco continua dentro do documento, mas perdeu o contexto. A renderização do estado de gravação e o texto de status aparecem; falta um destino de foco deliberado.

**Correção sugerida:** após renderizar a gravação, focar “Parar gravação”, ou outro controle adequado. Repetir iniciar/parar/cancelar e indisponibilidade por teclado. Stop/cancel já devolvem foco à textarea e preservam o texto corretamente.

Provas: `teclado/gravacao-foco.json` e `teclado/novos-fluxos.json`. Nenhum microfone foi aberto; é um achado do HTML de proposta, sem inferência de defeito no app distribuído.

## Detalhes baixos

**B1 — Conclusão B a 200%.** A grade específica do tema B (`1fr 1.75fr 0.75fr`) vence o auto-fit compartilhado. A palavra “Seu”, em `metric strong` de 52 px, excede a largura em cerca de 2 px (`scrollWidth` 362 para 360). Não afetou CTA ou progresso, mas deve receber o mesmo reflow da grade. Prova: `matriz.json`, vista `caderno/conclusao/longa`, e `texto200-caderno-conclusao-360.png`.

**B2 — controles da bancada nos HTMLs de entrega.** Os selects `offline-direction`/`offline-page` têm 38 px de altura, nas três propostas. Os controles do app continuam com pelo menos 44 px. Ampliar os selects da bancada para 44 px melhora a comparação no celular; regenerar e repetir a conferência dos bundles. Prova: `standalone.json`.

## Novos fluxos e limites

- Foto de exemplo: zoom por setas, Home/End e botões; nome/valor acessível, percentual e transformação; formato selecionado; aplicar ao rascunho e salvar no perfil. Não houve requisição de upload, apenas GET ao servidor estático.
- Denúncia: vazio anuncia erro e foca o primeiro motivo; seleção por Enter conserva foco/estado; revisão preserva detalhes; confirmação mostra protocolo local e esclarece que nada foi enviado à equipe.
- Código Studoo: SVG nomeado, domínio demonstrativo identificado e campo de link; diálogo de compartilhar nomeado e Escape devolvendo foco.
- Gravação: parada/cancelamento preservam rascunho e devolvem foco à textarea; transcrição de exemplo só é acrescentada ao parar; Activity indisponível mantém texto e erro. O início ainda tem R2-A2.
- O seletor real de arquivo ficou **sem validação**: não houve evento `filechooser` em 30 segundos após a tentativa por teclado. O diagnóstico e seu navegador foram encerrados. Não se inferiu bug do app nem se contornou política; a imagem de exemplo não prova o seletor nativo.
- Os três bundles HTTP abrem, expõem 35 páginas e permitem trocar as páginas novas. Seus hashes coincidem com a candidata congelada. Abertura offline direta continua não demonstrada neste ambiente.

## Movimento e resposta local

Três direções: entrada única de **180 ms**, uma iteração, controles habilitados. Com `prefers-reduced-motion: reduce`, animação `none`, 0 s e nenhuma animação ativa; conteúdo/ações preservados. A preferência do próprio protótipo também passou por teclado.

Seis amostras: feedback de Reenviar em **0,2–0,4 ms** até a mutação e **0,6–19,5 ms** até callback de frame; estado pendente da geração em **2,6–4,4 ms**; proposta em **1606,2–1608,8 ms**, por timer local nominal de 1600 ms. Cancelar conserva o objetivo e impede retorno tardio. Não são medições de API, IA, pintura física ou fluidez em aparelho.

## Notas desta revisão

| Critério | A | B | C | Evidência/limite |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Clareza completa pertence ao parecer de fluxo. |
| D2 | null | null | null | Rodapés medidos; não aprova todo o domínio funcional. |
| D3 | 8,0 | 8,0 | 8,0 | R2-A1 médio aberto nas três direções. |
| D4 | null | null | null | Identidade/acabamento completos não são avaliados por esta especialidade. |
| D5 | 9,0 | 9,0 | 9,0 | Entrada/redução/seleção e ausência de bloqueio observadas. |
| D6 | 8,0 | 8,0 | 8,0 | R2-A1 e R2-A2 abertos, apesar da correção dos achados anteriores. |
| D7 | 9,0 | 9,0 | 9,0 | Feedback/espera/cancelamento locais medidos, sem equivalência a rede/nativo. |
| D8 | null | null | null | Novos fluxos parcialmente conferidos; nota completa com revisão de domínio. |
| D9 | null | null | null | Sem avaliação completa ou prova de persistência/API. |
| D10 | null | null | null | Há 35 páginas e estados na matriz, sem transferência para paridade web/app. |

**DG3 e DG4 continuam reprovados na R2.** Não há nota global nem meta de 9 aprovada por este parecer. A revisão do protótipo permanece separada de C1–C10 do produto; notas nativas e uso com pessoas continuam `null`/não realizado.

## Evidências preservadas

Pasta local `/workspace/work/revisao-a11y-r2/`:

- `matriz.cjs`, `matriz.json`, `resumo.json`: 210 vistas canônicas, 90 estados, 105 páginas/direções ampliadas, hashes e PNGs.
- `complemento.cjs`, `complemento.json`: 15 formatos adicionais a 200% e 60 vistas com dados longos, sem duplicar contagem.
- `standalone.cjs`, `standalone.json`: 18 vistas dos HTMLs por HTTP, SHA-256 e comparação com o commit congelado.
- `teclado/RELATORIO-TECLADO-R2.md`, `resumo.json`, `resultado.json`, `novos-fluxos.json`, `gravacao-foco.json`, `foto-arquivo-limitacao.json` e seus roteiros/capturas: interações, tempos e limites.

Este parecer foi escrito a partir dos arquivos já gravados, depois de avisar a coordenação do encerramento da execução. Nenhuma candidata posterior foi testada ou misturada a esta R2.
