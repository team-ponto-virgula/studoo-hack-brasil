# Revisão independente de fluxos — R1

24/11/2026 · candidata `62ef474f34a31e2e0a0d5bb0cc2fa721b709fc5f` · revisor de fluxo, sem autoria do renderer. Não alterei app, CSS, critérios ou pesos.

**Resultado: a meta 9 ainda não é sustentada.** O percurso principal funciona nas três direções, mas recuperação após reload, saída de edição pelo navegador e estados da comunidade têm defeitos médios reproduzidos. Nenhuma nota de produto web/nativo foi atribuída.

## Fonte, execução e alcance

- `app.js` SHA-256 antes/depois: `32987017a0f36af58adb72eaa94fcb64f51260f2751ebdef2c1f895fae45ef43`, estável durante a rodada.
- Chromium com Playwright, viewport **390×844**, três contextos de direção e contextos novos por cenário; sem API, IA, email, áudio ou banco. A restauração medida é somente `localStorage` do protótipo.
- **12 cenários, 147 verificações: 129 passaram e 18 falharam**. As seis verificações distintas que falharam repetem-se em A/B/C. Zero exceções do roteiro e zero `pageerrors`.
- As três direções receberam o mesmo roteiro; o renderer compartilhado explica os resultados idênticos de fluxo. Este parecer não julga preferência estética entre as direções.
- Não conferi geometria a 360 px, contraste, leitor de tela, teclado virtual, gestos, API, rede ou aparelho. Esses itens dependem dos outros pareceres e de provas próprias.

## O que passou de fato

O percurso central passou **23 verificações por direção**: cinco cenas de apresentação; interesses; email inválido; código incorreto e `123456`; senha curta e válida; conta de exemplo; objetivo SQL com material; consentimento; geração cancelada preservando objetivo e material; geração e aceite; WHERE; resposta incompleta; erro com `>`; reforço em três etapas, incluindo erro no desafio; volta à questão original com a tentativa anterior preservada; acerto com `>=`; texto e indisponibilidade de áudio sem apagar a explicação; retorno identificado como exemplo sem avaliação por IA; conclusão local 1/5; reload local; retomada de INNER JOIN com consulta e pergunta correspondentes; cancelar saída e pausar no mapa sem apagar o progresso.

Também passaram redefinição de senha voltando à entrada; confirmação de descarte pelo botão Cancelar; cancelar o descarte preservando o rascunho; salvar nome; seguir e desfazer bloqueio pela lista; adicionar uma cópia preservando a trilha anterior; não duplicar a mesma cópia; cancelar/apagar uma trilha com confirmação mantendo a outra; e exigência de `EXCLUIR` antes da exclusão, com cancelamento preservando os dados locais. Não executei a confirmação final de exclusão nesta rodada.

## Três prioridades de correção

| Prioridade / gravidade | Reprodução nas três direções | Observado / impacto | Correção e nova prova necessárias |
| --- | --- | --- | --- |
| F1 · médio · recuperação e continuidade | Abrir `proposta&s=expirada` → “Gerar nova proposta” → reload. Repetir com `codigo&s=expirada` → reenviar e `conclusao&s=salvar-erro` → tentar salvar. | O DOM recupera, mas a URL mantém o estado antigo. Reload reabre a proposta/código expirados ou “Ainda não foi salvo”. A pessoa perde a confiança na recuperação que acabou de ocorrer. | Atualizar rota e cenário junto com a transição. Repetir cada caso, confirmar URL/estado e reload, sem inventar sucesso de servidor. |
| F2 · médio · autonomia ao sair | Meu perfil → Editar → alterar nome → Voltar do navegador. | Sai diretamente para o perfil, sem a decisão de descarte oferecida pelo botão Cancelar. O draft permanece escondido no estado local. A mesma intenção de saída tem comportamento inconsistente. | Aplicar a guarda de edição também à navegação de histórico; testar cancelar e confirmar a saída por botão e browser Back, além de reload do draft. |
| F3 · médio · estados da comunidade | Em Explorar, abrir “Seguindo” sem seguir perfis. Depois seguir Lia, bloqueá-la e observar seu perfil/Explorar. | Seguindo mostra as mesmas três trilhas, enquanto o chip Todos continua ativo. O bloqueio fica na lista local, mas o perfil e o botão Seguindo continuam disponíveis. O desenho não representa a consequência prometida. | Filtrar os dados locais e expor o estado selecionado. Bloqueio deve ocultar conteúdo/interações e retornar ao Explorar; permitir desfazer/desbloquear conforme a spec 14. Testar vazio, seguido, bloqueado e desbloqueado. |

F3 não é inferência sobre o servidor. A [spec 14](../../../specs/14-seguranca-comunidade.md), seção 1, exige ocultar perfil/trilhas, impedir seguir/adicionar e voltar ao Explorar após bloquear. O protótipo pode representar esses efeitos com dados locais, sem chamar uma API real.

## Notas do recorte interagido

Os números abaixo são **limites da R1 nas facetas examinadas**, iguais em A/B/C porque os defeitos foram reproduzidos em cada uma. Não são uma nota global da direção nem aprovação das variantes não executadas. Pelas âncoras do protocolo, os achados médios impedem nota acima de 8 nas facetas afetadas.

| Critério | A | B | C | Evidência / limite |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza | 8,0 | 8,0 | 8,0 | Textos e próximo passo do percurso SQL coerentes; Seguindo/bloqueio representam estados diferentes do conteúdo exibido. Não houve teste de compreensão com pessoas. |
| D2 · ação e autonomia | 8,0 | 8,0 | 8,0 | Iniciar, cancelar, corrigir, pausar e continuar funcionam; browser Back contorna a guarda de edição. |
| D8 · recuperação | 8,0 | 8,0 | 8,0 | Erro de exercício e reforço recuperam corretamente; os três estados recuperados reaparecem após reload. |
| D9 · continuidade e confiança | 8,0 | 8,0 | 8,0 | Progresso/cópias/retomada locais preservados; recuperação por rota e efeitos da comunidade ainda incoerentes. |
| D10 · cobertura integral | `null` | `null` | `null` | 32 páginas principais existem em cada direção, mas este roteiro não executou todas as variantes da matriz. Lacunas conhecidas abaixo também impedem aprovar DG1. |
| D3/D4/D5/D6/D7 | `null` | `null` | `null` | Fora da competência/prova desta rodada. |

## Cobertura que ainda exige fechamento

As 18 famílias têm uma página-base representada, mas 32 páginas não comprovam todos os subframes obrigatórios. Por inspeção do renderer, ainda faltam desenhos/interações próprios para gravação em curso/parar/limite/transcrição (P13), recorte de foto e edição de interesses/cor (P16), Código Studoo e seus estados (P17), motivo de denúncia e confirmação específica (P18), e estados de moderação/publicação previstos na spec 14. Há diálogos que explicam que a implementação virá depois; isso identifica a simulação, mas não substitui o desenho do estado requerido.

Na parte exercitada, executei lacuna de WHERE e a múltipla escolha de INNER JOIN, além do desafio do reforço. As outras cinco apresentações do seletor de formatos não receberam um percurso completo deste revisor. Não aprovei D10 por equivalência de HTML ou por existir um botão.

DG2/DG5 não passam integralmente enquanto F1–F3 estiverem abertos. DG1 fica pendente com as lacunas de subframes; DG3/DG4 dependem dos outros pareceres; DG6 só pode ser decidido após os três pareceres da mesma candidata. A nota consolidada da direção permanece `null` nesta revisão, sem arredondamento para 9.

## Evidências preservadas

Script: `/workspace/work/revisao-fluxos-r1/revisar.cjs`. Resultado detalhado: `/workspace/work/revisao-fluxos-r1/resultado.json`. Capturas por direção/cenário no mesmo diretório: erro de WHERE, conclusão, browser Back, Seguindo, perfil bloqueado e reload da proposta expirada. Os arquivos de bancada ficaram fora do Git conforme a tarefa; a coordenação pode publicar os recortes sanitizados junto ao manifesto.

Para R2, repetir o roteiro nos arquivos corrigidos, identificar novo commit/hash e preservar este parecer como histórico. Sucesso na R2 não deve apagar as 18 falhas da R1 nem se transformar em validação do app nativo.
