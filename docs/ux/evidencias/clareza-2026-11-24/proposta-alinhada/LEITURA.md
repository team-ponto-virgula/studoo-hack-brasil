# Medição focada da Proposta — 0453a72

Fonte `estudo.tsx` a12734b5bdc1eeefb2dd0505967fae6442eff8584685772997bb91adec4337a2 estável antes/depois. Dois contextos independentes, conta sintética nova, somente até a proposta pronta: nenhum aceite ou conclusão de lição foi executado. A rodada qaf33 anterior não foi sobrescrita.

| Viewport | CTA x/y/largura/altura | Gutter E/D | Gap visual | ScrollView natural → topo |
| --- | --- | --- | --- | --- |
| 390×844 | 20 / 722 / 350 / 52 | 20 / 20 | 10 | 155 → 0 |
| 360×800 | 20 / 678 / 320 / 52 | 20 / 20 | 10 | 177 → 0 |

Os retângulos de CTA são iguais no estado natural e no normalizado, inteiros no viewport. O ancestral do rodapé tem padding20/16/16; o grupo empilhado e o intervalo entre os botões medem10. Isso confirma o ajuste mobile pedido, sem aprovar paridade global.

Nos quatro registros, `cartao-titulo-geracao` está presente: `cartaoDeVolta` foi inferido desse DOM, sem inspecionar/mudar estado React. A faixa `faixa-geracao` está ausente por esse estado. O cartão está em y−71/−93 no natural e y84 após normalização; window permanece0. A mudança de recorte desta rodada é acompanhada pela mudança medida da ScrollView. O header de marca aparece nos dois PNGs normalizados, conforme inspeção visual; não foi medido como elemento DOM separado. O campo `headerPresent` do bruto se refere à faixa de geração, não ao header de marca.

`resultado.json` conserva todas as métricas, ancestrais, offsets, ações de normalização e eventos. `resumo.json` facilita a leitura. Foram registrados zero pageerrors e um `net::ERR_ABORTED` da stream de proposta em cada contexto, enquanto a API registrou200 e a proposta pronta foi exibida. O registro bruto foi preservado; a causa desse cancelamento não foi determinada aqui. Não declarar zero erros de transporte. A normalização ocorreu só depois da captura natural, com duas ações explícitas de scroll ao topo e espera de500ms entre elas.

Não valida iOS/Android, C6, Keychain, foco nativo, TLS/CORS de produção ou privacidade após reload. O harness mantém shims de armazenamento e acessibilidade e ponte de rede de QA. Esta rodada não recarregou a sessão nem reabriu o fluxo de privacidade.

8091/3011 foram encerrados e o symlink efêmero foi removido pelo wrapper; `limpeza.json` registra a verificação. Scripts permanecem locais em `.studoo-local/qa-rnw`; nenhuma fonte de produto foi alterada nesta recaptura.
