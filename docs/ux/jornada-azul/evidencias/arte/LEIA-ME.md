# Provas de arte · Jornada Azul R2

Fonte candidata: `b3e97e7cbe7d6b8b711216070453a13ebcad36e3`. Fonte histórica R1: `fa4be429992037cdaa1be055f52be6a529d32f76`.

Fechamento independente: **C4=9 e facetas visuais de C3=9 na amostra examinada**. As 44 famílias integrais, execução nativa, intro instalada e pesquisa com pessoas permanecem sem nota nesta revisão. Não se transferiu nota dos protótipos HTML.

- [Confirmação390 normal](capturas/r2/confirmacao-390-100.png), [360 normal](capturas/r2/confirmacao-360-100.png), [390 a 200%](capturas/r2/confirmacao-390-200.png) e [360 a 200%](capturas/r2/confirmacao-360-200.png): quatro PNGs novos R2, efetivamente abertos. Primário antes da saída, foco seguro, aviso oculto durante o modal e restaurado após Escape, sem overflow horizontal. [JSON](dados/confirmacao-r2.json).
- [AR6 antes da correção, R1 histórica](capturas/r1/ar6-antes-correcao-confirmacao-360-200.png): aviso cobrindo 40 px do título. [Métrica histórica](dados/ar6-antes-metricas.json). Esta imagem não representa a candidata R2.
- **AR8 baixo e aberto**: [360](capturas/r2/ar8-anterior-dispensa-musica-360.png) e [390](capturas/r2/ar8-anterior-dispensa-musica-390.png) são quadros R2 anteriores à dispensa normal do aviso, dentro dos seus 7 segundos. O aviso cobre parte do Enviar já usado no conteúdo rolado; Continuar principal fica livre e com largura útil. Isso é um residual do consumidor, sem nova exceção na spec; não foi apagado por capturar depois do relógio. O plano recomenda tratar o ciclo contextual do aviso. [Metadados](dados/ar8-metadados.json).
- [Equivalência R1→R2](dados/equivalencia-r1-r2.json): herança dos não afetados é identificada; não se renomearam capturas históricas como novas. Os quadros calmos do Explique e seus resultados pertencem ao pacote do auditor RNWeb (`qa-jornada-native/publicavel/capturas/r2/`).

Web 3020 e React Native Web 8091 em Chromium. **Nenhuma execução iOS/Android é certificada por essas imagens.** Os textos são exemplos locais/sintéticos. Foram selecionados apenas PNGs, JSONs de prova e esta ficha; não há armazenamento do navegador, sessão, credenciais, configuração de provisão ou arquivos de conta.

`manifest.json` identifica fonte, escopo e SHA-256 de cada arquivo. Os JSONs preservam os caminhos locais originais de coleta para rastreio; os links acima apontam às cópias publicáveis. O parecer completo e o acompanhamento de AR8 permanecem em `docs/ux/jornada-azul/PARECER-ARTE.md` e `PLANO.md` do repositório.
