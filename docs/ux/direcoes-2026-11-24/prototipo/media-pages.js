(function () {
  'use strict';

  // Subfluxos locais da bancada. Nenhuma imagem ou código é enviado a um servidor.
  window.StudooMedia = function (api) {
    const exampleLink = 'https://studoo.example.test/t/sql-exemplo';
    const e = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const footer = (primary, secondary) => '<div class="bottom-actions">' + primary + (secondary || '') + '</div>';
    let editingPhoto = false;
    let draftPhoto = null;
    let draftZoom = 1;
    let draftShape = 'circle';
    let photoLoading = false;
    let photoError = '';
    let photoLoadToken = 0;
    let codeSvg = '';

    function photoVisible() {
      return !!document.querySelector('.screen[data-page="foto"]');
    }

    function photoFocusIsLost() {
      const active = document.activeElement;
      return !active || active === document.body || active === document.documentElement || active.id === 'media-photo-file';
    }

    function renderPhotoFileResult(token) {
      if (token !== photoLoadToken || !editingPhoto || !photoVisible()) return;
      const recoverFocus = photoFocusIsLost();
      api.render(false);
      // Replacing the hidden file input must not send the next Tab to the header.
      // Keep a focus restored by the renderer, or a control chosen during decoding.
      if (!recoverFocus || token !== photoLoadToken || !editingPhoto || !photoVisible() || !photoFocusIsLost() || !document.hasFocus()) return;
      const chooser = document.querySelector('[data-action="media-photo-choose"]:not(:disabled)');
      const zoom = document.getElementById('media-photo-zoom');
      const target = chooser || (zoom && !zoom.disabled ? zoom : null);
      target?.focus({ preventScroll: true });
    }

    function beginPhoto() {
      const state = api.getState();
      const draft = state.profileDraft || {};
      draftPhoto = Object.prototype.hasOwnProperty.call(draft, 'photo') ? draft.photo : (state.photo || null);
      draftZoom = clampZoom(draft.photoZoom == null ? state.photoZoom : draft.photoZoom);
      draftShape = (draft.photoShape || state.photoShape) === 'rounded' ? 'rounded' : 'circle';
      photoLoading = false;
      photoError = '';
      photoLoadToken += 1;
      editingPhoto = true;
    }

    function clampZoom(value) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(2.5, Math.max(1, n)) : 1;
    }

    function photo() {
      if (!editingPhoto || !photoVisible()) beginPhoto();
      const state = api.getState();
      const name = state.profileDraft && state.profileDraft.name || state.name || 'N';
      const initial = Array.from(name.trim())[0] || 'N';
      const percentage = Math.round(draftZoom * 100);
      const disabled = !draftPhoto || photoLoading ? 'disabled' : '';
      const preview = draftPhoto
        ? '<img class="media-photo-image" src="' + e(draftPhoto) + '" alt="Prévia da foto escolhida" style="transform:scale(' + draftZoom + ')">'
        : '<span class="media-photo-initial" aria-label="Avatar com a inicial ' + e(initial) + '">' + e(initial) + '</span>';
      const html = api.title('Foto do perfil', 'Encontre o seu enquadramento.', 'Escolha uma imagem e confira como ela aparece no perfil.') +
        '<div class="media-photo-editor">' +
          '<div class="media-photo-surface" data-shape="' + draftShape + '">' + preview + '</div>' +
          '<p class="flow-description media-photo-caption">Prévia local. Nenhuma imagem é enviada.</p>' +
          '<div id="media-photo-message" role="status" aria-live="polite">' + (photoLoading ? 'Abrindo a imagem…' : '') + '</div>' +
        '</div>' +
        '<div class="media-photo-source-actions">' +
          api.btn(api.icon('image') + 'Escolher imagem', 'media-photo-choose', 'secondary', photoLoading ? 'disabled' : '') +
          api.btn('Usar imagem de exemplo', 'media-photo-example', 'quiet', photoLoading ? 'disabled' : '') +
        '</div>' +
        '<input type="file" id="media-photo-file" accept="image/png,image/jpeg,image/webp" aria-label="Escolher imagem do perfil" hidden>' +
        '<div class="media-zoom-controls"><div class="media-control-label"><label class="field-label" for="media-photo-zoom">Aproximar imagem</label><output id="media-photo-zoom-value" for="media-photo-zoom">' + percentage + '%</output></div>' +
          '<div class="media-zoom-row">' + api.btn('−', 'media-photo-decrease', 'secondary media-zoom-button', 'aria-label="Diminuir aproximação" ' + disabled) +
          '<input class="media-range" id="media-photo-zoom" type="range" min="1" max="2.5" step="0.05" value="' + draftZoom + '" aria-valuetext="' + percentage + ' por cento" ' + disabled + '>' +
          api.btn('+', 'media-photo-increase', 'secondary media-zoom-button', 'aria-label="Aumentar aproximação" ' + disabled) + '</div></div>' +
        '<fieldset class="media-shape-options"><legend class="field-label">Formato da prévia</legend><div class="media-shape-grid">' +
          api.btn('Redonda', 'media-photo-circle', 'secondary', 'aria-pressed="' + (draftShape === 'circle') + '"') +
          api.btn('Cantos suaves', 'media-photo-rounded', 'secondary', 'aria-pressed="' + (draftShape === 'rounded') + '"') +
        '</div></fieldset>' +
        (draftPhoto ? api.btn(api.icon('trash') + 'Remover imagem', 'media-photo-remove', 'quiet danger') : '') +
        '<div id="media-photo-error" role="alert">' + (photoError ? '<p class="form-error">' + e(photoError) + '</p>' : '') + '</div>';
      return {
        html,
        foot: footer(
          api.btn(draftPhoto ? 'Usar esta foto' : 'Usar avatar com inicial', 'media-photo-confirm', 'primary', photoLoading ? 'disabled' : ''),
          api.btn('Cancelar', 'media-photo-cancel', 'quiet')
        )
      };
    }

    function codeBlockReason() {
      const state=api.getState();
      if(state.isGuest || state.sessionActive===false || api.canShareTrack?.()!==true)return 'own';
      if(!['link','perfil','explorar'].includes(state.visibility) || (api.trackUsesMaterial?.()===true && state.visibility==='explorar'))return 'destination';
      const aliases={'publicacao-revisar':'revisar','publicacao-pendente':'pendente','em-revisao':'pendente','publicacao-erro':'erro','publicacao-reprovada':'recusado','publicacao-reprovado':'recusado','reprovado':'recusado','publicacao-recusada':'recusado','publicacao-retirada':'retirado','publicacao-retirado':'retirado','publicacao-aprovada':'aprovado'};
      const scenario=api.getScenario?.() || '';
      const status=aliases[scenario] || (['revisar','pendente','erro','recusado','retirado','aprovado','link-inativo','ja-adicionada'].includes(scenario)?scenario:state.publicationStatus || '');
      return ['revisar','pendente','erro','recusado','retirado','link-inativo','ja-adicionada'].includes(status)?'publication':'';
    }
    function codeUnavailable(reason=codeBlockReason()) {
      const own=reason==='own',destination=reason==='destination';
      return {html:api.title('Código Studoo',own?'Use uma trilha criada por você.':destination?'Confira onde compartilhar.':'Confira o compartilhamento.',own?'Cópias recebidas não oferecem link ou código para republicação.':destination?'Uma trilha criada com material pode ter link ou aparecer no perfil; ela não vai para o Explorar.':'O código fica indisponível enquanto a publicação está em revisão, recusada ou interrompida.'),foot:footer(api.btn(own?'Voltar aos meus estudos':'Conferir compartilhamento',own?'go:inicio':'go:compartilhar'),api.btn('Voltar à trilha','go:mapa','quiet'))};
    }
    function blockCodeAction() {
      const reason=codeBlockReason();if(!reason)return false;
      document.querySelectorAll('.media-share-dialog').forEach(dialog=>{dialog.close();dialog.remove();});
      api.notify(reason==='own'?'Abra uma trilha criada por você para compartilhar.':reason==='destination'?'Escolha link ou perfil para uma trilha criada com material.':'Confira o estado do compartilhamento antes de copiar ou mostrar o código.');
      api.render(false);return true;
    }

    function captureCodeContext() {
      const state=api.getState();
      return {id:state.activeTrack,page:api.getPage?.(),scenario:api.getScenario?.(),destination:state.visibility,status:state.publicationStatus,renderToken:api.getRenderToken?.()};
    }
    function codeContextCurrent(context) {
      if(!context?.renderToken || context.renderToken!==api.getRenderToken?.())return false;
      const state=api.getState();
      return context.id===state.activeTrack && context.page===api.getPage?.() && context.scenario===api.getScenario?.() && context.destination===state.visibility && context.status===state.publicationStatus && !codeBlockReason();
    }

    function makeCode() {
      if(codeBlockReason())return '';
      if (codeSvg) return codeSvg;
      if (typeof window.qrcode !== 'function') return '';
      const code = window.qrcode(0, 'M');
      code.addData(exampleLink, 'Byte');
      code.make();
      // Four-module quiet zone, no logo over the data. Color is Studoo navy on white.
      codeSvg = code.createSvgTag({
        cellSize: 6,
        margin: 24,
        scalable: true,
        title: { text: 'Código QR do link de exemplo', id: 'studoo-example-qr-title' },
        alt: { text: 'Contém https://studoo.example.test/t/sql-exemplo. Este domínio é apenas demonstrativo.', id: 'studoo-example-qr-description' }
      }).replace('fill="black"', 'fill="#142453"').replace('<description ', '<desc ').replace('</description>', '</desc>');
      return codeSvg;
    }

    function code() {
      const blocked=codeBlockReason();if(blocked)return codeUnavailable(blocked);
      const state = api.getState();
      const qr = makeCode();
      const html = api.title('Código Studoo', 'Uma trilha para compartilhar.', 'Mostre o código ou envie o link para apresentar sua trilha.') +
        '<div class="media-code-card"><div class="media-code-brand"><img src="' + e(api.asset('logo.png')) + '" alt="Studoo"><span class="tag">Código de exemplo</span></div>' +
          '<h2>' + e(state.planTitle || 'SQL para a prova') + '</h2>' +
          (qr ? '<div class="media-qr">' + qr + '</div>' : '<div class="feedback incorrect" role="alert"><h3>Prévia indisponível.</h3><p>O link de exemplo continua disponível abaixo.</p></div>') +
          '<p class="media-example-warning">Este código contém uma URL demonstrativa. Ele não abre uma trilha publicada.</p>' +
        '</div>' +
        '<div><label class="field-label" for="media-code-link">Link de exemplo</label><input class="field media-example-link" id="media-code-link" type="text" value="' + exampleLink + '" readonly spellcheck="false" autocomplete="off"></div>' +
        '<div id="media-code-message" class="flow-description" role="status" aria-live="polite"></div>' +
        api.btn(api.icon('link') + 'Opções para compartilhar', 'media-code-share', 'secondary') +
        '<p class="flow-description">Suas respostas e seu progresso não fazem parte do código.</p>';
      return {
        html,
        foot: footer(api.btn('Copiar link de exemplo', 'media-code-copy'), api.btn('Voltar ao compartilhamento', 'media-code-cancel', 'quiet'))
      };
    }

    function updateZoom(value, redraw) {
      if (!draftPhoto || photoLoading) return;
      draftZoom = clampZoom(value);
      if (redraw) {
        api.render(false);
        return;
      }
      const image = document.querySelector('.media-photo-image');
      const range = document.getElementById('media-photo-zoom');
      const valueLabel = document.getElementById('media-photo-zoom-value');
      if (image) image.style.transform = 'scale(' + draftZoom + ')';
      if (range) {
        range.value = String(draftZoom);
        range.setAttribute('aria-valuetext', Math.round(draftZoom * 100) + ' por cento');
      }
      if (valueLabel) valueLabel.textContent = Math.round(draftZoom * 100) + '%';
    }

    async function copyCodeLink(originalContext) {
      const context=originalContext || captureCodeContext();
      if(!codeContextCurrent(context)){if(!originalContext)blockCodeAction();return;}
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('ClipboardUnavailable');
        await navigator.clipboard.writeText(exampleLink);
        if(!codeContextCurrent(context))return;
        const status = document.getElementById('media-code-message');
        if (status) status.textContent = 'Link de exemplo copiado.';
        else api.notify('Link de exemplo copiado.');
      } catch (_) {
        if(!codeContextCurrent(context))return;
        const input = document.getElementById('media-code-link');
        if (input) {
          input.focus();
          input.select();
          input.setSelectionRange(0, input.value.length);
        }
        const status = document.getElementById('media-code-message');
        if (status) status.textContent = 'Selecione e copie o link de exemplo pelo seu navegador.';
        else api.notify('Selecione e copie o link de exemplo pelo seu navegador.');
      }
    }

    function shareCode() {
      const context=captureCodeContext();
      if(!codeContextCurrent(context)){blockCodeAction();return;}
      const dialog = document.createElement('dialog');
      dialog.className = 'dialog media-share-dialog';
      dialog.setAttribute('aria-labelledby', 'media-share-title');
      dialog.innerHTML = '<h2 id="media-share-title">Compartilhar este exemplo</h2><p>A folha do sistema é representada aqui. Nada é enviado automaticamente.</p>' +
        api.btn('Copiar link de exemplo', 'media-share-copy', 'primary') +
        api.btn('Baixar prévia do código', 'media-code-download', 'secondary', makeCode() ? '' : 'disabled') +
        api.btn('Cancelar', 'media-share-cancel', 'quiet');
      const opener = document.activeElement;
      let afterClose = null;
      document.body.appendChild(dialog);
      dialog.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        if(button.dataset.action!=='media-share-cancel' && !codeContextCurrent(context)){dialog.close();return;}
        if (button.dataset.action === 'media-share-copy') {
          afterClose = ()=>copyCodeLink(context);
          dialog.close();
        } else if (button.dataset.action === 'media-code-download') {
          downloadCode(context);
          dialog.close();
        } else if (button.dataset.action === 'media-share-cancel') dialog.close();
      });
      dialog.addEventListener('close', () => {
        dialog.remove();
        if(!codeContextCurrent(context))return;
        if (opener && opener.isConnected) opener.focus();
        if (afterClose) afterClose();
      });
      dialog.showModal();
      dialog.querySelector('[data-action="media-share-cancel"]').focus();
    }

    function downloadCode(originalContext) {
      const context=originalContext || captureCodeContext();
      if(!codeContextCurrent(context)){if(!originalContext)blockCodeAction();return;}
      const svg = makeCode();
      if (!svg) {
        api.notify('A prévia não está disponível. Use o link de exemplo.');
        return;
      }
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'studoo-codigo-exemplo.svg';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if(codeContextCurrent(context))api.notify('Prévia de exemplo preparada para baixar.');
    }

    async function readPhotoFile(event) {
      if (event.target.id !== 'media-photo-file' || !editingPhoto || !photoVisible()) return;
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const token = ++photoLoadToken;
      photoLoading = false;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        photoError = 'Escolha uma imagem PNG, JPEG ou WebP.';
        renderPhotoFileResult(token);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        photoError = 'Use uma imagem de até 2 MB nesta proposta.';
        renderPhotoFileResult(token);
        return;
      }
      photoLoading = true;
      photoError = '';
      api.render(false);
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('ImageReadFailed'));
          reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = data;
        await image.decode();
        if (token !== photoLoadToken || !photoVisible()) return;
        draftPhoto = data;
        draftZoom = 1;
        photoLoading = false;
        renderPhotoFileResult(token);
        api.notify('Imagem pronta para conferir o enquadramento.');
      } catch (_) {
        if (token !== photoLoadToken || !photoVisible()) return;
        photoLoading = false;
        photoError = 'Não foi possível abrir essa imagem. Tente outro arquivo.';
        renderPhotoFileResult(token);
      }
    }

    const actions = {
      'media-photo-choose': () => document.getElementById('media-photo-file')?.click(),
      'media-photo-example': () => { draftPhoto = api.asset('stu-acolhida.webp'); draftZoom = 1; photoError = ''; api.render(false); },
      'media-photo-increase': () => updateZoom(draftZoom + 0.25, true),
      'media-photo-decrease': () => updateZoom(draftZoom - 0.25, true),
      'media-photo-circle': () => { draftShape = 'circle'; api.render(false); },
      'media-photo-rounded': () => { draftShape = 'rounded'; api.render(false); },
      'media-photo-remove': () => { photoLoadToken += 1; photoLoading = false; draftPhoto = null; draftZoom = 1; photoError = ''; api.render(false); },
      'media-photo-cancel': () => { photoLoadToken += 1; editingPhoto = false; api.go('editar'); },
      'media-photo-confirm': () => {
        if (photoLoading) return;
        const state = api.getState();
        state.profileDraft = Object.assign({ name: state.name, summary: state.summary, interests: [...state.interests] }, state.profileDraft || {}, { photo: draftPhoto, photoZoom: draftZoom, photoShape: draftShape });
        if (api.markProfileDirty) api.markProfileDirty();
        api.save();
        editingPhoto = false;
        api.go('editar');
        api.notify('Enquadramento no rascunho. Salve o perfil para aplicar.');
      },
      'media-code-copy': () => copyCodeLink(),
      'media-code-share': () => shareCode(),
      'media-code-download': () => downloadCode(),
      'media-code-cancel': () => api.go('compartilhar')
    };

    return {
      photo,
      code,
      actions,
      onInput: event => {
        if (event.target.id === 'media-photo-zoom') updateZoom(event.target.value, false);
      },
      onChange: readPhotoFile
    };
  };
}());
