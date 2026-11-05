import test from 'node:test';import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
test('administradora recebe edição de produtos, lotes e equipamentos sem HTML ativo',async()=>{
 const {renderClinicalCatalog}=await import('../../gestao/js/clinical-catalog-panel.js');
 const html=renderClinicalCatalog({products:[{id:'p1',name:'<produto>'}],equipment:[{id:'e1',name:'<laser>'}]});
 assert.ok(html.includes('data-catalog-product-form'));assert.ok(html.includes('data-catalog-equipment-form'));assert.ok(html.includes('data-catalog-lot-form'));assert.ok(html.includes('&lt;produto&gt;'));assert.ok(!html.includes('<laser>'));
});
test('consulta de atualização pendente não apaga edição que começou depois da consulta',async()=>{
 const {initClinicalCatalog}=await import('../../gestao/js/clinical-catalog-panel.js');
 const {document}=parseHTML('<html><body><section id="catalogos"></section></body></html>');
 let pending=false,releases=[];
 const client={rpc:async()=>pending?new Promise(resolve=>releases.push(()=>resolve({data:[]}))):{data:[]}};
 const runtime=await initClinicalCatalog({client,profile:{role:'admin'},root:document});
 pending=true;let canApply=true;const poll=runtime.refresh({canApply:()=>canApply});
 await Promise.resolve();const input=document.querySelector('[name="name"]');input.value='Equipamento em edição';input.closest('form').dataset.bcDirty='true';canApply=false;
 releases.forEach(resolve=>resolve());await poll;
 assert.equal(document.querySelector('[name="name"]').value,'Equipamento em edição');runtime.destroy();
});
