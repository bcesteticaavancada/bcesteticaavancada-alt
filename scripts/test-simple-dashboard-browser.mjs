import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

// Real admin/collaborator forms and shared controller; isolated in-memory API.
// This harness never authenticates against or writes to a hosted database.
const base = process.cwd();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const route = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(base, `.${route.endsWith('/') ? route + 'index.html' : route}`);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (/^\/gestao\/(admin|colaborador)\/$/.test(route)) {
      body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
await mkdir('test-results/agenda', { recursive: true });
try {
 for (const [engine,browserType] of Object.entries({chromium,webkit})){
  const browser=await browserType.launch();
  try{for(const role of ['admin','colaborador'])for(const [device,width,height] of [['phone',320,740],['tablet',768,1024]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${url}/gestao/${role}/`,{waitUntil:'domcontentloaded'});
   await page.evaluate(async role=>{
    await import('/gestao/js/shell.js');const {startStaffDashboard}=await import('/gestao/js/dashboard-boot.js');
    window.testCalls=[];window.financeAvailable=false;window.paid=false;
    const overview=()=>({totals:{income:200,expense:window.paid?60:0,balance:window.paid?140:200},rows:[],pending:window.paid?[]:[{professional_id:'alice',professional_name:'Alice <img src=x onerror="window.injected=true">',amount:60,items:[{id:'i1',amount:60,procedure:'Sessão',client:'Cliente fictícia'}]}],payments:window.paid?[{id:'pay',amount:60,professional_name:'Alice',state:'paid',paid_at:'2026-10-23T12:00:00Z'}]:[],people:[],procedures:[],rules:[],charges:[],charge_issues:[],awaiting_rules:0});
    const client={storage:{from:()=>({})},from(){const q={};for(const m of ['select','eq','order','ilike','or','limit'])q[m]=()=>q;q.then=(yes,no)=>Promise.resolve({data:[],error:null}).then(yes,no);return q;},rpc:async(n,p)=>{
     window.testCalls.push([n,p]);if(n==='bc_finance_overview'||n==='bc_finance_my_summary')return !window.financeAvailable?{data:null,error:{message:'Falha financeira simulada'}}:{data:n==='bc_finance_overview'?overview():{pending_total:0,paid_total:60,awaiting_rules:0,items:[],payments:[{id:'pay',amount:60,state:'paid',paid_at:'2026-10-23T12:00:00Z'}]},error:null};
     if(n==='bc_finance_commission_pay'){window.paid=true;return {data:'pay',error:null};}
     if(n==='bc_staff_directory')return {data:[{user_id:'alice',display_name:'Alice'}],error:null};return {data:[],error:null};
    }};
    document.getElementById('gestaoApp').hidden=false;document.getElementById('authStatus').hidden=true;
    window.dashboard=startStaffDashboard({client,profile:{user_id:role==='admin'?'mel':'alice',role},root:document,authorize:async()=>true});await window.dashboard.ready;
   },role);
   assert.equal(await page.evaluate(()=>window.testCalls.some(([n])=>n.startsWith('bc_finance_'))),false,'lazy financial read');
   await page.locator('#menuToggle').click();await page.getByRole('link',{name:role==='admin'?'Financeiro':'Minha comissão',exact:true}).click();
   const status=page.locator(role==='admin'?'#adminFinanceStatus':'#collaboratorFinanceStatus');await status.filter({hasText:'Falha financeira simulada'}).waitFor();
   await page.locator('#menuToggle').click();await page.getByRole('link',{name:'Agenda',exact:true}).click();await page.locator(role==='admin'?'#adminAgendaList':'#todayAgendaList').getByText(/Nenhum atendimento/).waitFor();
   await page.locator('#menuToggle').click();await page.getByRole('link',{name:'Clientes',exact:true}).click();await page.locator('#clientsList .bcg-empty').waitFor();
   await page.locator('details.bcg-quick-create>summary').filter({hasText:'Novo cliente'}).click();await page.locator('#clientCreateForm [name=nome]').fill('Rascunho preservado');assert.equal(await page.locator('#clientCreateForm [name=cpf]').isVisible(),false);
   await page.evaluate(()=>window.financeAvailable=true);await page.locator('#menuToggle').click();await page.getByRole('link',{name:role==='admin'?'Financeiro':'Minha comissão',exact:true}).click();await page.locator(role==='admin'?'#adminFinanceRefresh':'#collaboratorFinanceRefresh').click();await status.filter({hasText:role==='admin'?'Financeiro atualizado':'Comissão atualizada'}).waitFor();
   assert.equal(await page.evaluate(()=>window.injected),undefined);
   if(role==='admin'){await page.getByRole('button',{name:'Marcar pago',exact:true}).click();await page.getByRole('button',{name:'Confirmar pago',exact:true}).click();await page.locator('#adminFinancePending').getByText('Nenhuma comissão a pagar.').waitFor();assert.equal(await page.evaluate(()=>window.testCalls.filter(([n])=>n==='bc_finance_commission_pay').length),1);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${engine}/${role}/${device}: no horizontal overflow`);
   await page.waitForFunction(()=>document.getElementById('gestaoMenu').getBoundingClientRect().right<=0);
   await page.screenshot({path:`test-results/agenda/${engine}-${role}-simple-${device}.png`,fullPage:true});
   await page.locator('#menuToggle').click();await page.getByRole('link',{name:'Clientes',exact:true}).click();assert.equal(await page.locator('#clientCreateForm [name=nome]').inputValue(),'Rascunho preservado');
   assert.deepEqual(errors,[],`${engine}/${role}/${device}`);await page.evaluate(()=>window.dashboard.destroy());await page.close();console.log(`PASS ${engine}/${role}/${device}: lazy areas, isolated failure, draft, optional fields, own finance/direct payment`);
  }}finally{await browser.close();}
 }
}finally{server.close();}
