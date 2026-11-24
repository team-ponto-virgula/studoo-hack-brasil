# Jornada — complementos da R5

Registro de autoria, anterior à revisão independente da candidata R5. As lacunas da [matriz R4](MATRIZ-COBERTURA.md) permanecem como histórico. Este arquivo não atribui nota, não encerra gates e não declara execução nativa.

## Representações e percursos

| Lacuna | Representação nova | Como conferir |
| --- | --- | --- |
| LC02 | Sessão restaurando, expirada e credencial rejeitada; mensagem e recuperação próprias. A visita usa um estado separado da conta sintética guardada. | `p=entrar&s=restaurando`, `expirada`, `credenciais`, `rede`. Expirar → visitante → reentrada simulada conserva a conta e não mostra suas trilhas/respostas na visita. |
| LC06 | Título e lições chegam por eventos sintéticos, sem percentagem ou check de conclusão. Espera longa, indisponibilidade de IA e limite têm saídas próprias. | Gerar pelo pedido; observar título/duas/cinco lições; cancelar antes do último evento. Queries `p=geracao&s=parcial`, `espera-longa`, `ia-indisponivel`, `limite`. |
| LC07 | Aceite pendente cancelável, falha de aceite e falha ao abrir; proposta longa usa as cinco lições reais do exemplo e seus capítulos. | `p=proposta&s=aceitando`, `aceite-erro`, `falha-abrir`, `longa`. Aceitar uma trilha nova só a adiciona após a confirmação local; cancelar não cria registro. |
| LC08 | Carga/sincronia e falha específicas da biblioteca, conservando seus registros. | `p=inicio&s=carregando`, `sincronizando`, `erro`; recuperar e retomar. |
| LC09 | Nó abre balão nomeado; ponte concluída pertence à trilha e permite reler o reforço. Ponte e “Vale rever” são independentes. | Tocar nó atual/concluído/bloqueado; vencer reforço, voltar ao mapa/recarregar e reabrir. `p=mapa&s=ponte-vale-rever` oferece o quadro demonstrativo combinado. |
| LC10 | Fonte/citação e apoio expansíveis, etapa anterior, aviso de retomada e reinício confirmado só da tentativa atual. | Origem [1] e apoio na lição; anterior no exercício/explicação/retorno. Cancelar reinício conserva respostas; confirmar limpa apenas a tentativa, sem reduzir o progresso concluído. |
| LC11 | Associação parcial marca e conserva pares corretos. Aberta apresenta dois critérios locais, com atendimento parcial. | Exercício `f=associar` ou `aberta`, verificar uma resposta parcial, tentar de novo e corrigir só o restante. Query `s=parcial` também mostra o quadro sintético. |
| LC12 | Quadro estável “Desafio vencido”, reler e retornar à questão original com sua tentativa preservada. | Errar → outro caminho → exemplo → desafio → vencer; reabrir pela ponte no mapa. |
| LC13 | Envio pendente cancelável e erro específico da explicação, com texto/transcrição mantidos e repetição. Gravação ilustrativa termina no limite real de **60 s** do contrato. | `p=explique&s=enviando`/`envio-erro`; enviar, cancelar e repetir. Limite lógico exercitado com relógio do Playwright, sem gravar som. |
| LC15 | Ordenação Em alta/Novas, mais itens e retorno conservando busca, aba, ordem, lista e rolagem. | Explorar → Novas → carregar mais → prévia → Back. Listas e datas são fixtures locais identificadas. |
| LC18 | Manifesto explícito: IA/email/API desligados, `iaNecessario=false`, cena de consentimento demonstrativa. Destinatário local acessível antes do consentimento e em Privacidade. | `window.STUDOO_FLAGS`, “Ver quem recebe”, consentir/recusar/revogar. Não representa configuração remota nem lista de provedores de produção. |

LC05 pertence ao módulo de material; LC16/LC17 ao módulo pessoal. Suas notas de autoria e a revisão independente precisam ser consultadas separadamente.

## Continuidade e contratos

As tentativas do exemplo são guardadas por **trilha + lição**. Trocar/criar/receber uma trilha carrega a tentativa correspondente, conservando a anterior em sua própria chave. Reinício não apaga o progresso da trilha nem a tentativa de outra lição. A origem de material na lição vem de `tracks[id].materialReference`, copiada no aceite; não vem do arquivo global de um pedido posterior.

Antes de entrar como visitante, a conta de exemplo fica em um snapshot local separado. A visita recebe outra lista de trilhas, tentativas e material; reentrada explícita no fluxo simulado restaura a conta. Não é implementação de autenticação, isolamento de servidor ou conta real. Todos os dados continuam sintéticos e locais ao navegador.

A edição usa os limites reais de `LIMITES_PERFIL`: nome de 2–40 caracteres, resumo até 160, até cinco interesses e os 12 IDs de `TEMAS`. Nome/resumo são normalizados em NFC e espaços; email, endereço, marcação e caracteres invisíveis não entram nesses campos públicos. Cores seguem os seis IDs de `CORES_PERFIL`. Rótulos antigos do protótipo são migrados apenas para os IDs correspondentes; os novos controles usam IDs estáveis (`programacao`, `artes`, etc.).

O renderer preserva o controle focado também por `data-go` e sua posição entre controles equivalentes. Títulos sem espaços quebram no cabeçalho. Notificações ficam acima dos rodapés/navegação medidos, preservando a ação principal.

## Prova de autoria e limites

Os roteiros de autoria ficam em `/workspace/work/jornada-r5-author/` (`smoke.cjs`, `resultado.json`). A rodada final executou **180/180 asserções em 48 cenários**, 16 por direção, em Chromium/Playwright a 390×844: zero `pageerrors`, com os hashes dos cinco arquivos de autoria examinados idênticos antes/depois. O limite de gravação usou avanço lógico de **61.000 ms**, sem aguardar ou capturar som. As contagens anteriores são parciais históricas, não entram nessa soma. Após regenerar a entrega com `exportar.py`, os três HTMLs autossuficientes passaram em **15/15 verificações HTTP** separadas: material escolhido/lido/conferido retorna ao pedido, flags IA falsa e módulo pessoal presentes, zero erros JavaScript e nenhuma requisição HTTP além do próprio documento. Essa prova não contorna `file://` nem valida abertura offline. A revisão independente deve repetir os casos afetados, a regressão de continuidade e a matriz visual/teclado apropriada.

Geração, aceite, envio, sessão e áudio usam eventos/timers locais: não medem rede, IA, hardware ou desempenho de pintura. Queries mostram quadros de desenho; só o percurso clicado comprova recuperação/cancelamento. A produção web/React Native, o TestFlight, safe area, leitor de tela e permissões reais continuam fora desta prova.
