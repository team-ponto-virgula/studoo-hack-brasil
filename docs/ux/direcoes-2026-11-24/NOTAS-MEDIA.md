# Foto e Código Studoo — complemento R2

Implementação local de dois subfluxos da bancada de desenho. Não abre câmera, não publica imagens, não envia dados e não executa APIs nativas. Os arquivos pertencem à mesma matriz das três direções.

## Foto e enquadramento

`media-pages.js` oferece a página `foto`: escolher PNG/JPEG/WebP de até 2 MB ou uma imagem do kit de exemplo, conferir a prévia, ajustar zoom pelo controle de faixa ou pelos botões, escolher formato, remover e cancelar. Arquivo inválido, tamanho excessivo e falha de leitura têm retorno recuperável. O zoom é uma prévia CSS real; não se afirma que houve processamento de recorte ou remoção de metadados do arquivo.

Antes de “Usar esta foto”, seleção/zoom permanecem em um rascunho privado da sessão do editor. Cancelar não modifica a foto anterior. Confirmar preenche `state.profileDraft.photo`, `photoZoom` e `photoShape`; a aplicação ao perfil só ocorre no `save-profile` do renderer. O helper chama `api.markProfileDirty?.()` para o guard de alterações pendentes. Se o renderer não fornecer esse callback e não copiar os campos no salvamento, a integração está incompleta.

O editor não substitui o novo Stu caderno. A imagem de exemplo é o asset provisório existente. Arquivos escolhidos pela pessoa ficam no navegador do protótipo; as capturas de QA usam apenas esse kit sintético.

## Código Studoo de exemplo

`codigostudoo` apresenta um QR convencional real com a marca fora da matriz, codificando exatamente `https://studoo.example.test/t/sql-exemplo`. O domínio e o aviso deixam claro que não existe uma trilha publicada nesse endereço. Não se afirma que essa composição já é o renderizador nativo ou o desenho personalizado definitivo do Código Studoo.

O gerador é `qrcode-generator` **2.0.4**, já presente nas dependências do repositório. A cópia em `prototipo/vendor/qrcode.js` preserva o cabeçalho original e a licença MIT em `vendor/LICENSE`. Não houve instalação de nova dependência. Nível de correção M; célula de 6 unidades e margem de 24, ou quatro módulos de área limpa. Navy sobre branco, sem logo por cima dos módulos.

Copiar usa a API do navegador quando disponível. Ao falhar, seleciona o campo e orienta a cópia manual, sem anunciar sucesso inexistente. O menu de compartilhamento é local e nomeado; permite copiar, baixar o SVG próprio e cancelar, sem chamar uma folha nativa ou enviar mensagens. Escape retorna ao acionador.

## Integração

Carregar `vendor/qrcode.js` e `media-pages.js` antes do `app.js`, e `media-pages.css` junto dos estilos da bancada. A factory `window.StudooMedia(api)` devolve `photo()`, `code()`, `actions`, `onInput` e `onChange`. Os casos `foto` e `codigostudoo` devem usar `{html,foot}`. As ações têm prefixo `media-`; o renderer encaminha os eventos de entrada e mudança. Os mesmos arquivos precisam entrar no empacotador offline.

## Conferência isolada executada

O harness em `/workspace/work/revisao-media-r2/` verificou **67/67 casos**, com zero exceções: 12 vistas (duas páginas × três direções × duas larguras), CTA e alvos, overflow, seis vistas de texto a 200%, zoom por range e teclado, seleção/erro/tamanho/leitura de imagem, cancelamento sem alteração, confirmação em rascunho, contrato de aplicar o rascunho ao salvar, QR decodificado por `jsQR` 1.4.0 e fallback de cópia/diálogo/foco. A rasterização do SVG em 330×330 decodificou a URL exata acima.

Essa prova é da **factory isolada com helpers do contrato**, não da integração final do renderer. O `save-profile` do harness é um stub explícito para verificar o contrato dos campos; o salvamento integrado deve ser conferido novamente na R2. Não houve execução de câmera, leitor de tela, iPhone/Android, escaneamento por aparelho ou avaliação com pessoas. Nenhuma nota 9 é atribuída por este documento.

## Correção R4 — foco após seleção de imagem (K4)

A revisão integrada da candidata R3 `902eca4e3a8e8ac374d79972677a1ed3edc83859` encontrou o foco em `BODY` depois de carregar uma fixture WebP em 6/6 pares de tema/largura. O próximo Tab voltava ao cabeçalho. Esse achado D6 não estava coberto pelos 67 checks isolados anteriores; a medição histórica foi preservada.

O resultado de `readPhotoFile` agora restitui foco ao seletor de imagem somente quando o editor segue aberto, o token da leitura continua atual e o foco já estava perdido em `BODY`/raiz/input oculto antes do render e continua perdido depois dele. Não substitui um controle focado pela pessoa, não recupera foco após navegação/cancelamento e não atua com o documento em segundo plano. Sucesso, tipo inválido, tamanho excessivo e erro de decodificação usam a mesma rotina. Nova seleção invalida também uma leitura anterior ainda pendente.

O harness de regressão em `/workspace/work/revisao-media-r4/` passou **145/145 checks**, zero exceções. Desses, **78** tratam o foco e as corridas de leitura: quatro resultados × três temas × duas larguras, sequência de Tab no editor, preservação de outro controle durante decode, cancelamento/navegação e token antigo versus seleção nova. Os 78 fazem parte dos 145, não são um total adicional. O teste usa arquivo próprio por `setInputFiles` e `Image.decode` real, com atraso controlado nos cenários de concorrência; não valida o seletor ou teclado nativo do sistema.

O renderer do harness restaura controles por `id`/`data-action` conforme seu contrato. Portanto, essa prova é de regressão da factory; a confirmação integrada da candidata R4 permanece com a revisão independente do app da bancada.
