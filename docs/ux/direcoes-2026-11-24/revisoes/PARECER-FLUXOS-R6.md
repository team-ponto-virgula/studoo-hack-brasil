# Revisão independente de fluxos — R6

24/11/2026 · candidata `28b003e6c29728e1fd8c96f14efbb497353b0d10` · fontes de interface somente lidas.

**As duas falhas da R5 foram corrigidas no recorte revalidado. A candidata ainda não atinge a meta:** callbacks de compartilhamento atuam depois de mudar o contexto; uma retirada iniciada em outra trilha altera uma cópia recebida; o aviso sobre o nome do material contém uma promessa contraditória. São problemas do protótipo local, sem publicação, clipboard de produção ou incidente em servidor.

## Fonte e execução

Li o diff `5ad1225..28b003e` e `NOTAS-COMPARTILHAR-R6.md`. Não reutilizei a contagem de autoria como aprovação independente. Chromium **156.0.8078.79**, Playwright; regressão base 390×844, riscos e fronteiras novos 360×800. Os cinco hashes ficaram idênticos antes/depois da coleta.

| Arquivo | SHA-256 |
| --- | --- |
| `app.js` | `67c55890d7cddb9ed3aed4fcb7e2fc694f6ae078b01c61b5028141ac85415ef6` |
| `material-pages.js` | `5fbfd822ad40d4c9f3a58425e139662f5e386b90ac387739c8b50f86b63ccbe9` |
| `media-pages.js` | `cc7839fa3492e21de099732f6fbf35051ac9e7ecdd63f2cdf87b7b9981c799cc` |
| `personal-pages.js` | `a2ac757d552a0498ab66ec1a4fd52b02c4ad13d37e4437a2bc2e83c8a892027e` |
| `social-pages.js` | `da6e68fbda274321effdcd065b6be7866073f2210ba2ed544e9f66ed31e46645` |

Os cenários adversos capturam a API real da bancada por um wrapper do factory `StudooMedia`, instalado antes do carregamento. Não substituem os módulos de autoria nem editam arquivos. Essa instrumentação permite contar clipboard, preparação de QR, Blob/download e executar handlers sem um botão que a nova interface corretamente esconde. Mudanças concorrentes de estado são fixtures explícitas; não se alega que uma pessoa consiga tocar a tela atrás de um diálogo modal.

## Contagem final

| Suíte | Cenários | Asserções | Passaram | Falharam |
| --- | ---: | ---: | ---: | ---: |
| Regressão principal | 12 | 147 | 147 | 0 |
| Fluxos herdados da R2 | 33 | 207 | 207 | 0 |
| Integração herdada da R3 | 12 | 51 | 51 | 0 |
| Metadados e cinco lições | 6 | 111 | 111 | 0 |
| Riscos LC da R5 | 42 | 372 | 372 | 0 |
| Fronteiras de compartilhamento R6 | 42 | 150 | 144 | 6 |
| Matriz de contexto assíncrono R6 | 60 | 120 | 69 | 51 |
| **Total R6** | **207** | **1.158** | **1.101** | **57** |

Cada direção tem **69 cenários, 386 asserções, 367 positivas e 19 negativas**, com **zero exceções e `pageerrors` nas rodadas finais**. As 888 verificações de regressão passam. As 57 negativas são repetições dos mesmos defeitos em contextos/direções; não representam 57 bugs distintos. O diagnóstico textual do material não foi somado às asserções. Rodadas iniciais, rechecagens substituídas e provas de autoria não entram duas vezes.

## Fechamento dos achados R5

**R5-F1 — material no Explorar:** fechado nesta candidata no recorte. O percurso completo PDF → leitura → prévia → confirmar → gerar/aceitar chega a uma folha que desabilita Explorar. A origem vem do registro ativo, mesmo com `file` de outro pedido. O teste adicional confirmou bloqueio por handlers e por URL de aprovação, ausência de QR/clipboard/Blob no legado inválido e recuperação explícita para link sem aprovação herdada. Link e Perfil continuam alternativas válidas. Remover o arquivo de entrada mantém a citação da trilha.

**R5-F2 — republicar recebida:** fechado nesta candidata no recorte. O menu não oferece Compartilhar, URLs de folha/código explicam a cópia privada e não expõem link/QR. Handlers de revisão/confirmação/repetir/salvar/visibilidade/cópia/código/folha/download não republicam nem alteram os registros. Conferi prefixo de recebida, marcador `received`, falta de registro, visitante e sessão inativa. Uma retirada iniciada antes de trocar de registro ainda apresenta a falha nova R6-F2 abaixo.

**R5-L1 — contexto da trilha ativa em Foco:** fechado por observação da home nas três direções, registrada em `material-nome-probe.json`: C agora inclui o título da trilha no cartão ativo.

## Achados abertos

### R6-F1 · médio · resposta assíncrona e folha atuam em outro contexto · A/B/C

**Reprodução:** iniciar a cópia em uma trilha própria elegível, manter a Promise do clipboard pendente e mudar para outra trilha própria, recebida, Privacidade ou Mapa; depois resolver ou rejeitar. Separadamente, abrir a folha de código na própria, mudar o contexto e só então tocar Copiar na folha antiga.

**Observado:**

- `copy-link` comum mostra sucesso ou abre o fallback com a URL nos quatro destinos. Na recebida, o fallback contradiz o bloqueio que a folha atual corretamente apresenta.
- `media-code-copy` bloqueia a recebida, mas em outra própria/Privacidade/Mapa ainda mostra sucesso ou a instrução de fallback após a mudança.
- O callback `afterClose` da folha bloqueia recebida e material com destino inválido, mas inicia outra chamada ao clipboard quando o contexto mudou para outra própria/Privacidade/Mapa.

Na matriz de 60 cenários, são **17 verificações negativas por direção**: oito no handler comum, seis na cópia de mídia e três na folha. O caso integrado de fallback após adicionar recebida repete o defeito uma vez por direção. A escrita inicial no clipboard foi solicitada enquanto a própria era elegível; não se afirma que seja possível desfazer uma escrita já iniciada. O defeito é a resposta, alternativa ou nova chamada tardia atravessar o contexto.

**Correção sugerida:** capturar trilha, tela/rota, destino e estado da publicação ao iniciar; revalidar o contexto antes de qualquer resposta após `await`, tanto no sucesso quanto no `catch`. A folha precisa capturar seu contexto na abertura e revalidá-lo no fechamento. Só conferir se a trilha atual é elegível não distingue outra própria nem outra tela.

**Prova:** `assincronia-contexto.cjs` / `assincronia-resultados.json`, capturas `*-async-*`; `compartilhar-resultados.json`, caso `copy-link-fallback-apos-mudar-propriedade`.

### R6-F2 · médio · retirada confirma sobre registro diferente · A/B/C

**Reprodução:** iniciar `social-stop-publication` numa própria; com o diálogo aberto, a fixture ativa uma recebida sem renderizar outro diálogo; confirmar a retirada anterior.

**Observado:** a recebida, que não iniciou a ação, muda `publicationStatus:''` para `'retirado'`. O seu título, cópia e progresso permanecem, mas o callback escreveu no estado de publicação do registro errado. O callback de confirmação de publicação foi testado de modo semelhante e corretamente bloqueou mudança de trilha ou de origem; o de retirada ainda não o faz.

**Correção sugerida:** capturar o ID e o estado do pedido ao abrir a confirmação, revalidar propriedade e contexto no callback e dirigir a alteração ao registro correto. A exceção necessária para retirar um legado com destino inválido não deve permitir modificar uma recebida ou outra trilha ativa.

**Prova:** `fronteiras-compartilhar.cjs` / `compartilhar-resultados.json`, caso `retirada-nao-altera-outra-trilha`, com registros antes/depois e captura nas três direções.

### R6-F3 · médio · promessa contraditória sobre nome do material · A/B/C

**Reprodução:** uma própria com `materialReference.nome='revisao.pdf'` e título `revisao.pdf para a prova`; abrir Compartilhar.

**Observado na mesma folha:** “Arquivo, nome e fotos não são publicados” e “O título traz o nome do seu arquivo. Arquivo bruto e fotos das páginas não vão.” O título exibido já contém `revisao.pdf`. A segunda explicação está alinhada à origem da trilha; a promessa absoluta anterior está errada.

**Efeito:** a pessoa não consegue decidir com confiança o que o compartilhamento inclui. Não houve envio real de arquivo ou dado: é uma contradição da proposta, relevante a D1/D9.

**Correção sugerida:** usar uma única explicação derivada da referência ativa: título, trechos e páginas podem seguir na cópia; arquivo bruto e fotos não. Se o título inclui o nome, explicar isso sem prometer a remoção do nome.

**Prova:** `material-nome-probe.cjs` / `material-nome-probe.json`, textos completos e capturas `*-material-nome-promessa-base.png`/`revisao.png`, três direções.

## Continuidade e recuperação preservadas

A regressão repetiu cadastro/código/senha/recuperação, SQL novo com consentimento e geração cancelável, aceite, erro/reforço/acerto, seis formatos, “Vale rever”, explicação opcional, conclusão e retomada local. O percurso das cinco lições conserva 5/5, sem sexta lição. Descrições, capas/temas, tentativas por trilha+lição e reinício isolado, snapshot conta → visitante → restauração, origem material, Explorar com ordem/paginação/Back/rolagem, postagem/retirada/desfazer e QR/clipboard nos caminhos permitidos conservam os resultados anteriores.

O parcial genérico agora abre a associação de WHERE com dois pares corretos; a tentativa anterior de INNER JOIN permanece intacta. Retry foca o par corrigível e verificar acerto foca Continuar. Não transfiro esses pontos de foco para uma aprovação integral de acessibilidade.

O áudio continua começando por gesto, preservando rascunho ao cancelar/Back e terminando com transcrição revisável no avanço lógico de **61.000 ms**, para o contrato atual de 60 s. Não foi gravado som nem conferida permissão nativa.

## Adaptações de bancada

As rodadas iniciais e rechecagens estão preservadas com sufixos `adaptacao-inicial`, `primeira`, `antes-fallback-textual` e `rechecagem`. O JSON final substitui somente os casos identificados; não soma a repetição ao total.

- O teste antigo que clicava Explorar e esperava revisão foi adaptado ao botão agora desabilitado; continua exigindo que material não entre como pendente no Explorar. Handlers e efeitos negativos foram conferidos separadamente na API real instrumentada.
- A legenda de moderação ficou compacta, com “Estado de exemplo”; o teste verifica o rótulo novo e o mesmo registro/status. O texto de cópia privada foi ajustado ao guard do núcleo, que precede o módulo social.
- A revisão de link é um handler válido, mas não é um botão da folha padrão que já oferece copiar. Nos cenários de callback, o handler é invocado explicitamente pela fixture; na alternativa Perfil depois do link aprovado, o roteiro agora retira, abre “Compartilhar novamente” e escolhe Perfil pelas ações reais desse estado.
- Sob carga, duas medições intermediárias de geração em Caderno avançaram com tempo real além da fronteira esperada. Repeti os mesmos 14 asserts com relógio pausado e movimento reduzido somente nesse caso; o roteiro controla exatamente os eventos, sem tratar isso como desempenho de rede ou pintura.
- A matriz assíncrona foi ampliada para contar também a mensagem de fallback “Selecione e copie” no toast, além do campo. Os seis casos afetados foram repetidos e expuseram as seis falhas adicionais; esse ajuste tornou a prova mais rigorosa.

Nenhum assert de integridade foi removido para alcançar a meta. Os problemas reais permanecem negativos.

## Notas competentes deste parecer

| Critério | A | B | C | Fundamentação |
| --- | ---: | ---: | ---: | --- |
| D1 · clareza e contexto | 8,0 | 8,0 | 8,0 | R6-F3 contradiz o que o título pode expor. |
| D2 · ação e autonomia | 8,0 | 8,0 | 8,0 | A retirada pode confirmar sobre o registro errado; a folha antiga pode iniciar nova cópia fora de seu contexto. |
| D8 · feedback e recuperação | 8,0 | 8,0 | 8,0 | Sucesso e fallback tardios aparecem em outra tela/trilha, apesar das recuperações positivas da regressão. |
| D9 · continuidade e confiança | 8,0 | 8,0 | 8,0 | R5-F1/F2 fechados; R6-F1/F2/F3 ainda impedem confiança integral na proposta de compartilhamento. |
| D10 integral e demais D | `null` | `null` | `null` | Este parecer não consolida a matriz visual/teclado completa e não fecha gates com os médios abertos. |
| Nota global | `null` | `null` | `null` | A meta de todos os critérios ≥9 ainda não está comprovada. |

**DG5 e fechamento de DG6 permanecem pendentes. Produto implementado web/iOS/Android: C1–C10 `null`. Uso com pessoas: não realizado.**

## Evidências

Diretório `/workspace/work/revisao-fluxos-r6/`: as cinco suítes de regressão e seus JSONs; `fronteiras-compartilhar.cjs`/`compartilhar-resultados.json`; `assincronia-contexto.cjs`/`assincronia-resultados.json`; `material-nome-probe.cjs`/`material-nome-probe.json`; capturas e histórico de adaptação. **`notas-e-contagens.json`** contém fonte, hashes, notas, falhas e contagens por direção.

As fontes ficaram congeladas até concluir a coleta, e foram liberadas ao autor depois dela. O histórico R5 não foi apagado nem reavaliado como se a fonte anterior já tivesse as correções.
