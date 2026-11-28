# R1 — QA, acessibilidade e resposta do protótipo

Revisão independente da candidata **`62ef474f34a31e2e0a0d5bb0cc2fa721b709fc5f`**, em 24/11/2026. Somente leitura do código; nenhum arquivo do protótipo foi alterado por esta revisão. Chromium headless com viewport mobile, dados e armazenamento locais. **Não houve execução React Native, iPhone/Android, leitor de tela, teclado virtual ou teste com pessoas.**

**Resultado:** a candidata ainda não atinge a meta de 9 em D3/D6. Três achados médios precisam de correção e repetição dos casos. As métricas canônicas são boas, mas não anulam as falhas a 200%, os nomes dos diálogos e o foco na reordenação.

## Fonte e escopo observado

Hashes SHA-256 registrados antes/depois das capturas e preservados nos resultados:

| Arquivo do protótipo | SHA-256 R1 |
| --- | --- |
| `app.js` | `32987017a0f36af58adb72eaa94fcb64f51260f2751ebdef2c1f895fae45ef43` |
| `base.css` | `521be8114a6c02d8b91bf74b9d1ba2a903472fc7959ac57c6fe49b9e83c1207b` |
| `accessibility.css` | `2dbfc581ed3cc6ac2cd6316e916ddf0316ddec352a4fa8d80f9316d8fed3902e` |
| `directions/jornada.css` | `b7bce47a0238054802eb1c3b3db583ebd879745cba0bc33766f6f1ce6f239c28` |
| `directions/caderno.css` | `781e22ae783a0d7a1b7af77fbc793826010212b13c5b0c8dd419395495de635d` |
| `directions/foco.css` | `7e79f3a66db34001b3f6e33cd51cee932755415bf9cf0eb41418ac3e23c0ecb6` |

- **192 vistas canônicas:** 32 páginas × três direções × 390×844/360×800, com PNG e métricas por vista.
- **48 variantes em 360×800:** erro/acerto e seis formatos de exercício; salvando/falha ao salvar; proposta/código expirados; permissão indisponível; vazio; falha de geração.
- **111 casos únicos com texto a 200% em 360×800:** 32 páginas por direção com conteúdo longo e os cinco formatos adicionais de exercício. A primeira passagem de 54 casos está preservada, mas é subconjunto repetido e não é somada aos 111.
- **Teclado, foco, movimento e resposta local:** três direções e as duas larguras; roteiro e reconciliação de seis expectativas excessivamente estritas de Tab preservados. Dois defeitos adicionais foram reproduzidos por árvore acessível e interação, descritos abaixo.

O redimensionamento de texto foi feito por `font-size` da raiz em 32 px, contra 16 px padrão. É uma prova de reflow do protótipo web; não equivale a Dynamic Type, zoom físico ou escala de fontes nativa.

## Métricas positivas, com limites

| Medida canônica | Jornada Azul | Caderno Claro | Foco Vivo |
| --- | ---: | ---: | ---: |
| Menor dimensão de alvo | 44 px | 44 px | 44 px |
| Menor altura de CTA primário de rodapé | 52 px | 52 px | 52 px |
| Menor texto renderizado | 12 px | 12 px | 12 px |
| Menor contraste de texto normal nos fundos efetivos examinados | 5,417:1 | 5,254:1 | 5,318:1 |

As 192 vistas canônicas tiveram zero `pageerror`, overflow horizontal do documento, controles sem nome, alvos abaixo de 44 px, auxiliares abaixo de 12 px ou CTA primário de rodapé fora da viewport. As 48 variantes também passaram nas métricas de tamanho, texto e contraste. Isso não certifica todos os gestos ou todos os fluxos funcionais.

O contraste foi calculado pelas cores computadas, compondo fundos ancestrais, com mínimo 4,5:1 para texto normal e 3:1 para texto grande. Controles desabilitados foram identificados separadamente. Não houve par abaixo do mínimo estrito nos textos examinados; a pesquisa não transfere esse resultado a artes raster, leitores de tela ou outros renderizadores.

## A1 — reflow a 200% corta conteúdo e uma alternativa de resposta

**Severidade média · D3/D6.** Reproduzido em 360×800 com texto a 200%. O documento externo não transborda porque a moldura contém o conteúdo; o `scrollWidth` do `.app-main` revela a rolagem horizontal interna e os recortes.

| Tela/variante | A | B | C | Efeito |
| --- | ---: | ---: | ---: | --- |
| Exercício Verdadeiro/Falso | 423 px | 419 px | 411 px | Grade continua com duas colunas; a alternativa **Falso** fica fora da largura visível. |
| Explorar | 375 px | 388 px | sem reprodução | `section-title` não quebra; a etiqueta Demonstração é cortada à direita. |
| Perfil próprio | 364 px | 366 px | sem reprodução | Métricas fixas em três colunas; rótulo “trilhas públicas” excede a largura. |
| Perfil público | 378 px | 376 px | sem reprodução | Cabeçalho com avatar/título/etiqueta/menu excede a largura. |
| Interesses | 362 px | 362 px | sem reprodução | A palavra longa no título excede discretamente a margem. |

Os valores acima são `app-main.scrollWidth`; a largura disponível é **360 px**. Em Explorar, a borda direita da etiqueta está em 374,95 px na direção A e 387,91 px na B. A falha de Verdadeiro/Falso é prioritária por afetar a leitura de uma opção interativa, e não somente uma decoração.

**Correção sugerida:** permitir reflow das grades segundo o tamanho do texto, em vez de manter duas/três colunas; habilitar quebra/min-width 0 em títulos, seções e cabeçalhos de perfil. Repetir os 111 casos, incluindo todas as seis variantes de exercício, e medir também o overflow interno. Não resolver diminuindo o texto ampliado ou escondendo informação.

Provas locais: `complemento200.json`, `reflow-defects.json`, `complemento200-*-exercicio-verdadeiro.png` e `reflow-*-explorar/perfil.png`, na pasta de QA indicada ao fim.

## A2 — menus modais sem nome acessível

**Severidade média · D6.** Em Mapa, abrir **Opções da trilha**; em Perfil público, abrir **Opções deste perfil**. Os dois `<dialog>` têm título visível, mas não têm `aria-label` nem `aria-labelledby`. O snapshot de acessibilidade começa com `dialog:` sem nome. Reproduzido nos três temas, seis casos em 390 px.

**Correção sugerida:** dar um ID ao heading e associá-lo ao diálogo, ou fornecer nome equivalente. Repetir a leitura da árvore acessível e a saída por Escape com retorno ao acionador. Os diálogos criados por `ask`, como Dica, já têm nome; o problema não é geral a todos os diálogos.

Prova: `teclado/dialog-names.json`.

## A3 — a reordenação mantém foco no índice antigo, mudando de item

**Severidade média · D6/D8.** Abrir Exercício → Ordenar. Focar **Mover Ler a tabela para cima** (`move-up-2`) e pressionar Enter. O item passa à segunda posição, mas o foco continua em `move-up-2`, agora pertencente a **Selecionar as colunas**. Nenhuma região viva anuncia item e posição. Reproduzido nos três temas e nas duas larguras, seis casos.

**Correção sugerida:** preservar a identidade do item movido, restaurar o foco na sua ação correspondente na posição resultante e anunciar sua nova posição. Repetir movimentos para cima/baixo, limites da lista e conferência final.

Prova: `teclado/ordenar-foco.json`.

## Teclado, movimento e resposta local

Passaram os percursos de Tab em entrada, mostrar/ocultar senha sem perda, switches por Space/Enter mantendo foco e `aria-checked`, Dica por Escape/Entendi com retorno ao acionador, confirmação destrutiva cancelável e cancelamento de geração sem reaparecimento tardio da proposta.

Seis asserções iniciais esperavam que o foco nunca fosse reportado como `BODY` ao ultrapassar o último botão de um diálogo. O controle mínimo de `<dialog>` nativo reproduziu a passagem ao navegador (`document.hasFocus() === false`). A reconciliação confirmou fundo inerte e nenhum controle do fundo focado. Esses seis registros foram preservados e não são classificados como defeito do produto. O roteiro original tem 138 asserções, com 132 positivas e seis expectativas estritas reconciliadas; não foi silenciosamente reescrito como 138 verdes.

- Movimento normal: uma entrada de 180 ms, uma iteração, sem desabilitar ações durante a transição.
- `prefers-reduced-motion: reduce`: três direções com `animation-name: none`, duração 0 s e nenhuma animação ativa, preservando conteúdo/ações.
- Os quatro WebP do protótipo não contêm animação; não há loop de personagem nesses assets.
- Reenviar código: feedback local em 0,2–0,3 ms; primeiro callback de frame observado entre 0,5–22,3 ms, seis amostras.
- Geração: estado pendente em 2,4–9,8 ms; proposta em 1606,3–1618,8 ms, seis amostras. É o **timer local nominal de 1600 ms**, não desempenho de IA/rede. Cancelar preservou o objetivo e impediu o retorno tardio.

## Notas desta revisão

Notas iguais nas três direções indicam o mesmo comportamento compartilhado efetivamente observado; não são uma média de preferências. Critérios fora da competência ou sem prova completa deste parecer ficam `null`.

| Critério | A | B | C | Justificativa |
| --- | ---: | ---: | ---: | --- |
| D1 | null | null | null | Compreensão e textos completos pertencem ao parecer de fluxo. |
| D2 | null | null | null | CTA de rodapé medido, mas este parecer não aprova todo o domínio funcional. |
| D3 | 8,0 | 8,0 | 8,0 | A1 aberto; C também corta a alternativa em Verdadeiro/Falso. |
| D4 | null | null | null | Sem avaliação independente completa de identidade/acabamento nesta especialidade. |
| D5 | 9,0 | 9,0 | 9,0 | Movimento local observável preserva ação e respeita redução; sem prova nativa. |
| D6 | 8,0 | 8,0 | 8,0 | A1/A2/A3 abertos, apesar dos bons pares de contraste e alvos. |
| D7 | 9,0 | 9,0 | 9,0 | Feedback, espera e cancelamento locais observados; tempos simulados identificados. |
| D8 | null | null | null | Faceta de reordenação tem limite de 8 até A3; a nota completa exige a revisão de fluxo. |
| D9 | null | null | null | Não avaliado completamente aqui; sem prova de API ou persistência real. |
| D10 | null | null | null | As 32 páginas estão na matriz, mas este parecer não aprova todos os subestados das 18 famílias. |

**DG3 e DG4 reprovados na R1.** Os demais gates não são consolidados por este parecer. Não há nota global nem meta de 9 aprovada para a candidata R1. A correção pode ser reavaliada com uma fonte nova, mantendo este histórico.

## Arquivos de evidência

Pasta local: `/workspace/work/revisao-a11y-r1/`.

- `matriz.cjs`, `matriz.json`, `resumo.json`: roteiro, métricas, hashes e 192 PNGs canônicos, 48 estados e primeira passagem de texto ampliado.
- `complemento200.cjs`, `complemento200.json`: 111 casos únicos de texto ampliado, hashes e capturas.
- `reflow-defects.cjs`, `reflow-defects.json`: medidas e recortes sob rolagem dos defeitos de largura.
- `teclado/RELATORIO-TECLADO.md`, `resultado.json`, `resumo.json`, `dialog-names.json`, `ordenar-foco.json`, controles de diálogo e reconciliação: provas de comportamento, tempos e achados de teclado.

Todos os resultados registram o escopo de protótipo; não devem ser apresentados como execução em aparelho ou resultado com pessoas. A coordenação pode arquivar os JSONs e as capturas escolhidas junto da candidata corrigida, sem apagar a rodada R1.
