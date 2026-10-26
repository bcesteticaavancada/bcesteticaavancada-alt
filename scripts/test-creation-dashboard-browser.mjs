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
    if(['/gestao/criacao/','/gestao/admin/'].includes(route))body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
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
        const errors=[],externalSignatureRequests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/https?:\/\/[^/]*(?:gov\.br|iti\.br)/.test(request.url()))externalSignatureRequests.push(request.url());});
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
            else if(args.p_section==='clientes')rows=Array.from({length:args.p_search?55:60},(_,i)=>({id:`c1000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,nome:`Beatriz fictícia ${i+1}`,telefone:'31000000000'}));
            else if(args.p_section==='equipe')rows=[{user_id:'profissional-ficticia',display_name:'Equipe de demonstração',role:'colaborador',active:true}];
            else rows=[{id:'registro-ficticio',nome:'Registro de demonstração',status:'ativo'}];
            return {data:{rows:rows.slice(args.p_offset,args.p_offset+50),total:rows.length,has_more:rows.length>args.p_offset+50}};
          }};
          window.supportCalls=[];window.returnedCopy=false;window.failSupportSave=false;
          const documentId='d1000000-0000-4000-8000-000000000001';
          let saved={nome:'Beatriz fictícia',telefone:'31000000000',email:'',updated_at:'2026-10-25T12:00:00Z'};
          client.functions={invoke:async(name,{body})=>{
            if(name!=='client-support')throw new Error('Unexpected function');
            if(body instanceof FormData){window.supportCalls.push({action:body.get('action'),clientId:body.get('clientId'),documentId:body.get('documentId')});window.returnedCopy=true;return {data:{fileId:documentId}};}
            window.supportCalls.push(body);
            if(body.action==='client_get')return {data:{client:{...saved,id:body.clientId},documents:[{id:documentId,documentId,kind:'original',category:'consentimento_procedimento',title:'Consentimento — procedimento fictício',created_at:'2026-10-25T12:00:00Z'},...(window.returnedCopy?[{id:'d1000000-0000-4000-8000-000000000002',documentId,kind:'returned',category:'tcle_externo',title:'Consentimento — cópia devolvida',created_at:'2026-10-25T12:01:00Z'}]:[])]}};
            if(body.action==='client_update'){if(window.failSupportSave)return {error:{message:'Falha de gravação simulada'}};saved={...saved,...body.patch,updated_at:'2026-10-25T12:01:00Z'};return {data:{client:{...saved,id:body.clientId}}};}
            if(body.action==='invite')return {data:{ok:true}};
            if(body.action==='download')return {data:{url:'data:application/pdf;base64,JVBERi0xLjQKVEVTVEU=',filename:'BC_TESTE_DE_FLUXO.pdf'}};
            throw new Error('Unexpected support action');
          }};
          document.getElementById('profileName').textContent='Perfil de demonstração';
          document.getElementById('gestaoApp').hidden=false;document.getElementById('authStatus').hidden=true;
          window.panel=await initCreationPanel({client,root:document});
          const {initSupportPanel}=await import('/gestao/js/support-panel.js');window.supportPanel=initSupportPanel({client,root:document,onChanged:()=>window.panel.refresh()});
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
        await page.evaluate(async()=>{
          const {startLiveRefresh}=await import('/gestao/js/live-refresh.js');
          window.secondaryLive=startLiveRefresh({root:document,authorize:async()=>true,tasks:[{scope:()=>document.getElementById('creationWorkspace'),refresh:window.panel.refresh}]});
        });
        await page.getByText('Todas as áreas',{exact:true}).click();
        await page.locator('#creationSection').selectOption('produtos');
        await page.getByRole('heading',{name:'Produtos',exact:true}).waitFor();
        assert.equal(new URL(page.url()).hash,'#produtos');
        await page.locator('#creationTitle').click();
        const secondaryRefresh=await page.evaluate(async()=>{const before=window.calls.length;await window.secondaryLive.refresh();window.secondaryLive.stop();return window.calls.length-before;});
        assert.equal(secondaryRefresh,1,'secondary navigation remains eligible for live refresh');
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
        await shortcut('Clientes').click();await page.getByRole('button',{name:'Abrir cadastro',exact:true}).first().click();
        const dialog=page.locator('#supportClientDialog');await dialog.getByRole('heading',{name:'Beatriz fictícia',exact:true}).waitFor();
        await page.locator('#supportClientForm [name=nome]').fill('Beatriz fictícia revisada');
        await page.evaluate(()=>window.failSupportSave=true);await dialog.getByRole('button',{name:'Salvar cadastro',exact:true}).click();
        await page.locator('#supportSaveStatus').filter({hasText:'Falha de gravação simulada'}).waitFor();assert.equal(await page.locator('#supportClientForm [name=nome]').inputValue(),'Beatriz fictícia revisada');
        await page.evaluate(()=>window.failSupportSave=false);await dialog.getByRole('button',{name:'Salvar cadastro',exact:true}).click();await page.locator('#supportSaveStatus').filter({hasText:'Cadastro salvo.'}).waitFor();
        const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Baixar para enviar',exact:true}).click();assert.equal((await download).suggestedFilename(),'BC_TESTE_DE_FLUXO.pdf');
        await dialog.getByText('Anexar consentimento devolvido',{exact:true}).click();
        await page.locator('#supportReturnedForm [name=file]').setInputFiles({name:'TESTE_DE_FLUXO.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTESTE DE FLUXO SEM VALIDADE CLINICA')});
        await dialog.getByRole('button',{name:'Anexar cópia à ficha',exact:true}).click();await page.locator('#supportDownloadStatus').filter({hasText:'Cópia anexada'}).waitFor();
        await dialog.getByRole('button',{name:'Baixar cópia devolvida',exact:true}).waitFor();
        assert.ok(await page.evaluate(()=>{const box=document.getElementById('supportClientDialog');return box.scrollWidth<=box.clientWidth;}),'support dialog does not overflow');
        await page.screenshot({path:`test-results/creation/${engine}-${device}-support.png`});
        await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await page.waitForFunction(()=>document.getElementById('supportClientBody').textContent==='');
        await shortcut('Equipe').click();await page.getByText('Adicionar colaboradora',{exact:true}).click();
        await page.locator('#supportInviteForm [name=name]').fill('Colaboradora fictícia');await page.locator('#supportInviteForm [name=email]').fill('novo-fluxo@example.invalid');await page.getByRole('button',{name:'Enviar convite',exact:true}).click();await page.locator('#supportInviteStatus').filter({hasText:'Convite enviado'}).waitFor();
        assert.equal(await page.evaluate(()=>window.supportCalls.filter(call=>call.action==='invite').length),1);
        assert.deepEqual(externalSignatureRequests,[],'manual consent does not contact external signature services');
        assert.equal(await page.evaluate(()=>window.injected),undefined);
        assert.ok(await page.evaluate(()=>window.calls.every(call=>call.name==='bc_creation_list'&&call.p_section!=='financeiro')));
        await page.waitForFunction(()=>document.getElementById('gestaoMenu').getBoundingClientRect().right<=0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${engine}/${device}: no horizontal overflow`);
        await page.goto(`${url}/gestao/admin/`,{waitUntil:'domcontentloaded'});
        await page.evaluate(async()=>{
          const {initAdminStaffClinicalIdentity}=await import('/gestao/js/admin-staff-profile.js');
          window.activationCalls=[];
          const profile={user_id:'d1000000-0000-4000-8000-000000000003',display_name:'Nova colaboradora fictícia',role:'colaborador',active:true,atende_clientes:false,profissao:'Profissional fictícia',conselho:'Conselho fictício',registro_conselho:'TESTE'};
          const query={select(){return this;},eq(){return this;},order:async()=>({data:[{...profile}]})};
          const client={from:()=>query,functions:{invoke:async(name,{body})=>{window.activationCalls.push({name,...body});profile.atende_clientes=true;return {data:{ok:true}};}}};
          document.getElementById('gestaoApp').hidden=false;document.getElementById('authStatus').hidden=true;
          document.querySelectorAll('[data-area-panel]').forEach(panel=>panel.hidden=panel.id!=='equipe');
          await initAdminStaffClinicalIdentity({client,root:document});
        });
        await page.getByRole('button',{name:'Habilitar atendimento',exact:true}).click();
        await page.locator('#staffClinicalIdentityStatus').filter({hasText:'Atendimento habilitado'}).waitFor();
        assert.equal(await page.locator('#staffActivateAttendance').isVisible(),false);
        assert.deepEqual(await page.evaluate(()=>window.activationCalls),[{name:'client-support',action:'activate_staff',userId:'d1000000-0000-4000-8000-000000000003'}]);
        assert.deepEqual(errors,[],`${engine}/${device}: no page errors`);
        await page.close();console.log(`PASS ${engine}/${device}: shortcuts, history, filters, pages, details, support edit/retry/download/upload/invite, manual consent and restricted areas`);
      }
    }finally{await browser.close();}
  }
}finally{server.close();}
