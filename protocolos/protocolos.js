// The complete catalogue remains usable without JavaScript.
(() => {
  const cards = [...document.querySelectorAll('.care-card')];
  const controls = document.querySelector('.care-filters');
  const status = document.querySelector('.filter-status');
  const specificHeading = document.querySelector('.specific-heading');
  if (!cards.length || !controls) return;
  const buttons = [...controls.querySelectorAll('button')];
  controls.hidden = false;
  function filter(category, announce = true) {
    cards.forEach(card => { card.hidden = category !== 'all' && card.dataset.category !== category; });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    specificHeading.hidden = !document.querySelector('.care-grid--specific .care-card:not([hidden])');
    const count = cards.filter(card => !card.hidden).length;
    if (announce) status.textContent = `${count} ${count === 1 ? 'grupo de cuidados disponível' : 'grupos de cuidados disponíveis'}.`;
  }
  buttons.forEach(button => button.addEventListener('click', () => filter(button.dataset.filter)));
  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    const card = target.closest('.care-card');
    if (!card) return;
    filter('all', false);
    const details = target.closest('details');
    if (details) details.open = true;
    requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
  }
  window.addEventListener('hashchange', revealHash);
  revealHash();
})();
