# R3 — regressão dirigida e capturas finais da candidata

Candidata **`902eca4e3a8e8ac374d79972677a1ed3edc83859`**, examinada em 24/11/2026. Revisão somente leitura; fontes congeladas e hashes estáveis. A execução terminou antes de liberar a fonte para a rodada seguinte. Nenhuma evidência posterior foi misturada à R3.

**Resultado:** foco ao iniciar gravação foi corrigido, mas D3/D6 continuam em 8. O email longo ainda transborda nos avisos de código expirado/recuperação enviada, e a leitura assíncrona de uma imagem local perde o foco. A meta de 9 não foi aprovada nesta rodada.

## Escopo e fonte

- **210 capturas canônicas:** 35 páginas × três direções × 390×844/360×800. Foram geradas a **DPR 2**, em 780×1688/720×1600 pixels; as métricas continuam em pixels CSS. Esse conjunto serve à entrega visual e à conferência de geometria/contraste, sem alegar repetição de todos os fluxos funcionais.
- **18 casos de email longo em 360×800:** três direções × código principal/código expirado/recuperação enviada × texto 100%/200%. São seis casos positivos e 12 reproduções da falha nas notas. Não somar esses 18 a uma suposta matriz completa de texto ampliado da R3.
- **186/186 checks dirigidos de teclado/movimento/resposta positivos**, três direções e duas larguras. Seis diagnósticos adicionais de imagem local reproduzem o achado K4; estão separados dos 186 positivos.
- A suíte de autenticação completa da R2 e seus 120 casos únicos ampliados não foram repetidos: essa evidência histórica permanece identificada com sua própria fonte.

| Arquivo | SHA-256 da R3 |
| --- | --- |
| `app.js` | `6cdf759ffc9210ce52e861625b5e5cbaf27a59016f692e15f2f95bd5e7050ce1` |
| `accessibility.css` | `7fd9adaff403f1a538c9da45238baf3061c16ee42179df968a192d1b61c8c732` |
| `media-pages.js` | `35aa4f8a274a8b4b7857bc33a7b6da9a2580fc18fddcb0a3ae6d6f072021d42a` |

`matriz.json` registra os hashes antes/depois dos 13 arquivos HTML/JS/CSS, o commit, o navegador, dimensões e DPR. Todos coincidiram durante essa captura.

## Métricas canônicas

| Medida | A | B | C |
| --- | ---: | ---: | ---: |
| Menor alvo do app | 44 px | 44 px | 44 px |
| Menor CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto renderizado | 12 px | 12 px | 12 px |
| Menor contraste normal examinado | 5,417:1 | 5,254:1 | 5,318:1 |

Nas 210 vistas canônicas: zero erros JavaScript, controles sem nome, alvos abaixo de 44 px, texto abaixo de 12 px, contraste de texto reprovado, overflow horizontal interno/externo ou controle de rodapé fora da viewport. Esse resultado não cobre automaticamente os casos com dados longos abaixo.

## Correções confirmadas

- **K1:** menus de trilha/perfil público nomeados, com Escape devolvendo foco ao acionador.
- **K2:** foco acompanha o item ordenado para cima/baixo; posição e limite são anunciados.
- **K3 fechado:** Enter em Gravar transfere foco para **Parar gravação**, com documento focado e outline sólido de 3 px nos seis pares. Parar/cancelar devolvem a textarea e preservam rascunho; transcrição de exemplo só é acrescentada ao parar. Indisponibilidade não inicia gravação.
- Selecionar resposta não reinicia a entrada da tela; switches de movimento reduzido mantêm foco e estado.
- Os dois seletores da bancada autossuficiente medem pelo menos 44×44 px e navegam por teclado nos seis pares. Isso fecha o detalhe de 38 px da R2.
- A frase de email na **tela principal de código**, em `.lead`, agora quebra nos seis casos com texto normal/ampliado examinados.

Não se declarou o reflow de todos os subestados encerrado apenas por ter corrigido a `.lead`.

## R3-A1 — email longo ainda não quebra nas notas

**Médio · D3/D6 · três direções.** Endereço sintético: `nina.maria.albuquerque.estudante.de.programacao@example.test`. Os estados **Código expirado** (`p=codigo&s=expirada`) e **Recuperação enviada** (`p=recuperar&s=enviado`) colocam o endereço em `.note > span`, fora da regra nova da `.lead`.

| Estado, largura 360 px | A 100% / 200% | B 100% / 200% | C 100% / 200% |
| --- | ---: | ---: | ---: |
| Código expirado: largura interna | 508 / 948 px | 508 / 948 px | 479 / 890 px |
| Recuperação enviada: largura interna | 512 / 955 px | 512 / 955 px | 482 / 896 px |

O endereço fica cortado e exige deslocamento horizontal para ser lido. É a mesma classe de falha de dados longos da R2, agora reproduzida em dois subestados próprios de P03. Não foi tratado como falha corrigida pelo sucesso da tela principal.

**Correção sugerida:** permitir quebra e encolhimento do conteúdo da nota, por exemplo em `.note > span`, preservando endereço, ícone e leitura a 200%. Repetir os dois estados nas duas larguras e o código principal como regressão.

Provas: `email-notas.json` e `email-{direção}-{codigo|recuperar}-{expirada|enviado}-{100|200}.png`, na pasta da R3.

## K4 — leitura local da foto perde o foco

**Médio · D6 · três direções × duas larguras.** Em Foto por HTTP, focar Escolher imagem e fornecer uma fixture WebP do próprio repositório ao input via `setInputFiles`. A leitura termina, produz `data:image/webp`, habilita o slider e informa que a imagem está pronta. O foco, porém, fica em `BODY`, com `document.hasFocus() === true`; o Tab seguinte vai a Voltar, no cabeçalho.

**Correção sugerida:** ao terminar ou falhar a leitura, devolver foco ao acionador ou a um controle deliberado, sem puxá-lo depois de navegação/cancelamento. Respeitar o token da leitura e a página atual.

A fixture verifica o ramo de leitura local, não o seletor nativo nem sua abertura por teclado. Não houve navegação `file://`, alteração de política ou upload; zero requisições após fornecer a fixture. O seletor real continua sem validação. Prova: `teclado/foto-fixture-foco.json`.

## Movimento e resposta

Nos seis pares: entrada normal única de **180 ms**, uma iteração, controles habilitados; preferência reduzida produz animação `none`, 0 s e nenhuma animação ativa, mantendo ações/conteúdo. A preferência do próprio protótipo e a ausência de reentrada ao selecionar também passaram.

Geração local: cancelamento disponível, objetivo conservado e nenhum retorno tardio. Seis amostras tiveram pendência em **2,5–5,7 ms** e proposta em **1607,1–1610,3 ms**, com timer demonstrativo nominal de 1600 ms. Isso não é desempenho de IA/API, pintura física ou aparelho.

## Notas deste parecer

| Critério | A | B | C | Escopo |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Sem revisão completa de compreensão. |
| D2 | null | null | null | Rodapés e controles dirigidos conferidos; domínio completo com parecer de fluxo. |
| D3 | 8,0 | 8,0 | 8,0 | R3-A1 aberto nas três direções. |
| D4 | null | null | null | Acabamento/branding completos pertencem ao parecer visual. |
| D5 | 9,0 | 9,0 | 9,0 | Movimento observável e redução revalidados. |
| D6 | 8,0 | 8,0 | 8,0 | R3-A1 e K4 médios abertos. |
| D7 | 9,0 | 9,0 | 9,0 | Resposta/espera/cancelamento locais novamente medidos. |
| D8 | null | null | null | Parada/cancelamento e ordenação conferidos; nota completa exige o fluxo inteiro. |
| D9 | null | null | null | Sem prova completa de confiança/persistência real. |
| D10 | null | null | null | Matriz canônica de 35 páginas completa; não é aprovação de todos os subestados ou paridade de renderizadores. |

**DG3 e DG4 continuam reprovados na R3.** Não há nota global. C1–C10 do produto, uso de leitor de tela, teclado virtual, gestos, permissões e desempenho nativos continuam sem aprovação por esta revisão.

## Evidências

Pasta local `/workspace/work/revisao-a11y-r3/`:

- `matriz-final.cjs`, `matriz.json`, `resumo.json`: 210 PNGs DPR2, métricas canônicas e hashes estáveis.
- `notas-email.cjs`, `email-notas.json` e capturas: 18 casos, sem duplicar contagem com rodadas anteriores.
- `teclado/RELATORIO-TECLADO-R3.md`, `resultado.json`, `resumo.json`, `foto-fixture-foco.json`, roteiro e capturas: 186 checks positivos e seis casos adicionais de K4, com limites explícitos.

As imagens da R3 são identificadas com a fonte R3. Para uma candidata posterior, só reutilizar uma captura se a equivalência do quadro afetado estiver comprovada e a proveniência permanecer explícita; não rebatizar a imagem como se tivesse sido capturada em outro commit.
