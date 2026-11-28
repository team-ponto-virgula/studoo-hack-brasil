# Três direções — resultado final do desenho

**A, B e C alcançaram 9,0 na régua D1–D10**, com todos os gates do escopo aprovados, após sete rodadas. A candidata é **`f0c9b7fb3fb962827fd743096fee935b4873ed29`**. Nenhum achado crítico, alto ou médio permaneceu aberto no conjunto examinado. A [matriz final](MATRIZ-COBERTURA-R7.md) rastreia representação, interação, captura, mínimos por família e aproveitamento explícito de provas históricas.

São **18 famílias e 35 páginas por direção**, seis formatos de exercício e variantes/folhas. A nota se refere ao protótipo HTML mobile em 390×844/360×800, com os casos declarados de texto 200% e dados longos. Não é nota do aplicativo instalado, nem medida de satisfação, compreensão ou retenção por estudantes.

## Comparação e recomendação

| Direção | Sistema de organização | Nota de desenho | Entrega |
| --- | --- | ---: | --- |
| **A · Jornada Azul** | Percurso espacial, reação contextual do Stu e próximo passo forte. | **9,0** | [PDF](entrega/studoo-direcao-a.pdf) · [Prancha](evidencias/final/prancha-a.png) |
| **B · Caderno Claro** | Papel, capítulos, margem e marcador para retomar. | **9,0** | [PDF](entrega/studoo-direcao-b.pdf) · [Prancha](evidencias/final/prancha-b.png) |
| **C · Foco Vivo** | Lista linear, hero navy e concentração no conceito. | **9,0** | [PDF](entrega/studoo-direcao-c.pdf) · [Prancha](evidencias/final/prancha-c.png) |

**Recomendo A como base da implementação**, pela correspondência ao pedido de Duolingo como inspiração: orientação clara, companhia contextual e recuperação do erro. B aproxima a composição da metáfora do novo Stu caderno; C oferece leitura mais contida. Essa recomendação é julgamento de design, sem pesquisa de preferência. Cada direção deve conservar um sistema coerente entre telas.

## Critérios e consolidação

[F] = [Fluxos R7](revisoes/PARECER-FLUXOS-R7.md); [V] = [Visual R7](revisoes/PARECER-VISUAL-R7.md); [Q] = [QA/acessibilidade R7](revisoes/PARECER-A11Y-R7.md); [AR] = [Arte R7](revisoes/PARECER-ARTE-CRAFT-R7.md); [M] = [Matriz R7](MATRIZ-COBERTURA-R7.md).

| Critério | Peso fixo | A | B | C | Parecer competente |
| --- | ---: | ---: | ---: | ---: | --- |
| D1 · Clareza do valor e dos textos | 12 | 9 | 9 | 9 | F |
| D2 · Ação principal e autonomia | 12 | 9 | 9 | 9 | F |
| D3 · Hierarquia, leitura e adaptação | 12 | 9 | 9 | 9 | V, Q |
| D4 · Identidade e acabamento | 8 | 9 | 9 | 9 | V, AR |
| D5 · Movimento com controle | 10 | 9 | 9 | 9 | V, Q; medições R6 equivalentes |
| D6 · Acessibilidade observável | 14 | 9 | 9 | 9 | Q |
| D7 · Resposta e espera locais | 10 | 9 | 9 | 9 | Q; ramos R6 equivalentes |
| D8 · Feedback, erros e recuperação | 10 | 9 | 9 | 9 | F |
| D9 · Continuidade e confiança representadas | 6 | 9 | 9 | 9 | F |
| D10 · Cobertura e consistência | 6 | 9 | 9 | 9 | M, triangulação F/V/Q/AR |
| **Ponderada / mínimo observado** | **100** | **9,0 / 9,0** | **9,0 / 9,0** | **9,0 / 9,0** | Menor nota competente, sem média entre revisores. |

Os pesos e a meta foram fixados antes de avaliar. A âncora 9 significa evidência suficiente nas facetas declaradas e nenhum defeito crítico/alto/médio aberto nesse conjunto. Todas as famílias têm mínimo competente 9 rastreado em M; a média não escondeu uma variante inferior. **Não há base para 9,5/10 ou perfeição universal.** O [JSON consolidado](AVALIACAO-FINAL.json) mantém fontes e limites; critérios aplicáveis sem prova de produto continuam `null`.

**DG1–DG6 passam no desenho declarado:** cobertura; operação; leitura; acesso/movimento; confiança/recuperação; revisão independente. As exclusões condicionais estão fundamentadas na matriz: as cinco lições SQL falsas não oferecem `resolucao`; reiniciar toda a trilha não é uma ação do produto consultado. Rever e reiniciar a tentativa atual continuam avaliados.

## O que foi verificado de fato

| Conjunto R7 | Prova nova | Limite |
| --- | --- | --- |
| Fluxo | **912/912 asserções, 321 cenários**, três direções; geração/aceite SQL, primeira lição, cinco lições, progresso local, reload/retomada, metadados e riscos de compartilhar. | Eventos/localStorage sintéticos. Sem banco, API ou autenticação reais. |
| QA/acessibilidade | **210 PNGs DPR2 novos**, **36 avisos** e **138 verificações de clipboard/teclado**; 17 arquivos comparados ao Git e HTTP, com hashes estáveis. | DOM/teclado do Chromium; operações de clipboard controladas. Sem VoiceOver/TalkBack ou seletor nativo. |
| Visual | **192 vistas novas** dos afetados, 390/360 e 100/200%; divulgação, revisão, fallback e restrições. Sem overflow, erro JS ou rodapé fora nos casos medidos. | As demais telas e medições R6 são históricas, aproveitadas por equivalência documentada. |
| Arte | **24 quadros finais novos abertos**, fonte estável; composição/copy afetadas, saídas e restrições. | Assets/fontes/CSS iguais aos examinados na R6. Kit do Stu provisório. |
| Artefatos | **3 PDFs de 36 páginas** (capa + 35 dobras iniciais), **210 PNGs** e **5 pranchas**; imagens carregadas, metadados e capa conferidos. | PDFs mostram a dobra inicial; rolagem/interações estão nos HTMLs. |

Os conjuntos se sobrepõem. **Não somar asserções, cenários, vistas, PNGs ou rodadas como um número de testes funcionais.** O diff R6→R7 muda só app/media/social JS: 14/17 arquivos de runtime permanecem idênticos, além de assets/fontes. As provas R6 continuam com seu commit e não foram rebatizadas. A matriz identifica exatamente o que foi repetido e o que foi aproveitado.

No conjunto canônico, os alvos mínimos são **44 px**, CTA **52 px**, texto auxiliar mínimo **12 px**; o menor contraste normal medido foi **5,417:1 em A, 5,254:1 em B e 5,318:1 em C**. Texto ampliado e movimento reduzido têm provas dirigidas da R6, preservadas por equivalência; não foi inventado um benchmark de frames nativos na R7.

## Histórico preservado

| Rodada / fonte | O que impediu ou permitiu o fechamento |
| --- | --- |
| R1 · `62ef474` | Histórico/saídas, foco, reflow e subfluxos incompletos. |
| R2 · `31fb427` | Novos subfluxos; casos de áudio, visitante, descrição e reflow ainda falhavam. |
| R3 · `902eca4` | Descrição herdada por cópia, email nas notas, foto/foco e acabamento exigiram correção. |
| R4 · `a6f2e09` | Arte atingiu 9; auditoria encontrou 14 lacunas de representação e QA manteve foco/cabeçalho. |
| R5 · `5ad1225` | Representações completas; restrições de material/cópia, fonte longa, foco e parcial inválido ainda falhavam. |
| R6 · `28b003e` | Leitura/acesso/arte passaram; callbacks entre contextos, retirada em outro registro e copy contraditória mantiveram gates reprovados. |
| **R7 · `f0c9b7f`** | **Três médios R6 fechados, mínimos 9 e gates aprovados no escopo de desenho.** |

[Pareceres R1–R7](revisoes/), matrizes R4/R5/R6 e [evidências históricas](evidencias/historico/) preservam achados e negativos. Correções de harness estão identificadas: espera pelo evento real de fechamento da folha, render explícito após fixture silenciosa e seleção de divulgações aplicáveis não foram tratadas como defeitos de produto nem apagadas.

## Produto, referências e próximos passos

O [índice](README.md) reúne PDFs, pranchas, HTMLs e como reabrir a porta 3012. [Pesquisa](PESQUISA.md), [referências anteriores](../referencias/), [brief](BRIEF.md) e [plano de implementação](PLANO-DE-IMPLEMENTACAO.md) ficam disponíveis junto das provas. O [manifesto de publicação](evidencias/final/manifesto-publicacao.json) vincula artefatos ao commit e aos hashes.

**Produto implementado C1–C10, execução iPhone/Android e pesquisa com pessoas permanecem `null`/não realizados.** IA, email, microfone, autenticação, material/OCR, moderação e compartilhamento não usam serviços reais nesta bancada. O novo Stu caderno permanece referência; os PNGs originais ainda precisam ser integrados e a composição revista. O kit atual é provisório.

A intro corrigida foi distribuída separadamente no **TestFlight interno 0.1.0 (7)**: [registro e provas do build 7](https://github.com/team-ponto-virgula/studoo-hack-brasil/blob/8ae72bb5e45516660a25ae79d1a3518a42bbf18b/docs/beta/BUILD-7-INTRO-BOOT.md). Estas três propostas não fazem parte desse IPA. Não houve execução desse build em iPhone físico nesta máquina.
