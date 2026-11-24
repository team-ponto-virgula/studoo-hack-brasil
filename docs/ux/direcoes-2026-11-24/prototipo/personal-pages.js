/* Propostas locais de perfil e configurações. Não publica conteúdo ou imagens. */
(function () {
  'use strict';
  window.StudooPersonal = function (api) {
    const {getState, save, render, go, ask, notify, icon, btn, title, field, esc, note, actionButtons, row, actionRow, profileAvatar} = api;
    const themes = {idiomas:'Idiomas', matematica:'Matemática', ciencias:'Ciências', programacao:'Programação e tecnologia', negocios:'Negócios e finanças', vestibular:'Vestibular e concursos', historia:'História e sociedade', artes:'Artes e música', saude:'Saúde e bem-estar', culinaria:'Culinária e casa', carreira:'Carreira e produtividade', outros:'Outros'};
    const covers = {
      padrao:['Padrão','#2457dd','#a9caff'], aurora:['Aurora','#5b3fd1','#e46fae'], oceano:['Oceano','#0f5fa8','#2bb3c9'], floresta:['Floresta','#1f6b47','#6fbf73'],
      'por-do-sol':['Pôr do sol','#d9480f','#f6b24a'], noite:['Noite','#0b1b5c','#4b3a9e'], areia:['Areia','#b7791f','#f0d08a'], lavanda:['Lavanda','#7c4dcc','#c6a8f0'],
      menta:['Menta','#0f7c6c','#7fdcc3'], coral:['Coral','#c2410c','#f58f84'], ceu:['Céu','#2a6fdb','#9cd3ff'], cereja:['Cereja','#9d174d','#f472b6'], grafite:['Grafite','#2f3a4f','#6b7a99']
    };
    const profileScenarios = {'perfil-pendente':'pendente','perfil-aprovado':'aprovado','perfil-recusado':'recusado','perfil-retirado':'retirado'};
    let forcedScenarioKey = '';
    const getScenario = () => api.getScenario?.() || '';
    const setScenario = value => {
      if(api.changeScenario)api.changeScenario(value);else{api.setScenario(value);render(true);}
      const main=document.querySelector('.app-main');if(main)main.scrollTop=0;
      document.querySelector('.screen h1')?.focus({preventScroll:true});
    };
    const current = () => getState().tracks?.[getState().activeTrack] || null;
    const received = id => String(id || '').startsWith('recebida-');
    const ownTracks = () => Object.entries(getState().tracks || {}).filter(([id]) => !received(id));
    const statusOf = t => (t.visibility === 'perfil' || t.visibility === 'explorar') && ['pendente','aprovado','recusado'].includes(t.publicationStatus) ? t.publicationStatus : 'fora';
    const appearance = t => ({cover: Object.hasOwn(covers, t?.cover) ? t.cover : 'padrao', tema:Object.hasOwn(themes, t?.tema) ? t.tema : 'programacao'});
    const appearancePreview = (a, cls = '') => {
      const c = covers[a.cover] || covers.padrao;
      return '<div class="personal-cover-preview '+cls+'" data-personal-cover="'+esc(a.cover)+'" style="--cover-from:'+c[1]+';--cover-to:'+c[2]+'" aria-hidden="true"><span></span><span></span><span></span></div>';
    };
    function planDraft() {
      const s = getState(), t = current();
      if (!s.personalPlanDraft || s.personalPlanDraft.trackId !== s.activeTrack) {
        s.personalPlanDraft = {trackId:s.activeTrack, title:s.planTitle || t?.title || '', description:s.planDescription || '', errors:{}, statuses:{}};
      }
      s.personalPlanDraft.errors ||= {};
      s.personalPlanDraft.statuses ||= {};
      return s.personalPlanDraft;
    }
    function updateTrack(id, changes) {
      const s = getState();
      save();
      if (!s.tracks?.[id]) return;
      Object.assign(s.tracks[id], changes);
      if (id === s.activeTrack) {
        if (Object.hasOwn(changes,'title')) s.planTitle = changes.title;
        if (Object.hasOwn(changes,'description')) s.planDescription = changes.description;
        if (Object.hasOwn(changes,'visibility')) s.visibility = changes.visibility;
        if (Object.hasOwn(changes,'publicationStatus')) s.publicationStatus = changes.publicationStatus;
      }
      save();
    }
    function fieldError(key, message) {
      const d = planDraft();
      d.errors[key] = message; d.statuses[key] = '';
      save(); render();
      const id = key === 'title' ? 'plan-title' : key === 'description' ? 'plan-description' : key === 'tema' ? 'personal-theme' : 'personal-cover-padrao';
      document.getElementById(id)?.focus({preventScroll:true});
    }
    function titleError(value) {
      if (/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/u.test(value)) return 'Use letras, números e pontuação simples.';
      if ([...value].length < 3) return 'Use pelo menos 3 caracteres.';
      if ([...value].length > 80) return 'Use até 80 caracteres.';
      return '';
    }
    function descriptionError(value) {
      if ([...value].length > 140) return 'Use até 140 caracteres.';
      if (/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/u.test(value)) return 'Use uma frase com letras, números e pontuação simples.';
      if (/@|:\/\/|\bwww\.|[\p{L}\p{N}-]\.[a-z]{2,}(?:[/:]|\b)/iu.test(value)) return 'Não inclua sites ou endereços de email na descrição.';
      return '';
    }
    function scenarioError(key, scenario) {
      return scenario === {title:'nome-erro',description:'descricao-erro',cover:'capa-erro',tema:'tema-erro'}[key] ? 'Não foi possível salvar. Sua escolha continua aqui; tente novamente.' : '';
    }
    function fieldStatus(key, scenario) {
      const d = planDraft(), error = d.errors[key] || scenarioError(key, scenario);
      const label = {title:'nome',description:'descrição',cover:'capa',tema:'tema'}[key];
      return '<div id="personal-'+key+'-status" class="personal-field-status '+(error?'is-error':'')+'" '+(error?'role="alert"':'role="status"')+'>' +
        (error ? '<p>'+icon('info')+esc(error)+'</p>'+btn('Tentar salvar '+label, 'personal-retry-'+key, 'quiet') : d.statuses[key] ? '<p>'+icon('check')+esc(d.statuses[key])+'</p>' : '') + '</div>';
    }
    function savePlan() {
      const d = planDraft();
      d.title = document.getElementById('plan-title')?.value ?? d.title;
      d.description = document.getElementById('plan-description')?.value ?? d.description;
      const titleValue = d.title.normalize('NFC').replace(/\s+/g,' ').trim(), descriptionValue = d.description.normalize('NFC').replace(/\s+/g,' ').trim();
      d.errors.title = titleError(titleValue); d.errors.description = descriptionError(descriptionValue);
      if (d.errors.title || d.errors.description) {save();render();document.getElementById(d.errors.title?'plan-title':'plan-description')?.focus({preventScroll:true});return;}
      updateTrack(d.trackId, {title:titleValue, description:descriptionValue});
      getState().personalPlanDraft = null;
      go('mapa'); notify('Trilha atualizada no exemplo local.');
    }
    function retryField(key) {
      const d = planDraft();
      if (key === 'title' || key === 'description') {
        const value = (document.getElementById(key==='title'?'plan-title':'plan-description')?.value ?? d[key]).normalize('NFC').replace(/\s+/g,' ').trim();
        const problem = key === 'title' ? titleError(value) : descriptionError(value);
        if (problem) {fieldError(key,problem);return;}
        d[key] = value; d.errors[key] = ''; d.statuses[key] = key==='title'?'Nome salvo no exemplo.':'Descrição salva no exemplo.';
        updateTrack(d.trackId, {[key]:value});
      } else {
        const s=getState(), pending=s.personalAppearanceDraft?.trackId===s.activeTrack?s.personalAppearanceDraft:appearance(current());
        if (!Object.hasOwn(covers,pending.cover) || !Object.hasOwn(themes,pending.tema)) {fieldError(key,'Escolha uma opção da galeria.');return;}
        updateTrack(s.activeTrack, {[key]:key==='cover'&&pending.cover==='padrao'?null:pending[key]}); d.errors[key]='';d.statuses[key]=key==='cover'?'Capa salva no exemplo.':'Tema salvo no exemplo.';
      }
      save();setScenario('');
      document.getElementById(key==='title'?'plan-title':key==='description'?'plan-description':'personal-no-field')?.focus();
      if(key==='cover'||key==='tema')document.querySelector('[data-action="change-cover"]')?.focus();
    }
    function coverScreen(scenario) {
      const s=getState(), d=planDraft();
      if (!s.personalAppearanceDraft || s.personalAppearanceDraft.trackId !== s.activeTrack) s.personalAppearanceDraft = {trackId:s.activeTrack,...appearance(current())};
      const a=s.personalAppearanceDraft;
      const html=title('Capa e tema','Um jeito de reconhecer este estudo.','Confira a prévia. Sua escolha só muda esta trilha.')+
        appearancePreview(a)+ '<p class="personal-preview-label"><strong>'+esc(covers[a.cover]?.[0] || 'Padrão')+'</strong><span>'+esc(themes[a.tema] || themes.programacao)+'</span></p>'+
        '<div><label class="field-label" for="personal-theme">Tema da trilha</label><select id="personal-theme" aria-describedby="personal-tema-status">'+Object.entries(themes).map(([id,label])=>'<option value="'+id+'" '+(a.tema===id?'selected':'')+'>'+label+'</option>').join('')+'</select>'+fieldStatus('tema',scenario)+'</div>'+
        '<div><h2 id="personal-covers-title">Escolha uma capa</h2><div class="personal-cover-grid" role="group" aria-labelledby="personal-covers-title">'+Object.entries(covers).map(([id,c])=>'<button type="button" id="personal-cover-'+id+'" class="personal-cover-choice" data-action="personal-cover-'+id+'" aria-pressed="'+(a.cover===id)+'">'+appearancePreview({cover:id})+'<span>'+esc(c[0])+'</span>'+'<span class="personal-cover-selected" aria-hidden="'+(a.cover!==id)+'">'+(a.cover===id?icon('check')+'Selecionada':'')+'</span>'+'</button>').join('')+'</div>'+fieldStatus('cover',scenario)+'</div>'+
        note('Prévia local. Nenhuma imagem é enviada; o progresso, as respostas e a visibilidade da trilha são preservados.','shield');
      return {html,foot:actionButtons(btn('Usar esta capa e tema','personal-apply-cover'),btn('Cancelar escolha','personal-cancel-cover','quiet'))};
    }
    function configuration(scenario) {
      const s=getState();
      if (!current()) return {html:title('Sua trilha','Escolha um estudo primeiro.','Você pode criar uma trilha ou abrir uma que já está com você.'),foot:actionButtons(btn('Voltar aos meus estudos','go:inicio'),btn('Criar uma trilha','go:pedido','quiet'))};
      if (scenario === 'capa' || scenario === 'capa-erro' || scenario === 'tema-erro') return coverScreen(scenario);
      const d=planDraft(), a=appearance(current()), titleProblem=d.errors.title || scenarioError('title',scenario), descriptionProblem=d.errors.description || scenarioError('description',scenario);
      const html=title('Sua trilha','Organize este estudo.','Ajuste como você reconhece a trilha.')+
        '<div><label class="field-label" for="plan-title">Nome da trilha</label><input class="field" id="plan-title" value="'+esc(d.title)+'" maxlength="80" aria-describedby="personal-title-help personal-title-status" '+(titleProblem?'aria-invalid="true"':'')+'><p id="personal-title-help" class="flow-description">De 3 a 80 caracteres.</p>'+fieldStatus('title',scenario)+'</div>'+
        '<div><label class="field-label" for="plan-description">Descrição</label><textarea class="textarea" id="plan-description" maxlength="140" aria-describedby="personal-description-help personal-description-status" '+(descriptionProblem?'aria-invalid="true"':'')+'>'+esc(d.description)+'</textarea><p id="personal-description-help" class="flow-description">Uma frase opcional, até 140 caracteres. Sem sites ou email.</p>'+fieldStatus('description',scenario)+'</div><div id="form-message" role="alert"></div>'+
        '<div class="personal-current-cover">'+appearancePreview(a)+'<div><strong>'+esc(covers[a.cover][0])+'</strong><span>'+esc(themes[a.tema])+'</span></div></div>'+
        '<div class="list">'+actionRow('Capa e tema','Confira e personalize esta trilha','image','change-cover')+(received(s.activeTrack)?note('Esta é uma cópia recebida. Você pode estudar e personalizar sua cópia, mas não compartilhá-la novamente.','shield'):row('Compartilhar','Escolha a visibilidade','link','compartilhar'))+actionRow('Apagar trilha','Remove sua cópia e o acesso a ela','trash','delete-plan','danger')+'</div>';
      return {html,foot:actionButtons(btn('Salvar alterações','save-plan'),btn('Cancelar','personal-cancel-plan','quiet'))};
    }
    const materialDisclosure = t => t.deMaterial || t.materialReference ? ' Esta trilha veio de um material. Trechos citados, páginas e o título podem aparecer no perfil. O arquivo bruto e as fotos não vão. Confira o título antes de postar.' : '';
    function profileStatusCard(id,t,status) {
      const names={fora:'Só nos seus estudos',pendente:'Em revisão',aprovado:t.visibility==='explorar'?'No perfil e no Explorar':'No perfil',recusado:'Não publicada',retirado:'Fora do perfil'};
      const details={fora:'Postar permite que outras pessoas descubram esta trilha.',pendente:'Só você vê enquanto a revisão não termina.',aprovado:'Aprovação de exemplo. Nenhum conteúdo foi publicado.',recusado:'A publicação não foi aprovada. Sua cópia foi preservada.',retirado:'A trilha continua nos seus estudos.'};
      return '<article class="personal-post-card"><h2>'+esc(t.title)+'</h2><p class="personal-post-status" role="status">'+icon(status==='aprovado'?'check':'shield')+'<strong>'+esc(names[status] || names.fora)+'</strong></p><p>'+esc(details[status] || details.fora)+'</p>'+(materialDisclosure(t)?'<p class="personal-material-notice">'+icon('paper')+'<span>'+esc(materialDisclosure(t).trim())+'</span></p>':'')+btn(status==='fora'||status==='retirado'||status==='recusado'?'Postar no perfil':'Tirar do perfil','personal-'+(status==='fora'||status==='retirado'||status==='recusado'?'post':'unpost'),'secondary','data-personal-track="'+esc(id)+'"')+'</article>';
    }
    function posting(scenario) {
      const s=getState(), rows=ownTracks(), forced=profileScenarios[scenario];
      if (forced && rows.length) {
        const id=rows[0][0], key=scenario+'|'+id;
        if (forcedScenarioKey !== key) {
          forcedScenarioKey = key;
          updateTrack(id,{visibility:forced==='retirado'?'link':'perfil',publicationStatus:forced==='retirado'?'aprovado':forced});
          s.personalPostUndo=null;save();
        }
      }
      const html=title('Postar no perfil','Escolha o que quer compartilhar.','Só as trilhas escolhidas aparecem no seu perfil, depois da aprovação.')+
        note('Postar compartilha a trilha, não suas respostas, progresso, explicações ou email. Neste protótipo, a solicitação e a moderação são exemplos locais.','shield')+
        (forced?'<div class="note"><span>Estado de moderação simulado: '+esc({pendente:'em revisão',aprovado:'aprovado',recusado:'recusado',retirado:'fora do perfil'}[forced])+'. Nenhuma publicação real.</span></div>':'')+
        (rows.length?'<div class="stack">'+rows.map(([id,t],i)=>profileStatusCard(id,t,i===0&&forced?forced:statusOf(t))).join('')+'</div>':'<div class="empty"><h2>Uma trilha sua pode abrir caminhos.</h2><p>Crie uma trilha para escolher se quer postá-la aqui. Cópias recebidas continuam privadas nos seus estudos.</p>'+btn('Criar uma trilha','go:pedido','secondary')+'</div>')+
        (s.personalPostUndo?'<div class="note"><span>A trilha saiu do perfil neste exemplo. Sua cópia e o estado do link foram preservados.</span></div>'+btn('Desfazer retirada','personal-undo-unpost','secondary'):'')+
        btn('Regras da comunidade','social-rules','quiet');
      return {html,foot:actionButtons(btn('Voltar ao meu perfil','personal-back-profile'))};
    }
    function profile(scenario) {
      if (scenario === 'postar' || Object.hasOwn(profileScenarios,scenario)) return posting(scenario);
      const s=getState(), socialEnabled=scenario!=='sem-social', activity=scenario==='novidades', fixtureTrack=ownTracks()[0];
      if(activity&&fixtureTrack){
        const key='novidades|'+fixtureTrack[0];
        if(forcedScenarioKey!==key){forcedScenarioKey=key;updateTrack(fixtureTrack[0],{visibility:'perfil',publicationStatus:'aprovado'});s.personalPostUndo=null;save();}
      }
      const activeTracks=Object.entries(s.tracks || {}), publicTracks=activeTracks.filter(([id,t])=>!received(id)&&statusOf(t)==='aprovado');
      const html='<div class="profile-cover" data-hue="'+esc(s.profileHue || 'azul')+'"></div><div class="profile-head covered">'+profileAvatar()+'<div><h1 tabindex="-1">'+esc(s.name)+'</h1><p class="muted">Seu espaço de aprender.</p></div></div><p>'+esc(s.summary)+'</p><div class="chips">'+(s.interests || []).map(x=>'<span class="tag">'+esc(api.themeLabel?.(x)||(Object.hasOwn(themes,x)?themes[x]:x))+'</span>').join('')+'</div>'+btn('Editar meu perfil','go:editar','secondary')+
        '<div class="stats"><div class="metric"><strong>'+activeTracks.length+'</strong><span>trilhas no exemplo</span></div><div class="metric"><strong>'+activeTracks.reduce((n,[,t])=>n+(Number(t.completed)||0),0)+'</strong><span>lições concluídas</span></div><div class="metric"><strong>'+publicTracks.length+'</strong><span>trilhas públicas</span></div></div>'+
        (socialEnabled?'<section class="personal-profile-section" aria-labelledby="personal-news-title"><div class="section-title"><h2 id="personal-news-title">Suas novidades</h2></div>'+(activity?note('Atividade de exemplo para conferir este estado. Não representa uso real ou alcance obtido pelo protótipo.','info')+'<div class="list"><div class="row"><span class="row-icon">'+icon('book')+'</span><div class="row-content"><strong>Lia começou uma trilha sua.</strong><small>'+esc(fixtureTrack?.[1]?.title || 'Trilha de exemplo')+' · evento de exemplo</small></div></div><div class="row"><span class="row-icon">'+icon('heart')+'</span><div class="row-content"><strong>Sua explicação abriu um caminho.</strong><small>'+esc(fixtureTrack?.[1]?.title || 'Trilha de exemplo')+' · valeu de exemplo</small></div></div></div><div class="personal-reach" aria-label="Alcance de exemplo"><strong>1 pessoa começou · 1 valeu</strong><span>Dados sintéticos desta variação.</span></div>':note('Quando alguém começar ou agradecer uma trilha sua, as novidades aparecem aqui.','leaf'))+'</section><section class="personal-profile-section" aria-labelledby="personal-shared-title"><div class="section-title"><h2 id="personal-shared-title">No seu perfil</h2></div>'+(publicTracks.length?'<div class="list">'+publicTracks.map(([id,t])=>'<button class="row" data-track="'+esc(id)+'"><span class="row-icon">'+icon('book')+'</span><span class="row-content"><strong>'+esc(t.title)+'</strong><small>Publicação aprovada no exemplo local</small></span>'+icon('next')+'</button>').join('')+'</div>':'<p class="muted">Nenhuma trilha aprovada por aqui. Você escolhe o que quer mostrar.</p>')+btn('Postar no perfil','personal-open-posting','secondary')+'</section>':note('Nesta variação, a comunidade está indisponível. Seus estudos, edição de perfil e preferências continuam acessíveis.','info'))+
        '<div class="list">'+row('Privacidade','Você controla seus dados','shield','privacidade')+row('Preferências','Som e movimento','settings','preferencias')+'</div>';
      return {html,foot:'',active:'perfil'};
    }
    function unpost(id) {
      const s=getState(), t=s.tracks?.[id];if(!t)return;
      ask(t.visibility==='explorar'?'Tirar do perfil e do Explorar?':'Tirar do perfil?', 'Sua trilha e o progresso continuam nos seus estudos. A configuração de compartilhamento volta para “Só com o link”; o estado de moderação não é alterado.', 'Tirar do perfil', ()=>{
        s.personalPostUndo={id,before:{visibility:t.visibility,publicationStatus:t.publicationStatus || ''}};
        updateTrack(id,{visibility:'link'});setScenario('postar');notify('Trilha retirada do perfil no exemplo. Você pode desfazer.');
      });
    }
    const actions={
      'save-plan':savePlan,
      'change-cover':()=>{getState().personalAppearanceDraft={trackId:getState().activeTrack,...appearance(current())};save();setScenario('capa');},
      'personal-apply-cover':()=>{
        const s=getState(), a=s.personalAppearanceDraft;
        if(!a || a.trackId!==s.activeTrack || !Object.hasOwn(covers,a.cover) || !Object.hasOwn(themes,a.tema)){fieldError('cover','Escolha uma capa e um tema antes de salvar.');return;}
        updateTrack(a.trackId,{cover:a.cover==='padrao'?null:a.cover,tema:a.tema});s.personalAppearanceDraft=null;const d=planDraft();d.errors.cover='';d.errors.tema='';d.statuses.cover='Capa salva no exemplo.';d.statuses.tema='Tema salvo no exemplo.';save();setScenario('');document.querySelector('[data-action="change-cover"]')?.focus();notify('Capa e tema salvos apenas nesta trilha.');
      },
      'personal-cancel-cover':()=>{getState().personalAppearanceDraft=null;save();setScenario('');document.querySelector('[data-action="change-cover"]')?.focus();},
      'personal-cancel-plan':()=>{getState().personalPlanDraft=null;getState().personalAppearanceDraft=null;save();go('mapa');},
      'personal-open-posting':()=>setScenario('postar'),
      'personal-back-profile':()=>setScenario(''),
      'personal-undo-unpost':()=>{const s=getState(), undo=s.personalPostUndo;if(!undo || !s.tracks?.[undo.id]){s.personalPostUndo=null;save();render();return;}updateTrack(undo.id,undo.before);s.personalPostUndo=null;save();setScenario('postar');notify('Visibilidade anterior restaurada no exemplo.');}
    };
    Object.keys(covers).forEach(id=>{actions['personal-cover-'+id]=()=>{const s=getState();s.personalAppearanceDraft ||= {trackId:s.activeTrack,...appearance(current())};s.personalAppearanceDraft.cover=id;planDraft().errors.cover='';save();render();};});
    ['title','description','cover','tema'].forEach(key=>{actions['personal-retry-'+key]=()=>retryField(key);});
    actions['personal-post'] = element => {
      const id=element.dataset.personalTrack,s=getState(),t=s.tracks?.[id];if(s.isGuest){go('entrar');return;}if(!t || received(id))return;
      if(!String(s.name || '').trim()){notify('Escolha um nome para seu perfil antes de postar.');go('editar');return;}
      ask('Postar esta trilha no seu perfil?', 'A trilha poderá aparecer depois da aprovação. Respostas, progresso, explicações e email não serão compartilhados.'+materialDisclosure(t)+' Esta solicitação é somente um exemplo local.', 'Confirmar postagem de exemplo', ()=>{if(getState().isGuest)return;updateTrack(id,{visibility:'perfil',publicationStatus:'pendente'});s.personalPostUndo=null;setScenario('postar');notify('Postagem de exemplo em revisão. Ainda não está pública.');});
    };
    actions['personal-unpost'] = element => unpost(element.dataset.personalTrack);
    return {
      content(page,scenario){if(page==='perfil'&&getState().isGuest)return null;if(page!=='perfil'||(!Object.hasOwn(profileScenarios,scenario)&&scenario!=='novidades'))forcedScenarioKey='';return page==='configurar'?configuration(scenario):page==='perfil'?profile(scenario):null;}, actions,
      onInput(event){if(api.getPage?.()!=='configurar')return;const key={'plan-title':'title','plan-description':'description'}[event.target.id];if(key){const d=planDraft();d[key]=event.target.value;d.errors[key]='';d.statuses[key]='';save();}},
      onChange(event){if(event.target.id==='personal-theme' && getState().personalAppearanceDraft){getState().personalAppearanceDraft.tema=event.target.value;planDraft().errors.tema='';save();render();}},
      onNavigate(from,dest){if(dest!=='configurar'&&getState().personalAppearanceDraft){getState().personalAppearanceDraft=null;save();}},
      appearance:()=>appearance(current()),appearancePreview,
      scenarios:{perfil:['sem-social','novidades','postar','perfil-pendente','perfil-aprovado','perfil-recusado','perfil-retirado'],configurar:['capa','nome-erro','descricao-erro','capa-erro','tema-erro']}
    };
  };
}());
