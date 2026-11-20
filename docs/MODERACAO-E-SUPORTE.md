# Comunidade, moderação e suporte

## Contrato da web e do app

| Ação | Pedido | Resposta |
|---|---|---|
| Bloquear quem publicou | `POST /api/bloqueios` com `{alvoTipo, alvo}` | `{bloqueado:true}` |
| Ver bloqueios próprios | `GET /api/bloqueios` | `{itens:[{id,nome}]}` |
| Desbloquear | `DELETE /api/bloqueios/:id` | 204 |
| Denunciar | `POST /api/denuncias` com `{alvoTipo,alvo,motivo}` | `{registrada:true,protocolo}` |
| Abrir suporte | `/suporte` | Formulário e consulta de protocolo |
| Denunciar por link público | `/suporte?alvoTipo=perfil&alvo=ID` ou `/suporte?alvoTipo=trilha&alvo=CODIGO` | Formulário sem login |

O alvo é o ID público do perfil ou o código da trilha. O bloqueio vale nos dois sentidos enquanto existir e pode ser desfeito na lista do Perfil. A lista contém o identificador do bloqueio. Cada método aceita a sessão web ou nativa, inclusive a sessão temporária. Sem sessão, a pessoa pode denunciar pelo formulário público.

Os motivos de denúncia são `spam`, `ofensivo`, `direitos` e `outro`. Guarde o protocolo para consultar a resposta no suporte. O estado de moderação da trilha aparece no link da dona como `moderacao` (`pendente`, `aprovado` ou `recusado`). Fotos e capas enviadas passam por análise antes de serem exibidas a outras pessoas.
