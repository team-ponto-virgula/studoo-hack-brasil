# Compartilhamento — guardas do protótipo R6

Registro de autoria dos módulos `social-pages.js` e `media-pages.js`, antes do parecer independente. Corrige dois caminhos locais encontrados na R5: uma trilha de material podia ser enviada ao Explorar e uma cópia recebida podia ser republicada pelo menu do mapa. É comportamento da bancada de desenho; não há publicação ou incidente em servidor.

## Contrato central

Os módulos recebem três funções síncronas da bancada:

- `canShareTrack(id = ativo)`: a trilha existe, pertence à conta de exemplo ativa e foi criada por ela. Recebidas, visitantes e sessão inativa não são elegíveis.
- `trackUsesMaterial(id = ativo)`: origem lida do registro da trilha (`deMaterial`/`materialReference`).
- `trackMaterialName(id = ativo)`: nome da referência desse registro, sem inferir origem a partir do arquivo de outro pedido.

Falta do helper de elegibilidade bloqueia a exposição do link/código. Foto/recorte do perfil e denúncia continuam independentes da propriedade da trilha. As regras não são prova de autenticação ou autorização de produção.

## Regras em desenho e ação

| Situação | Resultado |
| --- | --- |
| Própria sem material | Link, perfil e Explorar continuam disponíveis no exemplo. Material de outro pedido não altera essa elegibilidade. |
| Própria criada com material | Link/perfil disponíveis; Explorar desabilitado, com motivo textual. Confirmar, tentar novamente, salvar visibilidade e aprovação por query não contornam a restrição. |
| Legado com material + destino Explorar | Não mostra aprovação, link ou QR. Oferece escolher explicitamente o destino link, limpando a aprovação anterior, ou parar de compartilhar. Não aprova a recuperação silenciosamente. |
| Recebida ou sem trilha própria | Não oferece republicação nem código. Os handlers também recusam efeitos mesmo quando chamados diretamente pela fixture de teste. Estudos e personalização da cópia continuam acessíveis. |
| Revisão, pendente, erro, recusada ou retirada | Link/código permanecem indisponíveis, conforme o estado de compartilhamento. Parar/retirar e voltar continuam operáveis. |

O diálogo de confirmação revalida trilha, destino e origem no callback. Uma confirmação iniciada para outro registro/destino não publica o atual. Salvar visibilidade preserva o estado persistido; não promove para aprovado usando o estado de uma URL demonstrativa. Cancelar restaura somente a revisão pertencente ao registro atual; confirmação/retirada encerram o snapshot da revisão.

No módulo de mídia, os guardas vêm antes de preparar o SVG, escrever no clipboard, abrir a folha ilustrativa ou criar o Blob de download. O callback após fechar a folha consulta a elegibilidade novamente. Um QR previamente preparado não é reaproveitado para uma cópia recebida.

O aviso de material acompanha a referência da trilha ativa. Título, trechos citados e páginas podem seguir na cópia; arquivo bruto e fotos das páginas não. Se o título contém o nome do arquivo, isso é explicitado. O arquivo de um pedido posterior não muda esse aviso.

## Prova de autoria

Roteiro HTTP e resultados em `/workspace/work/compartilhar-r6-author/`. A primeira rodada, preservada em `resultado-inicial.json`, tinha 39 cenários/150 asserções executadas e nove falhas: os módulos bloquearam, mas o handler comum `copy-link` ainda escrevia no clipboard para recebidas/sem registro. A correção desse handler pertence ao núcleo da bancada e foi feita pelo responsável pelo `app.js`; a rodada final repete as fronteiras depois dela.

A rodada final passou **222/222 asserções em 63 cenários**, 21 por direção, com zero `pageerrors` e hashes dos dois módulos idênticos antes/depois (`resultado.json`). Inclui próprias com outro pedido de material, material por link/perfil, legado com Explorar, cópias por prefixo e por marcador, ausência de registro, visitante/sessão inativa, confirmação/cancelamento e QR em estados não expostos.

Os efeitos de clipboard/download são interceptados pela fixture do navegador, para contar chamadas autorizadas e provar ausência nos caminhos bloqueados. O QR permitido é renderizado e decodificado com `jsQR`; contém a mesma URL demonstrativa `https://studoo.example.test/t/sql-exemplo`. A folha continua explicitamente ilustrativa. Nenhuma publicação, mensagem, inferência, gravação ou envio real é efetuado.

A revisão independente da candidata congelada ainda precisa confirmar os resultados e a apresentação nas três direções. Este registro não atribui nota, não encerra gates e não valida iPhone/Android ou servidor.
