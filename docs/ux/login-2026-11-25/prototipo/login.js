'use strict';

// Estudo visual isolado: sem rede, armazenamento ou autenticação real.
const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const email = $('#email');
const password = $('#password');
const primary = $('#continue');
const dialog = $('#preview-dialog');
let step = 'email';
let lastTrigger = null;

function clearError(field) {
  field.removeAttribute('aria-invalid');
  const error = $(`#${field.id}-error`);
  error.textContent = '';
  error.hidden = true;
}

function showError(field, copy) {
  const error = $(`#${field.id}-error`);
  error.textContent = copy;
  error.hidden = false;
  field.setAttribute('aria-invalid', 'true');
  field.focus();
}

function setStep(next, focus = true) {
  step = next;
  document.body.dataset.step = next;
  $('#email-step').hidden = next !== 'email';
  $('#password-step').hidden = next !== 'password';
  email.disabled = next !== 'email';
  password.disabled = next !== 'password';
  primary.textContent = next === 'password' ? 'Entrar' : 'Continuar';
  $('.welcome h1').textContent = next === 'password' ? 'Sua senha.' : 'Olá de novo.';
  $('.welcome-copy p').textContent = next === 'password' ? 'Use a senha da sua conta Studoo.' : 'Entre para continuar aprendendo.';
  $('#other-methods').hidden = next !== 'password';
  $('#chosen-email').textContent = email.value.trim();
  clearError(email);
  clearError(password);
  if (focus) (next === 'email' ? email : password).focus();
}

function showDialog(title, copy, trigger) {
  lastTrigger = trigger;
  $('#dialog-title').textContent = title;
  $('#dialog-copy').textContent = copy;
  dialog.showModal();
  $('#close-dialog').focus();
}

$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (step === 'email') {
    email.value = email.value.trim();
    if (!email.value || !email.validity.valid) {
      showError(email, 'Digite um e-mail válido para continuar.');
      return;
    }
    setStep('password');
    return;
  }
  if (!password.value.trim()) {
    showError(password, 'Digite sua senha para entrar.');
    return;
  }
  password.value = '';
  showDialog('Este é um estudo do login.', 'Nenhum acesso foi enviado. Esta proposta visual não se conecta à sua conta nem guarda os dados digitados.', primary);
});

email.addEventListener('input', () => clearError(email));
password.addEventListener('input', () => clearError(password));
$('#edit-email').addEventListener('click', () => setStep('email'));
$('#other-methods').addEventListener('click', () => setStep('email'));
$('#toggle-password').addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  $('#toggle-password').setAttribute('aria-pressed', String(visible));
  $('#toggle-password').setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
});

const previews = {
  apple: ['Continuar com a Apple', 'O app usa o acesso oficial da Apple quando ele está disponível. Neste estudo, esse botão apenas demonstra a organização da tela.'],
  google: ['Continuar com o Google', 'No app, o acesso abre o navegador do sistema. Este estudo não inicia autenticação nem envia seus dados.'],
  cadastro: ['Criar conta', 'O cadastro continua em uma tela própria. Vamos desenhá-la depois de revisar este login.'],
  recuperar: ['Recuperar acesso', 'A recuperação continua em uma tela própria, aproveitando o e-mail já informado. Esta é uma prévia apenas do login.'],
  visitante: ['Experimentar sem conta', 'No app, seu progresso como visitante fica por 24 horas neste aparelho. Ele não é transferido para uma conta. Aqui você está apenas vendo a proposta de organização.'],
  ajuda: ['Precisa de ajuda?', 'A ajuda e a apresentação do Studoo continuam acessíveis antes do login. O conteúdo deste estudo se limita à composição da tela de acesso.'],
  privacidade: ['Sua privacidade', 'No app, a política completa é pública e pode ser lida antes de entrar. Nenhum dado digitado nesta proposta visual é enviado ou armazenado.'],
};

document.querySelectorAll('[data-screen]').forEach((button) => {
  button.addEventListener('click', () => showDialog(...previews[button.dataset.screen], button));
});
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (lastTrigger) lastTrigger.focus(); });

if (params.get('apple') === '0') $('#apple').hidden = true;
if (params.get('google') === '0') $('#google').hidden = true;
if ($('#apple').hidden && $('#google').hidden) $('#alternatives').hidden = true;
if (params.get('guest') === '0') $('[data-screen="visitante"]').hidden = true;
if (params.get('signup') === '0') $('.signup').hidden = true;
if (params.get('recovery') === '0') $('[data-screen="recuperar"]').hidden = true;
if (params.get('text') === '200') document.documentElement.style.fontSize = '200%';
if (params.get('step') === 'password') {
  email.value = 'ana@exemplo.com';
  setStep('password', false);
} else {
  document.body.dataset.step = 'email';
}
