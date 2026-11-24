# Piloto Clareza — criação, estudo e conclusão

24/11/2026 · pedido de repaginação urgente do app, seguido de pesquisa de referências na internet. **Implementação do primeiro lote**, em web e mobile: Pedido, geração/proposta, leitura/ação da lição, conclusão e ação de retomada. Perfil, comunidade e demais fluxos continuam no inventário; esta rodada não os apresenta como redesenhados ou avaliados.

A [pesquisa de estilos](referencias/ESTILOS-2026-11-24.md), os [componentes](referencias/COMPONENTES-2026-11-24.md) e os [fluxos de referência](referencias/FLUXOS-2026-11-24.md) sustentam a direção A. O [painel](referencias/painel-estilos.png) é pesquisa de sites; as capturas abaixo são do produto integrado com dados sintéticos.

## O que mudou

- **Pedido:** título e objetivo em primeiro plano; campo e controles planos, com material e sugestões em posição secundária. Azul/navy e Quicksand/Nunito preservados.
- **Geração/proposta:** superfície clara com menos elementos concorrentes. Os nós, eventos, cancelamento, ajuste, aceite, erro, expiração e medição do primeiro nó continuam reais.
- **Lição:** corpo de leitura em 17/26, auxiliares legíveis e ações principais de 52 px, preservando etapas, exercícios, correção e recursos.
- **Conclusão:** título e lição → progresso confirmado → próxima lição → objetivo praticado e aviso de revisão → detalhes da sessão. Uma reação do Stu; removidas as camadas simultâneas de confete/raios. A ação de continuar vem antes da alternativa de voltar.
- **Retomada:** ação visual consistente; progresso, próximo destino e regras de liberação continuam vindo do servidor.

`Botao.plano` e `Caminho.claro` são opt-in. Os renderizadores continuam específicos de cada plataforma; não foi instalado um catálogo de componentes. As emendas das specs 04/11/13 registram o novo brief e preservam os contratos funcionais.

## Conferência realizada

| Superfície | O que foi feito | Resultado e limite |
| --- | --- | --- |
| Web, Next real local | Conta sintética exclusiva, gerar/aceitar SQL, errar com `>`, corrigir com `>=`, concluir após POST200, recarregar com 1/5 salvo e abrir a lição 2 | Nove verificações positivas, zero erros de JavaScript; não é medição de desempenho ou teste com pessoas. |
| Código mobile em React Native Web | Login pela UI em outra conta, mesmos passos, progresso 1/5 lido novamente na API após reload e retomada de INNERJOIN | Nove etapas concluídas, zero pageerrors, hashes estáveis. API Next separada com mesmos handlers e dados locais; adaptações de QA descritas abaixo. |
| Capturas | Pedido, proposta, lição, exercício/correção, conclusão, mapa e retomada em 390×844 e 360×800 | Pares reais de cada renderer. Não chamar as capturas RNWeb de execução no iPhone/Android. |
| Código/build | Checks mobile 603/603 antes de integrar o teste extra da intro; interface integrada 604/604; tipos mobile, paridade 5/5 e movimento 4/4; tipos web formais e build de produção | Todos passaram. O [CI da fonte do IPA](https://github.com/team-ponto-virgula/studoo-hack-brasil/actions/runs/45459665209) passou. Os 18 casos de abertura integram os 604; não somar subconjuntos. Os arquivos de checks anteriores preservam seus próprios hashes e contagens. |

[Manifesto e hashes](evidencias/clareza-2026-11-24/manifesto.json) · [percurso web](evidencias/clareza-2026-11-24/web/percurso.json) · [percurso RNWeb](evidencias/clareza-2026-11-24/rnweb/resultado.json) · [checks mobile](evidencias/clareza-2026-11-24/checks-mobile.json) · [parecer visual independente](PARECER-PILOTO-CLAREZA.md).

Os roteiros preservam o histórico de ajustes. Na web, dois seletores iniciais foram corrigidos: o título possui `!` e o nome acessível do nó contém o estado “Começar”. No mobile complementar, os testes legados de tamanho/folga foram atualizados para o brief A, mantendo as verificações de foco/nome, alvo 44, título sem truncamento, nó inteiro e centro da área disponível. Falhas de expectativa de estilo não foram apresentadas como falhas da API nem apagaram a proteção funcional.

Na reabertura RNWeb, uma leitura de `/api/privacidade` falhou na ponte, com causa indeterminada. Houve chamadas bem-sucedidas posteriores até a lição 2; não se atribuiu o erro ao fechamento final nem se afirmou que toda a rede passou. **Privacidade após reload continua sem validação** nessa superfície. [Classificação preservada](evidencias/clareza-2026-11-24/rnweb/classificacao-transporte.json).

O parecer identificou o rodapé da Proposta com 16 px contra 20 px da web. O ajuste local passou a 20/16/16 com gap 10; tipos mobile e 38 verificações focadas passaram. A [recaptura específica](evidencias/clareza-2026-11-24/proposta-alinhada/LEITURA.md) confirmou CTA `(20,722,350,52)` em 390×844 e `(20,678,320,52)` em 360×800. Foram registrados estado, offsets naturais e normalização ao topo, em contextos independentes. As abortagens de stream observadas foram preservadas; não se aprovou rede ou streaming por essas imagens. A comparação global da Proposta continua parcial: variantes/rolagens e resumo por nó não são certificados como paridade pixel a pixel.

## Capturas para revisão

| Estado | Web 390/360 | App em RNWeb 390/360 |
| --- | --- | --- |
| Pedido | [390](evidencias/clareza-2026-11-24/web/pedido-390.png) · [360](evidencias/clareza-2026-11-24/web/pedido-360.png) | [390](evidencias/clareza-2026-11-24/rnweb/01-pedido-390x844.png) · [360](evidencias/clareza-2026-11-24/rnweb/01-pedido-360x800.png) |
| Proposta | [390](evidencias/clareza-2026-11-24/web/proposta-390.png) · [360](evidencias/clareza-2026-11-24/web/proposta-360.png) | [390](evidencias/clareza-2026-11-24/rnweb/02-proposta-390x844.png) · [360](evidencias/clareza-2026-11-24/rnweb/02-proposta-360x800.png) |
| Conclusão | [390](evidencias/clareza-2026-11-24/web/conclusao-390.png) · [360](evidencias/clareza-2026-11-24/web/conclusao-360.png) | [390](evidencias/clareza-2026-11-24/rnweb/06-conclusao-390x844.png) · [360](evidencias/clareza-2026-11-24/rnweb/06-conclusao-360x800.png) |

## Limites e estado de avaliação

**Mobile nativo: Provisório, notas `null`.** O harness RNWeb usou localStorage no lugar do SecureStore, fallback para APIs de acessibilidade ausentes no navegador e ponte HTTPS de bancada para uma API Next local com flags mobile. Essas adaptações não foram incorporadas ao app. Não comprovam Keychain, foco/leitor, TLS/CORS, streaming, teclado virtual, áreas seguras ou fluidez em aparelho. A conferência web usa o transporte normal do site; a geração nativa por streaming permanece para o build instalado.

O Stu exibido é o asset atual do kit, usado em escala contida. Os originais do novo Stu caderno continuam sendo as [referências de branding](REFERENCIAS-DO-STU.md); esta rodada não redesenhou um substituto nem afirma que essa integração terminou. Referências públicas e inspeção visual não aprovam toda a UX com 9,5. O método mantém pesos e gates, e exige evidência por fluxo/superfície.

A intro é a [versão suave de 1,04 s](RESULTADO-INTRO.md), exclusiva mobile. Sua conferência anterior à integração do piloto está identificada separadamente. O **build 0.1.0 (6)** está disponível no **Studoo Beta Interno**, com `VALID` + `IN_BETA_TESTING` confirmados e leitura independente às 19:26 UTC de 24/11. O [registro de distribuição](../beta/BUILD-6-INTRO-CLAREZA.md) identifica fonte, checksums, auditoria e vínculo real ao grupo; disponibilidade interna não equivale a execução nativa, aprovação global de UX ou revisão externa.

## Reabrir no Cloud

Na worktree do piloto, com o ambiente sintético já configurado: `npm exec next dev -- --hostname 0.0.0.0 --port 3010`. A URL local é `http://localhost:3010`; acesso pelo cliente exige uma prévia HTTP configurada para a máquina. Não é um endereço público de produção.

O harness de QA complementar está preservado localmente em `.studoo-local/qa-rnw`, com instruções/limitações próprias; sua ponte precisa acompanhar o contexto do navegador. Não equivale a abrir diretamente um app nativo. As contas sintéticas, tokens e arquivos privados de sessão não entram no Git ou nas capturas publicadas.
