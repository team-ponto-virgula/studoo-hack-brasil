# Revisão independente de fluxos — R3

24/11/2026 · candidata `902eca4e3a8e8ac374d79972677a1ed3edc83859` · renderer preservado durante a execução. Os pareceres [R1](PARECER-FLUXOS-R1.md) e [R2](PARECER-FLUXOS-R2.md) continuam como histórico.

**Os cinco defeitos da R2 foram corrigidos e passaram na regressão.** Uma verificação adicional encontrou herança indevida da descrição ao adicionar uma nova cópia. A meta 9 ainda não está sustentada em continuidade/confiança enquanto esse caso estiver aberto.

## Fonte e execução

- `app.js`: SHA-256 `6cdf759ffc9210ce52e861625b5e5cbaf27a59016f692e15f2f95bd5e7050ce1`.
- `media-pages.js`: `35aa4f8a274a8b4b7857bc33a7b6da9a2580fc18fddcb0a3ae6d6f072021d42a`.
- `social-pages.js`: `572a52154ab2a2d6aa681dfe6ee57b110826d8a12f461400e603039625e46a58`.
- Hashes antes/depois estáveis. Chromium **156.0.8078.79**, Playwright, 390×844, contextos novos por cenário, direções Jornada/Caderno/Foco. Sem API, IA, email, microfone ou dados de produção.

| Suíte | Cenários | Verificações | Passaram | Falharam |
| --- | ---: | ---: | ---: | ---: |
| Regressão principal | 12 | 147 | 147 | 0 |
| Novos fluxos da R2 | 33 | 207 | 207 | 0 |
| Regressões integradas adicionais | 12 | 51 | 48 | 3 |
| Total R3 | 57 | 405 | 402 | 3 |

Zero exceções e zero `pageerrors`. As três falhas são a mesma condição, reproduzida em A/B/C. Cada direção recebeu 135 verificações, com 134 positivas e uma negativa. Não somei contagens de rodadas antigas a esses resultados.

## Confirmações após os ajustes

Cadastro, geração cancelada, aceite, WHERE, erro/reforço, seis formatos, pular com “Vale rever”, conclusão, reload e retomada de INNER JOIN passaram novamente. Estados de expiração/salvamento recuperados, edição por histórico, Seguindo, bloqueio, cópias privadas e visitantes mantiveram a correção da R1/R2.

Os cinco pontos da R2 foram exercitados novamente: Back/Forward não reabre a gravação de exemplo; foto abre a partir de um rascunho sem exigir descarte; suporte preserva identidade de visitante; a descrição salva é restaurada; a denúncia de prévia direta aponta para o título exibido e oculta somente esse alvo. A denúncia pelo cartão normal também continuou funcionando.

Adicionalmente, confirmei ida/volta do recorte com nome e foto no mesmo draft, cancelar um novo recorte conservando o anterior, salvamento final do perfil e reload; descrição salva/cancelada, alternância entre dois registros; e o encerramento do temporizador local após Browser Back. O limite de gravação foi exercitado com **relógio simulado do Playwright avançado em 181.000 ms**, produzindo transcrição de exemplo revisável. Isso não é espera real de três minutos, captura de som, teste de segundo plano nativo ou medição de desempenho.

Código Studoo, clipboard permitido/negado, denúncia/revisão, publicação pendente/retirada e HTMLs autossuficientes via HTTP passaram nos roteiros. Não decodifiquei o QR nem contornei a política de `file://` neste parecer.

## Achado restante — R3-F1, médio

**Reprodução nas três direções:** Configurar a trilha A → salvar descrição “Descrição exclusiva da trilha A.” → abrir a prévia “SQL sem complicação” → adicionar a cópia B → Configurar B.

**Observado:** B começa com a descrição personalizada de A. A leitura veio do textarea renderizado, não apenas do código. Os registros ficam separados depois de salvar uma descrição própria em B, e alternar de volta a A restaura A corretamente; a falha está na inicialização da nova cópia com o estado ativo anterior.

**Impacto:** o desenho apresenta metadados de outro estudo como se pertencessem à cópia recém-adicionada. É uma falha de continuidade e de contexto do protótipo, sem alegação de vazamento no aplicativo real.

**Correção e prova necessárias:** inicializar a descrição da nova trilha a partir do conteúdo demonstrativo correspondente, sem herdar o campo personalizado anterior. Cobrir tanto `add-shared` quanto criação por `accept-plan`, além de salvar/cancelar, reload, alternar e apagar uma cópia sem alterar a descrição da outra.

## Notas do recorte R3

| Critério | A | B | C | Evidência / limite |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza de contexto | 8,0 | 8,0 | 8,0 | Textos dos fluxos corrigidos estão coerentes, mas a nova cópia exibe descrição que pertence ao estudo anterior. |
| D2 · ação e autonomia | 9,0 | 9,0 | 9,0 | Percursos, cancelamentos, histórico e edição composta passaram sem o contorno da R2, no conjunto interagido. |
| D8 · feedback e recuperação | 9,0 | 9,0 | 9,0 | Erros, nova tentativa, revisão, descarte e salvamento passaram; o achado restante é de inicialização/pertencimento do dado. |
| D9 · continuidade e confiança | 8,0 | 8,0 | 8,0 | Progresso, identidade e draft preservados; herança indevida da descrição ainda aberta. |
| D10 integral | `null` | `null` | `null` | Este revisor cobre os fluxos relatados em 390 px; cobertura integral e 360 px dependem das evidências complementares da mesma candidata. Não é uma exigência de prova nativa para aprovar desenho. |
| Demais critérios integrais | `null` | `null` | `null` | Fora do escopo completo deste parecer; não herdar notas por testes de lógica. |

As notas são do recorte de desenho efetivamente observado. O achado médio limita D1/D9 a 8 e mantém a nota global `null`; não há arredondamento ou aprovação automática pela meta. Nenhum número é transferido para C1–C10 do app instalado.

## Evidências

Em `/workspace/work/revisao-fluxos-r3/`: `revisar-regressao.cjs`/`resultado.json`, `novos-fluxos.cjs`/`novos-resultados.json` e `regressoes-integracao.cjs`/`integracao-resultados.json`. Logs separados e capturas preservam as duas suítes e os diagnósticos adicionais. Nada nas fontes do protótipo foi alterado por este revisor.
