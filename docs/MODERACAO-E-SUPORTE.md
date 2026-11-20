# Comunidade, moderação e suporte

## Contrato da web e do app

| Ação | Pedido | Resposta |
|---|---|---|
| Bloquear quem publicou | `POST /api/bloqueios` com `{alvoTipo, alvo}` | `{bloqueado:true,id}` |
| Ver bloqueios próprios | `GET /api/bloqueios` | `{itens:[{id,nome,perfilId}]}` |
| Desbloquear | `DELETE /api/bloqueios/:id` | 204 |
| Denunciar | `POST /api/denuncias` com `{alvoTipo,alvo,motivo}` | `{registrada:true,protocolo}` |
| Abrir suporte | `/suporte` | Formulário e consulta de protocolo |
| Denunciar por link público | `/suporte?alvoTipo=perfil&alvo=ID` ou `/suporte?alvoTipo=trilha&alvo=CODIGO` | Formulário sem login |

O alvo é o ID público do perfil ou o código da trilha. O bloqueio vale nos dois sentidos enquanto existir e pode ser desfeito na lista do Perfil. A lista contém o identificador do bloqueio. Cada método aceita a sessão web ou nativa, inclusive a sessão temporária. Sem sessão, a pessoa pode denunciar pelo formulário público.

Os motivos de denúncia são `spam`, `ofensivo`, `direitos` e `outro`. Guarde o protocolo para consultar a resposta no suporte. O estado de moderação da trilha aparece no link da dona como `moderacao` (`pendente`, `aprovado` ou `recusado`). Fotos e capas enviadas passam por análise antes de serem exibidas a outras pessoas.

## Operação da caixa

1. O dono designa titulares, substitutos, frequência de conferência e escala de cobertura. Uma conta de operador precisa ter o e-mail confirmado e constar, por correspondência exata, em `STUDOO_EQUIPE_EMAILS`. A lista aceita endereços separados por vírgula. Com a lista vazia a caixa fica fechada. O aplicativo não envia alertas por e-mail.
2. Entre na web com a conta designada e abra `/equipe/moderacao`. A caixa no mesmo banco recebe mensagens de `/suporte` e denúncias de trilha e perfil, inclusive sem login. Confira todas as páginas de denúncias, conteúdo em revisão e suporte.
3. Examine o perfil e cada trilha, inclusive as lições copiáveis, e abra cada imagem na prévia restrita. Revise pelos critérios em `/privacidade#regras-da-comunidade`. Para a primeira publicação, aprove o perfil e a trilha. Foto e capa têm decisões independentes. Enquanto a mídia aguarda, outras pessoas veem a inicial ou a capa padrão.
4. Use **Aprovar** para publicar a versão examinada. **Manter no ar** encerra as denúncias do alvo e restaura essa versão. **Remover** retira o alvo das páginas públicas, da descoberta e das novas adições. Se a pessoa retirou a publicação, encerre as denúncias com a informação de retirada. A caixa registra ação, alvo, identificador do operador e data. Se a versão mudou durante a análise, examine-a novamente.
5. Em **Pedidos de suporte**, abra o protocolo, escreva a resposta e envie. A pessoa consulta o resultado em `/suporte`, inclusive sem sessão. Responda apenas o necessário: quem tiver o protocolo pode consultar o estado e a resposta. Uma denúncia por sessão/conta e alvo pode ser repetida sem somar votos. Denúncias de visitantes e anônimas entram na caixa e não contam para o limite automático de três contas permanentes. A entrada usa os limites de rede e de conta do Studoo.
6. Ao aplicar a migração, o conteúdo preexistente entra em revisão e os links são preservados. A equipe precisa analisar o acervo para reabrir as publicações. A triagem local barra termos inequívocos. A aprovação humana cobre o restante dos textos (inclusive lições compartilhadas), fotos e capas. Os arquivos originais privados de estudo não integram a fila. Nenhum material é enviado a um fornecedor para essa análise. A migração troca os endereços antes servidos com cache imutável e as novas respostas de mídia usam cache privado sem armazenamento. Uma imagem já baixada por alguém pode continuar na cópia local dessa pessoa.

## Leituras e acompanhamento

- O perfil da dona informa `perfilModeracao` e `fotoModeracao`. A configuração da trilha informa `capaModeracao`. Mídia ausente retorna `null`. No app, a dona pode carregar a mídia pendente enviando o Bearer ao endpoint do próprio Studoo.
- Perfis bloqueados retornam 404 para as duas contas. Compare o `perfilId` com a lista de seus próprios bloqueios para oferecer **Desbloquear**.
- `POST /api/suporte` recebe `{mensagem}` e retorna `{protocolo}` com HTTP 201. `POST /api/suporte/protocolo` recebe `{protocolo}` e devolve estado, data e resposta. A consulta funciona para denúncias e pedidos de ajuda.
- O painel usa `GET/POST /api/equipe/moderacao`. A prévia de mídia usa `GET /api/equipe/moderacao/midia`. Cada pedido verifica a sessão e a lista da equipe.

## Conferência local

Com o banco de testes `studoo_local`, origem de loopback, provedores falsos e flags de comunidade/compartilhamento ligadas, execute o servidor da candidata. Configure `STUDOO_EQUIPE_EMAILS` com um endereço sintético exclusivo em `example.test` e defina a mesma lista no processo de QA. O roteiro cria contas e conteúdo sintéticos e os percorre pelas rotas HTTP do aplicativo.

```sh
STUDOO_QA_ORIGEM=http://127.0.0.1:3831 STUDOO_EQUIPE_EMAILS=equipe-qa@example.test EMAIL=falso IA=falsa node --env-file=.env --import tsx scripts/qa-moderacao-local.mjs
```
