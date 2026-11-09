import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { BC_WHATSAPP_NUMBER } from '../assets/js/bc-public-config.js';

const mobile = fileURLToPath(new URL('.', import.meta.url));
const site = join(mobile, '..');
const output = join(mobile, 'dist');
const officialSite = 'https://www.bcesteticaavancada.com.br';
const bundleOrigin = 'https://bundle.invalid';
const publicPages = [
  'agenda', 'ambiente', 'campanhas', 'clinica', 'contato', 'diamond',
  'equipe', 'mel', 'procedimentos', 'protocolos', 'resultados', 'valores',
];
const rootFiles = [
  'index.html', 'styles.css', 'script.js', 'editorial.css',
  'home-team-hero.css', 'video-campaign.css',
];
const tabs = [
  { path: '/', label: 'Início', icon: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z' },
  { path: '/agenda/', label: 'Agendar', icon: 'M4 6h16v15H4ZM4 10h16M8 3v6m8-6v6' },
  { path: '/campanhas/', label: 'Campanhas', icon: 'm2 9 5-6h10l5 6-10 12Zm0 0h20M7 3l5 18 5-18' },
  { path: '/meus-horarios/', label: 'Meus horários', icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2' },
];

function appPage(path) {
  return path !== '/' && path.endsWith('/') ? `${path}index.html` : path;
}

async function save(relativePath, content) {
  const destination = join(output, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

function prepareAgenda(document) {
  const form = document.querySelector('[data-booking-form]');
  if (!form) return;

  for (const [name, value] of Object.entries({ name: 'Cliente de teste', phone: '31900000000' })) {
    const input = form.querySelector(`[name="${name}"]`);
    input.type = 'hidden';
    input.removeAttribute('autocomplete');
    input.setAttribute('value', value);
    form.append(input);
  }
  form.querySelector('.agenda-contact-grid').remove();
  form.querySelector('.agenda-privacy').textContent = 'Os dados do teste são preenchidos automaticamente e a reserva é salva neste aparelho.';
  const success = document.querySelector('[data-booking-success]');
  success.querySelector('.agenda-step-label').textContent = 'Demonstração';
  success.querySelector('h2').textContent = 'Reserva de teste confirmada.';
  success.querySelector('[data-success-name]').parentElement.innerHTML =
    '<span data-success-name></span>, seu horário de demonstração foi salvo.';
  const confirmationLink = success.querySelector('[data-success-whatsapp]');
  confirmationLink.setAttribute('href', appPage('/meus-horarios/'));
  confirmationLink.removeAttribute('target');
  confirmationLink.removeAttribute('rel');
  confirmationLink.textContent = 'Ver meus horários';
  success.querySelector('.agenda-success__note').textContent = 'Este horário faz parte da agenda de teste.';
  document.querySelector('.agenda-live-badge').textContent = 'Horários de teste';
  document.querySelector('[data-booking-placeholder] small').textContent = 'A demonstração usa dados fictícios.';
  document.querySelector('.agenda-help').textContent = 'Os horários desta demonstração são fictícios e ficam neste aparelho.';

  const notice = document.createElement('p');
  notice.className = 'bc-beta-notice';
  notice.textContent = 'BC Estética Beta · Agenda com horários fictícios.';
  document.querySelector('main').before(notice);
}

function preparePage(html, relativePath) {
  const { document } = parseHTML(html);
  const pageUrl = new URL(relativePath, bundleOrigin);
  const route = pageUrl.pathname.replace(/index\.html$/, '');
  document.documentElement.setAttribute('data-bc-mobile-beta', '');

  document.querySelectorAll('link[rel="manifest"], link[href*="pwa-install"], script[src*="pwa-install"], script[src*="agenda/js/main.js"]')
    .forEach(node => node.remove());
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport.setAttribute('content', `${viewport.getAttribute('content')}, viewport-fit=cover`);
  document.head.insertAdjacentHTML('afterbegin',
    '<meta http-equiv="Content-Security-Policy" content="connect-src \'self\'; form-action \'none\'; base-uri \'none\'; object-src \'none\'">');
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/beta.css">');

  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.getAttribute('href'), pageUrl);
    if (url.origin !== bundleOrigin) continue;
    if (url.pathname.startsWith('/agendamento/')) {
      const isAnamnese = /anamnese/i.test(link.textContent) || url.hash === '#preAnamneseForm';
      link.setAttribute('href', isAnamnese ? `${officialSite}${url.pathname}${url.search}${url.hash}` : appPage('/agenda/'));
      continue;
    }
    if (/^\/(admin|gestao|instalar)\//.test(url.pathname)) {
      link.remove();
      continue;
    }
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      link.setAttribute('href', `${appPage(url.pathname)}${url.search}${url.hash}`);
    }
  }
  for (const node of document.querySelectorAll('[src], [href], [data-src]')) {
    for (const attribute of ['src', 'href', 'data-src']) {
      if (!node.hasAttribute(attribute)) continue;
      const url = new URL(node.getAttribute(attribute), pageUrl);
      if (url.origin === bundleOrigin && /^\/assets\/.+\.(mp4|webm)$/i.test(url.pathname)) {
        node.setAttribute(attribute, `${officialSite}${url.pathname}${url.search}`);
      }
    }
  }

  prepareAgenda(document);
  const tabLinks = tabs.map(({ path, label, icon }) => {
    const current = route === path || (path === '/campanhas/' && (route.startsWith(path) || route === '/diamond/'));
    return `<a class="bc-beta-tab" href="${appPage(path)}"${current ? ' aria-current="page"' : ''}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></svg><span>${label}</span></a>`;
  }).join('');
  document.body.insertAdjacentHTML('afterbegin', '<div class="bc-beta-status-area" aria-hidden="true"></div>');
  document.body.insertAdjacentHTML('beforeend', `<nav class="bc-beta-tabs" aria-label="Menu do app">${tabLinks}</nav><script type="module" src="/beta.js"></script>`);
  return document.toString();
}

async function copyPublicFile(source, relativePath) {
  const content = await readFile(source);
  await save(relativePath, relativePath.endsWith('.html') ? preparePage(content.toString('utf8'), relativePath) : content);
}

async function copyTree(root, relativePath, include) {
  const source = join(root, relativePath);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const child = join(relativePath, entry.name);
    if (entry.isDirectory()) await copyTree(root, child, include);
    else if (entry.isFile() && include(child)) await copyPublicFile(join(root, child), child);
  }
}

await rm(output, { recursive: true, force: true });
for (const relativePath of rootFiles) await copyPublicFile(join(site, relativePath), relativePath);
for (const directory of publicPages) await copyTree(site, directory, path => /\.(html|css|js)$/.test(path));
await copyTree(site, 'assets', path => /\.(webp|png|jpe?g|svg|ico|avif|woff2?)$/i.test(path));
await copyTree(join(mobile, 'web'), '', () => true);
await save('assets/js/bc-public-config.js',
  `export const BC_WHATSAPP_NUMBER = ${JSON.stringify(BC_WHATSAPP_NUMBER)};\nexport const PUBLIC_AGENDA_FUNCTION_URL = '/demo-agenda';\n`);
console.log('Telas públicas da BC e agenda de demonstração preparadas em mobile/dist.');
