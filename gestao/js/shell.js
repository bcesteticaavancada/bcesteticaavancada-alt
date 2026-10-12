const yearTargets = document.querySelectorAll('[data-current-year]');
const currentYear = new Date().getFullYear();
yearTargets.forEach((node) => { node.textContent = String(currentYear); });

const menuToggle = document.getElementById('menuToggle');
const menuDrawer = document.getElementById('gestaoMenu');
const menuBackdrop = document.getElementById('menuBackdrop');
const areaLinks = Array.from(document.querySelectorAll('[data-area-target]'));
const areaPanels = Array.from(document.querySelectorAll('[data-area-panel]'));
const areaContexts = Array.from(document.querySelectorAll('[data-area-context]'));

function setMenuOpen(open) {
  if (!menuToggle || !menuDrawer || !menuBackdrop) return;
  menuDrawer.classList.toggle('is-open', open);
  menuBackdrop.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuDrawer.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('bcg-menu-open', open);
}

function closeMenu() {
  setMenuOpen(false);
}

function selectArea(area, { updateHash = true } = {}) {
  if (!areaLinks.length || !areaPanels.length) return;

  const fallback = areaLinks[0]?.dataset.areaTarget;
  const selected = areaLinks.some((link) => link.dataset.areaTarget === area) ? area : fallback;
  if (!selected) return;

  areaPanels.forEach((panel) => {
    panel.hidden = panel.id !== selected;
  });

  areaContexts.forEach((node) => {
    if (node.dataset.areaContext !== selected) node.hidden = true;
  });

  areaLinks.forEach((link) => {
    if (link.dataset.areaTarget === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if (updateHash && window.location.hash !== `#${selected}`) {
    window.history.replaceState(null, '', `#${selected}`);
  }

  closeMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

menuToggle?.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
});

menuBackdrop?.addEventListener('click', closeMenu);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

areaLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    selectArea(link.dataset.areaTarget);
  });
});

const initialArea = window.location.hash.replace('#', '') || areaLinks[0]?.dataset.areaTarget;
selectArea(initialArea, { updateHash: false });
