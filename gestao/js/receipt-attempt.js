// Guarda somente IDs opacos e hash local; valores e observações ficam no formulário.
const STORE='bcg-receipt-attempt-v1';
export function createReceiptAttempt({storage,uuid=()=>crypto.randomUUID()}={}){
 if(storage===undefined)try{storage=globalThis.sessionStorage;}catch{}
 let entries=new Map();
 try{const rows=JSON.parse(storage?.getItem(STORE)||'[]');if(Array.isArray(rows))for(const row of rows)if(typeof row.context==='string'&&typeof row.key==='string'&&/^[a-f0-9]{64}$/.test(row.fingerprint))entries.set(row.context,{...row,uncertain:true});}catch{}
 function save(){try{storage?.setItem(STORE,JSON.stringify([...entries.values()]));}catch{}}
 return {
  async get(context,payload){
   const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))));
   const fingerprint=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
   const prior=entries.get(context);
   if(prior&&prior.fingerprint!==fingerprint)throw new Error('Há um recebimento aguardando confirmação. Reenvie os mesmos dados antes de iniciar outro.');
   if(prior)return prior.key;
   const key=uuid();entries.set(context,{context,key,fingerprint});save();return key;
  },
  fail(context,key,error){const entry=entries.get(context);if(entry?.key!==key)return;if(error?.confirmedFailure&&!entry.uncertain){entries.delete(context);}else{entry.uncertain=true;}save();},
  complete(context,key){if(entries.get(context)?.key===key){entries.delete(context);save();}},
 };
}
export function receiptFailureMessage(error,requestKey){
 return requestKey&&!error?.confirmedFailure?'Resultado não confirmado. Reenvie os mesmos dados para conferir a mesma tentativa.':error?.message||'Não foi possível registrar o recebimento.';
}
