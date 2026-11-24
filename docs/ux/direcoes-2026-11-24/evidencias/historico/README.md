# Evidências históricas selecionadas

Os JSONs e PNGs desta pasta são cópias dos resultados originais das rodadas R1–R4, identificadas com suas fontes. O [manifesto](manifesto.json) registra origem e SHA-256 de cada cópia. As revisões novas não reescrevem falhas antigas nem transformam esses arquivos em novas execuções.

Asserções, cenários, capturas e medições têm unidades diferentes. Rodadas e matrizes podem se sobrepor: não somar tudo para anunciar uma contagem de testes funcionais. Os [pareceres](../../revisoes/) explicam escopo, fonte, falhas, correções e limites de cada rodada. Os diretórios completos dos roteiros continuam acessíveis na tarefa em `/workspace/work/revisao-{fluxos,visual,a11y}-r{n}`.

O comparativo de arte usa imagens reais das duas fontes:

| Quadro | R3 `902eca4` | R4 `a6f2e09` | Mudança conferida |
| --- | --- | --- | --- |
| Conclusão A | [Antes](r3/arte/jornada-conclusao-390.png) | [Depois](r4/arte/jornada-conclusao-390.png) | Stu proporcionalmente menor e retirada da faixa decorativa; mais espaço para a ideia praticada. |
| Conclusão B | [Antes](r3/arte/caderno-conclusao-390.png) | [Depois](r4/arte/caderno-conclusao-390.png) | Retirada de pseudométricas que repetiam progresso e próximo passo. |
| Lição A | [Antes](r3/arte/jornada-licao-390.png) | [Depois](r4/arte/jornada-licao-390.png) | Destaque localizado em `>= 7`, correspondente ao conceito da lição. |

Essas provas fecharam o acabamento observado na R4. Não aprovaram automaticamente cobertura, foco, estados ausentes, branding final, implementação nativa ou uso por pessoas. A [matriz R4](../../MATRIZ-COBERTURA.md) preserva essas pendências.
