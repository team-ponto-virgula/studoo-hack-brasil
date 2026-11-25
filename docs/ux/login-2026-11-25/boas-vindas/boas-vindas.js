(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const dots = [...document.querySelectorAll('[data-slide]')];
  const next = document.querySelector('#next');
  const label = document.querySelector('#next-label');
  const dialog = document.querySelector('#create-preview');
  let current = 0;

  function show(index) {
    if (index === current || index < 0 || index >= slides.length) return;
    current = index;
    slides.forEach((slide, position) => {
      slide.hidden = position !== current;
      slide.removeAttribute('data-enter');
    });
    slides[current].setAttribute('data-enter', '');
    dots.forEach((dot, position) => {
      if (position === current) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    label.textContent = current === slides.length - 1 ? 'Criar minha conta' : 'Continuar';
    slides[current].querySelector('h1').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  dots.forEach(dot => dot.addEventListener('click', () => show(Number(dot.dataset.slide))));
  next.addEventListener('click', () => {
    if (current < slides.length - 1) show(current + 1);
    else dialog.showModal();
  });
  document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => next.focus({ preventScroll: true }));
})();
