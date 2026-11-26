import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cents,rate,preview,parseExample,commitPreview} from '../../docs/bc-gestao/maya-finance-preview/engine.mjs';
const sample={"professional":"Profissional A","procedure":"Procedimento fictício","gross":"300","received":"300","method":"pix","commission":"60","cost":"30","fee":"0","basis":"gross"};
test("exemplo 300/60%/30",()=>assert.equal((()=>{const x=preview(sample);return x.commission===18000&&x.contribution===9000&&x.outstanding===0})(),true));
test("parcial",()=>assert.equal((()=>{const x=preview({...sample,received:'100',basis:'received'});return x.commission===6000&&x.outstanding===20000})(),true));
test("arredondamento",()=>assert.equal((()=>preview({...sample,gross:'0,05',received:'0,05',commission:'50',cost:'0'}).commission===3)(),true));
test("taxa e margem negativa",()=>assert.equal((()=>preview({...sample,cost:'150',fee:'10'}).contribution===-4000)(),true));
test("milhar",()=>assert.equal((()=>cents('1.234,56')===123456)(),true));
test("rejeita fração de centavo",()=>assert.equal((()=>{try{cents('1,001');return false}catch{return true}})(),true));
test("rejeita recebido acima do total",()=>assert.equal((()=>{try{preview({...sample,received:'301'});return false}catch{return true}})(),true));
test("rejeita comissão superior a 100",()=>assert.equal((()=>{try{preview({...sample,commission:'100,01'});return false}catch{return true}})(),true));
test("não presume campos",()=>assert.equal((()=>{const x=parseExample('Hoje a Aline realizou um procedimento de 300 reais, recebeu no Pix, a comissão dela é de 60% e gastamos 30 reais de material.');return x.gross==='300'&&x.procedure===''&&x.basis===''&&x.fee===''})(),true));
test("bloqueia duplicidade na sessão",()=>assert.equal((()=>{const a=commitPreview([],preview(sample),'a');try{commitPreview(a,preview(sample),'a');return false}catch{return a.length===1}})(),true));
test("rejeita método inconsistente",()=>assert.equal((()=>{try{preview({...sample,method:'pendente'});return false}catch{return true}})(),true));
test("rejeita base ausente",()=>assert.equal((()=>{try{preview({...sample,basis:''});return false}catch{return true}})(),true));

import {commercialPeriod,cashScenario} from '../../docs/bc-gestao/maya-finance-preview/engine.mjs';
const cohort={prospects:10,buyers:3,eligible:5,returned:2,active:4,repeat:1,responses:0,positive:0};
test('indicadores comerciais respeitam denominadores e ausência de amostra',()=>{
 assert.deepEqual(commercialPeriod(cohort),{conversion:30,retention:40,recurrence:25,satisfaction:null});
 assert.throws(()=>commercialPeriod({...cohort,returned:6}));assert.throws(()=>commercialPeriod({...cohort,active:''}));
});
test('caixa separa liquidação, previsões e meta sem duplicar pendências',()=>{
 const input={opening:'10',settled:'5,50',paid:'2',expected:'4',payable:'20',goal:'11'};
 assert.deepEqual(cashScenario(input),{cash:1350,projected:-250,goalProgress:50});
 assert.equal(cashScenario({...input,goal:'0'}).goalProgress,null);assert.throws(()=>cashScenario({...input,paid:''}));
});
