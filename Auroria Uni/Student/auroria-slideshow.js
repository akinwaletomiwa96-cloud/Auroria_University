/* Standalone presentation enhancement. Does not access application state or backend. */
(() => {
  const root = document.querySelector('.auroria-home .hero');
  if (!root) return;
  const slides = [...root.querySelectorAll('.au-slide')];
  const dots = [...root.querySelectorAll('.hero-dots button')];
  const previous = root.querySelector('.au-prev');
  const next = root.querySelector('.au-next');
  if (!slides.length || !previous || !next || dots.length !== slides.length) return;
  let current = 0;
  let timer;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current));
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
  };
  const stop = () => { if (timer) window.clearInterval(timer); timer = undefined; };
  const start = () => {
    stop();
    if (!reducedMotion.matches && !document.hidden) timer = window.setInterval(() => show(current + 1), 5000);
  };
  const navigate = (index) => { show(index); start(); };
  previous.addEventListener('click', () => navigate(current - 1));
  next.addEventListener('click', () => navigate(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => navigate(i)));
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', (event) => { if (!root.contains(event.relatedTarget)) start(); });
  document.addEventListener('visibilitychange', start);
  reducedMotion.addEventListener?.('change', start);
  start();
})();
