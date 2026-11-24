# Compartilhamento — contexto assíncrono R7

Registro de autoria dos módulos `social-pages.js` e `media-pages.js`, anterior à revisão independente. A R6 permanece registrada: verificar apenas se a trilha ainda era elegível permitia que uma operação terminasse em outra trilha própria ou em outra página. A retirada também podia atingir o registro que se tornara ativo durante a confirmação. São fluxos locais do protótipo; não houve publicação em servidor.

## Identidade da operação

No início de uma cópia, da abertura da folha ou de uma confirmação, os módulos capturam **id da trilha, página, cenário, destino, estado persistido da publicação e token do quadro renderizado**. `addonApi.getRenderToken()` devolve o objeto da renderização atual; uma nova renderização tem outra identidade mesmo quando seus textos são iguais.

O snapshot original acompanha `await`, `catch`, callback de confirmação e `afterClose`. O callback da folha não captura uma autorização nova depois de fechar: ele recebe a mesma identidade registrada na abertura.

Depois de invalidado o contexto:

- A resolução/rejeição da cópia não mostra mensagem, fallback ou seleção de campo em outra página/trilha.
- A folha antiga não inicia cópia ou download, nem devolve foco a um controle de outro quadro.
- Confirmar publicação/retirada não altera o registro que passou a estar ativo.
- Cancelar uma revisão antiga não restaura ou limpa o estado de outra trilha.

Uma escrita no clipboard que já começou com autorização válida não é desfeita. A proteção impede efeitos e feedback posteriores em contexto diferente; não promete cancelar uma chamada de plataforma já iniciada.

Retirar uma **trilha própria de material com destino Explorar legado** continua permitido. A retirada verifica identidade e sessão, sem exigir que o destino antigo seja válido para uma nova publicação. Ela continua proibida para uma cópia recebida ou para outro registro que se torne ativo.

O cancelamento pertence ao quadro de revisão efetivamente renderizado. Se a própria revisão é redesenhada, um novo toque em Cancelar é uma nova ação válida naquele quadro. Isso permite editar escolhas, voltar à revisão e cancelar, sem reutilizar callbacks de uma folha anterior.

## Aviso único de material

`sharingNotice` continua consultando apenas os metadados da trilha ativa. Informa que título, trechos e páginas podem seguir, inclusive nome do arquivo presente no título. Agora também concentra a proteção de **arquivo bruto, fotos, progresso, respostas e explicações pessoais**, que não seguem na cópia. O núcleo da bancada removeu a nota absoluta duplicada que contrariava o caso de um título contendo o nome do arquivo.

## Prova de autoria e contagem

Evidências em `/workspace/work/compartilhar-r7-author/`:

- `async.cjs`: Promise de clipboard controlada por fixture, callbacks de diálogo e folha; cenários positivos/negativos nas três direções. Inclui `media-code-copy`, o `copy-link` comum do núcleo, resolução/rejeição, troca para outra própria/recebida, Mapa/Privacidade, alteração de cenário/destino/status e token de uma nova renderização.
- `resultado-inicial.json` e `async-inicial.cjs`: **216 cenários, 717 asserções tentadas; 714 positivas e três falhas da expectativa do harness**, zero erros JavaScript. As três falhas tratavam um novo toque em Cancelar num novo render da **mesma** revisão como se fosse um callback antigo. Os negativos e suas capturas foram preservados.
- `resultado-cancel-render.json`: **3/3 casos afetados repetidos**, um por direção, com a expectativa corrigida. Nenhuma fonte de produto foi alterada para fazer essa expectativa passar.
- `resultado.json`: consolidação transparente de **213 cenários positivos sem alteração + três casos reavaliados**, sem dupla contagem: **717 verificações / 216 cenários** na fonte final. Os hashes dos dois módulos coincidem entre as rodadas. Não significa uma segunda execução integral de todas as 717 asserções.

Os outros registros foram comparados antes/depois da entrega do callback invalidado. Continuaram idênticos. As cópias válidas mantiveram sucesso/fallback, a folha válida manteve sua cópia e a retirada do legado próprio de material continuou funcionando. A resolução/rejeição controlada registra uma chamada autorizada já iniciada; exige zero novos efeitos depois da invalidação.

Essas provas não usam clipboard, folha ou permissões nativas reais. Não medem servidor, autenticação, iPhone/Android nem UX com pessoas. As notas e gates dependem da revisão independente da candidata congelada.
