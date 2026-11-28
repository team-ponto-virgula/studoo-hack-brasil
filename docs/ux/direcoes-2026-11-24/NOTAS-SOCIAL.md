# Subfluxos sociais R2

Factory `window.StudooSocial(api)` em `prototipo/social-pages.js`. Não faz rede, não envia denúncias e não publica conteúdo. CSS isolado em `social-pages.css`. Os quatro motivos e os estados de revisão seguem a spec 14.

## Integração

- Carregar o script antes de `app.js`; instanciar com a API combinada; unir `actions` ao delegado do renderer e encaminhar `onInput`/`onChange`.
- Adicionar `denunciar` ao mapa de páginas e usar `social.report()` nesse caso. Menus de perfil/trilha chamam `social-start-profile` / `social-start-trail`.
- `publication(scenario)` retorna `{html, foot, status, hideLink}` ou `null` no caso normal. Os estados **pendente, recusado e retirado precisam substituir também o rodapé**: não oferecer Copiar link ou Código Studoo. `isLinkHidden(scenario)` está disponível para guards do renderer/media.
- No compartilhamento normal, `publicationNote()` acrescenta a linha das regras para Perfil/Explorar e `sharingFooter()` exige revisão/confirmação antes da publicação de exemplo. `api.setScenario` apenas atribui/sincroniza a rota; o módulo chama `render` depois.
- `sharingNotice()` usa a distinção da spec 09: trechos citados e páginas vão junto, arquivo/nome/fotos não; se o título contém o nome do arquivo, a variante avisa isso e não promete ocultá-lo. Use também no compartilhamento normal.
- `state.isGuest===true` ou `api.isGuest()` representa a sessão visitante explicitamente; não se infere papel a partir do nome. O módulo mostra Entrar para compartilhar e oculta link/código nesse estado. Denunciar continua permitido.
- O envio local da denúncia define `reportedProfile=true` ou adiciona `reportedTitles[]`. O renderer deve esconder o alvo no catálogo/perfil/prévia; cópias privadas em `state.tracks` são preservadas. Bloquear define `blocked=true`, `followed=false` e volta ao Explorar após confirmação.
- `api.activateTrack(id)` é opcional para abrir cópia já adicionada. Sem esse helper, o fallback atualiza o exemplo local preservando os demais registros de `tracks`.

## Cenas

- Denúncia: formulário com motivo obrigatório e detalhe opcional, conferência, protocolo `STU-EXEMPLO-001`, voltar e bloquear separadamente. Nenhuma promessa de prazo de atendimento.
- Compartilhar: `publicacao-revisar`, `publicacao-pendente`, `publicacao-erro`, `publicacao-reprovada`, `publicacao-retirada`, `publicacao-aprovada`, `link-inativo`, `ja-adicionada`. Os dois últimos são cenas de destinatário; as demais são do dono.
- Aprovação e protocolos são explicitamente simulados. Estados de revisão não aparecem como publicação confirmada e não expõem link/código; erro oferece repetir/revisar; parar de compartilhar mantém a trilha/progresso locais.

Ainda exige integração e QA congelado do renderer: nomes/foco dos controles, teclado, reflow200%, preservação/ocultação na navegação e as três direções. Nenhuma nota 9, execução nativa ou chamada de API foi atribuída por este módulo.

## Conferência de autoria, antes da integração

- Sintaxe JS e `git diff --check`: passaram.
- **18/18 verificações isoladas da factory:** motivo obrigatório, conferência/protocolo, estados sem link/código, cancelar sem perder pendência, parar/bloquear preservando cópias, reabrir cópia com progresso, visitante sem publicação, aviso de material e escape dos detalhes.
- **132 vistas isoladas**: três temas × duas larguras × texto100/200% × onze cenas. Sem pageerrors, transbordamento horizontal interno, alvos abaixo de44px ou rodapé fora da viewport. O harness reproduz os helpers de layout com ícone geométrico simples; não é o renderer integrado nem substitui a revisão independente.
- Evidências de autoria fora do Git: `/workspace/work/revisao-social-r2/api-smoke.json`, `visual-smoke.json`, scripts e três capturas representativas.
- Fonte JS desta conferência: `572a52154ab2a2d6aa681dfe6ee57b110826d8a12f461400e603039625e46a58`; CSS: `8badea9270eee1c0345407ea069d3ad25fbf699bd01192838380cbc10ea6ddfe`.

Esses números não se somam aos testes de produto, não comprovam leitores de tela nativos e não são aprovação das notas D do protótipo completo.
