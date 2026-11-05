import {listTreatmentPhotos,uploadTreatmentPhoto,voidTreatmentPhoto,getTreatmentPhotoUrl} from './treatment-photos-api.js';
import {listClinicalProducts,listProductLots,listTreatmentProductUsages,addTreatmentProductUsageByName,removeTreatmentProductUsage} from './treatment-products-api.js';
import {listClinicalEquipment,listTreatmentEquipmentUsages,addTreatmentEquipmentUsageByName,removeTreatmentEquipmentUsage} from './treatment-equipment-api.js';
import {listTreatmentIntercurrences,createTreatmentIntercurrence,addIntercurrenceEvolution,confirmOpenIntercurrencesForFinalization} from './treatment-intercurrences-api.js';

function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function editable(t={}){return ['rascunho','pronto_para_iniciar','em_atendimento'].includes(t.status)&&!t.pending_document_id&&!t.pending_version_id;}
function gateSet(t={}){return new Set(Array.isArray(t.finalization_gate_reasons)?t.finalization_gate_reasons:[]);}
function requiredChip(flag){return flag?'<span class="bcg-chip bcg-6d-required">Obrigatório</span>':'';}
function pendingChip(isPending){return isPending?'<span class="bcg-chip bcg-6d-pending">Pendente</span>':'<span class="bcg-chip">OK</span>';}
function summaryCount(value,label){return `${Number(value||0)} ${label}`;}
function formatDate(value){if(!value)return '—';const raw=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const [y,m,d]=raw.split('-');return `${d}/${m}/${y}`;}const date=new Date(raw);if(Number.isNaN(date.getTime()))return raw.slice(0,10);return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(date);}

export function renderEquipmentParameterFields(schema={}){
  const fields=Array.isArray(schema?.fields)?schema.fields:[];
  if(!fields.length)return '<p class="bcg-muted">Este equipamento não possui parâmetros configurados.</p>';
  return fields.map((field)=>{
    const key=esc(field.key); const label=esc(field.label||field.key); const req=field.required?' required':''; const unit=field.unit?` <small>${esc(field.unit)}</small>`:'';
    if(field.type==='number')return `<label>${label}${unit}<input class="bcg-input" name="parameter.${key}" type="number"${field.min!=null?` min="${esc(field.min)}"`:''}${field.max!=null?` max="${esc(field.max)}"`:''}${field.step!=null?` step="${esc(field.step)}"`:''}${req}></label>`;
    if(field.type==='select')return `<label>${label}<select class="bcg-input" name="parameter.${key}"${req}><option value="">Selecione</option>${(field.options||[]).map((opt)=>`<option value="${esc(opt)}">${esc(opt)}</option>`).join('')}</select></label>`;
    if(field.type==='boolean')return `<label class="bcg-toggle"><input name="parameter.${key}" type="checkbox"> ${label}</label>`;
    return `<label>${label}<input class="bcg-input" name="parameter.${key}" type="text"${req}></label>`;
  }).join('');
}

function card({key,title,required=false,pending=false,summary='',body=''}){
  return `<details class="bcg-6d-card" data-6d-card="${key}"><summary><span><strong>${title}</strong><small>${esc(summary)}</small></span><span class="bcg-6d-chips">${requiredChip(required)}${pendingChip(pending)}</span></summary><div class="bcg-6d-card-body">${body}</div></details>`;
}

function renderPhotos({treatment,photos}){
  const canEdit=editable(treatment); const gates=gateSet(treatment); const required=Boolean(treatment?.procedure_version?.requires_photo);
  const valid=(photos||[]).filter((p)=>!p.voided_at);
  const gallery=valid.length?`<div class="bcg-6d-photo-grid">${valid.map((p)=>`<figure><img data-6d-photo-path="${esc(p.storage_path)}" alt="Foto clínica ${esc(p.kind)}" loading="lazy"><figcaption><strong>${esc(p.kind)}</strong>${p.region?` • ${esc(p.region)}`:''}${p.view?` • ${esc(p.view)}`:''}${p.caption?`<br>${esc(p.caption)}`:''}${canEdit?`<button type="button" class="bcg-link-button" data-6d-photo-void="${esc(p.id)}">Anular foto</button>`:''}</figcaption></figure>`).join('')}</div>`:'<p class="bcg-muted">Nenhuma foto clínica registrada nesta sessão.</p>';
  const form=canEdit?`<form class="bcg-form bcg-6d-form" data-6d-photo-form><label>Classificação<select class="bcg-input" name="kind" required><option value="antes">Antes</option><option value="depois">Depois</option><option value="adicional">Adicional</option></select></label><label>Imagem<input class="bcg-input" name="file" type="file" accept="image/jpeg,image/png,image/webp" required></label><label>Região<input class="bcg-input" name="region"></label><label>Vista / ângulo<input class="bcg-input" name="view" placeholder="Frontal, perfil direito..."></label><label class="bcg-field-wide">Legenda<input class="bcg-input" name="caption"></label><button class="bcg-small-button" type="submit" data-6d-photo-submit>Adicionar foto</button></form>`:'<p class="bcg-muted">Somente leitura — esta versão do atendimento já foi congelada/finalizada.</p>';
  const s=treatment.phase6d_summary||{};
  return card({key:'photos',title:'Fotos clínicas',required,pending:gates.has('fotos_pendentes'),summary:`${summaryCount(s.photos_before,'antes')} • ${summaryCount(s.photos_after,'depois')}`,body:gallery+form});
}

function renderProducts({treatment,products,productUsages}){
  const canEdit=editable(treatment); const gates=gateSet(treatment); const required=Boolean(treatment?.procedure_version?.requires_product_lot);
  const rows=(productUsages||[]).length?`<div class="bcg-6d-list">${productUsages.map((u)=>`<article><div><strong>${esc(u.product_name_snapshot)}</strong><small>${u.manufacturer_snapshot?esc(u.manufacturer_snapshot)+' • ':''}${u.lot_code_snapshot?`Lote ${esc(u.lot_code_snapshot)} • `:''}${u.expires_on_snapshot?`Val. ${esc(formatDate(u.expires_on_snapshot))} • `:''}${esc(u.quantity)} ${esc(u.unit)}</small></div>${canEdit?`<button type="button" class="bcg-link-button" data-6d-product-remove="${esc(u.id)}">Remover</button>`:''}</article>`).join('')}</div>`:'<p class="bcg-muted">Nenhum produto/insumo registrado nesta sessão.</p>';
  const active=(products||[]).filter((p)=>p.active!==false);
  const suggestions=`bcg-product-suggestions-${esc(treatment.id)}`;
  const lotSuggestions=`bcg-lot-suggestions-${esc(treatment.id)}`;
  const form=canEdit?`<form class="bcg-form bcg-6d-form" data-6d-product-form><label>Produto<input class="bcg-input" name="product_name" data-6d-product-input list="${suggestions}" placeholder="Digite o nome do produto" maxlength="160" autocomplete="off" required><datalist id="${suggestions}">${active.map((p)=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist></label><label>Lote<input class="bcg-input" name="lot_code" data-6d-lot-input list="${lotSuggestions}" placeholder="Digite o número do lote" maxlength="100" autocomplete="off" required><datalist id="${lotSuggestions}" data-6d-lot-suggestions></datalist></label><label>Validade do lote<input class="bcg-input" name="expires_on" type="date" required></label><label>Quantidade<input class="bcg-input" name="quantity" type="number" min="0.0001" step="any" required></label><label>Unidade<input class="bcg-input" name="unit" maxlength="30" placeholder="mL, unidade, g..." required></label><p class="bcg-muted bcg-field-wide">Digite livremente. Produtos e lotes novos serão cadastrados ao registrar o uso. A validade é obrigatória para segurança e rastreabilidade.</p><button class="bcg-small-button" type="submit" data-6d-product-submit>Registrar uso</button></form>`:'<p class="bcg-muted">Somente leitura — produtos desta versão não podem mais ser alterados.</p>';
  return card({key:'products',title:'Produtos e lotes',required,pending:gates.has('produto_lote_pendente'),summary:summaryCount(treatment.phase6d_summary?.product_usages,'uso(s)'),body:rows+form});
}

function renderEquipment({treatment,equipment,equipmentUsages}){
  const canEdit=editable(treatment); const gates=gateSet(treatment); const required=Boolean(treatment?.procedure_version?.requires_equipment);
  const rows=(equipmentUsages||[]).length?`<div class="bcg-6d-list">${equipmentUsages.map((u)=>`<article><div><strong>${esc(u.equipment_name_snapshot)}</strong><small>${[u.manufacturer_snapshot,u.model_snapshot,u.internal_code_snapshot].filter(Boolean).map(esc).join(' • ')}</small><p>${Object.entries(u.parameter_values||{}).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' • ')||'Sem parâmetros'}</p>${u.usage_notes?`<p>${esc(u.usage_notes)}</p>`:''}</div>${canEdit?`<button type="button" class="bcg-link-button" data-6d-equipment-remove="${esc(u.id)}">Remover</button>`:''}</article>`).join('')}</div>`:'<p class="bcg-muted">Nenhum equipamento registrado nesta sessão.</p>';
  const active=(equipment||[]).filter((e)=>e.active!==false);
  const form=canEdit?`<form class="bcg-form bcg-6d-form" data-6d-equipment-form><label>Equipamento<input class="bcg-input" name="equipment_name" data-6d-equipment-input list="bcg-equipment-${esc(treatment.id)}" maxlength="160" placeholder="Digite o equipamento utilizado" autocomplete="off" required><datalist id="bcg-equipment-${esc(treatment.id)}">${active.map((e)=>`<option value="${esc(e.name)}"></option>`).join('')}</datalist></label><div class="bcg-field-wide" data-6d-equipment-parameters></div><label class="bcg-field-wide">Parâmetros / observações<textarea class="bcg-input" name="equipment_notes" rows="3" maxlength="4000" placeholder="Potência, tempo, ponteira, região e demais informações"></textarea></label><p class="bcg-muted bcg-field-wide">Digite livremente. Um equipamento novo será cadastrado ao registrar o uso.</p><button class="bcg-small-button" type="submit" data-6d-equipment-submit>Registrar equipamento</button></form>`:'<p class="bcg-muted">Somente leitura — equipamentos desta versão não podem mais ser alterados.</p>';
  return card({key:'equipment',title:'Equipamentos',required,pending:gates.has('equipamento_pendente'),summary:summaryCount(treatment.phase6d_summary?.equipment_usages,'uso(s)'),body:rows+form});
}

function renderIntercurrences({treatment,intercurrences}){
  const canCreate=editable(treatment); const gates=gateSet(treatment); const open=(intercurrences||[]).filter((i)=>i.status==='aberta'||i.status==='acompanhamento');
  const rows=(intercurrences||[]).length?`<div class="bcg-6d-list">${intercurrences.map((i)=>`<article class="bcg-6d-intercurrence"><div><strong>${esc(i.severity)} • ${esc(i.moment)}</strong><small>${esc(i.status)} • ${esc(formatDate(i.occurred_at))}</small><p>${esc(i.description)}</p><p><strong>Conduta registrada:</strong> ${esc(i.action_taken)}</p>${(i.updates||[]).map((u)=>`<p class="bcg-6d-evolution"><strong>Evolução:</strong> ${esc(u.evolution)} • ${esc(u.status_after)}</p>`).join('')}</div><form class="bcg-form bcg-6d-evolution-form" data-6d-intercurrence-evolution data-intercurrence-id="${esc(i.id)}"><label>Evolução<textarea class="bcg-input" name="evolution" required></textarea></label><label>Status<select class="bcg-input" name="status_after"><option value="aberta">Aberta</option><option value="acompanhamento">Em acompanhamento</option><option value="encerrada">Encerrada</option></select></label><button class="bcg-small-button" type="submit">Registrar evolução</button></form></article>`).join('')}</div>`:'<p class="bcg-muted">Nenhuma intercorrência registrada nesta sessão.</p>';
  const create=canCreate?`<form class="bcg-form bcg-6d-form" data-6d-intercurrence-form><label>Momento<select class="bcg-input" name="moment"><option value="antes">Antes</option><option value="durante">Durante</option><option value="apos">Após</option></select></label><label>Gravidade<select class="bcg-input" name="severity"><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option><option value="critica">Crítica</option></select></label><label class="bcg-field-wide">Descrição<textarea class="bcg-input" name="description" required></textarea></label><label class="bcg-field-wide">Conduta registrada<textarea class="bcg-input" name="action_taken" required></textarea></label><button class="bcg-small-button" type="submit" data-6d-intercurrence-create>Registrar intercorrência</button></form>`:'<p class="bcg-muted">O evento original está em somente leitura. Evoluções posteriores continuam disponíveis.</p>';
  const confirm=open.length&&gates.has('intercorrencia_aberta_nao_confirmada')&&canCreate?`<div class="bcg-6d-warning"><p>Há acompanhamento pendente. Confirme conscientemente para permitir a finalização da sessão; isso não encerra a intercorrência.</p><button type="button" class="bcg-small-button" data-6d-confirm-open-intercurrences>Confirmar acompanhamento pendente</button></div>`:'';
  return card({key:'intercurrences',title:'Intercorrências',pending:gates.has('intercorrencia_aberta_nao_confirmada'),summary:`${(intercurrences||[]).length} registro(s) • ${open.length} aberta(s)`,body:rows+confirm+create});
}

export function renderTreatment6dCards({treatment={},photos=[],products=[],productUsages=[],equipment=[],equipmentUsages=[],intercurrences=[]}={}){
  return `<section class="bcg-treatment-stage bcg-6d-section" data-treatment-6d><div><p class="bcg-eyebrow">REGISTRO COMPLEMENTAR 6D</p><h4>Documentação da sessão</h4><p class="bcg-muted">Fotos, rastreabilidade, parâmetros e intercorrências ficam vinculados a esta sessão.</p></div><div class="bcg-6d-cards">${renderPhotos({treatment,photos})}${renderProducts({treatment,products,productUsages})}${renderEquipment({treatment,equipment,equipmentUsages})}${renderIntercurrences({treatment,intercurrences})}</div><span class="bcg-status" data-6d-status></span></section>`;
}

function readParams(form){const out={};form.querySelectorAll?.('[name^="parameter."]')?.forEach?.((field)=>{const key=field.name.slice(10);if(field.type==='checkbox')out[key]=Boolean(field.checked);else if(field.type==='number')out[key]=field.value===''?null:Number(field.value);else out[key]=String(field.value??'').trim();});return out;}
function status(root,message,kind=''){const el=root?.querySelector?.('[data-6d-status]');if(el){el.textContent=message||'';el.dataset.kind=kind;}}

export function initTreatment6dController({client,root,getClientRecord,refreshTreatment}={}){
  if(!client||!root)throw new Error('Contexto 6D inválido.');
  let treatment=null,photos=[],products=[],productUsages=[],equipment=[],equipmentUsages=[],intercurrences=[],suggestedLots=[];
  let loadVersion=0,lotRequest=0;
  const productSubmissions=new WeakSet();
  const equipmentSubmissions=new WeakSet();
  const suggestedUnits=new WeakMap();
  const slot=()=>root.querySelector?.('[data-treatment-6d-slot]');
  const render=()=>{if(slot()&&treatment)slot().innerHTML=renderTreatment6dCards({treatment,photos,products,productUsages,equipment,equipmentUsages,intercurrences});};
  async function loadTreatment(next){
    const version=++loadVersion;++lotRequest;treatment=next;suggestedLots=[];if(!treatment?.id)return;
    const loaded=await Promise.all([
      listTreatmentPhotos({client,treatmentId:treatment.id}),listClinicalProducts({client}),listTreatmentProductUsages({client,treatmentId:treatment.id}),
      listClinicalEquipment({client}),listTreatmentEquipmentUsages({client,treatmentId:treatment.id}),listTreatmentIntercurrences({client,treatmentId:treatment.id}),
    ]);
    if(version!==loadVersion)return;
    [photos,products,productUsages,equipment,equipmentUsages,intercurrences]=loaded;render();
  }
  async function refresh(){if(refreshTreatment)await refreshTreatment();else if(treatment)await loadTreatment(treatment);}

  root.addEventListener('toggle',async(event)=>{
    const details=event.target?.closest?.('[data-6d-card="photos"]');if(!details?.open)return;
    for(const img of details.querySelectorAll?.('[data-6d-photo-path]')||[]){if(img.src)continue;try{img.src=await getTreatmentPhotoUrl({client,storagePath:img.dataset.sixdPhotoPath||img.getAttribute('data-6d-photo-path')});}catch{} }
  },true);
  root.addEventListener('input',(event)=>{
    const unit=event.target?.closest?.('[name="unit"]');
    const form=unit?.closest?.('[data-6d-product-form]');
    if(form)suggestedUnits.delete(form);
  });
  root.addEventListener('change',async(event)=>{
    const product=event.target?.closest?.('[data-6d-product-input]');
    if(product){
      const request=++lotRequest;
      const form=product.closest('form');const lot=form?.querySelector?.('[data-6d-lot-input]');const list=form?.querySelector?.('[data-6d-lot-suggestions]');
      if(lot)lot.value='';if(form?.elements?.expires_on)form.elements.expires_on.value='';
      suggestedLots=[];if(list)list.innerHTML='';
      const matches=products.filter((p)=>p.active!==false&&p.name?.trim().toLocaleLowerCase('pt-BR')===product.value.trim().toLocaleLowerCase('pt-BR'));
      const unit=form?.elements?.unit;
      if(unit&&(!unit.value||unit.value===suggestedUnits.get(form))){
        unit.value=matches.length===1?matches[0].default_unit||'':'';
        suggestedUnits.set(form,unit.value);
      }
      if(matches.length===1){
        const requestedName=product.value;
        try{
          const lots=await listProductLots({client,productId:matches[0].id});
          if(request!==lotRequest||product.value!==requestedName||!form.isConnected)return;
          suggestedLots=lots.filter((l)=>l.active!==false);
          if(list)list.innerHTML=suggestedLots.map((l)=>`<option value="${esc(l.lot_code)}"></option>`).join('');
        }catch(error){if(request===lotRequest)status(slot(),error?.message||'Não foi possível carregar sugestões de lotes.','error');}
      }
      return;
    }
    const lot=event.target?.closest?.('[data-6d-lot-input]');
    if(lot){const matches=suggestedLots.filter((l)=>l.lot_code?.trim().toLocaleLowerCase('pt-BR')===lot.value.trim().toLocaleLowerCase('pt-BR'));const expiry=lot.closest('form')?.elements?.expires_on;if(expiry)expiry.value=matches.length===1?matches[0].expires_on:'';return;}
    const eq=event.target?.closest?.('[data-6d-equipment-input]');if(eq){const form=eq.closest('form');const target=form?.querySelector?.('[data-6d-equipment-parameters]');const selected=equipment.find((e)=>e.active!==false&&e.name.trim().toLocaleLowerCase('pt-BR')===eq.value.trim().toLocaleLowerCase('pt-BR'));if(target)target.innerHTML=selected?renderEquipmentParameterFields(selected.parameter_schema):'';}
  });
  root.addEventListener('click',async(event)=>{
    if(!treatment)return;
    try{
      const photo=event.target?.closest?.('[data-6d-photo-void]');if(photo){const reason=globalThis.prompt?.('Motivo da anulação da foto:')||'';if(reason){await voidTreatmentPhoto({client,photoId:photo.dataset.sixdPhotoVoid||photo.getAttribute('data-6d-photo-void'),reason});await refresh();}return;}
      const prod=event.target?.closest?.('[data-6d-product-remove]');if(prod){await removeTreatmentProductUsage({client,usageId:prod.dataset.sixdProductRemove||prod.getAttribute('data-6d-product-remove')});await refresh();return;}
      const eq=event.target?.closest?.('[data-6d-equipment-remove]');if(eq){await removeTreatmentEquipmentUsage({client,usageId:eq.dataset.sixdEquipmentRemove||eq.getAttribute('data-6d-equipment-remove')});await refresh();return;}
      if(event.target?.closest?.('[data-6d-confirm-open-intercurrences]')){await confirmOpenIntercurrencesForFinalization({client,treatmentId:treatment.id});await refresh();}
    }catch(error){status(slot(),error?.message||'Não foi possível concluir a ação.','error');}
  });
  root.addEventListener('submit',async(event)=>{
    if(!treatment)return;
    const photoForm=event.target?.closest?.('[data-6d-photo-form]');const productForm=event.target?.closest?.('[data-6d-product-form]');const equipmentForm=event.target?.closest?.('[data-6d-equipment-form]');const interForm=event.target?.closest?.('[data-6d-intercurrence-form]');const evolution=event.target?.closest?.('[data-6d-intercurrence-evolution]');
    if(!photoForm&&!productForm&&!equipmentForm&&!interForm&&!evolution)return;event.preventDefault();
    if(productForm){
      if(productSubmissions.has(productForm))return;
      productSubmissions.add(productForm);
      const button=productForm.querySelector('[data-6d-product-submit]');
      const treatmentId=treatment.id;let saved=false;
      if(button)button.disabled=true;productForm.setAttribute('aria-busy','true');
      try{
        await addTreatmentProductUsageByName({client,treatmentId,productName:productForm.elements.product_name.value,lotCode:productForm.elements.lot_code.value,expiresOn:productForm.elements.expires_on.value,quantity:productForm.elements.quantity.value,unit:productForm.elements.unit.value});
        saved=true;productForm.reset();
        await refresh();
        if(treatment?.id===treatmentId){
          const card=slot()?.querySelector('[data-6d-card="products"]');if(card)card.open=true;
          status(slot(),'Uso de produto e lote registrado.','success');
        }
      }catch(error){
        if(treatment?.id===treatmentId)status(slot(),saved?'Uso registrado. Atualize a página para conferir o histórico.':error?.message||'Não foi possível registrar o produto e lote.','error');
      }finally{
        productSubmissions.delete(productForm);if(button)button.disabled=false;productForm.removeAttribute('aria-busy');
      }
      return;
    }
    if(equipmentForm){
      if(equipmentSubmissions.has(equipmentForm))return;
      equipmentSubmissions.add(equipmentForm);
      const button=equipmentForm.querySelector('[data-6d-equipment-submit]');if(button)button.disabled=true;
      try{
        await addTreatmentEquipmentUsageByName({client,treatmentId:treatment.id,equipmentName:equipmentForm.elements.equipment_name.value,parameterValues:readParams(equipmentForm),notes:equipmentForm.elements.equipment_notes.value});
        equipmentForm.reset();await refresh();const card=slot()?.querySelector('[data-6d-card="equipment"]');if(card)card.open=true;
        status(slot(),'Equipamento registrado.','success');
      }catch(error){status(slot(),error?.message||'Não foi possível registrar o equipamento.','error');}
      finally{equipmentSubmissions.delete(equipmentForm);if(button)button.disabled=false;}
      return;
    }
    try{
      if(photoForm){await uploadTreatmentPhoto({client,treatmentId:treatment.id,clienteId:treatment.cliente_id||getClientRecord?.()?.id,kind:photoForm.elements.kind.value,region:photoForm.elements.region.value,view:photoForm.elements.view.value,caption:photoForm.elements.caption.value,file:photoForm.elements.file.files?.[0]});}
      else if(equipmentForm){await addTreatmentEquipmentUsageByName({client,treatmentId:treatment.id,equipmentName:equipmentForm.elements.equipment_name.value,parameterValues:readParams(equipmentForm),notes:equipmentForm.elements.equipment_notes.value});}
      else if(interForm){await createTreatmentIntercurrence({client,treatmentId:treatment.id,moment:interForm.elements.moment.value,severity:interForm.elements.severity.value,description:interForm.elements.description.value,actionTaken:interForm.elements.action_taken.value});}
      else if(evolution){await addIntercurrenceEvolution({client,intercurrenceId:evolution.dataset.intercurrenceId,evolution:evolution.elements.evolution.value,statusAfter:evolution.elements.status_after.value});}
      await refresh();
    }catch(error){status(slot(),error?.message||'Não foi possível salvar o registro 6D.','error');}
  });
  return {loadTreatment};
}
