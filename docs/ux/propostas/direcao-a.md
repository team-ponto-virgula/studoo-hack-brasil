# A — Clareza que ensina

**Tese:** a pessoa deve entender onde está, o que aprendeu e qual é a próxima ação sem disputar atenção com molduras, selos ou opções secundárias. O branco abre espaço para o conteúdo; o azul pertence à ação e ao caminho. O Stu aparece para acolher, acompanhar a preparação e celebrar uma conclusão concreta.

O [protótipo navegável](direcao-a.html) contém Pedido, Geração, Proposta e Conclusão. São dados sintéticos, sem API ou persistência. A ação da proposta salta para a conclusão para comparar as duas pontas do percurso; não simula uma aula completa. A geração não inventa percentual ou duração: o seletor externo avança para a proposta. O quadro de conclusão ilustra um retorno de salvamento confirmado; esse estado só poderá aparecer na implementação depois de resposta real do servidor.

| Camada | Organização proposta |
| --- | --- |
| Moldura | Marca central pequena; voltar à esquerda; perfil à direita. A navegação existente de quatro destinos permanece reconhecível. |
| Conteúdo | Identificação da etapa, título, explicação curta e um único conjunto de informações. Sem repetir cartões dentro de cartões. |
| Pedido | Objetivo primeiro; material opcional dentro do mesmo compositor; sugestões pequenas; CTA amplo abaixo. |
| Geração | Um estado de trabalho verdadeiro, etapas sem percentual inventado e cancelamento acessível. |
| Proposta | Três lições em sequência, com nome e conceito; uma ação para começar e uma saída para ajustar. |
| Conclusão | O que foi aprendido, progresso concreto e próximo passo. Compartilhar, reforço e outras saídas só depois da ação principal, conforme necessidade real. |

Tokens: fundo `#FFFFFF`, texto `#0B1B5C`, ação `#2563FF`, texto secundário `#566382`, apoio `#F4F7FF`/`#E9E7FF`, sucesso `#17684A` sobre `#E9F6EE`. Quicksand em títulos 32/24, Nunito em conteúdo 17 e auxiliares 14; títulos de desktop podem usar 36. Escala de espaço 4/8/12/16/24/32, painéis de raio 20–22, botões 16. A ação principal tem 52 px; ícones tocáveis têm 44 px. O protótipo conserva os arquivos disponíveis no repositório, sem alterar rosto, cores ou proporção do Stu. O banner externo identifica a arte provisória. Este kit ainda mostra o personagem azul arredondado: o novo Stu caderno dos anexos deve substituir essas poses a partir dos PNGs de origem, sem redesenho, antes da aprovação final de branding. Esta lacuna não recebe uma nota de identidade completa.

Componentes para construir em paridade: `CabecalhoDaEtapa`, `TituloDaEtapa`, `CompositorObjetivo`, `SugestoesObjetivo`, `EstadoGeracao`, `ListaLicoes`, `AcaoPrincipal`, `ResumoConclusao`, `ProximoPasso` e os componentes existentes de navegação. Textos e tokens devem vir do pacote de contratos no produto, com renderizadores web/RN próprios. O protótipo HTML não vira uma segunda fonte de verdade.

**Tradeoff:** menos elementos competindo melhora a orientação, mas pode parecer menos expressivo numa demonstração de poucos segundos. A personalidade fica no Stu, no ritmo e na clareza da resposta; a direção não depende de efeitos grandes. O campo de objetivo e o plano são protagonistas. O espaço livre exige disciplina editorial: explicações longas precisam de expansão deliberada, não de encolher a tipografia.

Avaliar primeiro C1/C2/C3/C6 no pedido/proposta e C7/C8/C9 na passagem para conclusão. C4/C5 conferem expressão e movimento sem tomar o controle. C10 exige a mesma ordem, medidas e estados nos pares web/app. A proposta não recebe nota global: ainda faltam aula, erro, rede lenta, conteúdo longo, teclado nativo, leitor de tela, dados reais de salvamento e protótipo RN. A implantação começa por geração e conclusão, depois mapa e aula, preservando os contratos e usando o método completo para cada fluxo.
