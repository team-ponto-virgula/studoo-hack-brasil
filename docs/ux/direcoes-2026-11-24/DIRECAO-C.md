# C · Foco Vivo

**Resultado final R7:9,0 no escopo do desenho**, conforme [resultados](RESULTADOS.md) e [matriz](MATRIZ-COBERTURA-R7.md). As anotações de autoria abaixo conservam o contexto anterior às revisões; o fechamento atual está nesses pareceres.

## Proposta

Uma experiência de estudo contemporânea: o próximo conceito ocupa a região principal, a progressão continua reconhecível e os detalhes aparecem onde ajudam a tarefa. O princípio do Duolingo está no caminho claro, no desafio por vez e no feedback recuperável. A linguagem é do Studoo: azul, navy, Nunito e personagem contextual.

O início destaca a continuidade em uma superfície azul profunda; biblioteca, comunidade e configurações usam linhas editoriais com divisores, em vez de uma moldura para cada informação. Conceito, exemplo e exercício têm área de leitura estável. A conclusão reconhece o que foi praticado e entrega o próximo passo; métricas auxiliares recebem menos peso. Não há XP, sequência de dias, moedas, medalhas, ranking ou loja.

Esta é uma direção completa do protótipo de desenho, com os mesmos estados e contratos das outras propostas. Não constitui uma segunda implementação do produto. O renderer compartilhado fornece composições distintas de início, mapa e conclusão; os estilos C disciplinam hierarquia, superfícies, componentes e ritmo nas demais páginas.

## Sistema visual

| Papel | Definição |
| --- | --- |
| Fundo | `#F5F7FC`, contínuo e discreto. |
| Leitura | `#FFFFFF`; texto `#11215C`; secundário `#53627D`. |
| Ação | `#2658D9`, com texto branco; uma ação principal por tarefa. |
| Continuidade | Hero `#14245C`, texto branco, área secundária contida. |
| Sucesso | `#194F3B` sobre `#EAF5EE`, sempre com texto/ícone. |
| Erro | `#8F351E` sobre `#FFF0E9`, sem apagar a tentativa. |
| Tipografia | Nunito nos títulos e leitura, 30/35 no título principal, 17/25,5 no corpo e 14/21 nos auxiliares. Títulos estreitos descem a 28 px. Quicksand da identidade permanece na marca e é mantida nos assets; a predominância editorial de Nunito é hipótese explícita desta direção. |
| Componentes | Botões de 52 px/raio 14, secundários de 48 px, controles de ícone com alvo de 44 px, painéis de raio 18 e hero de 24. |
| Ritmo | Espaços 8/12/16/20/24; listas com divisores e separação por títulos. Código quebra sem rolagem horizontal. |
| Movimento | Resposta de pressão breve; nenhuma espera obrigatória de animação. Preferência de movimento reduzido remove transições e animações. |

O hero profundo e o agrupamento editorial distinguem C do mapa tátil de A e da materialidade de B. A superfície escura não invade a área de exercício. O efeito não depende de gradientes, blur, brilho ou painéis de métricas semelhantes a um dashboard.

Na composição integrada, o mapa usa marcadores quadrados, agrupamentos por parte e uma linha atual destacada, sem o conector atravessar os títulos. O perfil concentra avatar e identificação em um banner de altura intrínseca, em vez de uma capa vazia sobreposta. Nas telas de conceito e exercício, o indicador de etapas do conteúdo permanece e a barra duplicada do cabeçalho é removida nesta direção.

## Contrastes calculados

Cálculo WCAG numérico executado por revisão independente da paleta em 24/11/2026. São pares previstos do desenho; não certificam todo o DOM ou a acessibilidade do app.

| Par | Razão |
| --- | ---: |
| Texto principal / branco | 15,04:1 |
| Texto principal / fundo | 14,04:1 |
| Texto secundário / branco | 6,16:1 |
| Texto secundário / fundo | 5,74:1 |
| Branco / ação | 6,03:1 |
| Branco / hero | 14,62:1 |
| Preenchimento branco / trilho do progresso `#52638D` | 5,95:1 |
| Sucesso / fundo de sucesso | 8,45:1 |
| Erro / fundo de erro | 7,01:1 |
| Borda de controle `#7B89A5` / branco | 3,52:1 |

Os textos acima passam AA 4,5:1 e a borda passa 3:1 para elementos de interface. A cor de borda não é usada como texto pequeno. Foco usa contorno azul e separação; o botão azul ganha contorno navy com intervalo branco.

## Tradeoffs e limites

A direção tende a parecer mais concentrada e madura, com menor repetição de personagem. Isso deve ser confrontado com reconhecimento de marca e acolhimento, não apresentado como melhoria de retenção comprovada. O Stu aparece em acolhimento/ajuda/conclusão; a área de estudo permanece tranquila.

O kit disponível contém o Stu azul arredondado, identificado como arte provisória pela bancada. Os originais do Stu caderno não estão nesta cópia; não foi criado substituto nem atribuída aprovação de branding final. A organização do espaço para a arte preserva proporção e permite substituição a partir dos originais.

Dados, login, geração, gravação, progresso e retomada do protótipo são sintéticos. HTML de desenho não comprova API, armazenamento seguro, streaming, teclado nativo, VoiceOver/TalkBack, safe area ou fluidez em iPhone/Android. A nota D do desenho não passa para C do produto.

## Estado da revisão

Revisão autoral no renderer integrado, ainda em construção: **32 telas em 390×844 e 360×800**, 64 capturas de viewport, sem pageerrors nem overflow horizontal. Todos os CTAs de rodapé permaneceram inteiros. Foram inspecionados visualmente início, pedido, proposta, mapa, conceito, exercício, conclusão, Explorar, perfil, edição e preferências. Capturas e métricas locais em `/workspace/work/revisao-direcao-c/`; essa rodada de autoria não é a candidata congelada da avaliação independente.

Em **360×800 com a raiz de texto a 200%**, foram verificadas 12 telas: início, pedido, proposta, mapa, conceito, exercício, conclusão, Explorar, perfil, edição, preferências e perfil público. Não houve overflow horizontal ou de rótulos da navegação; os CTAs de rodapé continuaram inteiros. O CTA de retomar que estava dentro do hero do início ficou abaixo da dobra, fato encaminhado à coordenação para reposicionamento no renderer. Ampliar texto no navegador não comprova Dynamic Type ou teclado nativos.

| Achado de autoria | Encaminhamento |
| --- | --- |
| Conector do mapa atravessava títulos de parte. | Corrigido em C: marcadores e linhas atuais independentes, agrupados por títulos/divisores. |
| Capa vazia do perfil produzia sobreposição frágil com o nome. | Corrigido em C: identificação dentro do próprio banner, com altura intrínseca e texto branco. |
| Hero com um único filho mantinha uma coluna vazia e margem assimétrica. | Corrigido em C: uma coluna de conteúdo. |
| Foco programático do título produzia um contorno preto em todas as telas. | Encaminhado ao CSS compartilhado; foco dos controles deve permanecer visível. |
| Switches de preferências mediam 48×28 px. | Encaminhado à camada compartilhada para alvo de 44 px com trilho visual menor. |
| Retomar no início a 200% ficava abaixo da dobra. | Encaminhado ao renderer para ação de rodapé, preservando o resumo do hero. |

Esta ficha não atribui nota automaticamente. A consolidação D1–D10 depende de corrigir e rever os achados, congelar a fonte e concluir os pareceres independentes; C1–C10 do produto continuam sem notas herdadas.
