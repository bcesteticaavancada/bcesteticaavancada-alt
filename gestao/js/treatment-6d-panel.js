import {listTreatmentPhotos,uploadTreatmentPhoto,voidTreatmentPhoto,getTreatmentPhotoUrl} from './treatment-photos-api.js';
import {listClinicalProducts,listProductLots,listTreatmentProductUsages,addTreatmentProductUsage,removeTreatmentProductUsage} from './treatment-products-api.js';
import {listClinicalEquipment,listTreatmentEquipmentUsages,addTreatmentEquipmentUsage,removeTreatmentEquipmentUsage} from './treatment-equipment-api.js';
import {listTreatmentIntercurrences,createTreatmentIntercurrence,addIntercurrenceEvolution,confirmOpenIntercurrencesForFinalization} from './treatment-intercurrences-api.js';

function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function editable(t={}){return t.status!=='finalizado'&&!t.pending_document_id;}
function gateSet(t={}){return new Set(Array.isArray(t.finalization_gate_reasons)?t.finalization_gate_reasons:[]);}
function requiredChip(flag){return flag?'<span class="bcg-chip bcg-6d-required">Obrigatório</span>':'';}
function pendingChip(isPending){return isPending?'<span class="bcg-chip bcg-6d-pending">Pendente</span>':'<span class="bcg-chip">OK</span>';}
function summaryCount(value,label){return `${Number(value||0)} ${label}`;}
function formatDate(value){if(!value)return '—';const raw=String(value);const date=new Date(raw);if(Number.isNaN(date.getTime()))return raw.slice(0,10);return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(date);}

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
  const form=canEdit?`<form class="bcg-form bcg-6d-form" data-6d-product-form><label>Produto<select class="bcg-input" name="product_id" data-6d-product-select required><option value="">Selecione</option>${active.map((p)=>`<option value="${esc(p.id)}" data-unit="${esc(p.default_unit||'')}">${esc(p.name)}</option>`).join('')}</select></label><label>Lote<select class="bcg-input" name="lot_id" data-6d-lot-select><option value="">Selecione o produto</option></select></label><label>Quantidade<input class="bcg-input" name="quantity" type="number" min="0.0001" step="any" required></label><label>Unidade<input class="bcg-input" name="unit" required></label><button class="bcg-small-button" type="submit" data-6d-product-submit>Registrar uso</button></form>`:'<p class="bcg-muted">Somente leitura — produtos desta versão não podem mais ser alterados.</p>';
  return card({key:'products',title:'Produtos e lotes',required,pending:gates.has('produto_lote_pendente'),summary:summaryCount(treatment.phase6d_summary?.product_usages,'uso(s)'),body:rows+form});
}

function renderEquipment({treatment,equipment,equipmentUsages}){
  const canEdit=editable(treatment); const gates=gateSet(treatment); const required=Boolean(treatment?.procedure_version?.requires_equipment);
  const rows=(equipmentUsages||[]).length?`<div class="bcg-6d-list">${equipmentUsages.map((u)=>`<article><div><strong>${esc(u.equipment_name_snapshot)}</strong><small>${[u.manufacturer_snapshot,u.model_snapshot,u.internal_code_snapshot].filter(Boolean).map(esc).join(' • ')}</small><p>${Object.entries(u.parameter_values||{}).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' • ')||'Sem parâmetros'}</p></div>${canEdit?`<button type="button" class="bcg-link-button" data-6d-equipment-remove="${esc(u.id)}">Remover</button>`:''}</article>`).join('')}</div>`:'<p class="bcg-muted">Nenhum equipamento registrado nesta sessão.</p>';
  const active=(equipment||[]).filter((e)=>e.active!==false);
  const form=canEdit?`<form class="bcg-form bcg-6d-form" data-6d-equipment-form><label>Equipamento<select class="bcg-input" name="equipment_id" data-6d-equipment-select required><option value="">Selecione</option>${active.map((e)=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select></label><div class="bcg-field-wide" data-6d-equipment-parameters><p class="bcg-muted">Selecione o equipamento para preencher os parâmetros.</p></div><button class="bcg-small-button" type="submit" data-6d-equipment-submit>Registrar equipamento</button></form>`:'<p class="bcg-muted">Somente leitura — equipamentos desta versão não podem mais ser alterados.</p>';
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
  let treatment=null,photos=[],products=[],productUsages=[],equipment=[],equipmentUsages=[],intercurrences=[];
  const slot=()=>root.querySelector?.('[data-treatment-6d-slot]');
  const render=()=>{if(slot()&&treatment)slot().innerHTML=renderTreatment6dCards({treatment,photos,products,productUsages,equipment,equipmentUsages,intercurrences});};
  async function loadTreatment(next){
    treatment=next;if(!treatment?.id)return;
    [photos,products,productUsages,equipment,equipmentUsages,intercurrences]=await Promise.all([
      listTreatmentPhotos({client,treatmentId:treatment.id}),listClinicalProducts({client}),listTreatmentProductUsages({client,treatmentId:treatment.id}),
      listClinicalEquipment({client}),listTreatmentEquipmentUsages({client,treatmentId:treatment.id}),listTreatmentIntercurrences({client,treatmentId:treatment.id}),
    ]);render();
  }
  async function refresh(){if(refreshTreatment)await refreshTreatment();else if(treatment)await loadTreatment(treatment);}

  root.addEventListener('toggle',async(event)=>{
    const details=event.target?.closest?.('[data-6d-card="photos"]');if(!details?.open)return;
    for(const img of details.querySelectorAll?.('[data-6d-photo-path]')||[]){if(img.src)continue;try{img.src=await getTreatmentPhotoUrl({client,storagePath:img.dataset.sixdPhotoPath||img.getAttribute('data-6d-photo-path')});}catch{} }
  },true);
  root.addEventListener('change',async(event)=>{
    const product=event.target?.closest?.('[data-6d-product-select]');
    if(product){const form=product.closest('form');const lot=form?.querySelector?.('[data-6d-lot-select]');const unit=form?.elements?.unit;const option=product.options?.[product.selectedIndex];if(unit&&option?.dataset?.unit)unit.value=option.dataset.unit;if(lot){if(!product.value){lot.innerHTML='<option value="">Selecione o produto</option>';return;}try{const lots=await listProductLots({client,productId:product.value});lot.innerHTML='<option value="">Selecione</option>'+lots.map((l)=>`<option value="${esc(l.id)}">${esc(l.lot_code)} • val. ${esc(formatDate(l.expires_on))}</option>`).join('');}catch(error){status(slot(),error?.message||'Não foi possível carregar lotes.','error');}}return;}
    const eq=event.target?.closest?.('[data-6d-equipment-select]');if(eq){const form=eq.closest('form');const target=form?.querySelector?.('[data-6d-equipment-parameters]');const selected=equipment.find((e)=>e.id===eq.value);if(target)target.innerHTML=selected?renderEquipmentParameterFields(selected.parameter_schema):'<p class="bcg-muted">Selecione o equipamento.</p>';}
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
    try{
      if(photoForm){await uploadTreatmentPhoto({client,treatmentId:treatment.id,clienteId:treatment.cliente_id||getClientRecord?.()?.id,kind:photoForm.elements.kind.value,region:photoForm.elements.region.value,view:photoForm.elements.view.value,caption:photoForm.elements.caption.value,file:photoForm.elements.file.files?.[0]});}
      else if(productForm){await addTreatmentProductUsage({client,treatmentId:treatment.id,productId:productForm.elements.product_id.value,lotId:productForm.elements.lot_id.value||null,quantity:productForm.elements.quantity.value,unit:productForm.elements.unit.value});}
      else if(equipmentForm){await addTreatmentEquipmentUsage({client,treatmentId:treatment.id,equipmentId:equipmentForm.elements.equipment_id.value,parameterValues:readParams(equipmentForm)});}
      else if(interForm){await createTreatmentIntercurrence({client,treatmentId:treatment.id,moment:interForm.elements.moment.value,severity:interForm.elements.severity.value,description:interForm.elements.description.value,actionTaken:interForm.elements.action_taken.value});}
      else if(evolution){await addIntercurrenceEvolution({client,intercurrenceId:evolution.dataset.intercurrenceId,evolution:evolution.elements.evolution.value,statusAfter:evolution.elements.status_after.value});}
      await refresh();
    }catch(error){status(slot(),error?.message||'Não foi possível salvar o registro 6D.','error');}
  });
  return {loadTreatment};
}
