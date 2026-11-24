# Parecer independente — ritmo suavizado de Óculos em foco

24/11/2026, 17:46 UTC · revisor `direcao_caderno` · estudo de movimento, sem autoria da alteração. **Parecer favorável ao ajuste de ritmo no conceito examinado**, sem nota numérica, aprovação nativa ou transferência das notas anteriores.

Examinei os oito quadros fornecidos — 0, 114, 229, 352, 493, 642, 792 e 880 ms —, os metadados do MP4 e a fonte do render junto ao [contrato](../../packages/contratos/src/abertura-motion.json) e ao componente mobile. O material está em `/workspace/work/testflight-oculos-suave/render`; é filme de conceito Python, não gravação do aplicativo.

## Três conclusões

1. **O ajuste responde a “mais suave, um pouco menos rápido” na direção estudada.** A sequência passa de 560 para 880 ms; a extração ganha aproximadamente 229 ms, o foco 264 ms e a recomposição 299 ms. A curva simétrica `[0.42, 0, 0.58, 1]` desacelera e acelera cada trecho sem o arranque concentrado da curva anterior. A inclinação reduzida de −8°/+3° para −5°/+2° conserva o gesto dos óculos com menor oscilação. É uma desaceleração claramente perceptível na cronologia — cerca de 57% na sequência —, não apenas alguns frames adicionais; ainda resulta em assinatura nominal de cerca de um segundo.
2. **A identidade continua íntegra nos repousos examinados.** O foco ampliado e o reflexo permanecem dentro da composição; não há corte nos quadros. Extração e retorno mostram sobreposição transitória entre palavra e óculos, coerente com a transformação proposta, sem introduzir outro símbolo. Uma leitura de pixels confirmou igualdade RGB exata entre os quadros 0 e 880. O PNG integral já reassume aos 792 ms; o repouso final do contrato dura aproximadamente 88 ms antes do dissolve. Essa igualdade vale para o render, sem provar encaixe com a LaunchScreen em aparelho.
3. **O tempo de apresentação não deve virar tempo do app.** O estudo usa `hold-ms=0`, portanto não adiciona pausa externa. Sequência de 880 + saída de 160 dão nominal de 1040 ms; os 240 ms de cauda branca pertencem ao filme. O MP4 possui 1,283 s por arredondamento a 60 fps. O componente pode escolher sequência entre 680 e 880 ms conforme o prazo restante e tem teto de 1400 ms desde o módulo JS; assim, um boot pressionado não necessariamente mostrará o ritmo nominal completo. Isso precisa de prova de execução própria, não de aprovação pelo filme.

Não encontrei motivo visual, nos quadros e na cronologia declarada, para reabrir a ideia ou torná-la mais elaborada. Recomendo manter este ajuste para a próxima conferência do componente: passagem do splash, sequência integral ou dispensa antes do movimento, dissolve sem corte e interrupções. Não executei testes de navegador/componente nesta revisão, nem iOS/Android, VoiceOver/TalkBack ou observação com pessoas. Não atribuo 9,5 ou qualquer nota ao app a partir do estudo.

## Identificação da candidata

- Contrato JSON SHA-256: `7eeecd405a1acbdc554cc4c43969593fb33dfa3831532ed5abe9f39fdbf0e0bd`.
- Renderizador Python SHA-256: `a9ef199f19a0232a70d7c2121eb4d8bc6dcc05724a3b0bd4f184e8122fd0fc8c`.
- MP4 examinado SHA-256: `f6f4a28cc42c3df718e93b05ebdf10e6e990c40d9e3cca77e0a64a611b70aa67`.

Reprodução do estudo, com as dependências já descritas pelo projeto: `python3 scripts/motion/oculos-em-foco.py --out .studoo-local/oculos-suave --hold-ms 0 --tail-ms 240`. O arquivo de estudo não representa loop ou pausa adicional do aplicativo. Nenhum código, asset ou render foi alterado por esta revisão.
