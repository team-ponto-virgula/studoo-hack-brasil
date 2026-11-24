# Componentes para a próxima rodada do Studoo

Pesquisa em **24/11/2026**, por abertura e leitura de páginas oficiais e das fichas dos autores no 21st.dev. Os oito exemplos abaixo ampliam a base da [direção A](../propostas/direcao-a.md); não alteram a candidata já congelada para QA. Nenhum pacote foi instalado, código externo copiado ou arte reaproveitada. As recomendações de adaptação são análise do Studoo, não resultados de teste dessas bibliotecas no projeto.

**Prioridade:** compositor de objetivo/material; lista clara de lições; progresso e conclusão com estado verdadeiro. A proposta é estudar a composição e implementar os contratos em renderizadores próprios, preservando navy/azul, Quicksand/Nunito, Stu e ações de 52 px.

## 1. 21st.dev · Prompt Input, de Tinkerers Labs

[Abrir exemplo do autor](https://21st.dev/@tinkerers-labs/components/prompt-input).

O exemplo reúne textarea que cresce com o conteúdo, envio e interrupção no mesmo compositor. É uma referência direta para aproximar objetivo e material opcional sem empilhar painéis. No Studoo, manter um CTA com texto, validação e consentimento; Enter no teclado móvel não deve submeter inesperadamente. Só mostrar cancelamento quando houver operação cancelável real.

**Stack comprovada na ficha:** React e Tailwind; dependência declarada `lucide-react`; licença indicada MIT. A própria ficha informa que a fonte completa requer conta gratuita: não foi baixada nem auditada. Essa licença declarada não valida automaticamente cada dependência ou outro item do catálogo.

**App:** referência visual; não é um componente React Native. A mesma estrutura precisa de `TextInput`, `Pressable`, seletor de material e comportamento de teclado nativos.

## 2. shadcn/ui · Prompt Input atual

[Compositor](https://ui.shadcn.com/docs/ai-elements/base/prompt-input).

A documentação mostra um grupo de entrada com textarea, ações e anexos removíveis. Adaptar a organização ao Pedido: objetivo primeiro, material no mesmo contexto, remover material claramente e deixar a geração em uma ação única. Não trazer seletor de modelo, menus de esforço nem controles que não ajudem a estudar. O envio do Studoo continua nas APIs atuais.

**Stack confirmada:** composição React DOM de Input Group, Attachment e Dropdown Menu; a página oferece variantes Base UI, React Aria e Radix. Não são três dependências que precisem ser instaladas juntas. Não há portabilidade direta para RN; reproduzir estados e hierarquia com os componentes nativos existentes.

**Atualização relevante:** [AI Elements antigo](https://elements.ai-sdk.dev/components/prompt-input) anuncia migração para shadcn/ui e descontinuação no fim de novembro de 2026. Evitar começar uma adoção pelo pacote/documentação antigos.

## 3. shadcn/ui · Task para geração que chega aos poucos

[Task](https://ui.shadcn.com/docs/ai-elements/base/task) · [base Trace](https://ui.shadcn.com/docs/components/base/trace).

Task apresenta passos conforme o trabalho acontece; a documentação o distingue de um plano conhecido antecipadamente. Isso combina com eventos reais de geração de título e lições do Studoo. Adaptar para uma linha principal de estado e uma lista curta de resultados disponíveis, sem percentagem inventada. Preservar cancelamento, erro e repetição.

**Stack confirmada:** React DOM; o padrão atual compõe Trace e TraceCollapsible. No RN, usar lista e expansão nativas, apoiadas no mesmo contrato de eventos. Não exibir nomes de ferramentas, comandos, rastros de erro ou raciocínio interno do modelo: a referência é a progressão observável, com textos orientados ao estudante.

## 4. shadcn/ui · Plan para sequência conhecida

[Plan](https://ui.shadcn.com/docs/ai-elements/base/plan).

Plan organiza passos conhecidos antes da execução, com estados pendente, em curso e concluído. É mais apropriado para o plano SQL já aceito do que para prever lições ainda não geradas. Adaptar à sequência real de lições enviada pelo servidor, destacar a próxima e manter as concluídas acessíveis. Não trocar o mapa salvo por uma lista sem comparar as duas tarefas com pessoas.

**Stack confirmada:** React DOM; composição atual de Trace/TraceCollapsible. Compartilhar o modelo de estados com o app, não o JSX DOM. Os títulos, permissões e liberações continuam vindo da API do Studoo; o exemplo não resolve persistência ou progressão pedagógica.

## 5. shadcn/ui · Item / ItemGroup para lições e retomada

[Item e exemplos de composição](https://ui.shadcn.com/docs/components/base/item).

Item combina mídia, título, descrição e ações, e ItemGroup organiza uma lista. É a melhor referência deste conjunto para retirar cartões de dentro de cartões: uma linha por lição, um estado textual, uma ação clara. Também serve ao próximo passo da conclusão e à retomada. Reservar o azul ao próximo passo e não tornar a linha e um botão interno dois alvos concorrentes para a mesma ação.

**Stack confirmada:** composição React DOM; os exemplos usam partes ItemMedia, ItemContent, ItemTitle, ItemDescription e ItemActions. O guia distingue conteúdo de formulários: exercícios continuam usando controles com semântica própria. No app, reproduzir com `View`, `Text` e `Pressable`, sem substituir regras de bloqueio/liberação.

## 6. React Aria · ProgressBar para progresso honesto

[ProgressBar e escala de valores](https://react-aria.adobe.com/ProgressBar) · [hook de acessibilidade](https://react-aria.adobe.com/ProgressBar/useProgressBar.html).

A documentação diferencia progresso determinado e indeterminado, aceita escala própria e rótulo de valor. No Studoo, usar a contagem real de lições concluídas e total após confirmação de salvamento; enquanto a duração da geração é desconhecida, mostrar estado indeterminado com descrição textual. A animação nunca pode acrescentar tempo de espera ou apresentar conclusão antes da resposta real.

**Stack:** React para web, com semântica de acessibilidade documentada; não é um renderizador RN. No app, espelhar nome, valor e atualização pela API de acessibilidade nativa. A barra existente pode incorporar esses princípios sem adicionar biblioteca. A pesquisa não mediu comportamento desses exemplos com VoiceOver, TalkBack ou no binário do Studoo.

## 7. Motion · Layout animation com controle de movimento

[Transições de layout](https://motion.dev/docs/react-layout-animations) · [movimento reduzido](https://motion.dev/docs/react-accessibility).

Referência para um item que muda de pendente para concluído e para expansão de detalhes sem salto visual. A documentação apresenta transições de layout por transform e APIs para movimento reduzido. Adaptar apenas mudanças que orientem a tarefa, em uma entrada breve; não animar continuamente Stu, números, fundo e botões ao mesmo tempo.

**Stack:** Motion for React na web, não React Native. A [licença do repositório principal](https://github.com/motiondivision/motion/blob/main/LICENSE.md) é MIT; isso não estabelece os termos de todos os produtos pagos da marca. O Studoo não precisa adicionar Motion para um fade simples: CSS e o controlador existente podem bastar. Bundle, foco e interrupção exigiriam teste antes de adoção.

## 8. React Native Reanimated · FadeIn / FadeOut

[Entering/Exiting animations, documentação 4.x](https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/).

Contraponto nativo ao exemplo anterior: a documentação apresenta entradas/saídas configuráveis e redução de movimento. Usar uma transição pequena entre estado de geração e resultado, sem bloquear toque, foco ou navegação até o fim. Evitar bounce, rotação e atrasos aleatórios na leitura.

**Stack:** biblioteca React Native; a página também registra diferenças do suporte web, inclusive de springs. A [licença oficial](https://github.com/software-mansion/react-native-reanimated/blob/main/LICENSE) é MIT. Não consta como dependência direta no `apps/mobile/package.json` conferido nesta rodada; compatibilidade com Expo/RN, custo de integração e binários não foram validados. Não adicionar só para substituir um fade já atendido pelo Animated existente.

## Licenças, adoção e limites

O [repositório oficial do shadcn/ui](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) publica MIT. O [repositório Adobe React Spectrum](https://github.com/adobe/react-spectrum/blob/main/LICENSE), que abriga React Aria, publica Apache 2.0. As menções acima são verificações dessas fontes, não auditoria transitiva nem autorização para reutilizar artes, marcas, screenshots ou componentes de terceiros com outros termos. Antes de incorporar código, fixar origem/revisão e conferir a licença e dependências do item exato.

O piloto atual usa CSS/React e componentes RN próprios. **Componente React DOM não funciona diretamente no app nativo**: identidade, medidas e estados podem ser compartilhados; renderização, foco, teclado, acessibilidade e gestos precisam de execução específica por plataforma. A pesquisa não recomenda substituir a stack inteira nem instalar um catálogo.

Próximo recorte recomendado, após fechar o QA da candidata: comparar compositor e lista de lições em 390×844 e 360×800, mantendo o mesmo fluxo SQL e as APIs reais; depois avaliar progresso/salvamento/retomada pelo [método do Studoo](../METODO-AVALIACAO.md). Motion entra por necessidade observada. Nenhuma nota de UX, ganho de desempenho ou aprovação de acessibilidade foi inferido só pelas páginas de referência.
