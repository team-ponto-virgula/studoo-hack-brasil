# Cobertura e revisão das três direções mobile

24/11/2026 · inventário por leitura da base `f75a1f2` · proposta de protocolo, **sem avaliações executadas ou notas preenchidas neste documento**.

O novo pedido autoriza estudar e construir três direções das páginas principais do app, com Duolingo como inspiração e meta de **pelo menos 9,0**. Essa é a meta desta comparação de desenho. A meta 9,5 e as provas da intro mantêm seu próprio registro; a distribuição da intro pode avançar separadamente. Este documento não altera pesos, notas ou evidências históricas para favorecer uma direção.

## 1. Unidade e limites da entrega

Cada direção deve apresentar o mesmo conjunto de tarefas, conteúdo e estados, permitindo comparar organização, linguagem visual e interação. As diferenças precisam ir além de trocar cores: composição, hierarquia, componentes, presença do Stu e coreografia podem mudar; regras de aprendizagem e integridade continuam iguais.

São **18 famílias de telas**, com subestados e folhas identificados na matriz abaixo. Isso não significa que 18 screenshots cubram tudo: cadastro/recuperação, perfil público/prévia recebida, edição e compartilhamento exigem frames ou estados navegáveis próprios. A matriz deve marcar cada variante como `projetada`, `interagida`, `capturada`, `pendente` ou `fora_do_escopo_com_motivo` em A/B/C. Uma captura da tela-base não aprova suas folhas, estados de erro e retornos.

As propostas navegáveis podem usar dados sintéticos e eventos locais, identificados no entorno do protótipo. Essa origem não deve ser escondida. Não escrever “salvo no servidor” ou prometer sincronização real como conclusão de QA de um protótipo. Se o desenho inclui esse rótulo como estado de sucesso futuro, a ficha precisa registrar que a transição foi simulada. A implementação deverá esperar a confirmação real da API.

As [regras do projeto](../../REGRAS-DO-PROJETO.md), o [método principal](../METODO-AVALIACAO.md) e a [spec 07](../../specs/07-paridade-web-mobile.md) continuam aplicáveis à implementação. Protótipo HTML de app é uma superfície de desenho; não se chama execução React Native, iPhone, Android ou prova de paridade web/app.

## 2. Matriz mínima, igual para A, B e C

| ID | Família principal e tarefa | Estados/frames que não podem desaparecer da proposta | Fonte real no app |
| --- | --- | --- | --- |
| P01 | Boas-vindas e apresentação: entender e começar. | Primeira abertura; cinco cenas atuais; avançar, voltar, pular/fechar; interesse; destino de conta/visitante. A assinatura do boot permanece separada. | `apresentacao.tsx`, `sessao.tsx`, `estudo.tsx` |
| P02 | Entrada e sessão: entrar ou experimentar. | Email/senha; mostrar senha; erro local/credencial/rede; Google/Apple conforme disponibilidade; visitante; cancelar provedor; restaurar/expirar; ajuda. Não oferecer provedor real por inferência do desenho. | `sessao.tsx`, `apple-nativo.ts`, `google-nativo.ts` |
| P03 | Cadastro e recuperação. | Frames próprios para email, código, senha e recuperação; reenviar; incorreto/expirado; voltar sem perder email; sucesso e ajuda; flags de disponibilidade. | `cadastro.tsx`, `recuperar.tsx` |
| P04 | Pedido: definir o que estudar. | Objetivo vazio/preenchido/longo; sugestões/tema; validar limite; preservar rascunho; editar; consentimento de IA quando necessário; acesso ao material. CTA principal antes das saídas secundárias. | `estudo.tsx` (`Pedido`), `consentimento-ia.tsx` |
| P05 | Material: escolher, conferir e remover. | Arquivo, câmera e galeria; permissão negada; formato/tamanho; carregando/leitura; prévia/citação; remover/trocar; falha/expiração. O desenho não comprova OCR ou seletor nativo. | `estudio-adaptativo.tsx` (`MaterialParaTrilha`), `recorte.tsx` |
| P06 | Geração: acompanhar sem perder controle. | Título/nós que chegam; espera longa; acompanhar/rolar; cancelar e conservar pedido; rede/IA/limite; repetir. Não inventar percentagem, duração ou lições antes do evento real. | `estudo.tsx` (`GeracaoAoVivo`), `geracao-ao-vivo.ts` |
| P07 | Proposta: entender e aceitar o caminho. | Pronta; partes/lições longas; ajustar; trilha repetida; aceite pendente; erro/expirada; passagem para lição 1; falha ao abrir. O aceite e o mapa salvo são estados distintos. | `estudo.tsx`, `caminho.tsx`, `geracao-ritmo.ts` |
| P08 | Minhas trilhas: encontrar o próximo estudo. | Vazio; lista; carregando; erro/sincronia; abrir/retomar; menu da trilha; exclusão com confirmação; conteúdo recebido. | `estudo.tsx` (`CartaoDestaque`, `CartaoPlano`, `VazioDasTrilhas`) |
| P09 | Mapa da trilha: orientar e rever. | Atual, disponível, concluído e bloqueado; partes; balão da lição; próxima; ponte; “Vale rever”; trilha concluída; voltar sem repetir comemoração. Sem ranking de pessoas. | `estudo.tsx` (`TelaPlano`), `caminho.tsx`, `trilha.ts` |
| P10 | Lição: ler conceito e exemplo. | Conceito/exemplo; conteúdo longo; origem/citações; recursos/apoio; anterior/avançar; fechar/voltar; andamento e retomada. Não prometer sincronização do rascunho entre dispositivos. | `licao.tsx`, `estudio-adaptativo.tsx`, `rascunho.ts` |
| P11 | Exercício e retorno: tentar, compreender e corrigir. | **Seis variantes próprias:** lacuna, múltipla escolha, ordenar com alternativa ao arrasto, associar dos dois lados, verdadeiro/falso com justificativa e aberta com critérios. Em cada: incompleto, verificar, acerto/parcial/erro, dica, preservar acertos, tentar novamente, rever/pular e retorno. | `licao.tsx`, `aula-formatos.tsx`, `ordenar.tsx`, `opcao.tsx` |
| P12 | Reforço: construir outro caminho e retornar. | “Outro caminho” → “Novo exemplo” → “Desafio vencido”; errar/repetir/vencer/reabrir; voltar à questão original. Incluir estado de “Resolva comigo”/“Sua vez” e recursos quando oferecidos. | `resolva-comigo.tsx`, `estudio-adaptativo.tsx` (`ApoioDaLicao`) |
| P13 | Explique ao Stu: consolidar, opcionalmente. | Texto; começar gravação somente por ação explícita; negar/Activity indisponível; parar/limite/segundo plano; revisar transcrição; enviar; falhar/repetir; retorno estruturado; seguir sem gravar. Voz ao vivo só onde oferecida, sem prometer presença no binário nativo. | `estudio-adaptativo.tsx`, `voz-ao-vivo-painel.tsx`, `voz-ao-vivo.ts` |
| P14 | Conclusão e retomada: saber o que foi praticado e seguir. | Salvando; sucesso confirmado; falha de salvamento recuperável; progresso real/previsto claramente separados na ficha; próximo passo; “Vale rever”; voltar ao mapa; reabrir e retomar; trilha concluída; refazer/recomeçar com confirmação. | `estudo.tsx` (`concluir`, `TelaConcluida`), `licao.tsx` |
| P15 | Explorar e conteúdo recebido. | Explorar Todos/Seguindo; tema; Em alta/Novas; vazio/erro/paginação; **frames próprios** de perfil público e prévia de trilha; adicionar/continuar; já adicionada/link inativo; Valeu/seguir; voltar preservando lista/rolagem. Conteúdo sintético rotulado; Em alta ordena trilhas, não pessoas. | `comunidade.tsx` (`TelaExplorar`, `TelaPerfilPublico`, `TelaPreviaTrilha`), `social.tsx` |
| P16 | Meu perfil e edição. | Visitante/sem social/social; perfil próprio; **frame de edição** com privacidade, foto, nome, resumo, interesses/cor; recorte/remover foto; salvar/erro/sair sem salvar; alcance/novidades; postar/despostar com estados de moderação. Email não público. | `perfil.tsx`, `postar-perfil.tsx`, `recorte.tsx` |
| P17 | Configurar e compartilhar trilha. | **Frames/folhas próprios** de configurações e compartilhamento: nome/descrição/capa/tema; erro/salvo por campo; link/perfil/Explorar; restrição de material; Código Studoo; copiar/folha do sistema; parar/cancelar; apagar com confirmação e consequência dos links. | `configuracoes.tsx`, `social.tsx` (`FolhaCompartilhar`, `AdicionarPorLink`) |
| P18 | Preferências, privacidade, segurança e ajuda. | Som/movimento; consentir/revogar IA e provedores; política; sair; excluir conta com digitação `EXCLUIR`; denúncia/protocolo; bloquear/desfazer/desbloquear/lista; suporte/regras. Páginas públicas abrem no navegador do sistema conforme contrato. | `som.tsx`, `privacidade.tsx`, `seguranca.tsx`, `consentimento-ia.tsx`, `comunidade.tsx` |

O painel da equipe/moderação (`/equipe/moderacao`) é operação web restrita, fora do app do estudante. Sua ausência nessas propostas mobile não é uma lacuna. As flags precisam constar no manifesto: comunidade, compartilhar, visitante, provedores, cadastro e recuperação não se deduzem de uma imagem.

## 3. Duolingo como base, com identidade Studoo

A referência sustenta: caminho legível, um desafio por vez, botão principal evidente, reação contextual do personagem, erro recuperável e conclusão que orienta o próximo passo. O Studoo mantém azul/navy, Quicksand/Nunito e seus assets. Nenhuma direção adiciona XP, sequência de dias, ranking, moedas, medalhas ou loja para parecer mais próxima do Duolingo.

Também permanecem verdadeiros os contratos de conteúdo: proposta e progresso vêm da API na implementação; IA falsa é rotulada; revelar ajuda não apaga tentativa; concluir sem acertar mantém a indicação de revisão prevista; apagar/excluir exige confirmação; gravação inicia após gesto explícito. Conteúdo/material não vira publicação automática.

## 4. Dez critérios de desenho, rastreáveis aos critérios do produto

Para evitar uma nota do protótipo parecer uma nota do app instalado, esta rodada usa **D1–D10**. Cada item herda o peso e a intenção de C1–C10, mas avalia somente a faceta de desenho observável indicada. A ficha do produto continua separada; não recebe esses números por transferência. D7 não comprova latência de API, D9 não comprova persistência e D10 não comprova paridade entre renderizadores.

| ID / origem | Critério de desenho | Peso | Evidência exigida no protótipo |
| --- | --- | ---: | --- |
| D1 / C1 | Clareza do valor e dos textos | 12 | Texto e tarefa identificáveis em cada frame; rótulos concretos; todas as instruções/contagens coerentes com o conteúdo sintético; leitura do próximo passo. Não usar opinião como teste de compreensão com pessoas. |
| D2 / C2 | Ação principal e autonomia | 12 | Percurso clicado: iniciar, avançar, voltar, cancelar, pular quando previsto e sair. CTA visível sem rolar na entrada da tarefa, antes de ações secundárias; nenhuma ação visualmente ativa sem resposta demonstrável ou indicação explícita da simulação. |
| D3 / C3 | Hierarquia, leitura e adaptação | 12 | Capturas e caixas reais em 390×844 e 360×800; conteúdo longo e texto ampliado; ausência de cortes/sobreposição/overflow horizontal. Verificar rodapé e reflow, sem declarar teclado/safe area nativos aprovados. |
| D4 / C4 | Identidade e acabamento | 8 | Tokens/componentes consistentes; arte sem distorção; tipografia, ícones e espaços com hierarquia; desenho original Studoo; diferenças A/B/C reconhecíveis além da paleta. |
| D5 / C5 | Movimento com controle | 10 | Gravação/medição das transições do protótipo e teste de `prefers-reduced-motion`; leitura e ações conservadas; nenhuma espera obrigatória ou loop decorativo concorrente. Som não necessário para entender. |
| D6 / C6 | Acessibilidade observável no desenho | 14 | Contrastes sobre o fundo efetivo; alvos ≥44 px e CTA de 52 px como parâmetro da rodada; semântica/nome/estado dos controles; foco visível e percurso de teclado do protótipo; leitura a 200%. Leitor/gestos nativos permanecem sem nota. |
| D7 / C7 | Resposta e espera desenhadas | 10 | Feedback local medido após toque/tecla; estado pendente, erro, repetir/cancelar e conteúdo que chega sem percentagem inventada. A ficha identifica tempos simulados, sem convertê-los em desempenho de rede/boot. |
| D8 / C8 | Feedback, erros e recuperação | 10 | Tentar resposta incorreta e recuperar no protótipo; retorno com ícone/texto além da cor; campos válidos preservados; confirmação destrutiva reversível; ausência de clique duplicado ou saída sem destino. |
| D9 / C9 | Continuidade e confiança representadas | 6 | Percurso local de retorno/revisão/retomada coerente; claramente sintético; nenhum resultado real alegado; origem/visibilidade de material e privacidade compreensíveis. Teste localStorage, se existir, é apenas persistência do protótipo. |
| D10 / C10 | Cobertura e consistência da proposta | 6 | Mesma matriz de tarefas e variantes nas três direções; estados semanticamente equivalentes, IDs e fontes; sistema consistente em 390/360; lacunas explicitadas. A implementação ainda exige seus próprios pares web/app e integração nativa. |

Pesos somam 100 e ficam congelados antes de avaliar. Não renomear ou trocar pesos depois de conhecer os resultados. Uma verificação de C6 real ou C9 real ainda não feita fica `null`, mesmo se D6/D9 atingirem a meta no escopo de desenho.

## 5. Escala e gates para a comparação

As âncoras do método principal continuam orientando o julgamento: 0 exige falha observada, 5 indica tarefa parcial/contorno e 8 indica dívida concreta numa variante relevante. Para esta rodada, acrescenta-se a âncora **9,0**: todas as verificações declaradas da faceta de desenho têm evidência, o fluxo opera sem contorno e não há achado crítico/alto/médio aberto; pode sobrar detalhe baixo localizado. 9,5 requer confirmação independente adicional de acabamento/variantes; 10 só cabe quando não há defeito aberto no conjunto realmente examinado. Nota alta nunca significa perfeição universal.

| Gate | Condição para passar no desenho |
| --- | --- |
| DG1 · Cobertura | As 18 famílias e seus frames/variantes declarados estão presentes nas três direções, ou há exclusão explícita realmente cabível. Estado principal ausente reprova a alegação “todas as páginas principais”. |
| DG2 · Operação | As tarefas e saídas do percurso fechado são clicáveis, com destino verificável; sem tela sem saída, botão ativo que nada faz ou perda local indevida. |
| DG3 · Leitura | 390/360, texto ampliado e conteúdo longo operáveis; CTA na dobra conforme contrato; nenhum corte ou sobreposição que atrapalhe a tarefa. |
| DG4 · Acesso e movimento | Contraste/alvos/foco/teclado e movimento reduzido passam nas variantes declaradas do protótipo. Falta de prova fica pendente; não vira aprovação por screenshot. |
| DG5 · Confiança e recuperação | Simulações identificadas; sem progresso real inventado, ação destrutiva imediata, publicação automática ou erro sem saída. |
| DG6 · Revisão independente | Três pareceres da mesma candidata; critério competente com evidência; confirmação adicional das notas ≥9,5; nenhum defeito crítico/alto/médio aberto. |

Uma dependência nativa ausente é lacuna de implementação, não motivo para fingir que o protótipo a comprovou. Dentro do próprio escopo de desenho, uma variante declarada ainda não conferida mantém a revisão **Provisória** e a nota consolidada `null` até produzir a evidência.

## 6. Rodadas e consolidação

1. **Congelar a candidata:** commit/hash dos arquivos, revisão, conteúdo/flags, lista de telas e variantes, dimensões, navegador/versão e origem dos assets. Cada direção recebe sua própria ficha.
2. **Executar a matriz:** capturar 390×844 e 360×800, percorrer tarefa central completa e variantes de risco, testar foco/200%/movimento reduzido e medir os itens objetivos. Screenshots sem interação não aprovam D2/D8/D9.
3. **Parecer visual:** D3/D4/D5/D10, com no máximo três achados prioritários, estado, arquivo/quadro e impacto. **Parecer de fluxo:** D1/D2/D8/D9. **Parecer de QA/acessibilidade:** D6/D7 e confirmação dos estados de D8/D10. Um autor explica, mas não é seu único aprovador.
4. **Fechar pareceres antes da consolidação:** sem copiar notas entre revisores nem editar a candidata durante sua revisão. Cada parecer pontua apenas o que examinou; o resto fica `null` naquele parecer, sem ser excluído do escopo.
5. **Consolidar por critério:** usar a menor nota sustentada pelos revisores competentes. Divergência se resolve reproduzindo o caso e anexando nova prova; não por média de opiniões ou preferência pelo número maior.
6. **Corrigir os achados:** registrar antes/depois, fonte nova e critérios afetados; repetir os casos afetados e a regressão necessária. Guardar notas antigas como histórico; não substituí-las silenciosamente.
7. **Encerrar quando a meta for comprovada:** gates aprovados, todos D1–D10 com prova, cada critério ≥9,0, nota ponderada ≥9,0 e nenhum achado crítico/alto/médio aberto. Se isso não acontecer, a entrega informa a lacuna e segue em revisão; não ajusta a régua para produzir aprovação.

Por tela/variante declarada, `nota_design = soma(peso × nota_D) / 100`, com todos os critérios aplicáveis comprovados. Quando algo é genuinamente não aplicável àquela variante, registrar motivo/peso; na avaliação da direção completa o critério continua aplicável se houver alguma tarefa correspondente. Critério aplicável sem prova mantém a nota consolidada `null`; não normalizar a falta para cima.

A **nota da direção** é a menor nota consolidada entre os seus fluxos/variantes obrigatórios, não a média que esconderia uma página fraca. O comparativo A/B/C publica notas distintas; uma direção não herda nota da outra. `8,99` não atinge 9 por arredondamento. Um achado médio limita a faceta afetada a no máximo 8 até correção e nova prova.

## 7. Ficha mínima e saída publicável

Cada direção deve publicar: identificação; matriz de cobertura por estado; fonte/commit; capturas; roteiro interagido; métricas objetivas; três pareceres; D1–D10 com pesos, notas/evidências/limites; gates; histórico de achados e iterações; nota final e estado. O comparativo deve explicar por que escolher uma direção para o objetivo do Studoo, sem apresentar gosto como resultado empírico.

A saída terá três linhas de conclusão independentes:

- **Desenho do protótipo:** notas D e situação real no escopo examinado; pode atingir ≥9 se passar neste protocolo.
- **Produto implementado web/iOS/Android:** C1–C10, gates e nota completa `null` enquanto faltarem provas aplicáveis. A aprovação do desenho não é aprovação da implementação.
- **Uso por pessoas/produção:** `não realizado` enquanto não houver observação; nenhuma taxa de conclusão, retenção ou satisfação inventada.

Este inventário foi produzido por inspeção de código e documentação. Nenhuma tela foi executada por esta ficha, nenhum provedor/flag de produção foi validado, e nenhuma nota foi atribuída.
