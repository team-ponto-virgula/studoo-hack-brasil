# R6 — QA independente de leitura, foco e movimento

Candidata **`28b003e6c29728e1fd8c96f14efbb497353b0d10`**, examinada em 24/11/2026 em Chromium 156.0.8078.79, por HTTP. Revisão somente leitura do protótipo HTML. Fontes congeladas durante as execuções; nenhuma prova posterior será inserida nesta rodada.

**Resultado desta especialidade:** as três pendências médias R5 foram corrigidas e repetidas: nome160 no cartão/diálogo, foco de feedback/retry (K5) e foco das cores (NM-02). A regressão específica do título80 sem espaços, que não havia sido executada por esta QA na R5, agora tem prova nas duas larguras e escalas. D3/D5/D6/D7 recebem **9,0 em A/B/C no escopo examinado**.

**A candidata R6 não está globalmente aprovada.** O parecer de fluxo encontrou um médio separado na promessa pendente de copiar link: trocar da trilha própria para recebida e resolver a rejeição antiga abre um diálogo fora de contexto. Essa prova pertence ao fluxo/D9 e à próxima correção R7; esta QA não declara ter executado ou aprovado esse ramo. D9, D10 e nota global permanecem `null` neste parecer. A aprovação das facetas abaixo não apaga o achado de outro revisor.

## Fonte e artefatos novos

Os **17 HTML/JS/CSS recursivos** foram comparados por SHA-256 com os blobs do commit completo, antes e depois. A fonte permaneceu estável. O complemento `http-source.json` também verifica que as 17 respostas HTTP têm os mesmos bytes dos blobs. A lista completa inclui os quatro arquivos de material/personalização e o vendor, em `matriz.json`/`parecer-qa-r6.json`; não é uma lista fixa de 13 arquivos herdada de rodadas anteriores.

| Conjunto | Prova efetiva |
| --- | --- |
| Canônico | **210 PNGs novos DPR2**: 35 páginas × três direções × 390×844/360×800. Headers físicos conferidos: 780×1688/720×1600 pixels. |
| Estados comuns | **90 vistas DPR1**, 30 variantes × três direções em 360×800. |
| Texto a 200% comum | **105 vistas DPR1**, 35 páginas × três direções em 360×800; `s=longa` e fonte raiz 32 px. Não se presume dado longo injetado onde esse cenário não o implementa. |
| Variantes afetadas | **156 vistas DPR1**, 42 normais e 114 a 200%: erro/acerto dos seis formatos; parcial somente Associar/Aberta; câmera, galeria, leitura/prévia e capa. Três direções × duas larguras. |
| Longos explícitos | **24 cenários, 36 PNGs DPR1**: título técnico80 e material160 × três direções × duas larguras × 100%/200%. Cartão/apoio e diálogo capturados separadamente. |

As capturas de estados diretos conferem geometria e apresentação. Não são prova de todas as transições. Estados se sobrepõem entre conjuntos, por isso não se publica sua soma como quantidade de variantes únicas. As 210 bases são novas da R6; não servem como imagens da candidata R7.

## Métricas de leitura e acesso

| Medida | Jornada Azul | Caderno Claro | Foco Vivo |
| --- | ---: | ---: | ---: |
| Menor alvo canônico | 44 px | 44 px | 44 px |
| Menor CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto examinado | 12 px | 12 px | 12 px |
| Menor contraste normal canônico | 5,417:1 | 5,254:1 | 5,318:1 |
| Menor contraste normal com variantes | 5,417:1 | 5,254:1 | 5,212:1 |

Nos 210 canônicos, 90 estados comuns, 105 ampliados comuns e 156 dirigidos: **zero problemas métricos** de JavaScript, nome de controle, alvo abaixo de 44 px, auxiliar abaixo de 12 px, contraste textual, recorte/overflow horizontal ou botão de rodapé fora da viewport. Todos os botões do rodapé foram medidos, além do CTA principal. Legendas locais e a folha de capa passaram em 100%/200% nas duas larguras; a ação Etapa anterior foi exercitada no corpo, fora do rodapé.

Contraste: cores CSS computadas e fundos efetivos compostos por alfa, fórmula de luminância WCAG, 4,5:1 normal/3:1 grande, com textos desabilitados identificados separadamente. Inclui erro/acerto, seleção, navegação e rodapé. Não mede texto em raster, toda borda/ícone ou todas as condições de renderização física. Nomes computados por DOM foram complementados por interação/semântica dos diálogos, não por teste com leitor real.

## Repetição das pendências

**R5-A1 fechado.** O nome válido de 160 caracteres sem espaços (`a`×156 + `.pdf`) está completo no cartão da lição e no diálogo Origem [1], sem overflow. O apoio expandido continua legível. Os 12 cenários de material (seis pares × duas escalas) mantêm `scrollWidth=clientWidth` na área principal; Escape fecha e devolve foco ao acionador. `conteudo-longo.json` contém as caixas, texto, foco e capturas. São dados sintéticos da trilha ativa em localStorage, sem upload/OCR.

**Título80 explicitamente confirmado.** Um título de 80 caracteres sem espaços foi injetado no `.context small` da lição e conferido em 12 cenários. Texto completo, quebra e rodapé passam em 390/360 e 100%/200%. Esta prova fecha a lacuna de observação R5 desta especialidade; as vistas `s=longa` anteriores não foram usadas como substitutas.

**K5 fechado no escopo repetido.** As **120 transições** dos seis formatos agora levam ao sucessor exato esperado: feedback→Tentar de novo/Continuar, retry→select/campo/alternativa pertinente. Nenhuma termina em BODY ou no início Sair da lição ao pressionar o próximo Tab. Erro, acerto e os parciais de Associar/Aberta foram incluídos. Um complemento de VF com justificativa curta confirma seis casos/12 transições, com retry focando `#reason`. Seis acertos de Associar se sobrepõem ao lote principal; não são cobertura adicional.

**NM-02 fechado.** **144 casos centrais** de Enter/Espaço exercitam mudança e reativação das seis cores em todos os pares; foco e `aria-pressed` permanecem no botão. São acompanhados de 72 pré-condições, separadas da cobertura funcional. **54 verificações** adicionais exercitam Etapa anterior no corpo, Shift+Tab e navegação. Não houve restauração em avatar decorativo.

**Capas sem salto observado.** Doze seleções por Enter em seis pares, medindo o mesmo botão antes/depois de selecionar Oceano e Floresta: deltas máximos de top, scroll, largura e altura iguais a zero; foco/seleção corretos. São provas comportamentais separadas das capturas estáticas da folha.

## Regressão comportamental e movimento

| Roteiro de interação | Resultado R6 |
| --- | --- |
| Teclado/movimento comuns | **186/186 positivos** |
| Foto e sete guards | **42/42 positivos** |
| Bancada parcial | **66/66 positivos** |
| Material/personalização | **1.200/1.200 registros efetivos positivos** |
| Complemento K5 | **120/120 sucessores exatos** |
| VF com justificativa curta | **6/6 casos; 12 transições positivas** |
| Cores e etapa anterior | **270/270 registros**: 144 centrais, 72 pré-condições, 54 anterior |
| Capas sem deslocamento | **12/12 seleções positivas** |

Zero erros JavaScript nos roteiros finais. As contagens têm sobreposições e finalidades diferentes, explicitadas nos subpareceres; não constituem uma soma de casos únicos. O harness herdado de publicação esperava uma frase literal antiga: 24 rechecagens com a nova legenda “Estado de exemplo” substituem essas expectativas na consolidação, sem contagem adicional. O bruto foi preservado e a correção do harness não foi tratada como defeito do produto.

K1–K4b foram novamente exercitados: nomes dos diálogos, Escape/retorno; ordenação com anúncio e foco no item; gravação somente após ação e foco em Parar; parar/cancelar preservam texto; indisponibilidade mantém alternativa escrita; leitura de foto respeita foco escolhido, navegação, cancelamento e controle externo.

A foto usa bytes de fixture HTTP por `setInputFiles`, com FileReader/decode reais no navegador e controle da resolução para testar concorrência. Isso comprova o ramo local, sem provar o seletor/câmera nativos. Material usa os dois eventos locais de leitura; foco de Cancelar/Meu perfil e invalidação foram repetidos. O limite de áudio60s e a autenticação completa não foram novamente contados como testes R6; a prova temporal R5 continua identificada como histórica.

Entrada normal de 180 ms e uma iteração; seleção não reinicia a animação. Movimento reduzido do sistema/app conserva conteúdo e ações sem animação. Pendência, proposta e cancelamento da geração são timers locais demonstrativos, não medição de IA/rede, boot ou aparelho. O relatório de teclado registra os valores observados desta candidata.

## Notas e limites

| Critério | Jornada | Caderno | Foco | Escopo |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Conteúdo/fluxo completo fora desta especialidade. |
| D2 | null | null | null | Asserções dirigidas não aprovam todas as operações. |
| D3 | 9,0 | 9,0 | 9,0 | Geometria, longos e 200% sem médio aberto no conjunto examinado. |
| D4 | null | null | null | Parecer de arte/visual. |
| D5 | 9,0 | 9,0 | 9,0 | Movimento e controle repetidos. |
| D6 | 9,0 | 9,0 | 9,0 | Foco, nome/estado, contraste, alvos e ampliação repetidos nas variantes declaradas. |
| D7 | 9,0 | 9,0 | 9,0 | Resposta/espera/cancelamento locais observados. |
| D8 | null | null | null | Erros dirigidos comprovados; domínio integral pertence ao fluxo. |
| D9 | null | null | null | Médio clipboard comunicado por fluxo; sem aprovação aqui. |
| D10 | null | null | null | 35 bases e capturas não aprovam integralmente 18 famílias. |

DG3/DG4 passam **no conjunto examinado nesta especialidade**. DG1/DG2/DG5 aguardam consolidação de cobertura/fluxo; DG6/global não podem ser aprovados com o médio D9 conhecido. Não há 9,5/10 nem alegação de perfeição universal. A nota integral de cada direção depende dos pareceres competentes e da menor nota sustentada, conforme protocolo.

Não foram testados app React Native instalado, iOS/Android, VoiceOver/TalkBack, teclado virtual/safe area, seletor físico, microfone, permissões, OCR/IA/email/API/moderação reais ou pessoas. Persistência local não comprova servidor. C1–C10 do produto, paridade e liberação TestFlight permanecem separados. Nenhuma política de `file://` foi contornada.

## Evidências acessíveis

`/workspace/work/revisao-a11y-r6/`: `matriz.json`, `resumo.json`, 210 PNGs DPR2, estados/ampliados; `http-source.json`; `variantes-direcionadas.json`; `conteudo-longo.json`; `parecer-qa-r6.json`, com scripts reproduzíveis. `teclado/` e `novos-modulos/` preservam subpareceres, resultados e scripts novos. As fontes e provas R1–R5 permanecem intactas. Todas as execuções R6 foram encerradas e a fonte foi liberada explicitamente antes da R7; depois disso houve somente leitura dos JSONs e escrita deste parecer. Este parecer não reaproveita resultados antigos como se fossem execuções R6.
