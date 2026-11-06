import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { VIP_GROUP_INVITE_URL } from '../campanhas/vip-config.js';

const base = process.cwd();
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png' };
const server = createServer(async (req,res) => {
  try {
    const route = new URL(req.url,'http://localhost').pathname;
    const file = path.resolve(base, '.' + (route.endsWith('/') ? route+'index.html' : route));
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const root = 'http://127.0.0.1:' + server.address().port;
await mkdir('test-results/campaigns',{recursive:true});
try {
  for (const [engine,type] of Object.entries({chromium,webkit})) {
    const browser = await type.launch();
    try {
      for (const width of [320,390,768,1440]) {
        const context = await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
        // Somente arquivos locais: sem pacientes, Supabase, mensagens ou chamadas ao WhatsApp.
        await context.route('**/*',route => route.request().url().startsWith(root+'/') ? route.continue() : route.abort());
        await context.route(/\.supabase\.co\//,route => route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, OPTIONS'},body:JSON.stringify({days:[],slots:[],procedures:[],professionals:[]})}));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror',e => errors.push(e.message));
        await page.goto(root+'/',{waitUntil:'networkidle'});
        const strip=page.locator('.bc-campaign-strip');
        await strip.screenshot({path:'test-results/campaigns/'+engine+'-'+width+'-home-strip.png'});
        await strip.locator('a[data-campaign-banner]').click();
        await page.waitForURL('**/diamond/');
        assert.equal(await page.locator('[data-vip-link]').count(),2);
        assert.equal(await page.locator('.photo img').evaluate(img=>img.complete && img.naturalWidth>0 && img.currentSrc.endsWith('/diamond-casal-original.webp')),true);
        const backdrop = await page.locator('.photo').evaluate(el => {
          const rect = el.getBoundingClientRect();
          const image = el.querySelector('img');
          return { left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            viewportWidth: innerWidth, viewportHeight: innerHeight, position: getComputedStyle(el).position,
            fit: getComputedStyle(image).objectFit, animation: getComputedStyle(image).animationName };
        });
        assert.equal(backdrop.position,'fixed',engine+'/'+width+' full-page photograph');
        assert.equal(backdrop.fit,'cover');
        assert.equal(Math.abs(backdrop.left)<=1 && Math.abs(backdrop.top)<=1,true);
        assert.equal(backdrop.width>=backdrop.viewportWidth-1 && backdrop.height>=backdrop.viewportHeight-1,true);
        assert.equal(backdrop.animation,'none','reduced motion keeps the photograph still');
        assert.equal(await page.getByRole('link',{name:'Compartilhar convite no WhatsApp'}).count(),1);
        await page.screenshot({path:'test-results/campaigns/'+engine+'-'+width+'-diamond.png',fullPage:true});
        const diamondBounds = await page.evaluate(() => ({
          viewport: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowing: [...document.querySelectorAll('body *')].map(el => {
            const bounds = el.getBoundingClientRect();
            return { tag: el.tagName, className: el.className, left: bounds.left, right: bounds.right };
          }).filter(el => el.left < -1 || el.right > innerWidth+1)
        }));
        assert.equal(diamondBounds.scrollWidth <= diamondBounds.viewport+1,true,engine+'/'+width+' Diamond overflow: '+JSON.stringify(diamondBounds));
        await page.goto(root+'/campanhas/',{waitUntil:'networkidle'});
        await page.screenshot({path:'test-results/campaigns/'+engine+'-'+width+'-hub.png'});
        await page.getByRole('link',{name:'Conhecer o Grupo Diamond',exact:false}).click();
        await page.waitForURL('**/diamond/');
        await page.goto(root+'/campanhas/aniversario-1-ano/',{waitUntil:'networkidle'});
        await page.waitForURL('**/campanhas/aniversario-1-ano/');
        assert.match(await page.locator('h1').innerText(),/1 ano\s+Diamond\./);
        assert.equal(await page.locator('[data-vip-link]').count(),2);
        for (const link of await page.locator('[data-vip-link]').all()) assert.equal(await link.getAttribute('href'),VIP_GROUP_INVITE_URL);
        assert.equal(await page.locator('[data-vip-pending]').isVisible(),false);
        assert.equal(await page.locator('a[href^="https://wa.me/5531995184110?text="]').count()>0,true);
        await page.locator('#menuToggle').click();
        assert.equal(await page.locator('.drawer-nav [data-bc-campaigns-link]').count(),1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#siteDrawer').getAttribute('aria-hidden'),'true');
        await page.getByText('O grupo continua depois do aniversário?',{exact:true}).click();
        assert.equal(await page.locator('details[open]').count(),1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),true,engine+'/'+width+' overflow');
        await page.screenshot({path:'test-results/campaigns/'+engine+'-'+width+'.png',fullPage:true});
        assert.deepEqual(errors,[],engine+'/'+width+' errors');
        await context.close();
        console.log('PASS campaigns '+engine+'/'+width);
      }
      const context = await browser.newContext({viewport:{width:390,height:900}});
      await context.route('**/*',route => route.request().url().startsWith(root+'/') ? route.continue() : route.abort());
      await context.route('**/campanhas/vip-config.js*',route => route.fulfill({contentType:'text/javascript',body:'export const VIP_GROUP_INVITE_URL = "https://chat.whatsapp.com/ExemploFicticioGrupo123";'}));
      const page = await context.newPage();
      await page.goto(root+'/campanhas/aniversario-1-ano/',{waitUntil:'networkidle'});
      assert.equal(await page.locator('[data-vip-link]').count(),2);
      assert.equal(await page.locator('[data-vip-link]').first().getAttribute('href'),'https://chat.whatsapp.com/ExemploFicticioGrupo123');
      assert.equal(await page.locator('[data-vip-pending]').isVisible(),false);
      await page.screenshot({path:'test-results/campaigns/'+engine+'-vip-ficticio.png',fullPage:true});
      await context.close();
      console.log('PASS campaigns '+engine+'/synthetic-invite-without-navigation');
      const motion = await browser.newContext({viewport:{width:390,height:900},reducedMotion:'no-preference'});
      await motion.route('**/*',route => route.request().url().startsWith(root+'/') ? route.continue() : route.abort());
      const motionPage = await motion.newPage();
      await motionPage.goto(root+'/diamond/',{waitUntil:'networkidle'});
      assert.notEqual(await motionPage.locator('.photo img').evaluate(el=>getComputedStyle(el).animationName),'none');
      assert.equal(await motionPage.getByRole('checkbox',{name:'Pausar movimento',exact:true}).count(),1);
      await motionPage.locator('label[for="diamond-motion"]').click();
      assert.equal(await motionPage.locator('#diamond-motion').isChecked(),true);
      assert.equal(await motionPage.getByRole('checkbox',{name:'Retomar movimento',exact:true}).count(),1);
      assert.equal(await motionPage.locator('.photo img').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
      await motionPage.locator('label[for="diamond-motion"]').click();
      assert.equal(await motionPage.locator('.photo img').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
      await motion.close();
      console.log('PASS campaigns '+engine+'/motion-and-native-pause');
      const invalid = await browser.newContext({viewport:{width:390,height:900}});
      await invalid.route('**/*',route => route.request().url().startsWith(root+'/') ? route.continue() : route.abort());
      await invalid.route('**/campanhas/vip-config.js*',route => route.fulfill({contentType:'text/javascript',body:'export const VIP_GROUP_INVITE_URL = "https://chat.whatsapp.com.evil.example/invalid";'}));
      const invalidPage = await invalid.newPage();
      await invalidPage.goto(root+'/campanhas/aniversario-1-ano/',{waitUntil:'networkidle'});
      assert.equal(await invalidPage.locator('[data-vip-link]').count(),0);
      assert.equal(await invalidPage.locator('[data-vip-join]').count(),2);
      for (const button of await invalidPage.locator('[data-vip-join]').all()) assert.equal(await button.isDisabled(),true);
      assert.equal(await invalidPage.locator('[data-vip-pending]').isVisible(),true);
      await invalid.close();
      const noJs = await browser.newContext({viewport:{width:390,height:900},javaScriptEnabled:false,reducedMotion:'no-preference'});
      await noJs.route('**/*',route => route.request().url().startsWith(root+'/') ? route.continue() : route.abort());
      const noJsPage = await noJs.newPage();
      await noJsPage.goto(root+'/campanhas/aniversario-1-ano/',{waitUntil:'networkidle'});
      assert.equal(await noJsPage.locator('[data-vip-link]').count(),2);
      for (const link of await noJsPage.locator('[data-vip-link]').all()) assert.equal(await link.getAttribute('href'),VIP_GROUP_INVITE_URL);
      await noJsPage.goto(root+'/diamond/',{waitUntil:'networkidle'});
      assert.equal(await noJsPage.locator('[data-vip-link]').count(),2);
      for (const link of await noJsPage.locator('[data-vip-link]').all()) assert.equal(await link.getAttribute('href'),VIP_GROUP_INVITE_URL);
      assert.equal(await noJsPage.getByRole('link',{name:'Compartilhar convite no WhatsApp'}).count(),1);
      await noJsPage.locator('label[for="diamond-motion"]').click();
      assert.equal(await noJsPage.locator('.photo img').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
      await noJs.close();
      console.log('PASS campaigns '+engine+'/invalid-invite-and-no-javascript');
    } finally { await browser.close(); }
  }
} finally { server.close(); }
