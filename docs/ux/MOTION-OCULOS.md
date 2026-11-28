# Óculos em foco

**Assinatura de movimento para o aplicativo iOS/Android.** A ideia faz dos dois “o” o personagem da abertura: os óculos saem do nome, encontram foco com um reflexo e retornam, trazendo a palavra e o sorriso. O site permanece sem intro.

## Coreografia

| Tempo nominal | O que muda |
| --- | --- |
| 0–229 ms | O nome recua enquanto os óculos ganham escala e se aproximam do centro. A entrada acelera gradualmente; o primeiro quadro coincide com a launch screen. |
| 229–493 ms | Inclinação contida de −5° a +2° e uma passagem de luz comunicam foco. O reflexo fica dentro das lentes. |
| 493–792 ms | Os óculos voltam à posição dos dois “o”; “stud” e o sorriso recompõem a assinatura, desacelerando na chegada. |
| 792–880 ms | O PNG integral reassume o repouso final. A identidade original permanece intacta. |
| Depois de sequência e recursos prontos | Dissolve de 160 ms. Duração nominal 1.040 ms; prazo absoluto de 1.400 ms desde o módulo limita atrasos. |

A tabela mostra o refinamento pedido pelo dono em 24/11: **mais suave e pouco menos rápido**. A curva simétrica `0.42, 0, 0.58, 1` substitui a arrancada anterior; a entrada foi alongada e a inclinação reduzida. Se a montagem consumir parte do prazo, a duração é escolhida **antes de começar**, entre 680 e 880 ms, reservando 160 ms de dissolve e 48 ms de margem. Se nem o mínimo couber, a assinatura é dispensada com o logo íntegro. O prazo absoluto é 1.400 ms.

Uma curva amostrada alimenta **um único timing** do driver nativo. As opacidades do bitmap integral e das fatias pertencem ao mesmo grafo; a sequência não retorna à thread JS entre marcos. Os estados iniciais/finais usam o PNG original. A camada HD foi derivada deterministicamente do ícone oficial para evitar serrilhado na ampliação, sem redesenhar letras ou criar outro mascote. O vidro usa a cor de ação do tema.

Toque, voltar, preferência reduzida, tecnologia assistiva, falhas e segundo plano podem dispensar a assinatura; ela não repete ao navegar ou retomar o processo. Enquanto a consulta de preferência está pendente, a marca é estática. Não há som nem espera pela API.

## Ver e reproduzir o estudo

[GIF suave](evidencias/oculos-em-foco-suave-2026-11-24/oculos-em-foco.gif) · [MP4 suave](evidencias/oculos-em-foco-suave-2026-11-24/oculos-em-foco.mp4) · [metadados](evidencias/oculos-em-foco-suave-2026-11-24/render.json).

**Este filme é um estudo de motion, não captura nativa.** Usa o mesmo contrato e os assets do componente, sem pausa adicional de leitura; acrescenta somente uma cauda de apresentação de 240 ms após o dissolve. A repetição é do GIF; não é um loop do app. A janela de tempo do filme não mede a abertura de um aparelho. O [filme anterior](evidencias/oculos-em-foco-2026-11-24/oculos-em-foco.mp4) tinha 560 ms de movimento e uma pausa didática de 500 ms; permanece como histórico.

```sh
python3 scripts/motion/preparar-oculos.py
python3 scripts/motion/oculos-em-foco.py --out .studoo-local/oculos --hold-ms 0 --tail-ms 240
```

O segundo comando precisa de Pillow, NumPy e FFmpeg. A renderização usa um relógio determinístico de 60 fps em 780×1688. `--hold-ms 0` remove a pausa de apresentação. O [contrato JSON](../../packages/contratos/src/abertura-motion.json) é a fonte de tamanhos, marcos, deslocamentos, opacidades e tempos; o script não altera o logo original.

## Provas e limites

O [resultado atual](RESULTADO-INTRO.md) identifica o refinamento suave e suas verificações. Os pareceres e capturas de 560 ms listados abaixo são históricos; não aprovam automaticamente o ritmo de 880 ms.

- [Parecer visual independente](PARECER-MOTION-OCULOS.md): ideia, ritmo e acabamento no conceito; quadros complementares do componente identificados separadamente.
- [Parecer de fluxo/controlador](PARECER-FLUXO-OCULOS.md): latch, deadline absoluto, interrupções, árvore acessível e limites de integração.
- [Checks automatizados](evidencias/oculos-em-foco-2026-11-24/checks.json): histórico das execuções e correções, sem esconder falhas intermediárias.
- [Prévia RNWeb](evidencias/oculos-em-foco-2026-11-24/browser-app-preview.json) e [movimento observado](evidencias/oculos-em-foco-2026-11-24/browser-app-motion-independent.json): complementares, não equivalem a iPhone/Android. A tentativa anterior com duas fases naturais ausentes foi preservada; não é apresentada como sucesso.
- [Prazo com relógio controlado](evidencias/oculos-em-foco-2026-11-24/prova-prazo.json): observação em janela de 2 ms, não precisão física nem tempo de boot do sistema.

O caminho normal no app, a passagem da launch screen, o comportamento com VoiceOver/TalkBack e a fluidez em aparelho ainda precisam do novo build nativo. As notas mobile continuam `null` e a entrega completa **Provisória**. Nenhuma nota anterior foi herdada. [Resultado e brief atuais](RESULTADO-INTRO.md).
