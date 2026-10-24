import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=dirname(fileURLToPath(import.meta.url));
function html(path){return readFileSync(resolve(dir,'../../gestao',path),'utf8');}
for(const [label,file] of [['administração','admin/index.html'],['colaboradora','colaborador/index.html'],['criação','criacao/index.html']]){
 test('Acesso à Maya aparece apenas dentro do painel interno: '+label,()=>{
  const source=html(file);
  assert.match(source,/id="gestaoApp"[^>]*hidden/);
  assert.match(source,/<nav[^>]*>[\s\S]*?<a href="\.\.\/maya-beta\/" data-maya-beta-link>Maya Beta \(uso interno\)<\/a><\/nav>/);
  assert.equal((source.match(/data-maya-beta-link/g)||[]).length,1);
  assert.ok(source.indexOf('id="gestaoApp"')<source.indexOf('data-maya-beta-link'));
  assert.ok(source.indexOf('data-maya-beta-link')<source.indexOf('</nav>'));
  assert.ok(!source.includes('data-area-target="maya-beta"'), 'Não adicionar a Maya ao seletor de abas de gestão');
 });
}
test('Maya segue separada do menu público e continua com seu próprio controle de sessão',()=>{
 const src=html('maya-beta/index.html');
 assert.match(src,/await getCurrentProfile\(client\)/);
 assert.match(src,/installSessionGuard/);
 assert.match(src,/noindex,nofollow,noarchive/);
});
