import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

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
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror',e => errors.push(e.message));
        await page.goto(root+'/campanhas/',{waitUntil:'networkidle'});
        await page.getByRole('link',{name:'Conhecer a campanha de 1 ano',exact:false}).click();
        await page.waitForURL('**/campanhas/aniversario-1-ano/');
        assert.match(await page.locator('h1').innerText(),/Super Aniversário\s+de 1 ano\./);
        assert.equal(await page.locator('[data-vip-join]').count(),2);
        for (const button of await page.locator('[data-vip-join]').all()) assert.equal(await button.isDisabled(),true);
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
      await context.route('**/campanhas/vip-config.js',route => route.fulfill({contentType:'text/javascript',body:'export const VIP_GROUP_INVITE_URL = "https://chat.whatsapp.com/ExemploFicticioGrupo123";'}));
      const page = await context.newPage();
      await page.goto(root+'/campanhas/aniversario-1-ano/',{waitUntil:'networkidle'});
      assert.equal(await page.locator('[data-vip-link]').count(),2);
      assert.equal(await page.locator('[data-vip-link]').first().getAttribute('href'),'https://chat.whatsapp.com/ExemploFicticioGrupo123');
      assert.equal(await page.locator('[data-vip-pending]').isVisible(),false);
      await page.screenshot({path:'test-results/campaigns/'+engine+'-vip-ficticio.png',fullPage:true});
      await context.close();
      console.log('PASS campaigns '+engine+'/synthetic-invite-without-navigation');
    } finally { await browser.close(); }
  }
} finally { server.close(); }
