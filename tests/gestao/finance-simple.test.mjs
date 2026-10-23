import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import {payCommission,createExpense} from '../../gestao/js/finance-simple-api.js';
import {financeReportCsv,financeReportPdf} from '../../gestao/js/finance-report.js';
import {initAdminFinance} from '../../gestao/js/admin-finance.js';
import {initCollaboratorFinance} from '../../gestao/js/colaborador-finance.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const overview=()=>({totals:{income:200,expense:0,balance:200},rows:[],pending:[{professional_id:'p1',professional_name:'Alice',amount:60,items:[{id:'i1',amount:60,procedure:'Sessão',client:'Cliente'}]}],payments:[],people:[{id:'p1',name:'Alice',procedure_ids:['proc']}],procedures:[{id:'proc',name:'Sessão'}],awaiting:[],awaiting_rules:0,charges:[],charge_issues:[],rules:[]});
async function host(role){const html=await readFile(new URL(`../../gestao/${role}/index.html`,import.meta.url),'utf8');return parseHTML(html);}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,1));}assert.fail('Operação não concluiu');}

test('pagamento confirma resultado por chave após rede perdida e não duplica a mutação',async()=>{
 let writes=0;const client={rpc:async(name,p)=>{if(name==='bc_finance_commission_pay'){writes++;return {data:null,error:{message:'Failed to fetch'}};}assert.equal(name,'bc_finance_operation_result');assert.equal(p.p_request_key,'key');return {data:{id:'paid',amount:60,state:'paid'},error:null};}};
 assert.equal(await payCommission({client,requestKey:'key',professionalId:'p',itemIds:['i'],amount:60}),'paid');assert.equal(writes,1);
});
test('despesa mínima não exige método e recusa fração de centavo antes da rede',async()=>{
 let call;const client={rpc:async(n,p)=>(call=[n,p],{data:'expense',error:null})};
 assert.equal(await createExpense({client,requestKey:'key',description:'Material',amount:25,paidAt:'2026-10-22T12:00:00-03:00'}),'expense');assert.equal(call[1].p_method,null);
 await assert.rejects(createExpense({client,requestKey:'k',description:'Material',amount:1.001}),/centavos/);
});
test('Mel confirma comissão em dois toques sem método ou anexo e saldo pago sai de pendente',async()=>{
 const {document,window}=await host('admin');let paid=false,writes=0;const calls=[];
 const client={rpc:async(n,p)=>{calls.push([n,p]);if(n==='bc_finance_overview')return {data:paid?{...overview(),pending:[],payments:[{id:'pay1',professional_name:'Alice',amount:60,paid_at:'2026-10-22T15:00:00Z',state:'paid'}],totals:{income:200,expense:60,balance:140}}:overview(),error:null};if(n==='bc_finance_commission_pay'){writes++;paid=true;return {data:'pay1',error:null};}return {data:[],error:null};}};
 await initAdminFinance({client,profile:{user_id:'mel',role:'admin'},root:document,storage:storage()});
 assert.match(document.getElementById('adminFinancePending').textContent,/60,00/);
 document.querySelector('[data-finance-pay]').click();const form=document.querySelector('[data-finance-pay-form]');assert.ok(form);assert.match(form.textContent,/Alice/);assert.match(form.textContent,/60,00/);
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>document.getElementById('adminFinancePending').textContent.includes('Nenhuma comissão'));
 assert.equal(writes,1);assert.equal(calls.find(x=>x[0]==='bc_finance_commission_pay')[1].p_method,null);assert.match(document.getElementById('adminFinanceTotalExpense').textContent,/60,00/);assert.equal(document.querySelector('[data-finance-pay-form]'),null);
});
test('visão própria usa somente resumo próprio e não calcula comissão na tela',async()=>{
 const {document}=await host('colaborador');const calls=[];await initCollaboratorFinance({client:{rpc:async(n,p)=>(calls.push([n,p]),{data:{pending_total:0,paid_total:60,awaiting_rules:0,items:[],payments:[{id:'pay',amount:60,state:'paid',paid_at:'2026-10-22T15:00:00Z'}]},error:null})},profile:{user_id:'alice'},root:document});
 assert.deepEqual(calls.map(x=>x[0]),['bc_finance_my_summary']);assert.match(document.getElementById('collaboratorTotalPending').textContent,/0,00/);assert.match(document.getElementById('collaboratorTotalPaid').textContent,/60,00/);assert.equal(document.querySelector('[name="percent"]'),null);
});
test('CSV conserva totais do relatório, identifica cancelados e neutraliza fórmulas',()=>{
 const report={clinic:'BC',from:'2026-10-01',to:'2026-10-31',generated_at:'2026-10-22T15:00:00Z',totals:{income:200,expense:60,balance:140},rows:[{direction:'in',kind:'receipt',description:'=HYPERLINK("evil")',amount:200,occurred_at:'2026-10-22T15:00:00Z',included:true,state:'ativo'},{direction:'out',kind:'commission_payment',description:'Comissão Alice',amount:60,occurred_at:'2026-10-22T15:00:00Z',included:true,state:'paid'},{direction:'out',kind:'expense',description:'Cancelada',amount:80,occurred_at:'2026-10-22T15:00:00Z',included:false,state:'reversed'}]};
 const csv=financeReportCsv(report);assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/'=HYPERLINK/);assert.match(csv,/Cancelad/);assert.match(csv,/140,00/);assert.doesNotMatch(csv,/<script/);
 const pdf=financeReportPdf(report);assert.ok(pdf instanceof Uint8Array);assert.equal(new TextDecoder().decode(pdf.slice(0,8)),'%PDF-1.4');
});
