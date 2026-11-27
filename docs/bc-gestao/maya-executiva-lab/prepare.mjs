// Isolated synthetic foundation. No network, storage, or production adapters.
const categories = ['tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico'];
const clean = v => typeof v === 'string' ? v.trim() : '';
export function prepare(input, role) {
  if(role !== 'admin') throw Error('perfil');
  if(!input || !['client','payment','document'].includes(input.kind)) throw Error('operacao');
  const missing=[], data={};
  if(input.kind==='client'){
    data.name=clean(input.name); data.phone=clean(input.phone).replace(/\D/g,'');
    if(data.name.split(/\s+/).length<2) missing.push('name');
    if(!/^\d{10,11}$/.test(data.phone)) missing.push('phone');
  } else {
    data.clientId=clean(input.clientId);
    if(!data.clientId || input.clientVerified!==true) missing.push('clientVerified');
    if(input.kind==='payment'){
      data.cents=input.cents; data.method=clean(input.method); data.date=clean(input.date);
      if(!Number.isSafeInteger(data.cents)||data.cents<=0) missing.push('cents');
      if(!['pix','cash','card','transfer'].includes(data.method)) missing.push('method');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date))||new Date(data.date).toISOString().slice(0,10)!==data.date) missing.push('date');
    } else {
      data.title=clean(input.title); data.category=clean(input.category); data.fileHash=clean(input.fileHash);
      if(!data.title) missing.push('title');
      if(!categories.includes(data.category)) missing.push('category');
      if(!/^[a-f0-9]{64}$/.test(data.fileHash)) missing.push('fileHash');
    }
  }
  return {environment:'synthetic',kind:input.kind,data,missing,state:missing.length?'needs_review':'ready_for_review',persisted:false};
}
