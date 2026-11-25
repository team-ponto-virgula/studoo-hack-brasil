# Jornada Azul · sistema de interface do Studoo

25/11/2026 · direção escolhida pelo dono: **A · Jornada Azul**. Este documento fixa a organização e o acabamento da implementação web/React Native. O [plano](PLANO.md) e o [inventário](INVENTARIO.md) tornam a migração verificável por componente e por fluxo.

A proposta A foi examinada como desenho HTML na [R7](../direcoes-2026-11-24/RESULTADOS.md). A implementação começa com sua própria ficha de produto; a nota 9 do protótipo não é transferida. A base de integração é `8c057241f6fc4820f36c284218a4f04affa59543`, que já contém a intro corrigida e as rodadas recentes do produto.

## Identidade que aparece no uso

**O Stu está aprovado pelo dono e permanece como está.** Conservam-se os arquivos, as expressões, as proporções, o catálogo e os controles de animação atuais. Logo e assinatura de abertura também permanecem. Esta etapa personaliza o sistema ao redor deles; não recria personagem, não troca sua linguagem nem abre uma nova aprovação de mascote.

A assinatura da Jornada Azul combina três elementos: caminho com próximo passo legível; botão azul com face e degrau; superfícies claras, arredondadas e com respiro. O branco sustenta leitura; o navy dá hierarquia; o azul destaca a ação atual. Os óculos pertencem à marca e à intro: não viram ornamento repetido em campos, checkboxes ou ícones de operação.

O Duolingo orienta progressão, um desafio por vez, reação contextual e recuperação do erro. O desenho, as cores, o texto, a iconografia e o Stu são do Studoo. Não entram XP, sequência de dias, ranking, moeda, medalhas ou ações extras para imitar outro produto.

A personalização usa dados que já existem: objetivo, título da trilha, etapa atual, progresso confirmado, tema/capa escolhidos, nome/foto e preferências. A interface acolhe o contexto real sem inventar um nível, uma meta diária ou um diagnóstico. Nenhuma nova pergunta bloqueia a primeira lição.

## Fundamentos

| Papel | Valor vigente | Regra de uso |
| --- | --- | --- |
| Ação | `#2457DD` | Uma decisão principal por conjunto de ações; texto branco. |
| Degrau da ação | `#173B9C` | Profundidade de 4 px; a face desce 3 px ao pressionar. Não mexe na caixa nem no fluxo. |
| Texto | `#15275B` | Títulos, corpo forte e ícones de conteúdo. |
| Texto secundário | `#50607A` | Descrição e metadados; sem reduzir contraste por opacidade. |
| Fundo/superfície de destaque | `#FFFFFF` / `#EDF3FF` | Leitura sobre branco; acolhimento/seleção sobre azul suave. |
| Borda | `#DFE7F2` | Separação de superfície; campos e estado selecionado exigem contraste próprio mais forte. |
| Campo | Borda `#7B8AAF`, raio 16 px | Texto 16/24 ou maior, padding lateral 16; rótulo externo e erro associados. |
| Semânticas | Sucesso `#1F7A5A`, atenção `#9A5B00`, erro `#C23B4E` | Sempre acompanhadas de texto/ícone/estado; azul não substitui sucesso ou erro. |
| Título | Quicksand 700 | Principal 30/36; seção 22/28; cartão 20/26; evitar compressão de letras. |
| Corpo | Nunito 400/700/800 | Base 16/24; leitura longa até 17/26; auxiliares 14/21, metadados a partir de 13/20. |
| Escala | 4, 8, 12, 16, 20, 24, 32, 44 px | Separar componente, grupo e seção; não ajustar cada tela com números avulsos. |
| Superfícies | Raio 24 px | Bloco principal, cartão de trilha e confirmação. Campos/ações usam 16; selos, pílula. |
| Página mobile | Margem lateral 20 px | Ações e leitura alinhadas. A navegação mantém altura-base 62, posição flutuante e safe area da spec 05/07, com raio externo 24, aba selecionada de raio 16 e fundo ativo azul suave. |
| Alvos | Principal ≥52 px; demais ≥44×44 px | Medidas mínimas, não alturas que cortam texto ampliado. No Android, preservar o hitSlop previsto. |
| Foco | Anel 3 px e afastamento 3 px | Visível por teclado; não substituído pelo relevo ou pela seleção. |

Fontes e renderização seguem a exceção técnica da [spec 07](../../specs/07-paridade-web-mobile.md). O mesmo papel usa o mesmo token nas duas implementações. Uma mudança de token requer comparar todos os consumidores; um ajuste de tela não pode criar outro azul principal.

## Anatomia dos componentes

| Família | Anatomia e identidade | Estados obrigatórios |
| --- | --- | --- |
| Botão principal | Face azul, texto Nunito 800, raio 16, altura mínima 52 e degrau 4. Ícone apenas quando ajuda a reconhecer a ação. | Normal, foco, pressionado, indisponível e enviando; rótulo/caixa estáveis, ação duplicada bloqueada. |
| Botão secundário/de texto/ícone | Borda/superfície neutra ou texto; sem disputar com o principal. Ícone isolado precisa de nome acessível e alvo 44. | Foco, pressão, selecionado quando aplicável e indisponível. |
| Campo | Rótulo externo, controle, descrição/contador e erro perto do valor. Placeholder é exemplo, não nome. | Vazio, preenchido, foco, inválido, pendente, bloqueado e conteúdo longo; preservar valor válido. |
| Escolha/ficha/chave | Contorno e superfície de seleção; indicação textual e papel correto. Tocar não desloca os vizinhos. | Normal, marcado, desmarcado, parcial/correto/errado quando aplicável e bloqueado. |
| Cartão de trilha/retomada | Título real, contexto, progresso real e próximo conceito; capa e Stu mantêm proporção. Só um destino principal por cartão. | Vazio, em andamento, concluído, recebido, em revisão, falha e menu aberto. |
| Cartão de conteúdo | Conteúdo com borda discreta, raio 24 e respiro; separar seções por hierarquia, evitando cartão dentro de cartão sem função. | Leitura, expandido, referência aberta, carregando e erro recuperável. |
| Progresso/selo | Fração legível, barra e rótulo; sem texto de salvo antes da resposta. | Inicial, parcial, concluído, atualizando e offline. |
| Caminho | Partes, nós, título e estado; próximo passo com halo/degrau. Curva e alternância permanecem subordinadas à leitura dos nomes. | Atual, disponível, concluído, bloqueado, prévia, ponte e vale rever. |
| Exercício | Instrução e pergunta antes da interação; seis formatos com a mesma família de escolha/campo. | Incompleto, tentativa, corrigindo, acerto, erro, parcial, dica/reforço e retomar. |
| Retorno/conclusão | Cor semântica + ícone + frase concreta; próximo passo forte, evidência e demais detalhes em segundo plano. | Salvando, salvo confirmado, falha/repetir, vale rever e trilha concluída. |
| Menu | Botão 44, balão com itens 48, ações destrutivas por último; tokens e foco da spec 11. | Abrir, navegar por teclado, escolher, sair por fora/Esc/voltar e devolver foco. |
| Folha/confirmação | Título, explicação, conteúdo e ações; safe area/rolagem internas; conteúdo acessível sem competir com a tela de baixo. | Abrir, cancelar, enviar, falhar, repetir e fechar; foco seguro e retorno ao acionador. |
| Aviso | Faixa navy, ícone, texto e no máximo uma ação; não leva foco. | Status/erro, ação opcional, pausa de tempo e dispensa conforme contrato existente. |
| Esqueleto/vazio/erro | Distinguir esperar, não ter dados e falhar. Stu atual aparece quando ajuda a acolher; a ação diz como seguir. | Pendente, vazio útil, offline, repetir e indisponível. |

## Organização de tela

A sequência é **contexto → tarefa → feedback → próximo passo**. Cabeçalho informa onde a pessoa está; conteúdo resolve uma tarefa; rodapé segura a ação principal onde o contrato exige. Não empilhar uma segunda barra com as mesmas ações.

Até 600 px, a ação principal ocupa a largura útil, aparece antes das saídas secundárias e fica visível na entrada da tarefa. Rótulos crescem/rolam com texto ampliado: o mínimo de altura não é teto. Nenhuma ação fica por baixo do teclado, da cápsula, do aviso ou da área segura. “Etapa anterior” permanece contextual, junto do andamento/conteúdo; não cria uma fileira de quatro ações concorrentes no rodapé.

- **Acolher:** entrada, apresentação e conta explicam valor e oferecem conta/visitante conforme flags reais.
- **Preparar:** objetivo e material têm acesso claro; geração é a trilha tomando forma por eventos reais, com cancelar e recuperar.
- **Aprender:** proposta → aceite → mapa → conceito/exemplo → tentativa → retorno/reforço → explicação opcional.
- **Continuar:** conclusão confirma o que foi salvo e mostra a próxima lição; Minhas trilhas retoma o mesmo estado.
- **Conectar e cuidar:** Explorar/perfil/compartilhar ficam fora da disputa com o exercício; privacidade, ajuda e preferências têm grupos identificáveis.

## Movimento

A pressão do botão dura aproximadamente 110 ms e altera apenas a face. Microtransições de estado usam 140–220 ms; menu/folha mantêm os tempos da spec 11. Entrada de seção usa deslocamento curto e opacidade, sem remontar ao digitar ou ao atualizar o progresso. O conteúdo não espera uma coreografia decorativa.

Com movimento reduzido ou preferência ainda desconhecida, dispensar deslocamento, escala e loops; conservar imediatamente conteúdo, seleção, feedback e ações. O estado final continua compreensível sem som. Som e gravação obedecem às preferências/gestos existentes. A assinatura do boot mantém o hotfix e o orçamento próprios; esta direção não a reprograma.

## Critério para dizer que migrou

Um componente só pode ser marcado como integrado quando os consumidores web/app usam o mesmo papel visual, seus estados de risco operam e as evidências têm fonte identificada. Um token global pode atualizar muitos consumidores; isso não comprova que cada estado, folha ou tela foi revisado. O [inventário](INVENTARIO.md) impede confundir cobertura de CSS com cobertura de UX.
