# Parecer independente — piloto Clareza

24/11/2026 · revisão web às 18:04 UTC; complemento RN Web na candidata `f33ae5e` · revisor `direcao_caderno` · branch `feat/mobile-ui-ux-refino`, árvore de trabalho de `/workspace/work/studoo-ui-ux`.

**Parecer favorável ao layout web observado e ao núcleo da Conclusão em RN Web. A paridade visual da Proposta permanece parcial.** As ações principais estão inteiras nas duas larguras. Há uma inconsistência pequena e concreta no espaçamento do rodapé da Proposta mobile; a posição de rolagem e a composição do mapa diferem entre os pares. Recomendo o ajuste local de espaçamento, sem reabrir a direção estética. A aprovação de branding final e a validação nativa permanecem pendentes; não atribuo nota global ou nota nativa por estas capturas.

## Evidência e alcance

Examinei visualmente os seis PNGs `pedido`, `proposta` e `conclusao`, cada um em **390×844 e 360×800**, de `/workspace/work/studoo-ui-ux-qa/web`. Comparei-os com a [direção A](propostas/direcao-a.md), a folha de estilos da candidata e a ordem dos componentes. Li também o `percurso.json` da coordenação: sete verificações positivas, incluindo erro/correção real, conclusão após resposta de salvamento e reabertura com 1 de 5 lições concluídas. Esse percurso foi executado pela coordenação; não o repeti nesta revisão.

Medi independentemente os componentes azuis dos quatro PNGs de Proposta/Conclusão: os limites de pixels coincidem com os retângulos DOM registrados. Os valores do Pedido abaixo vêm do registro DOM, não de uma nova execução minha.

| Estado | Largura/altura | CTA: x/y | Largura × altura | Final vertical |
| --- | --- | --- | --- | ---: |
| Pedido vazio | 390×844 | 20 / 342 | 350×52 | 394 |
| Pedido vazio | 360×800 | 20 / 342 | 320×52 | 394 |
| Proposta | 390×844 | 20 / 722 | 350×52 | 774 |
| Proposta | 360×800 | 20 / 678 | 320×52 | 730 |
| Conclusão | 390×844 | 20 / 726 | 350×52 | 778 |
| Conclusão | 360×800 | 20 / 682 | 320×52 | 734 |

O Pedido vazio apresenta a ação desabilitada, coerente com a necessidade de preencher o objetivo. As seis capturas não mostram transbordamento horizontal; o registro DOM também o marca como ausente. Isso não representa teste de texto ampliado, teclado virtual ou área segura nativa.

## Três conclusões visuais

1. **Hierarquia e densidade melhoraram de forma concreta.** O Pedido concentra título, campo e ação, mantendo material e exemplos como alternativas. A Proposta preserva o caminho real e seus estados, com placa clara e CTA estável; não foi transformada em uma lista estática de três lições do mock. Na Conclusão, progresso confirmado, próxima lição e objetivo praticado aparecem antes das estatísticas. O aviso de revisão permanece presente, sem prometer domínio do conteúdo só por ter concluído a lição. O rodapé mantém continuar antes de voltar.
2. **Tipografia e paleta são coerentes com A.** A candidata mantém Quicksand nos títulos e Nunito na leitura; os registros mostram títulos de 30 px no Pedido/Conclusão e 24 px na Proposta. Corpo em torno de 17/26 e auxiliares de 14 px deixam a leitura menos fragmentada que a composição anterior. Branco/navy e apoio azul suave separam contexto e conteúdo; a cor mais forte pertence à ação e aos estados. Recalculei os pares declarados no CSS: branco/azul **4,88:1**, navy/branco **15,84:1**, secundário/apoio **5,59:1**, verde de sincronia/branco **6,74:1**, aviso âmbar/fundo claro **6,02:1**, contorno do campo/branco **3,44:1**. São pares específicos, não certificação completa de acessibilidade.
3. **O acabamento do piloto não fecha o novo branding.** O Stu atual foi mantido em escala contida e com menos camadas concorrentes. Os arquivos ainda mostram o personagem azul arredondado, e não o Stu caderno dos anexos. A forma final — capa azul, folha dobrada e óculos com os dois “o” — depende dos originais já identificados em [Referências do Stu](REFERENCIAS-DO-STU.md). Não aprovo essa arte provisória como a nova identidade nem recomendo inventar uma substituição. A organização da interface pode avançar separadamente dessa lacuna.

Os elementos abaixo da dobra na Conclusão, incluindo parte do aviso e os detalhes de sessão, precisam continuar alcançáveis por rolagem; a existência do rodapé fixo não é licença para cortar conteúdo. A CSS reserva espaço inferior. Esta inspeção estática não substitui a conferência de rolagem/foco/zoom no produto.

## Fechamento pelo método

- **C3/C4, subverificações visuais web:** parecer favorável para as seis capturas e os pares de cor explicitados. A identidade final do Stu continua pendente; nenhum resultado desta revisão vira nota global de 9,5.
- **C5:** a redução de elementos concorrentes é visível na composição e na fonte. Não medi a animação do piloto em vídeo nesta revisão.
- **C1/C2/C6/C7/C8/C9:** o registro funcional da coordenação é evidência complementar, com autoria identificada. Fluxo, foco, acesso assistivo, rede e integridade exigem seus pareceres próprios.
- **C10:** subconjunto visual RN Web examinado no complemento abaixo; Conclusão e presença das ações são coerentes, Proposta com paridade parcial. Não atribuo uma nota única de paridade nem aprovo equivalência de pixels. **iOS/Android nativos: `null`.** RN Web é o código mobile no navegador, não uma execução nativa.

Não há justificativa nesta amostra para reabrir uma exploração estética ampla. A conferência de integração continua necessária para texto ampliado/teclado/áreas seguras e preservação dos estados reais; a amostra RN Web está registrada abaixo. Sem pesquisa com pessoas realizada nesta rodada.

Identificação das fontes web lidas: `src/app/clareza.css` SHA-256 `ce4f55d6e94a5c22389418cbffc81cb6f7d5a49b293e718861b9eb07314b7240`; `src/app/estudo.tsx` SHA-256 `d03b52510c90127b898f1234f0cf135162a5eb2dfd46d49cf13023f053201ffb`. Nenhum código, estilo, asset ou captura foi alterado por esta revisão; somente este parecer foi escrito.


## Complemento — RN Web versus web, candidata `f33ae5e`

Examinei os seis PNGs finais mobile em `.studoo-local/qa-rnw/evidencias/sql-final/`: `01-pedido`, `02-proposta` e `06-conclusao`, em 390×844 e 360×800, comparando com os seis PNGs web já descritos. Li `resultado.json`, o roteiro `sql.cjs` e os trechos correspondentes de `estudo.tsx`, `interface.tsx` e `caminho.tsx`. A fonte mobile permaneceu com SHA-256 `4ef69116f0e77bbf8f5fd7743920f3f335e1660f0879457b09e6fff1b2a70056` durante a rodada de QA. Não executei de novo esse percurso.

| Estado RN Web | Janela | CTA x/y | Largura × altura | Comparação com web |
| --- | --- | --- | --- | --- |
| Pedido preenchido | 390×844 | 20 / 360 | 350×52 | Web arquivado vazio, y342; estados distintos |
| Pedido preenchido | 360×800 | 20 / 360 | 320×52 | Web arquivado vazio, y342; estados distintos |
| Proposta | 390×844 | 16 / 726 | 358×52 | Web x20 / y722 / 350×52 |
| Proposta | 360×800 | 16 / 682 | 328×52 | Web x20 / y678 / 320×52 |
| Conclusão | 390×844 | 20 / 724 | 350×52 | Web x20 / y726 / 350×52 |
| Conclusão | 360×800 | 20 / 680 | 320×52 | Web x20 / y682 / 320×52 |

As caixas vêm do registro do agente `checks_release`; minha revisão verificou sua relação com a composição das imagens e a fonte. O registro não acusa transbordamento horizontal nem erro de página. O símbolo preto de raio presente nas capturas de 360 px pertence à prévia de desenvolvimento; não o classifico como um componente final do Studoo.

### Três achados e decisão

1. **Baixa gravidade, ajuste local recomendado: rodapé da Proposta.** `geracaoRodapeEstreito` define `paddingHorizontal: 16`, enquanto o Pedido, a Conclusão e a CSS web usam 20. A diferença horizontal de 4 px é de implementação, não arredondamento do renderizador. Alterar esse único valor para 20 elimina a divergência lateral sem mudar fluxo, domínio ou tamanho mínimo da ação. A diferença vertical de 4 px também tem origem verificável: o `rodapeConteudo` compartilhado usa 12 px acima e 14 abaixo, e `.previa-rodape` web usa 16 px. Não recomendo alterar o componente compartilhado somente para perseguir igualdade de pixels; caso a coordenação exija o mesmo rodapé, usar sobrescrita apenas nessa tela e recapturar a Proposta.
2. **Paridade parcial, composição/estado da Proposta não equivalentes.** A RN Web mostra duas lições e resumos curtos por nó; a web mostra três títulos, com densidade menor. Os resumos são explícitos na fonte mobile (`no.estado === 'previa' && no.resumo`), portanto essa diferença não é do renderizador. O topo RN Web começa no objetivo e na origem por IA, com o título/voltar fora das capturas; a web mantém o cabeçalho. O roteiro não normaliza nem registra a rolagem entre os pares, e a fonte mobile troca a faixa fixa por `cartaoDeVolta` e centraliza o primeiro nó automaticamente. O autor do QA confirmou que `pair()` apenas redimensiona e captura, sem `scrollTo`/`scrollIntoView`; o fallback de foco usa `preventScroll`. Sem offsets registrados, a causa exata desse recorte permanece indeterminada. Assim, não concluo pelas imagens que o cabeçalho foi removido, nem aprovo paridade de apresentação. Para fechar esse subcritério, comparar o mesmo estado e a mesma posição de rolagem, registrando título, origem e primeiro nó. Isso não justifica redesenhar o mapa inteiro nesta rodada.
3. **Conclusão coerente; Pedido exige estado equivalente antes de ajuste.** Na Conclusão, as duas implementações preservam título, lição, progresso real 1/5, confirmação de salvamento, próxima lição, prática e aviso de revisão, na mesma ordem. O CTA de 52 px cabe nas duas larguras e o desvio vertical de 2 px não é defeito material de usabilidade. A ação secundária tem tratamento de superfície diferente, sem inversão de prioridade. No Pedido, o arquivo RN Web contém objetivo e fala de confirmação; o web está vazio, com placeholder e ação desabilitada. Ambos preservam título/campo/ação, mas os 18 px de deslocamento, sozinhos, não sustentam uma correção: comparar primeiro estados iguais. Não há evidência nesta amostra para abrir outra direção estética.

O `checks_release` registrou geração/aceite, erro e correção, conclusão após resposta da API com 1/5, recarga e retomada de INNER JOIN; `passed: true`, 16 capturas, zero erros de página e hashes estáveis. Esse é o relato de execução daquele agente. A ponte de HTTPS, o fallback de acessibilidade e o armazenamento em localStorage existem **somente no harness de QA**: não certificam Keychain, CORS/TLS de produção, acessibilidade nativa, foco de VoiceOver/TalkBack ou tempo real do streaming. **C6 nativo e execução iOS/Android permanecem `null`.**

Decisão de revisão: corrigir o espaçamento lateral local da Proposta é adequado antes do build; não apresentar a rodada como paridade visual completa. O núcleo de leitura e a Conclusão permitem avançar com essas limitações explícitas, sem converter a inspeção em nota 9,5 ou aprovação nativa. Somente este parecer foi editado por este revisor.
