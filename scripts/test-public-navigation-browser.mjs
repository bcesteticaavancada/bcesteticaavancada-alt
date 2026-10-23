import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base=process.cwd();
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const route=new URL(req.url,'http://localhost').pathname;
    const filename=path.resolve(base, '.'+(route.endsWith('/')?route+'index.html':route));
    if(!filename.startsWith(base+path.sep)){res.writeHead(403).end();return;}
    res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');
    res.end(await readFile(filename));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root='http://127.0.0.1:'+server.address().port;
await mkdir('test-results/public-navigation',{recursive:true});
try{
  for(const [engine,browserType] of Object.entries({chromium,webkit})){
    const browser=await browserType.launch();
    try{
      for(const [device,width,height] of [['phone',360,780],['tablet',768,1024]]){
        const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(root+'/',{waitUntil:'domcontentloaded'});
        await page.locator('#menuToggle').click();
        assert.equal(await page.locator('.drawer-nav > .bc-drawer-group').count(),2);
        const booking=page.locator('.drawer-nav > a[data-bc-agendar-link]');
        assert.match(await booking.getAttribute('href'),/\/agenda\/$/);
        assert.equal(await page.locator('.drawer-nav > a').filter({hasText:'Pré-anamnese'}).count(),1);
        assert.equal(await page.locator('.drawer-nav > a').filter({hasText:'Login BC Gestão'}).count(),1);
        await page.locator('.bc-drawer-group > summary').first().click();
        await page.locator('.bc-drawer-submenu a').filter({hasText:'Protocolos'}).click();
        await page.waitForURL('**/protocolos/');
        await page.locator('#menuToggle').click();
        assert.equal(await page.locator('.bc-drawer-group').first().getAttribute('open'),'');
        await page.screenshot({path:'test-results/public-navigation/'+engine+'-'+device+'.png',fullPage:true});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine+'/'+device+' horizontal overflow');
        assert.deepEqual(errors,[],engine+'/'+device+' page errors');
        await page.close();
        console.log('PASS public navigation '+engine+'/'+device);
      }
    }finally{await browser.close();}
  }
}finally{server.close();}
