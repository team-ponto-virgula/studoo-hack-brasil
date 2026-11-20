# Fluxos da spec 14 (preparados, ainda não executados)

Três fluxos do Maestro para a segurança da comunidade, prontos para a conferência nativa da versão corrigida. Eles ficam
fora de `fluxos/` de propósito: o percurso do workflow não os roda, e uma captura que faltasse derrubaria a coleta. Os `id`
usados (nav-explorar, titulo-explorar, confirmacao-confirmar, denuncia-spam, denuncia-enviar, nav-perfil, titulo-perfil,
ajuda-suporte, ajuda-regras e ajuda-politica) existem no app; ao mover, `conferir-fluxos.mjs` volta a conferi-los. Para ligar, com o servidor da spec 14 na mesma versão, faça três coisas:
1. mova os arquivos `.yaml` para `fluxos/telas/`;
2. acrescente os nomes à ordem de `telas/config.yaml`;
3. acrescente as capturas a `CAPTURAS_ESPERADAS` de `comum.sh`.

| Fluxo | O que faz | Capturas |
|---|---|---|
| `61-bloquear` | Explorar → "•••" do primeiro cartão de outra pessoa → "Bloquear <nome>" → confirmação → aviso → "Desfazer" | `61-bloquear-confirmacao`, `61-bloquear-aviso` |
| `62-denunciar` | Explorar → "•••" de um cartão → "Denunciar" → "Spam ou propaganda" → enviar → aviso com protocolo | `62-denuncia-motivo`, `62-denuncia-protocolo` |
| `63-ajuda` | Perfil → seção Ajuda (suporte, regras, política) | `63-perfil-ajuda` |

Os itens do menu e do aviso são achados pelo texto do contrato (`mensagens.seguranca`, `mensagens.planos.maisOpcoesRotulo`), porque o testID do cartão leva o código da trilha.

O bloqueio é desfeito no próprio fluxo, e a conta sintética fica como estava.

A denúncia vale só para a conta sintética e some do Explorar dela. Por isso o `62` roda depois do `61`, e os outros fluxos não dependem daquele cartão.

Limites: é simulador e emulador, não aparelho, e não confere o VoiceOver nem o TalkBack. Se o cartão da demonstração não aceitar bloqueio ou denúncia no servidor da conferência, o fluxo para no aviso de erro, e a captura mostra o motivo.
