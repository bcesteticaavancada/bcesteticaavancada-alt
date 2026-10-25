import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';

// Real page, controller and shell; fictional RPC boundary, no hosted login/data.
const base=process.cwd();
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const route=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(base,`.${route.endsWith('/')?route+'index.html':route}`);
    if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
    let body=await readFile(file);
    if(route==='/gestao/criacao/')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
await mkdir('test-results/creation',{recursive:true});
try{
  for(const [engine,type] of Object.entries({chromium,webkit})){
    const browser=await type.launch();
    try{
      for(const [device,width,height] of [['phone',320,740],['tablet',768,1024]]){
        const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(`${url}/gestao/criacao/`,{waitUntil:'domcontentloaded'});
        await page.evaluate(async()=>{
          await import('/gestao/js/shell.js');
          const {initCreationPanel}=await import('/gestao/js/creation-panel.js');
          window.calls=[];window.revision=0;window.failQuery=false;
          const client={rpc:async(name,args)=>{
            if(name!=='bc_creation_list')throw new Error(`Unexpected RPC ${name}`);
            window.calls.push({name,...args});
            if(window.failQuery)return {error:{message:'Falha de consulta simulada'}};
            let rows;
            if(args.p_section==='agenda')rows=[{id:'agenda-ficticia',cliente:'Beatriz — demonstração',profissional:'Profissional fictícia',procedimento:'Avaliação de demonstração',inicio:'2026-10-25T12:00:00Z',status:'confirmado',observacoes:`Revisão ${window.revision}`},{id:'agenda-texto',cliente:'Nome fictício muito longo para verificar a leitura no celular e a quebra correta do texto',status:'agendado',observacoes:'<img src=x onerror="window.injected=true">'}];
            else if(args.p_section==='clientes')rows=Array.from({length:args.p_search?55:60},(_,i)=>({id:`cliente-${i}`,nome:`Beatriz fictícia ${i+1}`,telefone:'31000000000'}));
            else if(args.p_section==='equipe')rows=[{user_id:'profissional-ficticia',display_name:'Equipe de demonstração',role:'colaborador',active:true}];
            else rows=[{id:'registro-ficticio',nome:'Registro de demonstração',status:'ativo'}];
            return {data:{rows:rows.slice(args.p_offset,args.p_offset+50),total:rows.length,has_more:rows.length>args.p_offset+50}};
          }};
          document.getElementById('profileName').textContent='Perfil de demonstração';
          document.getElementById('gestaoApp').hidden=false;document.getElementById('authStatus').hidden=true;
          window.panel=await initCreationPanel({client,root:document});
        });
        assert.deepEqual(await page.evaluate(()=>window.calls.map(call=>call.p_section)),['agenda'],'one initial query');
        assert.equal(await page.locator('.bcg-creation-areas').getAttribute('open'),null);
        await page.screenshot({path:`test-results/creation/${engine}-${device}-overview.png`,fullPage:true});
        const shortcut=name=>page.getByRole('navigation',{name:'Consultas principais'}).getByRole('link',{name,exact:true});
        await shortcut('Clientes').click();
        await page.locator('#creationSearch').fill('Beatriz');await page.locator('#creationSearch').press('Enter');
        await page.locator('#creationStatus').filter({hasText:'1–50 de 55'}).waitFor();
        await page.getByRole('button',{name:'Próxima',exact:true}).click();
        await page.locator('#creationStatus').filter({hasText:'51–55 de 55'}).waitFor();
        await shortcut('Equipe').click();await page.getByRole('heading',{name:'Equipe',exact:true}).waitFor();
        await page.goBack();await page.getByRole('heading',{name:'Clientes',exact:true}).waitFor();
        assert.equal(await page.locator('#creationSearch').inputValue(),'Beatriz');
        await page.locator('#creationStatus').filter({hasText:'51–55 de 55'}).waitFor();
        const beforeClear=await page.evaluate(()=>window.calls.length);
        await page.getByRole('button',{name:'Limpar busca',exact:true}).click();
        await page.locator('#creationStatus').filter({hasText:'1–50 de 60'}).waitFor();
        assert.equal(await page.evaluate(()=>window.calls.length),beforeClear+1);
        await page.getByText('Todas as áreas',{exact:true}).click();
        await page.locator('#creationSection').selectOption('produtos');
        await page.getByRole('heading',{name:'Produtos',exact:true}).waitFor();
        assert.equal(new URL(page.url()).hash,'#produtos');
        await page.locator('#menuToggle').click();await page.locator('[data-menu-settings]>summary').click();
        await page.getByRole('link',{name:'Eventos da operação',exact:true}).click();
        await page.getByRole('heading',{name:'Eventos da operação',exact:true}).waitFor();
        assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'),'false');
        await shortcut('Agenda').click();
        await page.locator('#creationList details').first().locator('summary').click();
        await page.evaluate(async()=>{window.revision++;await window.panel.refresh({quiet:true});});
        assert.equal(await page.locator('#creationList details').first().getAttribute('open'),'');
        await page.locator('#creationList').getByText('Revisão 1',{exact:true}).waitFor();
        await page.locator('#creationSearch').fill('Rascunho de busca');
        await page.evaluate(async()=>{
          const {startLiveRefresh}=await import('/gestao/js/live-refresh.js');
          const live=startLiveRefresh({root:document,authorize:async()=>true,tasks:[{scope:()=>document.getElementById('creationWorkspace'),refresh:window.panel.refresh}]});
          window.beforeLive=window.calls.length;await live.refresh();live.stop();
        });
        assert.equal(await page.evaluate(()=>window.calls.length),await page.evaluate(()=>window.beforeLive),'focused search blocks background replacement');
        assert.equal(await page.locator('#creationSearch').inputValue(),'Rascunho de busca');
        await page.getByRole('button',{name:'Limpar busca',exact:true}).click();
        await page.evaluate(()=>window.failQuery=true);await page.getByRole('button',{name:'Atualizar',exact:true}).click();
        await page.locator('#creationStatus').filter({hasText:'Falha de consulta simulada'}).waitFor();
        await page.evaluate(()=>window.failQuery=false);await shortcut('Equipe').click();
        await page.getByRole('heading',{name:'Equipe',exact:true}).waitFor();
        await page.evaluate(()=>{location.hash='financeiro';});
        await page.getByRole('heading',{name:'Agenda geral',exact:true}).waitFor();
        assert.equal(new URL(page.url()).hash,'#agenda');
        assert.equal(await page.evaluate(()=>window.injected),undefined);
        assert.ok(await page.evaluate(()=>window.calls.every(call=>call.name==='bc_creation_list'&&call.p_section!=='financeiro')));
        await page.waitForFunction(()=>document.getElementById('gestaoMenu').getBoundingClientRect().right<=0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${engine}/${device}: no horizontal overflow`);
        assert.deepEqual(errors,[],`${engine}/${device}: no page errors`);
        await page.close();console.log(`PASS ${engine}/${device}: shortcuts, history, filters, pages, details, background refresh, recovery and restricted areas`);
      }
    }finally{await browser.close();}
  }
}finally{server.close();}
