# Parecer visual independente — R7

Revisor: `revisao_visual_r1` · candidata **f0c9b7fb3fb962827fd743096fee935b4873ed29** · 24/11/2026. Revisão pontual, posterior à [R6](PARECER-VISUAL-R6.md). Nenhuma UI editada e nenhum commit criado por este revisor.

**D3, D4 e D5 permanecem em 9,0 nas três direções, por equivalência explícita com a prova R6 e novas capturas das superfícies alteradas. A contradição de copy apontada na R6 não aparece nos quadros R7 examinados. D10 integral e a nota global continuam `null` neste parecer: a auditoria de matriz e os percursos de contexto assíncrono pertencem à conciliação independente.**

## Escopo novo e equivalência

O diff **28b003e6c29728e1fd8c96f14efbb497353b0d10 → f0c9b7fb3fb962827fd743096fee935b4873ed29** altera somente `app.js`, `media-pages.js` e `social-pages.js`. Os outros **14 arquivos runtime** mantêm SHA-256 igual à R6, incluindo todos os CSS e os módulos material/pessoal. Os **sete arquivos de arte/fontes** foram comparados com os blobs Git da R6 e com o filesystem antes/depois da coleta; são idênticos. `equivalencia-r6.json` e `conferencia-final.json` conservam os pares.

A R7 não repete nem rebatiza as 1524 vistas da R6. Hierarquia/reflow das demais famílias, arquivo de 160 caracteres na fonte/diálogo/apoio, cabeçalho de 80, nome de 40, rodapés de aprendizagem, capas e movimento conservam a prova **R6**, com essa origem e limite. O diff não altera `render`, CSS de entrada/movimento ou as arquiteturas A/B/C. Os 24 probes de seleção e a medição de entrada de 180 ms normal/0 ms reduzida são **resultados R6**, não nova medição de fluidez nesta candidata.

## Execução pontual R7

Chromium **156.0.8078.79**/Playwright em Linux, viewport 390×844 e 360×800, DPR 1, fonte raiz padrão de 16 px e ampliada a 32 px. Dados e clipboard de exemplo locais; o fallback usa um stub de rejeição de clipboard. Nenhum serviço, conta, material ou gravação real foi acionado.

Foram capturados **16 casos × A/B/C × duas larguras × padrão/200% = 192 vistas**, com **288 PNGs** incluindo posições finais de rolagem. Os casos incluem Compartilhar base/revisão, material com e sem nome no título, falha de publicação, fallback comum de link e do Código, cópia recebida, visitante, sessão expirada, revisão e destino de material inválido. A lista exata está em `resultado.json`.

| Verificação sobre as vistas R7 | Resultado |
| --- | --- |
| Geometria de documento, área principal e diálogo; rodapés inteiros | **192/192**, zero overflow horizontal ou CTA fora. |
| Exceções JS / casos ou direções incompletos | **Zero**. |
| Presença da promessa antiga “Arquivo, nome e fotos não são publicados” | **Zero nas 192 vistas**. |
| Divulgação de material nos quadros base/revisão aplicáveis | **36/36**: título/trechos/páginas podem ir; arquivo bruto/fotos/progresso/respostas/explicações pessoais não vão. |
| Copy própria de falha de material | **12/12**: publicação não confirmada; falha não publica material nem apaga estudos. |
| Estados restritos | **72/72** sem link/QR. |
| Aviso antes do acionador Código nos quadros que o oferecem | **48/48**. |
| Fonte runtime | **17 SHA-256 idênticos antes/depois**. Arte/fontes: sete iguais ao Git R6 e ao final da coleta. |

As linhas se sobrepõem; não se somam como telas ou testes funcionais. O raw `resultado.json` conserva **180/192 asserções iniciais positivas**: 12 asserções exigiam a divulgação integral de confirmação também no estado `material-erro`. Essa condição era ampla demais para uma tela que informa falha não publicada. As imagens e textos foram conferidos; `conferencia-final.json` separa geometria, divulgação aplicável e copy própria do erro, sem apagar o raw ou mudar a UI. Não se declara “192 testes funcionais passaram”. Uma tentativa inicial de harness interrompida por acumular seeds está preservada em `tentativa-inicial/` e não integra os resultados.

## Inspeção e julgamento

Foram abertos **nove PNGs novos** de f0: material nomeado na base e revisão ampliada, material sem nome no título, erro padrão/ampliado, revisão sem material, fallback de link ampliado, fallback de Código e cópia recebida ampliada. Exemplos: `jornada-material-nome-base-100-390-fim.png`, `caderno-material-sem-nome-base-100-390-fim.png`, `caderno-material-nome-revisar-200-360-fim.png`, `foco-fallback-link-200-360.png` e `jornada-fallback-codigo-100-390.png`. Não é inspeção individual de todos os 288 PNGs.

A folha nomeada informa **“O título traz o nome do seu arquivo”**; a outra informa **“Confira o título: ele pode conter o nome do arquivo”**. A promessa absoluta antiga foi removida. Um único aviso central protege progresso/respostas/explicações e antecede “Ver Código Studoo”. A revisão conserva confirmação explícita. O erro mantém seu contexto de solicitação não confirmada, sem uma promessa contraditória de privacidade. A folha e o fallback conservam reflow a 200%; o URL do diálogo quebra dentro do próprio contêiner.

As três direções conservam desenho reconhecível: A arredondada e acompanhada pelo Stu, B editorial em fundo de caderno, C compacta com navy. A redução de repetição de avisos melhora a sequência título → destino → alcance do compartilhamento → Código, sem alterar tipografia ou arte. Não foi identificado novo achado visual médio/alto/crítico nesta amostra.

**O fechamento visual da copy não certifica callbacks assíncronos.** O teste de fallback deste parecer mantém o mesmo contexto. Troca de trilha/destino/status durante Promise, confirmação, fechamento e retirada exige os percursos do revisor de fluxos. As capturas de estados restritos não substituem essa prova; a reconciliação D1/D9 pertence a esse parecer competente.

## Notas e limites

| Critério | Peso | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo | Origem |
| --- | ---: | ---: | ---: | ---: | --- |
| D3 — hierarquia/leitura/adaptação | 12 | **9,0** | **9,0** | **9,0** | R6 identificada + 192 vistas R7 dos afetados. |
| D4 — identidade/acabamento | 8 | **9,0** | **9,0** | **9,0** | CSS/arte/fontes equivalentes; novos PNGs R7 de compartilhamento/copy. |
| D5 — movimento com controle | 10 | **9,0** | **9,0** | **9,0** | Medição R6, CSS/render preservados; sem nova animação no diff. Não é benchmark nativo. |
| D10 — cobertura/consistência integral | 6 | `null` | `null` | `null` | Aguarda auditoria da matriz/14 LCs e provas de interação; não fecha por quantidade de queries. |

D1/D2/D6/D7/D8/D9 ficam `null` nesta competência, com pesos originais 12/12/14/10/10/6. Os dez pesos somam 100; a nota não é normalizada sobre os três itens preenchidos. Nota ponderada/global, C1–C10 do produto, paridade web/RN, TestFlight/dispositivo e métricas com pessoas permanecem **`null`/não realizados**. O Stu disponível continua provisório; D4 não aprova o novo branding de caderno.

Provas em `/workspace/work/revisao-visual-r7/`, notas/pesos e hashes em `notas-r7.json` e `notas-{jornada,caderno,foco}.json`. A liberação da fonte foi comunicada depois da coleta e da comparação final; a redação usa somente evidência salva. R6 e seus achados históricos foram preservados.
