# Parecer visual independente — R4

Revisor: `revisao_visual_r1` · candidata **a6f2e09b559b3c531b66fbc404839d661d304f48** · 24/11/2026. Nova coleta da superfície HTML mobile, preservando [R1](PARECER-VISUAL-R1.md), [R2](PARECER-VISUAL-R2.md) e [R3](PARECER-VISUAL-R3.md). Nenhuma fonte do protótipo foi alterada por este revisor.

**D3, D4 e D5 atingem 9,0 no conjunto visual observado das três direções. D10 fica em 8,0: a auditoria de cobertura da rodada identificou variantes obrigatórias ausentes. A direção completa permanece provisória, com nota consolidada `null` e DG1 reprovado.** As 35 páginas-base capturadas não constituem cobertura integral das 18 famílias e de seus subestados.

## Evidência nova desta rodada

Chromium **156.0.8078.79**/Playwright em Linux, 390×844 e 360×800. A ampliação usa fonte raiz de 16 para 32 px, conservando a largura da viewport; é teste de reflow do HTML. O ambiente não executa React Native, teclado/safe area de iPhone/Android, API, IA, OCR, gravação real ou envio de email.

| Bloco | Quantidade | Resultado observado |
| --- | ---: | --- |
| Matriz principal: 35 páginas-base, 20 estados e cinco formatos adicionais de exercício em cada direção/largura; mais as 35 bases a 200% | 570 vistas: 360 padrão e 210 ampliadas | Zero `pageerrors`, overflow horizontal de documento/área principal e CTA de rodapé fora da viewport. |
| Alvos de conclusão e email: conclusão, código, código expirado, recuperação enviada; A/B/C, duas larguras, padrão/200% | 48 vistas | Zero overflow, incluindo detalhes internos de conclusão; rodapés inteiros. |
| Trilha 5/5: início e conclusão; A/B/C, duas larguras, padrão/200% | 24 vistas | Contagem 5 de 5; início oferece criar outra trilha/rever esta trilha; sem próxima lição inventada. |
| Nome, título e objetivo longos: início, pedido, proposta, mapa e perfil; A/B/C, duas larguras, padrão/200% | 60 vistas | Zero overflow/rodapé fora; fontes iguais às da captura principal. |
| Seleção local de `>=` no exercício, normal/reduzido | 6 probes | Zero animações ativas ou deslocamento da tela; opacidade 1 antes e depois. |

Os blocos se sobrepõem: esses números descrevem execuções e não devem ser somados como quantidade de telas distintas. A matriz principal inclui capturas das 360 vistas padrão e das oito páginas de risco a 200% em cada direção/largura; as demais vistas ampliadas têm medição de geometria, não screenshot próprio. Foram abertas capturas novas de início, lição, conclusão, conclusão 5/5, código expirado e recuperação enviada, além das pranchas comparativas de pedido/material/geração/proposta/mapa e exercício/reforço/retorno/explorar/perfil público nas três direções.

O email sintético tem **138 caracteres**: `'n'.repeat(63) + '@' + 'd'.repeat(61) + '.example.test'`. O nome longo e o título sem espaços verificam os componentes que falharam em rodadas anteriores. Nenhuma identidade real ou envio foi usado.

Artefatos reproduzíveis: `/workspace/work/revisao-visual-r4/`, com `resultado.json`, `emails-conclusao.json`, `concluida.json`, `longos.json`, `motion.json`, scripts e PNGs. Os 12 arquivos de HTML/JS/CSS mantiveram SHA-256 idênticos antes/depois da coleta principal e dos retestes com hashes. `longos.json` confirma também igualdade com a coleta principal. Exemplos de hashes congelados:

| Arquivo | SHA-256 antes = depois |
| --- | --- |
| `app.js` | `5bfbd13c1b5856f01f36a0a96bac741000d22ea656e029457f1e18d4999d13ee` |
| `accessibility.css` | `72989cbcbaf419faf790ee5a3bfb63465ffca5fd47fef21563ba6d0ba01b6f93` |
| `directions/jornada.css` | `cf20e039dd9f3b2e71464b82e482346d30e8d662cd5eba17340f90d6733267b3` |
| `directions/caderno.css` | `781e22ae783a0d7a1b7af77fbc793826010212b13c5b0c8dd419395495de635d` |
| `directions/foco.css` | `7e79f3a66db34001b3f6e33cd51cee932755415bf9cf0eb41418ac3e23c0ecb6` |

O JSON principal registra os 12 pares completos. A liberação do congelamento foi comunicada após as coletas; a redação e montagem posterior de pranchas usam apenas esses dados e PNGs salvos.

## Achados prioritários e fechamentos

### V1-R3 fechado — email longo em nota

Código expirado e recuperação enviada passam a quebrar o email dentro de `.note`, sem ocultá-lo, abreviá-lo ou reduzir a fonte. O ícone permanece separado do texto. As 36 vistas de email do bloco direcionado passaram nas três direções, em 360/390 e padrão/200%. As capturas ampliadas mostram continuação vertical rolável; não se exige que 138 caracteres caibam todos na primeira dobra. O CTA permanece inteiro. Isso fecha o achado médio da R3.

### Acabamento R4 — conclusão e leitura contextual

A remoção dos três números decorativos da conclusão deixa o resumo do aprendizado, o progresso e o próximo passo com hierarquia mais simples. A conclusão A usa Stu de 112 px e deixa o próximo assunto legível na entrada; B usa marca de página e composição editorial; C usa confirmação discreta e tipografia mais compacta. Nenhuma delas troca o progresso real de 1 de 5 por uma contagem promocional. Em 200%, as três conservam reflow e rolagem vertical, incluindo o componente interno do próximo passo que falhara na R2.

Na lição A, o único destaque do SQL em `>= 7` conversa diretamente com a explicação do limite inclusivo. O texto do cartão inicial cita filtros e conexão de tabelas; o estado 5/5 muda o convite para revisão ou nova trilha. Esses ajustes melhoram o foco sem adicionar XP, ranking ou etapas artificiais. O caminho A continua dividido em partes, sem o conector cruzar os títulos. Evidências: `jornada-licao-390.png`, `jornada-conclusao-390.png`, conclusões B/C e `completa-*-inicio-100-390.png`.

### V1-R4 aberto — cobertura declarada ainda incompleta

**Médio · D10 · A/B/C.** A auditoria transversal de cobertura comunicada nesta rodada identificou estados exigidos pelo protocolo ainda não representados: **P15 Em alta/Novas e paginação; P06 títulos/nós chegando e espera longa; P05 formato/tamanho e carregando/leitura**. As pranchas desta coleta mostram a exploração-base e a geração-base; esses frames não comprovam as variantes em falta. As verificações de layout passadas das 35 páginas não fecham esse achado.

Correção e prova necessárias: representar os estados nas três direções, registrar seus IDs e transições e repetir captura/interação nas duas larguras e nos pontos de reflow relevantes. Não excluir essas variantes por serem sintéticas: pertencem à própria proposta de desenho. Até essa prova, D10 fica limitado a 8,0 e DG1 não passa. A nota 9 de D10 em R2/R3 descrevia o conjunto então observado; o novo confronto com o inventário revela a lacuna e altera o julgamento atual, preservando o histórico.

## Julgamento por direção e critério

| Critério | A · Jornada Azul | B · Caderno Claro | C · Foco Vivo | Evidência e limites |
| --- | ---: | ---: | ---: | --- |
| D3 — hierarquia, leitura e adaptação | 9,0 | 9,0 | 9,0 | Recoleta das bases e estados declarados no script; 200%, conteúdo longo e emails sem o defeito médio anterior. Não aprova a legibilidade de variantes ainda ausentes. |
| D4 — identidade e acabamento | 9,0 | 9,0 | 9,0 | A tem personagem, caminho e superfícies arredondadas; B organiza por folha, margem e marca de página; C concentra o próximo passo em blocos navy e reduz a presença do personagem. As diferenças de composição, densidade e componentes se reconhecem além da paleta. As pranchas novas confirmam consistência das famílias observadas. |
| D5 — movimento com controle | 9,0 | 9,0 | 9,0 | Entrada medida de 180 ms normal e 0 ms/`none` com movimento reduzido nas três. Seleção local estável nos seis probes; leitura preservada. Não equivale a benchmark de fluidez/boot em aparelho. |
| D10 — cobertura e consistência | 8,0 | 8,0 | 8,0 | As bases comparáveis e seus estados medidos mantêm sistema coerente, mas V1-R4 impede alegação de cobertura integral. |

D1, D2, D6, D7, D8 e D9 são `null` neste parecer; pertencem às outras competências. Não há nota ponderada ou aprovação global por média destes quatro números. A faceta de leitura de DG3 e a de movimento de DG4 têm a prova localizada descrita acima; DG4 completo exige também o parecer de acesso, e DG2/DG5 exigem o de fluxos. DG6 não é certificado por este revisor isoladamente.

O kit atual contém Stu provisório, distinto do novo caderno de capa azul/folha dobrada. A arte disponível conserva proporção e uso contextual, mas os PNGs originais do novo Stu continuam ausentes desta superfície. **D4 não aprova o branding final nem substitui a futura integração dessas referências.** Os critérios C1–C10, paridade web/app, produto nativo, uso por pessoas e produção permanecem `null`/não realizados nesta revisão.
