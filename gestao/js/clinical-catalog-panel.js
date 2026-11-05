import {listClinicalProducts,saveClinicalProduct,listProductLots,saveProductLot} from './treatment-products-api.js';
import {listClinicalEquipment,saveClinicalEquipment} from './treatment-equipment-api.js';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const options=rows=>rows.map(r=>`<option value="${esc(r.id)}">${esc(r.name||r.lot_code)}${r.active===false?' (inativo)':''}</option>`).join('');

export function renderClinicalCatalog({products=[],equipment=[]}={}){
 return `<p class="bcg-eyebrow">CADASTROS DA CLÍNICA</p><h2>Produtos, lotes e equipamentos</h2><p class="bcg-muted">Cadastre e edite os itens. As fichas anteriores preservam os dados registrados em cada sessão.</p>
 <div class="bcg-subgrid">
 <article class="bcg-subpanel"><h3>Produtos</h3><form class="bcg-form" data-catalog-product-form>
 <label>Editar produto<select class="bcg-input" name="id"><option value="">Novo produto</option>${options(products)}</select></label>
 <label>Nome<input class="bcg-input" name="name" maxlength="160" required></label><label>Fabricante<input class="bcg-input" name="manufacturer"></label><label>Categoria<input class="bcg-input" name="category"></label><label>Unidade padrão<input class="bcg-input" name="default_unit" maxlength="30" placeholder="mL, unidade, g..."></label>
 <label class="bcg-toggle"><input type="checkbox" name="tracks_lot" checked> Controlar lote</label><label class="bcg-toggle"><input type="checkbox" name="active" checked> Ativo</label><button class="bcg-button" type="submit">Salvar produto</button></form></article>
 <article class="bcg-subpanel"><h3>Lotes</h3><form class="bcg-form" data-catalog-lot-form>
 <label>Produto<select class="bcg-input" name="product_id" required><option value="">Selecione o produto</option>${options(products)}</select></label><label>Editar lote<select class="bcg-input" name="id"><option value="">Novo lote</option></select></label>
 <label>Lote<input class="bcg-input" name="lot_code" maxlength="100" required></label><label>Validade<input class="bcg-input" type="date" name="expires_on" required></label><label>Observações<textarea class="bcg-input" name="notes" rows="2"></textarea></label><label class="bcg-toggle"><input type="checkbox" name="active" checked> Ativo</label><button class="bcg-button" type="submit">Salvar lote</button></form></article>
 <article class="bcg-subpanel"><h3>Equipamentos</h3><form class="bcg-form" data-catalog-equipment-form>
 <label>Editar equipamento<select class="bcg-input" name="id"><option value="">Novo equipamento</option>${options(equipment)}</select></label>
 <label>Nome<input class="bcg-input" name="name" maxlength="160" required></label><label>Fabricante<input class="bcg-input" name="manufacturer"></label><label>Modelo<input class="bcg-input" name="model"></label><label>Código interno<input class="bcg-input" name="internal_code"></label><label>Número de série<input class="bcg-input" name="serial_number"></label>
 <details><summary>Parâmetros estruturados (opcional)</summary><label>Definição dos campos<textarea class="bcg-input" name="parameter_schema" rows="5">{"fields":[]}</textarea></label><p class="bcg-muted">Mantenha a definição existente para aparelhos já configurados. Os parâmetros livres também podem ser anotados no atendimento.</p></details>
 <label class="bcg-toggle"><input type="checkbox" name="active" checked> Ativo</label><button class="bcg-button" type="submit">Salvar equipamento</button></form></article>
 </div><p class="bcg-status" data-catalog-status role="status" aria-live="polite"></p>`;
}

export async function initClinicalCatalog({client,profile,root=document}={}){
 if(profile?.role!=='admin')throw Error('Cadastros restritos à administradora.');
 const host=root.getElementById('catalogos');if(!host)throw Error('Área de cadastros indisponível.');
 let products=[],equipment=[],lots=[],lotRequest=0,busy=false;
 const hasEdits=()=>Boolean(host.querySelector('[data-bc-dirty="true"]')||(root.activeElement&&host.contains(root.activeElement)&&root.activeElement.closest?.('form')));
 const status=(message,kind='')=>{const el=host.querySelector('[data-catalog-status]');if(el){el.textContent=message;el.dataset.kind=kind;}};
 async function refresh({canApply=()=>true,force=false,submitted=null}={}){
  const loaded=await Promise.all([listClinicalProducts({client,includeInactive:true}),listClinicalEquipment({client,includeInactive:true})]);
  if(!force&&(!canApply()||busy||hasEdits()))return;
  const drafts=force?[...host.querySelectorAll('form')].filter(f=>f!==submitted).map(f=>({kind:f.getAttributeNames().find(n=>n.startsWith('data-catalog-')),dirty:f.dataset.bcDirty,fields:[...f.elements].filter(x=>x.name).map(x=>({name:x.name,value:x.value,checked:x.checked,options:x.tagName==='SELECT'&&x.name==='id'&&f.hasAttribute('data-catalog-lot-form')?x.innerHTML:null}))})):[];
  [products,equipment]=loaded;host.innerHTML=renderClinicalCatalog({products,equipment});
  for(const draft of drafts){const form=host.querySelector(`[${draft.kind}]`);if(!form)continue;if(draft.dirty)form.dataset.bcDirty=draft.dirty;for(const field of draft.fields){const target=form.elements[field.name];if(!target)continue;if(field.options!==null)target.innerHTML=field.options;target.value=field.value;if(target.type==='checkbox')target.checked=field.checked;}}
 }
 function fill(form,row={},kind){
  for(const field of form.elements){if(!field.name||['id','product_id'].includes(field.name))continue;const value=row[field.name];if(field.type==='checkbox')field.checked=value!==false;else field.value=field.name==='parameter_schema'?JSON.stringify(value||{fields:[]},null,2):value??'';}
 }
 const onChange=async event=>{
  const form=event.target.closest('form');if(!form)return;
  if(event.target.name==='id'){const rows=form.hasAttribute('data-catalog-product-form')?products:form.hasAttribute('data-catalog-equipment-form')?equipment:lots;fill(form,rows.find(x=>x.id===event.target.value));}
  if(form.hasAttribute('data-catalog-lot-form')&&event.target.name==='product_id'){
   const version=++lotRequest;lots=[];const select=form.elements.id;select.innerHTML='<option value="">Novo lote</option>';fill(form);if(!event.target.value)return;
   try{const loaded=await listProductLots({client,productId:event.target.value,includeInactive:true});if(version!==lotRequest||!form.isConnected)return;lots=loaded;select.innerHTML='<option value="">Novo lote</option>'+options(lots);}
   catch(error){if(version===lotRequest)status(error.message,'error');}
  }
 };
 const onSubmit=async event=>{
  const form=event.target.closest('form');if(!form||!host.contains(form))return;event.preventDefault();if(busy)return;
  busy=true;const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  const val=n=>String(form.elements[n]?.value??'').trim();const checked=n=>Boolean(form.elements[n]?.checked);
  try{
   if(form.hasAttribute('data-catalog-product-form'))await saveClinicalProduct({client,productId:val('id')||null,payload:{name:val('name'),manufacturer:val('manufacturer'),category:val('category'),default_unit:val('default_unit'),tracks_lot:checked('tracks_lot'),active:checked('active')}});
   else if(form.hasAttribute('data-catalog-equipment-form')){let schema;try{schema=JSON.parse(val('parameter_schema')||'{"fields":[]}');}catch{throw Error('A definição de parâmetros precisa ser um JSON válido.');}await saveClinicalEquipment({client,equipmentId:val('id')||null,payload:{name:val('name'),manufacturer:val('manufacturer'),model:val('model'),internal_code:val('internal_code'),serial_number:val('serial_number'),parameter_schema:schema,active:checked('active')}});}
   else if(form.hasAttribute('data-catalog-lot-form'))await saveProductLot({client,productId:val('product_id'),payload:{id:val('id')||null,lot_code:val('lot_code'),expires_on:val('expires_on'),notes:val('notes'),active:checked('active')}});
   await refresh({force:true,submitted:form});status('Cadastro salvo.','success');
  }catch(error){status(error.message||'Não foi possível salvar o cadastro.','error');}
  finally{busy=false;if(button)button.disabled=false;}
 };
 host.addEventListener('change',onChange);host.addEventListener('submit',onSubmit);await refresh();
 return {refresh:async(options={})=>{if(!hasEdits()&&!busy)await refresh(options);},destroy(){++lotRequest;host.removeEventListener('change',onChange);host.removeEventListener('submit',onSubmit);}};
}
