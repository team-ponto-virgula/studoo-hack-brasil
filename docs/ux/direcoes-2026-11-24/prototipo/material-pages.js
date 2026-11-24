(function () {
  'use strict';

  // Desenho local de P05. Não abre seletor, câmera, OCR ou conexão de rede.
  window.StudooMaterial = function (api) {
    const {getState, save, render, go, ask, notify, icon, btn, title, esc, note} = api;
    // Snapshot do contrato packages/contratos/src/estudio.ts; não são limites novos.
    const limits = {bytes:5 * 1024 * 1024, pages:6, text:24000, csvRows:200, csvColumns:20};
    const limitsText = 'Imagem JPG/PNG/WebP, PDF de até 6 páginas, DOCX ou CSV. Até 5 MB e 24 mil caracteres. CSV: até 200 linhas e 20 colunas, em UTF-8.';
    const foot = (...buttons) => '<div class="bottom-actions">' + buttons.filter(Boolean).join('') + '</div>';
    const aliases = {tipo:'formato-invalido',formato:'formato-invalido','material-tipo':'formato-invalido',tamanho:'tamanho-excedido','material-tamanho':'tamanho-excedido',erro:'leitura-erro',rede:'leitura-erro',pronto:'previa',selecionado:'previa','permissao-negada':'permissao',expirado:'expirada'};
    const pending = ['carregando','lendo'];
    let run = 0;
    let timers = [];
    const getScenario = () => api.getScenario?.() || '';
    const phase = value => aliases[value] || value || '';
    const visible = () => (!api.getPage || api.getPage() === 'material') && !!document.querySelector('.screen[data-page="material"]');
    const clone = value => JSON.parse(JSON.stringify(value));
    const p1 = 'WHERE seleciona as linhas que satisfazem a condição. Use >= para incluir valores a partir do limite: o próprio limite entra no resultado.';
    const p2 = 'INNER JOIN combina linhas de duas tabelas quando a condição em ON é satisfeita. Cada par correspondente gera uma linha no resultado.';

    function fixture(kind, origin) {
      const common = {id:'material-sql-exemplo-' + kind,leitura:'demonstracao',origem:origin || 'arquivo',utf8:true,paginas:[{numero:1,rotulo:'Página 1',texto:p1}]};
      if (kind === 'docx') return {...common,nome:'anotacoes-sql.docx',tipo:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes:96256};
      if (kind === 'csv') return {...common,nome:'notas-alunos.csv',tipo:'text/csv',bytes:29,csvLinhas:4,csvColunas:2,paginas:[{numero:1,rotulo:'Linhas 1–4',texto:'Linha 1: ["aluno","nota"]\nLinha 2: ["Ana","6"]\nLinha 3: ["Bia","7"]\nLinha 4: ["Caio","9"]',tabela:[['aluno','nota'],['Ana','6'],['Bia','7'],['Caio','9']]}]};
      if (kind === 'image') return {...common,nome:'anotacoes-sql.jpg',tipo:'image/jpeg',bytes:307200,origem:origin || 'galeria',imagemExemplo:true};
      if (kind === 'invalid') return {...common,nome:'apresentacao.pptx',tipo:'application/vnd.openxmlformats-officedocument.presentationml.presentation',bytes:102400};
      if (kind === 'large') return {...common,nome:'resumo-grande.pdf',tipo:'application/pdf',bytes:limits.bytes + 1};
      return {...common,nome:'revisao-sql.pdf',tipo:'application/pdf',bytes:184320,paginas:[{numero:1,rotulo:'Página 1',texto:p1},{numero:2,rotulo:'Página 2',texto:p2}]};
    }

    function validationProblem(material) {
      if (!material || typeof material.nome !== 'string' || !material.nome.trim() || material.nome.length > 160 || /[\x00-\x1f/\\]/.test(material.nome)) return 'formato-invalido';
      const ext = material.nome.toLowerCase().split('.').pop();
      const docx = ext === 'docx' && ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream','application/zip',''].includes(material.tipo);
      const csv = ext === 'csv' && ['text/csv','text/comma-separated-values','application/csv','application/x-csv','text/x-csv','text/plain','application/vnd.ms-excel','application/octet-stream',''].includes(material.tipo);
      if (!docx && !csv && !['application/pdf','image/jpeg','image/png','image/webp'].includes(material.tipo)) return 'formato-invalido';
      if (!Number.isFinite(material.bytes) || material.bytes <= 0 || material.bytes > limits.bytes) return 'tamanho-excedido';
      if (!Array.isArray(material.paginas) || !material.paginas.length || material.paginas.length > limits.pages) return 'paginas-excedidas';
      if (material.paginas.some(p => typeof p.texto !== 'string' || p.texto.length > 12000) || material.paginas.reduce((n,p) => n + p.texto.length,0) > limits.text) return 'texto-excedido';
      if (!material.paginas.some(p => p.texto.trim().length >= 30)) return 'leitura-erro';
      if (csv && (material.csvLinhas > limits.csvRows || material.csvColunas > limits.csvColumns || material.utf8 === false)) return 'csv-invalido';
      return '';
    }

    function cancelTimers() {
      run += 1;
      timers.forEach(clearTimeout);
      timers = [];
    }

    function confirmed() {
      const s = getState();
      if (!s.file) return null;
      if (s.materialExample?.nome === s.file) return s.materialExample;
      return {...fixture('pdf'),nome:s.file,status:'ready',legacyExample:true};
    }

    function candidate() {
      return getState().materialDraft || confirmed() || fixture('pdf');
    }

    function show(value, asynchronousToken) {
      if (api.setScenario) api.setScenario(value || '');
      save();
      const asynchronous = asynchronousToken !== undefined;
      render(!asynchronous);
      if (!asynchronous || asynchronousToken !== run || !visible() || !document.hasFocus()) return;
      const focused = document.activeElement;
      if (!focused || focused === document.body || focused === document.documentElement) {
        document.querySelector('.screen[data-page="material"] h1')?.focus({preventScroll:true});
      }
    }

    function startReading(kind, origin) {
      cancelTimers();
      const material = typeof kind === 'object' ? clone(kind) : fixture(kind, origin);
      const problem = validationProblem(material);
      getState().materialDraft = {...material,status:problem ? 'invalid' : 'loading'};
      if (problem) {show(problem);return;}
      const token = run;
      show('carregando');
      timers.push(setTimeout(() => {
        if (token !== run || !visible() || phase(getScenario()) !== 'carregando') return;
        getState().materialDraft.status = 'reading';
        show('lendo',token);
      },600));
      timers.push(setTimeout(() => {
        if (token !== run || !visible() || phase(getScenario()) !== 'lendo') return;
        getState().materialDraft.status = 'ready';
        show('previa',token);
      },1200));
    }

    function sampleNotice() {
      return '<div class="mat-sample-note">' + icon('info') + '<p><strong>Material de exemplo.</strong> Arquivos e leitura são simulados; nada é enviado.</p></div>';
    }

    function sizeText(bytes) {
      if (bytes === limits.bytes + 1) return '5 MB + 1 byte';
      return bytes < 1024 ? bytes + ' bytes' : Math.round(bytes / 1024).toLocaleString('pt-BR') + ' KB';
    }

    function fileCard(material) {
      return '<div class="mat-file-card">' + icon(material.imagemExemplo ? 'image' : 'paper') + '<div><strong>' + esc(material.nome) + '</strong><small>' + sizeText(material.bytes) + ' · ' + material.paginas.length + (material.paginas.length === 1 ? ' página' : ' páginas') + ' de exemplo</small></div></div>';
    }

    function sourceRow(label, detail, name, action) {
      return '<button type="button" class="row" data-action="' + action + '"><span class="row-icon">' + icon(name) + '</span><span class="row-content"><strong>' + label + '</strong><small>' + detail + '</small></span>' + icon('next') + '</button>';
    }

    function limitsDetails() {
      return '<details class="mat-limits"><summary>Formatos e limites aceitos</summary><p>' + limitsText + '</p></details>';
    }

    function chooseView() {
      return {html:title('Seu material','Traga seu ponto de partida.','Um documento ou uma página pode orientar o seu estudo.') + sampleNotice() +
        '<div class="list">' + sourceRow('Escolher arquivo','PDF, DOCX, CSV ou imagem','paper','material-open-file') + sourceRow('Fotografar uma página','Prévia local da câmera','camera','material-open-camera') + sourceRow('Escolher da galeria','Imagem de exemplo','image','material-open-gallery') + '</div>' + limitsDetails() +
        note('Seu objetivo continua preservado. O material não é publicado automaticamente.','shield'),
        foot:foot(btn('Continuar sem material','material-clear-continue'),btn('Voltar ao objetivo','go:pedido','quiet'))};
    }

    function paperPreview() {
      return '<div class="mat-photo-preview" role="img" aria-label="Imagem de exemplo de uma página de anotações SQL"><div class="mat-photo-paper"><span>SQL · ANOTAÇÕES</span><strong>O limite também entra.</strong><code>SELECT nome FROM alunos<br>WHERE nota &gt;= 7;</code><p>Bia tem nota 7.<br>Caio tem nota 9.</p></div></div>';
    }

    function cameraView(isGallery) {
      return {html:title(isGallery?'Galeria':'Câmera',isGallery?'Escolha uma página para conferir.':'Enquadre o que você quer estudar.','Confira se a página ficou legível. Esta é uma imagem de exemplo.') + paperPreview() + note('Confira se o texto e os números estão legíveis antes de continuar.','eye'),
        foot:foot(btn(isGallery?'Usar imagem de exemplo':'Usar foto de exemplo',isGallery?'material-use-gallery-photo':'material-use-camera-photo'),btn('Cancelar','material-cancel-picker','quiet'))};
    }

    function readingView(value) {
      const material = candidate();
      return {html:title('Seu material',value==='carregando'?'Preparando o material.':'Conferindo o conteúdo.','Seu objetivo continua guardado enquanto você prepara o material.') + fileCard(material) +
        '<div class="mat-reading-status" role="status" aria-live="polite">' + icon('clock') + '<div><strong>' + (value==='carregando'?'Preparando o arquivo de exemplo…':'Lendo as páginas de exemplo…') + '</strong><p>Seu objetivo e o material anterior continuam preservados.</p></div></div>' +
        note('Você confere a prévia antes de usar esse material.','eye'),foot:foot(btn('Cancelar leitura','material-cancel-reading','secondary'),btn('Trocar material','material-open-file','quiet'))};
    }

    function pagePreview(page, index, material) {
      const table = page.tabela ? '<div class="mat-table-wrap"><table><caption>Prévia da tabela · UTF-8</caption><thead><tr>' + page.tabela[0].map(cell => '<th scope="col">' + esc(cell) + '</th>').join('') + '</tr></thead><tbody>' + page.tabela.slice(1).map(row => '<tr>' + row.map(cell => '<td>' + esc(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : '<blockquote class="mat-excerpt">' + esc(page.texto) + '</blockquote>';
      return '<section class="mat-page-preview" aria-labelledby="mat-page-' + index + '"><div class="mat-page-heading"><h2 id="mat-page-' + index + '">' + esc(page.rotulo || 'Página ' + page.numero) + '</h2><span class="tag">Conteúdo de exemplo</span></div>' + (material.imagemExemplo ? paperPreview() : '') + table +
        btn('Ver citação [' + (index + 1) + ']','material-citation-' + index,'quiet') + '</section>';
    }

    function previewView() {
      const s = getState(), material = candidate();
      const isDraft = !!s.materialDraft;
      return {html:title('Confira a leitura','O conteúdo está como você espera?','Revise os trechos antes de usar o material no seu objetivo.') + fileCard(material) + '<span class="tag">Modo demonstração · leitura local</span>' +
        material.paginas.map((page,index) => pagePreview(page,index,material)).join('') +
        (material.imagemExemplo ? note('A leitura de imagens pode errar números e fórmulas. Se notar um problema, troque por uma imagem mais nítida. A prévia exibida é sintética.','eye') : '') +
        note('O texto de entrada fica disponível por 24 horas. As citações continuam nas lições salvas. Esta prévia usa conteúdo de exemplo.','shield') +
        '<div class="mat-inline-actions">' + btn('Trocar material','material-open-file','secondary') + btn(isDraft?'Descartar esta escolha':'Remover material',isDraft?'material-discard-draft':'material-remove','quiet danger') + '</div>',
        foot:foot(btn('Usar este material','material-confirm'),btn('Voltar ao objetivo','material-keep-confirmed','quiet'))};
    }

    function clearInput() {
      const s = getState();
      s.file = null;s.materialExample = null;s.materialDraft = null;
      save();
    }

    function errorView(value) {
      const errors = {
        'formato-invalido':['Este formato não é aceito.','Escolha uma imagem JPG/PNG/WebP, PDF, DOCX ou CSV.'],
        'tamanho-excedido':['Este arquivo passa do limite.','Use um arquivo de até 5 MB. O exemplo rejeitado tem 5 MB + 1 byte.'],
        'paginas-excedidas':['Vamos reduzir o número de páginas.','Um PDF pode ter até 6 páginas. Separe o trecho que você quer estudar.'],
        'texto-excedido':['O texto ficou maior que o limite.','Escolha um trecho com até 24 mil caracteres.'],
        'csv-invalido':['Vamos conferir essa tabela.','Use CSV em UTF-8, com até 200 linhas e 20 colunas.'],
        'leitura-erro':['Não foi possível concluir a leitura.','Seu objetivo e o material anterior continuam aqui. Tente novamente ou escolha outro exemplo.'],
        'expirada':['Esse material precisa ser escolhido de novo.','O texto de entrada deixou de estar disponível. As citações das lições salvas não são apagadas.'],
        'permissao':['A câmera não está disponível.','Permita o acesso à câmera no aparelho ou escolha um arquivo para continuar.'],
        'camera-bloqueada':['A permissão da câmera está bloqueada.','No aparelho, libere o acesso nas configurações ou escolha um arquivo.']
      };
      const copy = errors[value];
      const permission = ['permissao','camera-bloqueada'].includes(value);
      const previous = confirmed();
      const file = getState().materialDraft || (value==='tamanho-excedido'?fixture('large'):value==='formato-invalido'?fixture('invalid'):null);
      const primary = value==='leitura-erro' ? btn('Tentar leitura de exemplo','material-retry-read') : btn(permission?'Escolher arquivo no lugar':'Escolher outro material',value==='expirada'?'material-replace-expired':'material-open-file');
      return {html:title(permission?'Permissão':'Seu material',copy[0],copy[1]) + '<div class="feedback incorrect" role="alert"><h2>' + icon(permission?'camera':'info') + (permission?'Você tem outra saída.':'O material não foi confirmado.') + '</h2><p>' + (permission?'Você pode continuar sem usar a câmera.':'A escolha rejeitada não substituiu o material anterior.') + '</p></div>' + (file?fileCard(file):'') + limitsDetails() +
        (previous&&value!=='expirada'?note('Material anterior preservado: ' + esc(previous.nome) + '.','paper'):'') + sampleNotice(),
        foot:foot(primary,value==='leitura-erro'?btn('Escolher outro material','material-open-file','secondary'):'',btn(value==='expirada'?'Continuar sem material':previous?'Manter material anterior':'Continuar sem material',value==='expirada'?'material-clear-continue':previous?'material-keep-confirmed':'material-clear-continue','quiet'))};
    }

    function content(page, scenario) {
      if (page !== 'material') return null;
      let value = phase(scenario);
      const current = confirmed();
      if (!value && current?.validUntil && Date.now() >= current.validUntil) value = 'expirada';
      if (['camera','galeria'].includes(value)) return cameraView(value==='galeria');
      if (pending.includes(value)) return readingView(value);
      if (['formato-invalido','tamanho-excedido','paginas-excedidas','texto-excedido','csv-invalido','leitura-erro','expirada','permissao','camera-bloqueada'].includes(value)) return errorView(value);
      if (value==='previa' || getState().materialDraft?.status==='ready' || current) return previewView();
      return chooseView();
    }

    function openFileChoice() {
      const wasPending = pending.includes(phase(getScenario()));
      cancelTimers();
      if(wasPending){getState().materialDraft=null;show(confirmed()?'previa':'');}
      const dialog = document.createElement('dialog');
      dialog.className = 'dialog mat-file-dialog';dialog.setAttribute('aria-labelledby','mat-choice-title');
      dialog.innerHTML = '<h2 id="mat-choice-title">Escolha um arquivo de exemplo</h2><p>Escolha um exemplo pronto para conferir o formato e a leitura.</p>' +
        ['pdf','docx','csv'].map(kind => btn(esc(fixture(kind).nome),'material-example-' + kind,'secondary')).join('') +
        '<details class="mat-limits"><summary>Conferir exemplos de erro</summary>' + btn('Formato não aceito · PPTX','material-example-invalid','quiet') + btn('Maior que 5 MB','material-example-large','quiet') + '</details>' + btn('Cancelar','material-close-dialog','quiet');
      const opener = document.activeElement;document.body.append(dialog);
      dialog.addEventListener('click',event => {const button=event.target.closest('button[data-action]');if(!button)return;const action=button.dataset.action;if(action==='material-close-dialog'){dialog.close();return;}if(action.startsWith('material-example-')){dialog.close();actions[action]();}});
      dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();});
      dialog.showModal();dialog.querySelector('[data-action="material-close-dialog"]').focus();
    }

    function citation(index) {
      const material=candidate(), page=material.paginas[index];if(!page)return;
      ask('Fonte [' + (index + 1) + '] — exemplo',esc(material.nome) + ' · ' + esc(page.rotulo || 'Página ' + page.numero) + '.<br><br>“' + esc(page.texto) + '”<br><br>Trecho sintético mostrado na prévia. Nenhum documento externo é aberto.','Voltar à prévia',()=>{});
    }

    const actions = {
      'material-open-file':openFileChoice,
      'material-open-camera':()=>{cancelTimers();show('camera');},
      'material-open-gallery':()=>{cancelTimers();show('galeria');},
      'material-use-camera-photo':()=>startReading('image','camera'),
      'material-use-gallery-photo':()=>startReading('image','galeria'),
      'material-cancel-picker':()=>{cancelTimers();getState().materialDraft=null;show(confirmed()?'previa':'');},
      'material-cancel-reading':()=>{cancelTimers();getState().materialDraft=null;show(confirmed()?'previa':'');notify('Leitura de exemplo cancelada. Seu objetivo foi preservado.');},
      'material-discard-draft':()=>{cancelTimers();getState().materialDraft=null;show(confirmed()?'previa':'');},
      'material-remove':()=>{
        if(pending.includes(phase(getScenario()))){cancelTimers();getState().materialDraft=null;show(confirmed()?'previa':'');}
        ask('Remover deste pedido?','O material deixa de orientar o próximo pedido. As citações das lições que já foram salvas continuam preservadas.','Remover material',()=>{cancelTimers();clearInput();show('');});
      },
      'material-keep-confirmed':()=>{cancelTimers();getState().materialDraft=null;save();go('pedido');},
      'material-clear-continue':()=>{cancelTimers();clearInput();go('pedido');},
      'material-replace-expired':()=>{cancelTimers();clearInput();show('');openFileChoice();},
      'material-retry-read':()=>startReading(candidate()),
      'material-confirm':()=>{
        const s=getState(), material=clone(candidate());
        const value=phase(getScenario());
        if(pending.includes(value)||['formato-invalido','tamanho-excedido','paginas-excedidas','texto-excedido','csv-invalido','leitura-erro','expirada','permissao','camera-bloqueada'].includes(value))return;
        const problem=validationProblem(material);if(problem){show(problem);return;}
        material.status='ready';material.validUntil=Date.now()+24*60*60*1000;
        material.reference={nome:material.nome,pagina:material.paginas[0].numero,trecho:material.paginas[0].texto,leitura:'demonstracao'};
        s.materialExample=material;s.file=material.nome;s.materialDraft=null;s.materialReferences ||= {};s.materialReferences[material.id]=clone(material.reference);
        cancelTimers();save();go('pedido');notify('Material de exemplo conferido para este objetivo.');
      }
    };
    for (const kind of ['pdf','docx','csv','invalid','large']) actions['material-example-'+kind]=()=>startReading(kind,'arquivo');
    for(let index=0;index<limits.pages;index++)actions['material-citation-'+index]=()=>citation(index);

    return {
      content,
      actions,
      onNavigate:(from)=>{
        if(from!=='material')return;
        const value=phase(getScenario());cancelTimers();
        if(value==='expirada'){clearInput();return;}
        if(pending.includes(value)){getState().materialDraft=null;save();}
      }
    };
  };
}());
