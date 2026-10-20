import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {installSessionGuard} from '../../gestao/js/auth.js';
test('logout from another tab removes private DOM immediately',()=>{
 const {document}=parseHTML('<main id="app"><p>Registro fictício privado</p></main>');let listener,url;
 const client={auth:{onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){}}}};}}};
 installSessionGuard({client,profile:{user_id:'worker',role:'colaborador'},app:document.getElementById('app'),view:{location:{replace(value){url=value;}}}});
 listener('SIGNED_OUT',null);assert.equal(document.getElementById('app').hidden,true);assert.equal(document.getElementById('app').textContent,'');assert.equal(url,'../login/');
});
test('returning active session is denied when server disables the staff profile',async()=>{
 const {document}=parseHTML('<main id="app">Privado fictício</main>');let url;
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{user_id:'worker',role:'colaborador',active:false}};}};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'worker'}}}}),onAuthStateChange(){return {};}},from(){return query;}};
 const guard=installSessionGuard({client,profile:{user_id:'worker',role:'colaborador'},app:document.getElementById('app'),view:{location:{replace(value){url=value;}}}});
 assert.equal(await guard.authorize(),false);assert.equal(document.getElementById('app').textContent,'');assert.equal(url,'../login/');
});
