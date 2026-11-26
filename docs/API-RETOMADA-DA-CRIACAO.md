# Retomada da criação de trilhas: contrato, servidor e prova

Referência de comportamento e textos: [spec 04, "Retomada da criação"](specs/04-experiencia-ilustrada.md#retomada-da-criacao) (commit `1331ad0`, em outro ramo). Este arquivo
descreve o que o servidor e o contrato compartilhado fazem; a tela de cada cliente tem o teste dela.

## O problema

"Começar a lição 1" e "Salvar para depois" mandam o aceite da proposta (`POST /api/aprendizado/planos`), que escreve as lições e pode levar minutos. Se a resposta se perde
(rede, segundo plano, app fechado), o cliente não sabia o que houve: a trilha podia estar salva e a tela dizia "Não deu para criar".

## Identidade

`PropostaPlano.pedidoId` é o `id` que o comprovante assinado (`token`) já carrega e que vira o id do plano (`PlanoDetalhe.id`). `validaPorMs` diz por quanto tempo o `token`
ainda vale, contado do recebimento. O id sozinho não autoriza nada: a consulta é autenticada e por conta; um id de outra conta responde `nao_recebido`.
`GET /api/sessao` devolve `conta`, um identificador opaco e estável da conta (HMAC, não é o id dela), para o aparelho guardar o pedido pendente numa chave por conta.

## Consulta

`GET /api/aprendizado/pedidos/{pedidoId}` (`cliente.consultarCriacao`). Só lê: nunca chama a IA, nunca começa lote e não escreve. Lê o registro antes do plano (o plano e o "pronto" são
gravados na mesma transação, então um registro pronto garante o plano à vista); o plano salvo manda sobre qualquer linha.

| `estado` | Campos | Quando |
| --- | --- | --- |
| `nao_recebido` | `pedidoId` | Sem registro nem plano (o envio nunca chegou, ainda está a caminho, é de outra conta, ou a trilha foi apagada). |
| `em_preparo` | `tentativas`, `etapa`, `decorridoMs`, `limiteMs`, `consultarEmMs` | Há um lote vivo. `limiteMs` é o teto: passado dele, ou vencido o prazo do dono, a consulta já mostra `falha`. |
| `pronto` | `plano`, `tentativas?`, `duracaoMs?` | A trilha está salva. `tentativas` falta nas trilhas de antes desta versão. |
| `falha` | `codigo`, `causa`, `repetivel`, `tentativas`, `aguardarSegundos?` | Falha confirmada. `causa`: `resposta_ia`, `limite`, `tempo`, `interrompida`, `seguranca`, `proposta_expirada`, `outra`. |

`aguardarSegundos` só existe quando o servidor sabe (o limite do Studoo por conta, ou o `Retry-After` real da OpenAI) e é o prazo RESTANTE, recalculado a cada consulta.
`repetivel` quer dizer "o mesmo token já pode ser reenviado agora": com prazo ainda correndo, ou com a triagem de segurança recusando, é `false`.
O estado `desconhecido` só existe no cliente: a consulta em si falhou (rede, tempo, erro do servidor, sessão). Nunca vale como ausência (`packages/contratos/src/pedido-criacao.ts`).

## Envio e idempotência

`POST /api/aprendizado/planos {token}` não mudou: devolve `PlanoDetalhe` e os mesmos códigos de erro (iOS 10 e APK 4 seguem). Por dentro:

- O pedido é registrado ANTES de gerar (`PedidoCriacao`, uma linha por conta e proposta). Só um lote por pedido, em qualquer instância: a chave (conta, id) decide quem gera.
- Um segundo POST com o mesmo token, com lote vivo (da mesma instância ou de outra), espera e devolve o plano do lote em curso. Não gera de novo e não gasta o limite de novas trilhas.
- O dono renova o prazo (`validoAte`) a cada 10 s. Se o processo cai ou reinicia, o prazo (45 s) vence e a consulta mostra `interrompida`. Passando de 300 s, `tempo`.
- Só um POST explícito começa outro lote, e só se o anterior falhou ou foi abandonado: a troca confere o prazo na hora (uma renovação que chegou depois da leitura vale), e `tentativas` sobe.
- A transação que grava o plano começa por "tomar a vez" (a mesma tentativa, em preparo): o lote que perdeu a vez não grava nada e devolve a trilha do lote que assumiu, se já existe.
- A recusa da triagem de segurança não se repete com o mesmo token. O limite com prazo conhecido também não, até o prazo passar.
- Na primeira falha de um lote, as chamadas que ainda estão no ar também param, e a causa que vale é a da primeira falha.

`tentativas` é a prova de "uma geração só": 1 depois de POST repetido, concorrente ou de qualquer número de consultas; sobe só num reenvio depois de falha ou abandono.

## Banco

Migração aditiva `20261129090000_pedido_criacao`: a tabela `PedidoCriacao` (chave `usuarioId` + `id`, `onDelete: Cascade`). Só estado, etapa, tempos e a causa da falha: sem token, tema,
e-mail nem conteúdo. Apagar a trilha apaga o pedido; pedidos antigos saem em 7 dias.

## Registro (log)

Uma linha JSON por evento, correlacionada pelos 8 primeiros caracteres do id do pedido, sem conta, token nem tema:
`{"rota":"criacao-trilha","pedido":"43135882","evento":"lote|etapa|resultado|lote_abandonado|entrou_no_lote", "etapa":"triagem|licoes|revisao|gravacao", "resultado":"pronto|falha|perdeu_a_vez", "causa":…, "tentativa":1, "duracaoMs":…}`.
Uma falha de limite do provedor registra também `espera_ms` (o `Retry-After` real).

## Cliente (web)

`src/app/criacao-retomada.ts` guarda o pedido por conta ANTES de enviar (com a prévia, sem expor o token na URL nem no log), consulta sem IA, reconfere a ausência por 20 s antes de oferecer
"Reenviar pedido", e retoma os pedidos guardados ao abrir. `src/app/criacao-textos.ts` diz o que a tela mostra em cada fase; `src/app/criacoes-em-curso.tsx` desenha os avisos
(abaixo do título em Minhas trilhas, no alto das outras telas, sem mover foco nem o texto digitado).

## Como provar

```
npm run test:dominio            # contrato e regras puras do cliente
npm run test:estudio            # inclui tests/criacao-retomada.test.mjs (banco real, OpenAI simulada, sem chamada paga)
npm run test:estudio:interface  # controlador e tela da web
```

`tests/criacao-retomada.test.mjs` cobre: pedido registrado antes de gerar, consulta que não chama a IA, resposta perdida, duas instâncias, dono que para, lote antigo que termina depois
do novo, conclusão entre as leituras da consulta, falha da IA, limite com `Retry-After`, recusa de segurança, proposta vencida, aceite legado, autorização e log sem dados da pessoa.
