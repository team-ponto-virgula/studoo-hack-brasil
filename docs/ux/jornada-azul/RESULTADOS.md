# Jornada Azul · resultados da implementação

**Candidata R2: `b3e97e7cbe7d6b8b711216070453a13ebcad36e3`.** R1: `fa4be429992037cdaa1be055f52be6a529d32f76`. Base: release `8c057241f6fc4820f36c284218a4f04affa59543`. O código preserva as correções recentes de continuidade, foco, comunidade e boot; não incorpora o diagnóstico curricular de outra branch.

## Mudanças no produto

- **Fundamentos comuns:** `packages/contratos/src/jornada-azul.ts` alimenta o tema RN e o CSS gerado. `ui:conferir` impede divergência de tokens antes do typecheck/build.
- **Controles próprios:** primário tátil de 52 px, alternativas de 44 px, campos legíveis, seleção além da cor, estados de erro/espera e navegação em colunas que crescem com o texto. A ampliação não fica limitada a 1,3× na navegação.
- **Componentes semânticos:** `CartaoStudoo`, `CabecalhoSecao`, `EstadoTrilha` e `ProgressoStudoo`, com consumidores reais nas duas implementações.
- **Organização da jornada:** objetivo/material, geração/proposta/mapa, leitura/exercício/feedback, conclusão e retomada. O primário do Pedido permanece na dobra com fonte ampliada; o enunciado orienta a resposta em 22/30; o operador SQL preenchido tem contraste computado de 12,81:1.
- **Conta e comunidade:** grupos e campos, cartões, vazios, folhas, confirmação e configuração da trilha. Salvamento por campo tem fila, última intenção e identidade do plano; respostas antigas não atualizam outro contexto.
- **Interação recuperada:** menus recebem foco/teclado e camada própria; confirmação mantém foco seguro ao reordenar ações; efeito rearmado não devolve foco por cima da folha; aviso de música cede precedência a modal/menu.

O mascote, a marca e a assinatura de abertura não tiveram arquivos alterados. O escopo da API e do aprendizado permanece o da release; as mudanças de salvamento são de coordenação local da interface, usando os mesmos endpoints.

## Verificações realmente executadas

| Conjunto | Resultado | Alcance |
| --- | --- | --- |
| Typecheck web / mobile | Passaram | TypeScript das duas implementações; tokens gerados conferidos. |
| Build web R2 | Passou | Build de produção em worktree isolado; `/sistema-ui` respondeu 404 e `/api/auth/config`200 no servidor desse build. |
| Exportação iOS R2 | Passou | Metro/Hermes exportaram o bundle iOS; isso não é compilação/assinatura de IPA nem execução em aparelho. A URL de API desse ensaio é sintética e não é configuração de distribuição. |
| Interface | **693/693** | Mesmos casos anteriores, atualizados para os novos contratos visuais e tokens; nenhum caso removido ou ignorado. |
| Paridade / movimento / visitante | **5/5 · 6/6 · 6/6** | Suítes do repositório; paridade de código/textos/cores não prova igualdade de todos os pixels em aparelho. |
| Formatos / domínio | **271/271 · 18/18** | Regras dos exercícios, visuais, gerador falso e continuidade de domínio. |
| Web: SQL | Passou em 390/360 | Gerar/aceitar, errar `>`, corrigir `>=`, concluir200, verificar1/5, recarregar e abrir INNER JOIN; falha de rede preserva o pedido. |
| Web: Config | **3/3**, seis PATCH reais | Duas edições no mesmo campo, campos distintos e troca de plano com resposta atrasada; GET final confirma dados. |
| Web: controles | Passaram nos recortes | Navbar200%, CTA100/200%, menus por toque/teclado, foco/armadilha, confirmação ocupada e escala dinâmica. |
| RN Web R1 | **95/95**,44 PNGs,43 chamadasAPI | Jornada e recortes de perfil/comunidade com API MOBILE local e PostgreSQL sintético. Inclui dois quadros de antes do fix compacto. |
| RN Web R2 | **32/32**,8 PNGs,23 chamadasAPI | Retorno do Explique, CTA350/320×56, conclusão e retomada. Demais fontes RN idênticas à R1. |
| Web focal R2 | **4/4** | Confirmação200% com aviso real, e Continuar350/320×52; fontes estáveis. |
| Catálogo real | Quatro vistas + dois checks de foco | 390/360 em 100/200%, sem transbordamento/ação cortada/erroJS; PDF de 3 páginas exportado. |

Esses conjuntos se sobrepõem. Asserções, cenários, chamadas, capturas e rodadas não formam um total único de testes funcionais. R1 não foi rebatizada como R2; o diff dos três arquivos de runtime afetados e as heranças estão documentados nos pacotes.

## Revisão e nota

- **Arte:** C4 e facetas visuais de C3 = **9 na amostra**, conforme [parecer](PARECER-ARTE.md). Identidade, ritmo, hierarquia, estados e Stu contextual foram observados em capturas reais.
- **Fluxos web e RN Web:** **9 nos recortes declarados** pelos revisores; os relatórios discriminam tarefas, medidas e limitações. Os rótulos D1/D2/D8/D9 preservados no parecer RN correspondem às facetas de clareza, autonomia, recuperação e continuidade, sem consolidar nota global C1–C10.
- **Nota integral das 44 famílias, aparelho nativo e pesquisa com pessoas: `null`/não executados.** Não houve transferência da nota9 dos protótipos HTML.

Os achados prioritários examinados foram corrigidos e rechecados. **AR8 continua baixo e aberto**: aviso transitório sobre parte do Enviar já usado, em conteúdo rolado do Explique, com Continuar livre. [Plano de acompanhamento](PLANO.md#acompanhamento-residual-da-revisão-r2) e [provas transitórias](evidencias/arte/LEIA-ME.md) preservam o caso. C15 não recebe aprovação integral por uma captura calma posterior.

## Evidências acessíveis

- [RN Web: parecer, JSONs e capturas selecionadas](evidencias/rnweb/PARECER-RNWEB.md).
- [Web R1: seleção sanitizada](evidencias/web/README.md).
- [Web R2: parecer](evidencias/web-r2/PARECER-R2.md) e [resumo](evidencias/web-r2/PUBLICAVEL.json).
- [Arte: focais, antes do fix e estado transitório](evidencias/arte/LEIA-ME.md).
- [Manifesto da entrega](evidencias/manifesto.json) · [registro consolidado](RESULTADOS.json).

## Limites de execução

O ambiente usa dados sintéticos, IA falsa e email falso. A aplicação web e a API MOBILE local persistem no PostgreSQL isolado. O harness RN Web adapta SecureStore/foco e encaminha um hostname HTTPS sintético à API local; não valida TLS, Keychain, permissões, seletores, VoiceOver/TalkBack, desempenho ou áudio do aparelho. Cadastro/recuperação RN ficaram fora desse harness pela proteção do email falso em loopback. O aviso dev `ariaHidden` do adaptador SVG está registrado nos relatórios.

Os seis formatos têm regressões de código/regras, mas não todos receberam inspeção visual em todas as suas variantes nesta rodada. Compartilhamento completo/QR, moderação enviada, mídia nativa e os demais estados não exercitados ficam identificados no [inventário](INVENTARIO.md) e no plano. **Não há nova build TestFlight desta UI.**
