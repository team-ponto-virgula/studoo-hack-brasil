# Direção de arte e acabamento — reavaliação R4

24/11/2026 · candidata congelada **`a6f2e09b559b3c531b66fbc404839d661d304f48`** · parecer independente suplementar.

O [parecer R3](PARECER-ARTE-CRAFT.md), com D4 = 8,0 e seus achados, permanece como histórico. Este arquivo registra uma nova inspeção; não substitui silenciosamente a avaliação anterior.

## Prova nova e escopo

Foram **capturados e abertos 20 PNGs novos** da R4, sem reutilizar imagens da candidata R3 como prova do estado corrigido:

- Início, mapa, lição, conclusão e perfil, em A/B/C, a 390 × 844: **15 quadros**.
- Conclusão em A/B/C, a 360 × 800: **3 quadros**.
- Início de A com trilha 5/5, em 390 × 844 e 360 × 800: **2 quadros**.

Chromium **156.0.8078.79**, DPR 2. As capturas foram feitas depois de fontes carregarem e de a transição inicial terminar. Todos os assets de imagem dos quadros canônicos estavam carregados. Nenhum dos 20 casos apresentou overflow horizontal na área principal. Os hashes dos seis arquivos de fonte relacionados a esta revisão ficaram idênticos antes/depois da captura: `app.js`, `base.css`, `accessibility.css` e os três CSS de direção.

Evidência local: `/workspace/work/revisao-arte-craft-r4/`, com os 20 PNGs, `capturar.cjs` e `evidencias.json` contendo commit, navegador, hashes, texto da consulta, trecho enfatizado, presença de métricas e posição dos botões. Foi feita uma conferência adicional das caixas de navegação do início 5/5 em 390: rodapé até y = 768 e navegação inferior entre y = 768–844, dentro do viewport.

O escopo continua sendo **D4, composição e acabamento observáveis**. Esta revisão não executou as 35 páginas, todos os estados, leitor de tela, integração de dados, animação em aparelho ou testes com pessoas. D1–D3 e D5–D10 não recebem nota por transferência desta ficha. O novo Stu caderno segue pendente de asset original; o kit do personagem visto aqui permanece provisório.

## Fechamento dos achados R3

| Achado | Prova da R4 | Resultado |
| --- | --- | --- |
| **AR1 · Pseudométricas da conclusão** | Nas seis conclusões novas, `.screen .stats` = **0**. `SQL / na prática` e `Seu / próximo passo` foram retirados. Resultado, confirmação, progresso, próxima lição e ideia praticada continuam presentes. Os números úteis do perfil permanecem. | **Fechado.** Os destaques voltaram a corresponder a informações próprias. |
| **AR2 · Foco específico do SQL** | Nas três lições, o código continua exatamente `SELECT nome FROM alunos\nWHERE nota >= 7;`; somente `>= 7` está no trecho forte. A cor usa o azul já existente e o peso também diferencia o trecho. | **Fechado.** A ênfase corresponde à inclusão do limite, sem acrescentar uma paleta de syntax highlighting. |
| **AR3 · Repetição no início A** | O hero agora diz `De filtros a tabelas que se conectam.` para a próxima lição INNER JOIN. Não repete `Seu próximo passo está aqui`. | **Fechado por solução alternativa válida.** A altura se mantém, mas a frase agora explica a relação entre etapas. Não se alega redução de altura. |
| **AR4 · Proporção da celebração A** | Stu medido em **112 px** nas duas conclusões A, mantendo proporção. Em 390, a ideia praticada inteira aparece antes do rodapé. Em 360, o resumo continua rolável, com resultado e próximo passo já visíveis. | **Fechado.** O personagem continua expressivo sem dominar o fechamento. Não é necessário forçar todo o conteúdo acima da dobra. |
| **AR5 · Vazio de novidades** | A/B/C explicam: `Quando alguém começar ou agradecer uma trilha sua, as novidades aparecem aqui.` A frase corresponde ao conteúdo esperado da seção. | **Fechado.** A redação adotada é mais específica do que o texto sugerido inicialmente e não exige publicação. |

Não foram encontrados novos achados críticos, altos ou médios de direção de arte nos quadros desta amostra. Os refinamentos foram locais; a identidade de cada proposta foi preservada.

## Reavaliação D4

| Direção | R3 | R4, escopo examinado | Fundamentação |
| --- | ---: | ---: | --- |
| **A · Jornada Azul** | 8,0 | **9,0** | Acolhimento no início, caminho espacial e estados claros no mapa; Stu dá orientação específica na lição; a conclusão agora equilibra expressão, resultado, resumo e continuidade. A metáfora de percurso e os botões com relevo pertencem ao mesmo sistema. |
| **B · Caderno Claro** | 8,0 | **9,0** | Dobra, margem lateral, fundo de papel, divisores e mapa como índice funcionam em conjunto. A conclusão ficou mais enxuta sem perder conteúdo. A materialidade é reconhecível, sem textura concorrendo com leitura. |
| **C · Foco Vivo** | 8,0 | **9,0** | Blocos navy no início e perfil, títulos Nunito firmes, lista linear e menor presença do personagem sustentam uma tese de concentração. Conclusão e lição mantêm hierarquia sem acrescentar ornamentação. |

**A nota subiu porque o achado médio foi corrigido e conferido em nova prova.** Os cinco refinamentos estão fechados no escopo declarado. Não se elevaram pesos ou se mudou a definição de D4. A nota não foi obtida por média entre propostas.

**9,0 não significa perfeição universal nem aprovação do branding final.** É uma conclusão sobre componentes e composição da amostra. Não atribuo 9,5 ou 10: a arte final do Stu não está integrada e a coerência percebida entre esses quadros ainda não foi confrontada com uso por estudantes. As capturas tampouco comprovam fluidez nativa. Esses limites não são transformados em benefícios presumidos.

## Coerência, modernidade e relação com o Duolingo

O avanço mais convincente foi editorial: retirar um grupo visual sem informação e concentrar o destaque no que foi praticado. Títulos, corpo, ícones, margens, rodapés e estados continuam formando uma família. O refinamento não dependeu de acrescentar efeitos ou trocar a tipografia da marca.

As três propostas continuam distintas além da cor: **A usa percurso espacial e companhia; B usa página e índice; C usa blocos de foco e lista linear.** O conteúdo de estudo permanece reconhecível ao trocar de direção. A linguagem moderna aparece na hierarquia, nas superfícies contidas e no espaço para ler; não exige importar recursos de competição ou monetização do Duolingo.

O início com **5/5** em A é uma melhoria de coerência do sistema: mostra `Trilha concluída`, progresso completo, `Criar outra trilha` e `Rever esta trilha`. O personagem comemora um fechamento real do cenário. Não anuncia uma sexta lição nem apresenta uma etapa encerrada como a próxima. Esta observação refere-se ao desenho e às caixas/rótulos renderizados, sem atribuir persistência de produto.

**Mantenho a recomendação de A como base principal.** É a melhor correspondência ao objetivo declarado de Studoo com inspiração no Duolingo: uma ação evidente, progressão reconhecível, acolhimento contextual e continuidade. B continua sendo a alternativa com maior potencial de diálogo com o Stu caderno; C oferece a composição mais concentrada. A escolha final não deve alternar os três sistemas entre telas.

## Estado final desta revisão

- **D4: 9,0 em A/B/C no conjunto de quadros e componentes examinado.** AR1–AR5 fechados, sem achado médio aberto nesta amostra.
- **Consolidação global:** depende dos outros pareceres R4 e da matriz de cobertura; esta revisão de arte não aprova por si só todas as páginas, estados ou critérios.
- **Stu caderno original:** pendente de asset e nova composição. A troca deve ser revista pela diferença de silhueta e proporção.
- **Produto integrado, iPhone/Android e uso por pessoas:** sem nota nesta ficha.

Nenhuma fonte de UI foi modificada por esta revisão; apenas o novo parecer e as evidências de captura foram produzidos.
