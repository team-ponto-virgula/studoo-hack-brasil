# R5 — QA independente de leitura, acesso e movimento

Candidata **`5ad1225f586af063d58f694d4ebe705fcabca081`**, examinada em 24/11/2026, em Chromium 156.0.8078.79 por HTTP. A fonte ficou congelada durante as execuções e foi liberada explicitamente antes de qualquer correção R6. Este parecer usa somente os resultados R5 gravados. Nenhum código do protótipo foi alterado por esta revisão.

**Resultado:** K4b foi corrigido e os novos estados receberam provas adicionais. Permanecem **três achados médios**: nome de material longo estoura o cartão e o diálogo de origem; verificar/repetir exercício perde foco; mudar a cor do perfil perde foco. **D3/D6 = 8,0; D5/D7 = 9,0**, em cada uma das três direções, no escopo local abaixo. A meta da candidata não foi aprovada.

## Proveniência e conjuntos de prova

Os capturadores descobriram recursivamente **17 arquivos HTML/JS/CSS**, incluindo `material-pages.js/css`, `personal-pages.js/css`, `media-pages.js/css` e `vendor/qrcode.js`. Cada arquivo foi comparado por SHA-256 com seu blob no commit completo. Hashes antes/depois coincidem; `sourceStable=true`. A lista completa está em `matriz.json` e `parecer-qa-r5.json`. Descoberta recursiva evita deixar módulos novos fora de uma lista fixa.

| Conjunto | Execução efetiva e limite |
| --- | --- |
| Canônico | **210 PNGs novos DPR2**: 35 páginas × três direções × 390×844/360×800. Headers PNG conferidos: 780×1688/720×1600 pixels. Métricas em pixels CSS. |
| Estados da regressão comum | **90 vistas DPR1**, 30 variantes × três direções, em 360×800. Incluem seis formatos, erro/acerto, gravação/Activity, conclusão/salvamento, revisão e publicação. |
| Texto a 200% comum | **105 vistas DPR1**, 35 páginas × três direções, em 360×800, `font-size` raiz 32 px e `s=longa`. O cenário só acrescenta conteúdo onde implementado; não equivale a injetar todos os dados longos possíveis. |
| Novos estados | **150 vistas DPR1**, 50 cenas × três direções, em 360×800: material (14), perfil/publicação (7), configurar (5), entrada (4), geração (4), proposta (4), início (3), mapa (1), lição (1), parcial Associar/Aberta (2), envio (2), Explorar (3). |
| Novos estados a 200% | **51 vistas DPR1**, 17 variantes por direção. Incluem leitura/prévia e erros de material, capas, erros de campos, postagem, geração parcial/longa, proposta longa, parciais, erro de envio e Novas. |
| Nome de material com 160 caracteres | **Seis cenários**: três direções × 100%/200% em 360; cartão/apoio e diálogo capturados separadamente, **12 PNGs**. |
| Teclado e movimento comuns | **186/186** verificações positivas. |
| Guards da leitura de foto | **42/42** positivos, sete ramos × seis pares. |
| Limite do áudio de exemplo | **30/30** positivos com relógio controlado, cinco verificações × seis pares. |
| Novos módulos, interação | **1.200 registros efetivos**, 1.164 positivos e 36 falhas: 30 de cor e seis de Associar/K5. Não são 1.200 fluxos nem telas. |
| Rechecagens dos módulos | **78/78** positivas; 24 substituem expectativas inadequadas do harness, 54 são adicionais. Resultados brutos preservados. |
| Complemento de foco de exercícios | **120 transições**, todas com perda de foco; seis se sobrepõem ao lote principal. Não somar a sobreposição como cobertura nova. |

As vistas de estados foram abertas diretamente e conferidas fisicamente; **não constituem prova de que todas as transições funcionam**. Interações e suas asserções estão nos JSONs separados. Alguns estados existem nos dois conjuntos de captura; não se publica uma soma como quantidade de variantes únicas. As 210 bases pertencem à R5 e não podem receber etiqueta de R6.

## Leitura, contraste e alvos

| Medida | Jornada Azul | Caderno Claro | Foco Vivo |
| --- | ---: | ---: | ---: |
| Menor alvo canônico | 44 px | 44 px | 44 px |
| Menor CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto examinado | 12 px | 12 px | 12 px |
| Menor contraste de texto normal canônico | 5,417:1 | 5,254:1 | 5,318:1 |
| Menor contraste normal incluindo novos estados | 5,417:1 | 5,254:1 | 5,212:1 |

Nos **210 canônicos, 90 estados comuns, 105 ampliados comuns e 201 novos estados/ampliados**, os dados padrão não produziram erros JavaScript, controles sem nome, alvos abaixo de 44 px, auxiliares abaixo de 12 px, contraste textual reprovado, recorte/overflow horizontal ou controle do rodapé fora da viewport. Todos os botões do rodapé foram medidos, além do CTA principal. A falha de conteúdo longo abaixo foi conferida separadamente e permanece aberta; o resultado padrão não a apaga.

O cálculo de contraste usa cores CSS computadas, composição alfa com os fundos efetivos dos ancestrais e luminância WCAG: 4,5:1 para texto normal e 3:1 para grande. Textos desabilitados foram identificados separadamente. Foram incluídos erro/acerto, rodapé, navegação, seleção e estados novos; o menor valor adicional (Foco Vivo) é `Selecionada` na folha de capa, 12 px sobre RGB(233,238,255). A prova não mede contraste de texto dentro de imagens, todas as bordas/ícones nem toda variação de rasterização.

## Achados médios

### R5-A1 — nome válido de material não quebra no cartão e na origem

**D3/D6 · três direções · 100% e 200% em 360.** Referência de material da trilha ativa com nome `a` repetido 156 vezes seguido de `.pdf`, total 160 caracteres, dentro do limite declarado. O cartão `.source-card small` mantém o token numa linha, provocando overflow da área principal. Em Jornada, `.app-main.scrollWidth` chega a **1170/2268 px**, para largura de 360, em 100%/200%; Caderno e Foco reproduzem a mesma classe de falha.

Abrir **Conferir origem [1]** repete o problema no parágrafo do diálogo: largura útil 280 px, `scrollWidth` **1351/2701 px** em 100%/200%. A caixa externa permanece na viewport, mas o nome não fica integralmente legível. O apoio expandido `.study-details` quebra corretamente. Escape fecha o diálogo e devolve foco a `show-source` em todos os seis cenários.

Sugestão de correção: permitir encolhimento/quebra no conteúdo do cartão e no texto do diálogo, conservando o nome completo. Não encurtar o dado do teste para produzir aprovação. Prova independente: `material-nome160.json`, `material-nome160.cjs` e 12 PNGs; dados inseridos somente no localStorage do protótipo, sem upload/OCR. O parecer visual já havia encontrado a mesma classe no cartão; o diálogo é extensão reproduzida nesta QA.

### K5 — verificar e repetir exercício perdem a posição de teclado

**D6 · seis formatos × três direções × duas larguras.** Ativar `Verificar resposta` remove o botão focado e deixa `document.activeElement=BODY`. O próximo Tab alcança `Sair da lição`. `Tentar de novo` também é removido sem que a alternativa ou campo pertinente receba foco. Há **120 transições reproduzidas**: 36 erro→feedback, 36 retry→resposta, 36 acerto→feedback e 12 retries parciais de Associar/Aberta.

Roteiro mínimo: `?d=jornada&p=exercicio&f=associar&s=parcial` → focar `Tentar de novo` e Enter → corrigir Maior ou igual para `>=` → focar Verificar e Enter. O resultado visual aparece, mas o foco fica em BODY e exige novo percurso. Os pares corretos permanecem bloqueados e conservados, comportamento aprovado separadamente.

Sugestão: sucessor deliberado do botão removido em cada etapa; retry deve levar ao controle a corrigir. Uma restauração genérica de qualquer BODY não é prova suficiente. Evidência: `novos-modulos/exercicios-foco.json`, script e seis PNGs de Associar. Os seis acertos presentes no lote principal não foram somados novamente.

### NM-02 — mudar a cor do perfil perde foco

**D6 · cinco mudanças de cor × seis pares = 30 falhas.** Em Editar perfil, focar Verde e Enter altera `aria-pressed` e a prévia, mas deixa foco em BODY. O mesmo ocorre com Laranja, Roxo, Rosa e Turquesa. Ativar a cor já selecionada mantém foco. Depois do render, o seletor amplo `[data-hue=...]` também encontra o avatar decorativo `DIV`; o índice anterior alcança um elemento não focável.

Sugestão: preservar a identidade dos controles equivalentes, excluindo elementos decorativos da coleção de restauração. Evidência: `novos-modulos/resultados-resolvidos.json`, suíte `profile limits interests hue and keyboard preservation`, e relatório independente do colaborador. Nenhuma correção foi aplicada nesta fonte.

## O que foi confirmado por interação

K1/K2/K3 seguem positivos: diálogos nomeados com Escape/retorno ao acionador; reordenação mantém o item e anuncia posição; iniciar gravação por Enter foca Parar, e parar/cancelar devolve a textarea e conserva o rascunho. Activity indisponível mantém a opção de texto.

**K4b fechado:** sete guards da foto passaram nos seis pares. Bytes WebP do repositório foram fornecidos ao input com `setInputFiles`, por HTTP. Sucesso/erro recuperam o controle deliberado; cancelamento/navegação invalidam resultados; foco escolhido em Cantos suaves, Meu perfil (`data-go`) ou fora do app é respeitado. O ramo de FileReader/decode foi exercitado; o seletor físico não foi validado.

Material: seletor de exemplos locais nomeado, abertura/fechamento por teclado; prévias PDF/DOCX/CSV com seções reais e conteúdo sem campos editáveis; CSV com caption e cabeçalhos; confirmação explícita e referência da trilha; nove erros com alerta/recuperação. Os callbacks locais de 600/1200 ms preservam Meu perfil; Cancelar leitura conserva foco enquanto existe, e a conclusão leva ao título se esse controle desapareceu. Cancelar/navegar invalida callbacks; rejeitar substituição preserva material confirmado. Câmera e galeria permanecem simulações declaradas.

Perfil/configurar: 12 IDs de interesses, limite cinco e foco/`aria-pressed`; limites do nome 2–40 e resumo 160; erros indicam campo e foco. Treze capas (Padrão + 12) e 12 temas mantêm seleção/foco, cancelar conserva texto e descarta aparência, aplicar retorna ao acionador e persiste localmente na trilha ativa. Erros/retries de nome/descrição/capa/tema foram exercitados. O limite/foco positivo desses controles não abrange a cor do perfil defeituosa.

Publicação local: confirmação nomeada, Escape/retorno, pendente/aprovada/recusada/retirada declarados sintéticos; retirada conserva cópia/progresso/moderação, desfazer restaura visibilidade. Balões concluído/atual/bloqueado, origem e recomeço têm nome/retorno; recomeçar conserva progresso concluído. Etapa anterior retorna ao conceito e foca o título. A checagem de origem com nome padrão passa; a variante longa R5-A1 continua aberta.

O colaborador preservou os resultados iniciais do harness: 24 expectativas foram substituídas por provas melhores (nó real AND e existência das seções de prévia). Essas correções não são defeitos atribuídos ao protótipo nem asserções novas. No diálogo HTML, o intervalo de foco na fronteira do navegador foi tratado separadamente: nenhum controle de fundo é alcançado e o Tab seguinte volta ao diálogo. K5 é perda na página sem diálogo, com Tab seguinte alcançando a saída, por isso é um defeito distinto.

## Movimento e resposta local

Entrada normal de **180 ms**, uma iteração; seleção de resposta não reinicia a entrada. Movimento reduzido do sistema e do app mantém conteúdo/ações com animação `none`, duração zero e sem animação ativa. O toggle do app responde por teclado e conserva foco.

Geração demonstrativa: pendência observada em **2,8–18,6 ms**, proposta em **1608,4–1651,5 ms**, para timer nominal local de 1600 ms. Cancelar conserva objetivo e impede proposta tardia. Os dois eventos de leitura de material e o limite de áudio foram aferidos com relógio controlado, não como latência física.

Áudio de exemplo continua ativo aos 59,5 e 59,999 s; para aos **60,000 s**, preserva o rascunho, acrescenta uma única transcrição e foca a textarea. Avançar mais 10 s não duplica. `getUserMedia` permaneceu em zero. É prova da regra temporal local, sem microfone, permissões ou segundo plano de aparelho.

## Notas, gates e limites

| Critério | Jornada | Caderno | Foco | Base da nota |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Parecer completo de conteúdo/fluxo fora desta especialidade. |
| D2 | null | null | null | Controles dirigidos não aprovam todo o domínio. |
| D3 | 8,0 | 8,0 | 8,0 | Nome160 corta a leitura no cartão e diálogo. |
| D4 | null | null | null | Acabamento depende do parecer de arte/visual. |
| D5 | 9,0 | 9,0 | 9,0 | Movimento normal/reduzido e controle efetivamente repetidos. |
| D6 | 8,0 | 8,0 | 8,0 | Foco K5/NM-02 e leitura longa com dívida concreta. |
| D7 | 9,0 | 9,0 | 9,0 | Estados/tempo/cancelamento locais medidos; sem desempenho de rede. |
| D8 | null | null | null | Erros dirigidos têm prova; conjunto integral é do parecer de fluxo. |
| D9 | null | null | null | localStorage não comprova servidor ou continuidade do produto. |
| D10 | null | null | null | Capturas base não aprovam todas as folhas/18 famílias. |

**DG3/DG4 reprovados; DG6 não pode passar com médios abertos.** DG1/DG2/DG5 e nota global ficam `null` neste parecer especializado, aguardando consolidação competente. Não há arredondamento para a meta 9.

A regressão específica com injeção do título técnico sem espaços no `.context` da R4 **não foi repetida em um lote separado nesta QA R5**. As 105 vistas `s=longa` não a substituem; sua confirmação depende da prova visual ou da rodada seguinte. Nenhuma prova de outra rodada foi reetiquetada. Autenticação comum inalterada não foi repetida funcionalmente por este colaborador; seus estados novos receberam capturas, não aprovação herdada.

Não foram executados app React Native instalado, iOS/Android, VoiceOver/TalkBack, teclado virtual, seletor/câmera/microfone nativos, serviço de OCR/IA, email, moderação ou API reais. Não houve teste com pessoas, taxa de sucesso ou prova de produção. `file://` e políticas não foram contornados. C1–C10 do produto e aprovação de TestFlight permanecem separados.

## Arquivos acessíveis

Raiz de evidências: `/workspace/work/revisao-a11y-r5/`. `matriz.json`/`resumo.json` e os 210 PNGs DPR2; `estados-novos.json`; `material-nome160.json`; `parecer-qa-r5.json`; scripts `matriz-final.cjs`, `source-guard.cjs`, `estados-novos.cjs`, `material-nome160.cjs` e `consolidar-parecer.cjs`. O consolidado foi gerado somente a partir dos JSONs gravados e confirma os headers dos PNGs, sem novas visitas ao app após a liberação da fonte.

Subpareceres: `teclado/RELATORIO-TECLADO-R5.md`, seus três JSONs/scripts; `novos-modulos/RELATORIO-NOVOS-MODULOS-R5.md`, `resultados-resolvidos.json`, `rechecagens.json`, `exercicios-foco.json`, resultados brutos e capturas. Fonte e artefatos R1–R4 permanecem preservados nos respectivos diretórios; esta rodada não sobrescreve suas notas.
