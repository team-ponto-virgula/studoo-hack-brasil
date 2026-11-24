/* Estados locais de desenho. Não envia denúncias nem publica conteúdo. */
(function () {
  'use strict';
  window.StudooSocial = function (api) {
    const {getState, save, render, go, ask, notify, icon, btn, title} = api;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const reasons = {spam:'Spam ou propaganda', ofensivo:'Conteúdo ofensivo', direitos:'Cópia ou direitos autorais', outro:'Outro motivo'};
    const aliases = {
      'publicacao-revisar':'revisar', 'publicacao-pendente':'pendente', 'em-revisao':'pendente',
      'publicacao-erro':'erro', 'publicacao-reprovada':'recusado', 'publicacao-reprovado':'recusado',
      'reprovado':'recusado', 'publicacao-recusada':'recusado', 'publicacao-retirada':'retirado',
      'publicacao-retirado':'retirado', 'link-inativo':'link-inativo', 'ja-adicionada':'ja-adicionada',
      'publicacao-aprovada':'aprovado'
    };
    const scenarioFor = {revisar:'publicacao-revisar', pendente:'publicacao-pendente', erro:'publicacao-erro', recusado:'publicacao-reprovada', retirado:'publicacao-retirada', aprovado:'publicacao-aprovada'};
    const foot = (primary, secondary = '', third = '') => '<div class="bottom-actions">' + primary + secondary + third + '</div>';
    const note = (text, name = 'shield') => '<div class="publication-note">' + icon(name) + '<p>' + text + '</p></div>';
    const isGuest = () => api.isGuest ? api.isGuest() : getState().isGuest === true;
    function guestShare() {
      return {html:title('Compartilhar trilha', 'Entre para compartilhar.', 'Visitantes podem estudar, adicionar trilhas e denunciar. Para compartilhar sua própria trilha, entre com uma conta.') + note('Nenhum conteúdo foi publicado ou enviado por este protótipo.'), foot:foot(btn('Entrar para compartilhar', 'go:entrar'), btn('Voltar à trilha', 'go:mapa', 'quiet')), status:'visitante', hideLink:true};
    }
    const canShare = () => !isGuest() && getState().sessionActive !== false && api.canShareTrack?.() === true;
    const usesMaterial = () => api.trackUsesMaterial?.() === true;
    const destinationAllowed = value => ['link','perfil','explorar'].includes(value) && !(value === 'explorar' && usesMaterial());
    let reviewContext=null;
    function captureShareContext() {
      const state=getState();
      return {id:state.activeTrack,page:api.getPage?.(),scenario:api.getScenario?.(),destination:state.visibility,status:state.publicationStatus,renderToken:api.getRenderToken?.()};
    }
    function sameShareFields(a,b) {
      return a.id===b.id && a.page===b.page && a.scenario===b.scenario && a.destination===b.destination && a.status===b.status;
    }
    function shareContextCurrent(context,allowInvalidDestination=false) {
      const current=captureShareContext();
      return !!context?.renderToken && context.renderToken===current.renderToken && sameShareFields(context,current) && canShare() && (allowInvalidDestination || destinationAllowed(current.destination));
    }
    function rememberReviewFrame() {
      const expected=captureShareContext();
      // The token is assigned after the renderer installs this new review frame.
      // Bind cancellation to that frame, never to a target observed after closing a dialog.
      queueMicrotask(()=>{const current=captureShareContext();if(current.renderToken && current.renderToken!==expected.renderToken && sameShareFields(expected,current) && current.page==='compartilhar' && publicationState(current.scenario)==='revisar')reviewContext=current;});
    }
    function ownShareUnavailable() {
      if (isGuest() || getState().sessionActive === false) return guestShare();
      return {html:title('Compartilhar trilha','Compartilhe uma trilha criada por você.','Cópias recebidas continuam privadas nos seus estudos.') + note('Você pode estudar e rever esta cópia. Criar uma trilha própria permite preparar um link ou código.'),foot:foot(btn('Voltar aos meus estudos','go:inicio'),btn('Criar minha trilha','go:pedido','quiet')),status:'indisponivel',hideLink:true};
    }
    function invalidDestination() {
      return {html:title('Seu material','Escolha onde compartilhar.','Trilhas criadas a partir de material podem ser compartilhadas por link ou no perfil. Elas não vão para o Explorar.')+visibilityChoices()+sharingNotice(),foot:foot(btn('Escolher só com o link','social-recover-link'),btn('Parar de compartilhar','social-stop-publication','quiet'),btn('Voltar à trilha','go:mapa','quiet')),status:'destino-invalido',hideLink:true};
    }
    function allowPublication() {
      if (!canShare()) {notify('Abra uma trilha criada por você para compartilhar.');render(true);return false;}
      if (!destinationAllowed(getState().visibility)) {notify('Escolha link ou perfil para compartilhar uma trilha criada com material.');render(true);return false;}
      return true;
    }
    function sharingNotice() {
      const s=getState();
      if (!usesMaterial()) return note('Compartilhar leva o conteúdo da trilha. Seu progresso, respostas e explicações pessoais não vão junto.');
      const name=api.trackMaterialName?.() || '';
      const containsFileName=!!name && (s.planTitle || '').toLocaleLowerCase('pt-BR').includes(String(name).toLocaleLowerCase('pt-BR'));
      return note(containsFileName ? 'Vão junto o título, os trechos citados nas lições e as páginas de referência. O título traz o nome do seu arquivo. Arquivo bruto, fotos das páginas, progresso, respostas e explicações pessoais não vão.' : 'Vão junto o título, os trechos citados nas lições e as páginas de referência. Confira o título: ele pode conter o nome do arquivo. Arquivo bruto, fotos das páginas, progresso, respostas e explicações pessoais não vão.');
    }
    function setScenario(value) { if (api.setScenario) api.setScenario(value); }
    function setPublication(status) {
      if (status !== 'retirado' && !allowPublication()) return false;
      getState().publicationStatus = status;
      if(status!=='revisar'){delete getState().publicationBeforeReview;delete getState().publicationReviewTrackId;reviewContext=null;}
      save(); setScenario(scenarioFor[status] || ''); render(true);return true;
    }
    function draft() {
      const s = getState();
      s.reportDraft ||= {targetType:'perfil', targetName:'Lia', reason:'', details:'', stage:'compose'};
      return s.reportDraft;
    }
    function targetText(d) {
      return d.targetType === 'trilha' ? 'Trilha: ' + (d.targetName || getState().previewTitle || 'SQL sem complicação') : 'Perfil de ' + (d.targetName || 'Lia');
    }
    function reportContext(d) {
      return '<div class="report-context">' + icon(d.targetType === 'trilha' ? 'book' : 'user') + '<div><strong>' + esc(targetText(d)) + '</strong><small>Conteúdo de demonstração</small></div></div>';
    }
    function report() {
      const s = getState(), d = draft();
      if (!reasons[d.reason] && d.stage !== 'compose') d.stage = 'compose';
      let html, footer;
      if (d.stage === 'sent') {
        html = title('Segurança', 'Obrigado por avisar.', 'Denúncia de exemplo registrada apenas neste protótipo. Nenhum relato foi enviado à equipe.') +
          '<div class="report-confirmed" role="status">' + icon('check') + '<div><h2>Protocolo local</h2><p class="report-protocol">' + esc(d.protocol) + '</p><p>Guarde este exemplo para acompanhar o fluxo de suporte.</p></div></div>' +
          reportContext(d) + note('O alvo denunciado fica oculto para você neste exemplo. Bloquear a pessoa é uma decisão separada.') +
          '<div class="report-summary"><span class="field-label">Motivo escolhido</span><p>' + esc(reasons[d.reason]) + '</p></div>';
        footer = foot(btn('Voltar ao Explorar', 'go:explorar'), s.blocked ? '' : btn('Bloquear Lia', 'social-block-person', 'quiet'));
      } else if (d.stage === 'review') {
        html = title('Conferir denúncia', 'Está tudo certo?', 'Confira o motivo e o contexto antes de confirmar o exemplo local.') + reportContext(d) +
          '<div class="report-summary"><h2>' + esc(reasons[d.reason]) + '</h2>' + (d.details ? '<p>' + esc(d.details) + '</p>' : '<p class="muted">Sem detalhes adicionais.</p>') + '</div>' +
          note('Esta confirmação demonstra a interação. Não envia dados para a equipe e não remove conteúdo de outras pessoas.');
        footer = foot(btn('Confirmar denúncia de exemplo', 'social-send-report'), btn('Voltar e editar', 'social-edit-report', 'quiet'));
      } else {
        html = title('Segurança', 'Conte o que aconteceu.', d.targetType === 'trilha' ? 'A equipe do Studoo revisa denúncias de trilhas. Escolha o motivo que melhor descreve a situação.' : 'A equipe do Studoo revisa cada denúncia. Escolha o motivo que melhor descreve a situação.') +
          reportContext(d) + '<div class="report-options" role="group" aria-labelledby="report-reason-label"><h2 id="report-reason-label">Qual é o motivo?</h2>' +
          Object.entries(reasons).map(([id, label]) => '<button type="button" id="report-reason-' + id + '" class="report-option" data-action="social-reason-' + id + '" aria-pressed="' + (d.reason === id) + '"><span class="report-option-mark" aria-hidden="true"></span><span>' + label + '</span></button>').join('') + '</div>' +
          '<div><label class="field-label" for="report-details">Quer acrescentar algo? <span class="report-optional">Opcional</span></label><textarea class="textarea report-details" id="report-details" maxlength="500" aria-describedby="report-details-help" placeholder="Conte apenas o que ajuda a entender a situação.">' + esc(d.details) + '</textarea><p id="report-details-help" class="report-helper">Não informe senhas ou dados pessoais. Até 500 caracteres.</p></div>' +
          '<div id="report-error" class="form-error" role="alert"></div>' + note('Protótipo: nenhuma denúncia é enviada a um serviço real.', 'info');
        footer = foot(btn('Revisar denúncia de exemplo', 'social-review-report'), btn('Cancelar', 'social-cancel-report', 'quiet'));
      }
      return {html, foot:footer};
    }
    function reportError(message) {
      const el = document.getElementById('report-error');
      if (el) el.textContent = message;
      document.getElementById('report-reason-spam')?.focus();
    }
    function startReport(type) {
      const s = getState();
      s.reportDraft = {targetType:type, targetName:type === 'trilha' ? (s.previewTitle || s.planTitle || 'SQL sem complicação') : 'Lia', reason:'', details:'', stage:'compose'};
      save(); go('denunciar');
    }
    function visibilityChoices() {
      const s = getState();
      const options = [['link','Só com o link','Apenas quem receber o link.'],['perfil','No meu perfil','Também aparece no seu perfil público.'],['explorar','No Explorar','Pode ser encontrada pela comunidade.']];
      return '<div class="publication-visibility" role="group" aria-labelledby="publication-visibility-title"><h2 id="publication-visibility-title">Quem pode ver</h2>' + options.map(([value, label, detail]) => '<button type="button" class="publication-option" data-action="social-visibility-' + value + '" aria-pressed="' + (s.visibility === value) + '" ' + (value === 'explorar' && usesMaterial() ? 'disabled aria-disabled="true"' : '') + '><span class="report-option-mark" aria-hidden="true"></span><span><strong>' + label + '</strong><small>' + (value === 'explorar' && usesMaterial() ? 'Indisponível para trilhas criadas com material.' : detail) + '</small></span></button>').join('') + '</div>';
    }
    function publicationState(scenario) {
      return aliases[scenario] || (['revisar','pendente','erro','recusado','retirado','aprovado'].includes(scenario) ? scenario : getState().publicationStatus || '');
    }
    function publicationNote(scenario) {
      if (!canShare()) return note('Esta cópia não oferece link nem código para republicação.');
      if (!destinationAllowed(getState().visibility)) return note('Escolha link ou perfil. Esta trilha de material não é publicada no Explorar.');
      const status = publicationState(scenario), s = getState();
      const messages = {
        pendente:['Em revisão','Em revisão pela equipe do Studoo. Por enquanto, só você vê.'],
        erro:['A solicitação não foi confirmada','Sua trilha e suas escolhas continuam aqui. Tente novamente ou revise a publicação.'],
        recusado:['Não publicada','A equipe do Studoo não aprovou esta publicação. Ela continua só com você.'],
        retirado:['Compartilhamento interrompido','A trilha continua nos seus estudos. O link deste exemplo está inativo.'],
        aprovado:['Link de exemplo pronto','Este é um retorno de aprovação simulado. Nenhum conteúdo foi enviado ou publicado.']
      };
      if (messages[status]) return '<div class="publication-status publication-' + status + '" role="status">' + icon(status === 'aprovado' ? 'check' : status === 'erro' ? 'repeat' : 'shield') + '<div><h2>' + messages[status][0] + '</h2><p>' + messages[status][1] + '</p></div></div>';
      return s.visibility === 'perfil' || s.visibility === 'explorar' ? '<p class="publication-rules">Ao publicar, você concorda com as <button type="button" data-action="social-rules">Regras da comunidade</button>.</p>' : '';
    }
    function sharingFooter() {
      if (!canShare()) return ownShareUnavailable().foot;
      if (!destinationAllowed(getState().visibility)) return invalidDestination().foot;
      const s = getState(), status = publicationState(api.getScenario?.());
      if (['pendente','recusado','retirado','erro','revisar'].includes(status)) return publication(api.getScenario?.())?.foot || '';
      return foot(btn(s.visibility === 'link' ? 'Copiar link de exemplo' : 'Revisar publicação de exemplo', s.visibility === 'link' ? 'copy-link' : 'social-review-publication'), btn('Voltar à trilha', 'go:mapa', 'quiet'));
    }
    function publication(scenario) {
      const s = getState(), status = publicationState(scenario);
      if (!['link-inativo','ja-adicionada'].includes(status)) {
        if (!canShare()) return ownShareUnavailable();
        if (!destinationAllowed(s.visibility)) return invalidDestination();
      }
      if (!status) return null;
      let html, footer;
      if (status === 'link-inativo') return {
        html:title('Trilha compartilhada', 'Esta trilha não está disponível agora.', 'O link pode ter sido desativado ou o conteúdo pode estar em revisão.') + note('Você pode procurar outra trilha no Explorar. Nenhuma cópia existente dos seus estudos foi removida.', 'book'),
        foot:foot(btn('Explorar outras trilhas', 'go:explorar'), btn('Voltar', 'back', 'quiet')), status, hideLink:true
      };
      if (status === 'ja-adicionada') return {
        html:title('Já está com você', 'Sua cópia tem um caminho próprio.', 'Esta trilha de exemplo já foi adicionada aos seus estudos.') + '<div class="report-context">' + icon('book') + '<div><strong>' + esc(s.previewTitle || 'SQL sem complicação') + '</strong><small>Seu progresso é separado de quem compartilhou.</small></div></div>' + note('Abrir sua cópia preserva os outros estudos e não substitui seu progresso.'),
        foot:foot(btn('Abrir minha cópia', 'social-open-added'), btn('Voltar ao Explorar', 'go:explorar', 'quiet')), status, hideLink:true
      };
      const plan = '<div class="report-context">' + icon('book') + '<div><strong>' + esc(s.planTitle || 'SQL para a prova') + '</strong><small>Só o conteúdo da trilha. Sem respostas ou progresso pessoal.</small></div></div>';
      if (status === 'revisar') {
        rememberReviewFrame();
        html = title('Conferir compartilhamento', s.visibility === 'link' ? 'Ativar o link do exemplo?' : 'Conferir antes de publicar.', 'Nenhuma publicação acontece sem sua confirmação.') + plan + visibilityChoices() + publicationNote('') + sharingNotice() + note('Este fluxo é local e ilustrativo. Nenhum dado será enviado para a comunidade.');
        footer = foot(btn(s.visibility === 'link' ? 'Ativar link de exemplo' : 'Confirmar publicação de exemplo', 'social-confirm-publication'), btn('Cancelar', 'social-cancel-publication', 'quiet'));
      } else if (status === 'erro') {
        html = title('Compartilhar', 'Vamos tentar de novo?', 'A publicação de exemplo não foi confirmada.') + publicationNote(status) + plan + note('Uma falha não publica seu material nem apaga seus estudos.');
        footer = foot(btn('Tentar publicação de exemplo', 'social-retry-publication'), btn('Revisar minhas escolhas', 'social-review-publication', 'quiet'), btn('Voltar à trilha', 'go:mapa', 'quiet'));
      } else if (status === 'retirado') {
        html = title('Sua trilha', 'Continua só com você.', 'Você pode seguir estudando e decidir compartilhar de novo depois.') + publicationNote(status) + plan;
        footer = foot(btn('Voltar à minha trilha', 'go:mapa'), btn('Compartilhar novamente', 'social-review-publication', 'quiet'));
      } else if (status === 'aprovado') {
        html = title('Compartilhar', 'Uma ideia pronta para circular.', 'Estado de aprovação de exemplo, sem publicação real.') + publicationNote(status) + plan + sharingNotice();
        footer = foot(btn('Copiar link de exemplo', 'copy-link'), btn('Ver Código Studoo', 'show-code', 'quiet'), btn('Parar de compartilhar', 'social-stop-publication', 'quiet'));
      } else {
        html = title('Compartilhar', status === 'recusado' ? 'Esta publicação precisa de revisão.' : 'Sua escolha está em revisão.', 'A prévia abaixo representa o estado de exemplo.') + publicationNote(status) + plan + visibilityChoices() + note('Enquanto não estiver aprovada, esta publicação não oferece link nem código para outras pessoas.');
        footer = status === 'recusado' ? foot(btn('Revisar e tentar de novo', 'social-review-publication'), btn('Falar com o suporte', 'go:ajuda', 'quiet'), btn('Parar de compartilhar', 'social-stop-publication', 'quiet')) : foot(btn('Salvar visibilidade do exemplo', 'social-save-visibility'), btn('Parar de compartilhar', 'social-stop-publication', 'quiet'), btn('Voltar à trilha', 'go:mapa', 'quiet'));
      }
      return {html, foot:footer, status, hideLink:status !== 'aprovado'};
    }
    const actions = {
      'social-start-profile':()=>startReport('perfil'),
      'social-start-trail':()=>startReport('trilha'),
      'social-review-report':()=>{
        const d = draft();
        if (!reasons[d.reason]) { reportError('Escolha um motivo para continuar.'); return; }
        d.stage = 'review'; save(); render(true);
      },
      'social-edit-report':()=>{draft().stage='compose';save();render(true);},
      'social-cancel-report':()=>go(draft().targetType === 'trilha' ? 'previa' : 'publico'),
      'social-send-report':()=>{
        const s=getState(), d=draft();
        if (d.stage !== 'review' || !reasons[d.reason]) {d.stage='compose';save();render(true);return;}
        s.reportExampleCount=(s.reportExampleCount || 0)+1;d.protocol='STU-EXEMPLO-'+String(s.reportExampleCount).padStart(3,'0');d.stage='sent';
        if (d.targetType === 'perfil') s.reportedProfile=true;
        else s.reportedTitles=[...new Set([...(s.reportedTitles || []),d.targetName])];
        save(); render(true); notify('Denúncia local registrada: '+d.protocol+'. Nenhum relato foi enviado.');
      },
      'social-block-person':()=>ask('Bloquear Lia?', 'Você deixa de ver as trilhas e o perfil dessa pessoa, e ela deixa de ver os seus no Studoo. Ela não é avisada. Neste protótipo, o efeito é apenas local.', 'Bloquear', ()=>{const s=getState();s.blocked=true;s.followed=false;save();go('explorar');notify('Pessoa bloqueada no exemplo. Você pode desfazer em Segurança.');}, true),
      'social-rules':()=>ask('Regras da comunidade', 'Sem spam, ofensas ou dados pessoais de outras pessoas. Respeite direitos autorais. Trilhas e textos gerados por IA seguem as mesmas regras.', 'Entendi', ()=>{}),
      'social-review-publication':()=>{if(!allowPublication())return;const s=getState(),current=s.publicationStatus || '';s.publicationBeforeReview=current==='revisar'?(s.publicationBeforeReview || ''):current;s.publicationReviewTrackId=s.activeTrack;setPublication('revisar');},
      'social-cancel-publication':()=>{const context=reviewContext || captureShareContext();if(context.page!=='compartilhar'||publicationState(context.scenario)!=='revisar'||!shareContextCurrent(context,true))return;const s=getState();if(s.publicationReviewTrackId&&s.publicationReviewTrackId!==context.id)return;if(s.publicationStatus==='revisar'&&s.publicationReviewTrackId===context.id){s.publicationStatus=s.publicationBeforeReview || '';delete s.publicationReviewTrackId;delete s.publicationBeforeReview;save();}reviewContext=null;setScenario(scenarioFor[s.publicationStatus] || '');render(true);},
      'social-confirm-publication':()=>{const context=captureShareContext();if(!allowPublication()||!shareContextCurrent(context))return;ask('Confirmar este exemplo?', 'Você verá o retorno local da solicitação. Nenhum conteúdo será publicado nem enviado para uma equipe real.', 'Confirmar exemplo', ()=>{if(!shareContextCurrent(context))return;setPublication(context.destination === 'link' ? 'aprovado' : 'pendente');});},
      'social-retry-publication':()=>{if(!allowPublication())return;setPublication('pendente');},
      'social-save-visibility':()=>{if(!allowPublication())return;save();notify('Visibilidade guardada no exemplo. O estado de revisão não mudou.');},
      'social-recover-link':()=>{if(!canShare()){notify('Abra uma trilha criada por você para compartilhar.');render(true);return;}const s=getState();s.visibility='link';s.publicationStatus='';delete s.publicationBeforeReview;delete s.publicationReviewTrackId;reviewContext=null;save();setScenario('');render(true);notify('Destino alterado para link. Confira antes de compartilhar.');},
      'social-stop-publication':()=>{const context=captureShareContext();if(!shareContextCurrent(context,true))return;ask('Parar de compartilhar?', 'O link de exemplo ficará inativo. A trilha e o progresso continuam nos seus estudos.', 'Parar de compartilhar', ()=>{if(!shareContextCurrent(context,true))return;setPublication('retirado');}, true);},
      'social-open-added':()=>{
        const s=getState(), name=s.previewTitle || 'SQL sem complicação', id='recebida-'+name.toLowerCase().replace(/[^a-z0-9]/g,'-');
        save();s.tracks ||= {};s.tracks[id] ||= {title:name,completed:0,reviewNeeded:[]};
        if (api.activateTrack) api.activateTrack(id);
        else {const t=s.tracks[id];s.activeTrack=id;s.planTitle=t.title;s.completed=t.completed;s.reviewNeeded=[...(t.reviewNeeded || [])];s.lessonIndex=Math.min(t.completed,4);s.selected=null;s.hasPlan=true;save();}
        go('mapa');
      }
    };
    Object.keys(reasons).forEach(reason=>{actions['social-reason-'+reason]=()=>{draft().reason=reason;save();render();};});
    ['link','perfil','explorar'].forEach(value=>{actions['social-visibility-'+value]=()=>{if(!canShare()){notify('Abra uma trilha criada por você para compartilhar.');render(true);return;}if(!destinationAllowed(value)){notify('Trilhas criadas com material não vão para o Explorar. Escolha link ou perfil.');render(true);return;}const s=getState(),wasInvalid=!destinationAllowed(s.visibility);s.visibility=value;if(wasInvalid){s.publicationStatus='';delete s.publicationBeforeReview;delete s.publicationReviewTrackId;setScenario('');}save();render();};});
    return {
      report, publication, publicationNote, sharingFooter, sharingNotice, actions,
      onInput(event) {if(event.target.id==='report-details'){draft().details=event.target.value.slice(0,500);save();}},
      onChange() {},
      isLinkHidden(scenario) {return !canShare() || !destinationAllowed(getState().visibility) || ['revisar','pendente','erro','recusado','retirado','link-inativo','ja-adicionada'].includes(publicationState(scenario));}
    };
  };
}());
