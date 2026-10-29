import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

// All HTTPS requests are fulfilled locally or aborted. No hosted API, login,
// email, Google authorization or patient record is used by this rehearsal.
const root = process.cwd();
const bases = [
  'https://www.bcesteticaavancada.com.br/',
  'https://bcesteticaavancada.com.br/',
  'https://bcesteticaavancada.github.io/bcesteticaavancada-alt/',
];
const canonical = bases[0];
const api = 'https://tpqsmerlxquyrzrjbogj.supabase.co/functions/v1/public-agenda';
const sdk = `globalThis.domainFixture = {resets:[]};
globalThis.supabase = {createClient:()=>({
  auth:{
    async getSession(){return {data:{session:location.pathname.includes('/maya-beta/')?{user:{id:'domain-test-user'}}:null},error:null};},
    async signOut(){return {error:null};},
    async resetPasswordForEmail(email,options){domainFixture.resets.push({email,...options});return {data:{},error:null};},
    onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}
  },
  from(table){if(table!=='staff_profiles')throw Error('Unexpected table');return {
    select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:{user_id:'domain-test-user',display_name:'Equipe fictícia',role:'colaborador',active:true},error:null};}
  };}
})};`;
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp'};
const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
await mkdir('test-results/custom-domain', {recursive:true});
let passed = 0;

for (const [engine, browserType] of Object.entries({chromium, webkit})) {
  const browser = await browserType.launch();
  try {
    for (const [index, base] of bases.entries()) {
      const site = new URL(base);
      const context = await browser.newContext({viewport:{width:390, height:844}, isMobile:true,
        hasTouch:true, reducedMotion:'reduce', serviceWorkers:'block'});
      const page = await context.newPage();
      const errors = [], missing = [], unexpected = [], bookings = [];
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(15000);
      await page.addInitScript(() => { window.open = () => null; });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@supabase/supabase-js@2')) {
          return route.fulfill({contentType:'text/javascript', body:sdk});
        }
        if (url.href === api) {
          const headers = {'Access-Control-Allow-Origin':site.origin,
            'Access-Control-Allow-Headers':'content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', Vary:'Origin'};
          if (request.method() === 'OPTIONS') return route.fulfill({status:204, headers});
          const body = request.postDataJSON(), month = body.month || today.slice(0,7);
          const date = month === today.slice(0,7) ? today : month + '-20';
          const responses = {
            catalog:{procedures:[{id:'p1',name:'Procedimento fictício',durationMinutes:60}]},
            overview:{month,days:[{date,available:true}]},
            professionals:{professionals:[{id:'test-professional',name:'Profissional fictícia'}]},
            slots:{slots:['09:00','17:30']},
            book:{booking:{id:'domain-test-booking',date:body.date,time:body.time,
              procedureName:'Procedimento fictício',professionalName:'Profissional fictícia'}},
          };
          if (!Object.hasOwn(responses,body.action)) {
            unexpected.push('Unmocked agenda action: ' + body.action);
            return route.fulfill({status:503,headers,json:{error:'Unmocked action'}});
          }
          if (body.action === 'book') bookings.push(body);
          return route.fulfill({headers,json:responses[body.action]});
        }
        if (url.origin === site.origin && url.pathname.startsWith(site.pathname)) {
          if (request.resourceType() === 'media') return route.fulfill({status:204});
          const local = decodeURIComponent(url.pathname.slice(site.pathname.length));
          const filename = path.resolve(root, local.endsWith('/') || !local ? local + 'index.html' : local);
          if (!filename.startsWith(root + path.sep)) return route.fulfill({status:403});
          try { return await route.fulfill({contentType:types[path.extname(filename)] || 'application/octet-stream',body:await readFile(filename)}); }
          catch { missing.push(local); return route.fulfill({status:404,body:'Missing local fixture'}); }
        }
        if (url.hostname === 'www.google.com' && url.pathname === '/maps') {
          return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Mapa fictício</title>'});
        }
        // Optional third-party fonts/images are blocked; executable code and APIs
        // outside the explicit fixtures fail this test as well as being blocked.
        if (!['font','image','media','stylesheet'].includes(request.resourceType())) unexpected.push(url.origin + url.pathname);
        return route.abort();
      });
      try {
        const go = async route => {
          const response = await page.goto(base + route, {waitUntil:'domcontentloaded'});
          assert.equal(response.status(),200,route);
        };
        await go('');
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),canonical);
        await page.locator('#menuToggle').click();
        await page.locator('.bc-drawer-group > summary').first().click();
        await page.locator('.drawer-nav a').filter({hasText:'Protocolos'}).click();
        await page.waitForURL(base + 'protocolos/');
        const pre = page.locator('footer a').filter({hasText:'Pré-avaliação'});
        assert.equal(await pre.getAttribute('href'),base + 'agendamento/');
        await pre.click();
        await page.waitForURL(base + 'agendamento/');
        await page.locator('.agenda-calendar__day.is-available').first().waitFor();
        assert.equal(await page.locator('#preAnamneseForm .step').count(),8);
        await page.getByRole('button',{name:'Próximo mês',exact:true}).click();
        await page.locator('.agenda-calendar__day.is-available').first().click();
        await page.locator('[data-procedure]').selectOption('p1');
        await page.locator('[data-slot="17:30"]').click();
        await page.locator('[name="name"]').fill('Cliente fictícia do domínio');
        await page.locator('[name="phone"]').fill('(31) 90000-0000');
        await page.locator('[data-submit]').click();
        await page.locator('[data-booking-success]:not([hidden])').waitFor();
        assert.equal(bookings.length,1);
        assert.equal(bookings[0].name,'Cliente fictícia do domínio');
        await page.screenshot({path:`test-results/custom-domain/${engine}-${index}-agenda.png`,fullPage:true});

        const manifest = await page.evaluate(async url => {
          const response = await fetch(url); if (!response.ok) throw Error('Manifest unavailable');
          return await response.json();
        },base + 'manifest.webmanifest');
        const start = new URL(manifest.start_url,base + 'manifest.webmanifest');
        assert.equal((manifest.id ? new URL(manifest.id,start.origin) : start).href,base);
        assert.equal(new URL(manifest.scope,base + 'manifest.webmanifest').href,base);
        for (const shortcut of manifest.shortcuts) assert.ok(new URL(shortcut.url,base + 'manifest.webmanifest').href.startsWith(base));
        for (const icon of manifest.icons) {
          const status = await page.evaluate(async url => (await fetch(url)).status,new URL(icon.src,base + 'manifest.webmanifest').href);
          assert.equal(status,200,icon.src);
        }
        await go('instalar/');
        assert.equal(await page.locator('link[rel="manifest"]').evaluate(node => node.href),base + 'manifest.webmanifest');
        assert.ok(await page.locator('#installStatus').isVisible());
        await go('gestao/login/');
        await page.getByRole('link',{name:'Esqueci minha senha'}).click();
        await page.waitForURL(base + 'gestao/recuperar-senha/');
        await page.locator('#recoveryEmail').fill('domain-test@example.invalid');
        await page.locator('#recoverySubmit').click();
        await page.waitForFunction(() => globalThis.domainFixture.resets.length === 1);
        const resets = await page.evaluate(() => globalThis.domainFixture.resets);
        assert.deepEqual(resets,[{email:'domain-test@example.invalid',redirectTo:base + 'gestao/redefinir-senha/'}]);
        assert.match(await page.locator('#recovery-status').innerText(),/Se o e-mail estiver habilitado/);

        await go('gestao/maya-beta/');
        await page.locator('#app:not([hidden])').waitFor();
        assert.equal(await page.locator('#mayaCharacter').getAttribute('data-state'),'ready');
        await page.locator('[data-topic="cadastro"]').click();
        await page.waitForFunction(() => document.querySelector('#chat').textContent.includes('Assunto: Cadastro'));
        for (const route of ['backup/','backup/privacidade/','backup/termos/']) {
          await go(route);
          assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),canonical + route);
        }
        await go('gestao/configurar-drive/');
        await page.waitForFunction(() => document.querySelector('#setupStatus').textContent.includes('Entre no BC Gestão'));
        assert.equal(await page.locator('#confirmFolders').isDisabled(),true);
        const privacy = await page.locator('a').filter({hasText:'Política de Privacidade'}).evaluate(node => node.href);
        assert.equal(privacy,base + 'backup/privacidade/');
        assert.deepEqual(errors,[],'JavaScript errors');
        assert.deepEqual(missing,[],'Missing local assets');
        assert.deepEqual(unexpected,[],'Unexpected external requests (all blocked)');
        passed++;
        console.log(`PASS ${engine} mobile ${base}: menu, footer, synthetic booking, manifest/icons, reset destination, Maya, Drive pages; no live network`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
assert.equal(passed,6);
console.log(`${passed}/6 custom-domain browser scenarios passed; physical devices and hosted integrations remain separate gates.`);
