const yearTargets = document.querySelectorAll('[data-current-year]');
const currentYear = new Date().getFullYear();
yearTargets.forEach((node) => { node.textContent = String(currentYear); });

document.querySelectorAll('[data-nav]').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('[data-nav]').forEach((item) => item.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'page');
  });
});
