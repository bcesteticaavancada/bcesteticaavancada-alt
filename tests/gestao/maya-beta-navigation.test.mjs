import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseHTML} from 'linkedom';

const dir=dirname(fileURLToPath(import.meta.url));
function html(path){return readFileSync(resolve(dir,'../../gestao',path),'utf8');}
test('Atalho da Maya é exibido na área autenticada da colaboradora',()=>{
 const source=html('colaborador/index.html');
 assert.match(source,/id="gestaoApp"[^>]*hidden/);
 assert.match(source,/data-maya-beta-link/);
 assert.match(source,/data-maya-entry>Ajuda da Maya/);
});
for(const file of ['admin/index.html','criacao/index.html'])test('Maya tem atalho visível e entrada no menu autenticado de '+file,()=>{
 const {document}=parseHTML(html(file));
 const app=document.querySelector('#gestaoApp');
 assert.equal(app.hidden,true);
 const entry=app.querySelector('[data-maya-entry]'),menu=app.querySelector('[data-maya-beta-link]');
 assert.ok(entry&&menu);
 assert.equal(entry.getAttribute('href'),'../maya-beta/');
 assert.equal(menu.getAttribute('href'),'../maya-beta/');
 assert.match(entry.textContent,/Ajuda da Maya/);
});
test('Maya segue separada do menu público e continua com seu próprio controle de sessão',()=>{
 const src=html('maya-beta/index.html');
 assert.match(src,/await getCurrentProfile\(client\)/);
 assert.match(src,/installSessionGuard/);
 assert.match(src,/noindex,nofollow,noarchive/);
});
