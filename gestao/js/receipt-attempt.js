// Somente IDs opacos e hash local; nenhuma entrada nova sai sem chave persistida.
const STORE='bcg-receipt-attempt-v1:';
const storageError=()=>Object.assign(new Error('Este navegador não conseguiu guardar ou liberar a tentativa anterior. Permita o armazenamento do site e tente novamente.'),{confirmedFailure:true,code:'BC_STORAGE'});
export function createReceiptAttempt({storage,uuid=()=>crypto.randomUUID()}={}){
 if(storage===undefined)try{storage=globalThis.sessionStorage;}catch{}
 const entries=new Map();
 function load(context){try{const raw=storage.getItem(STORE+context);if(!raw)return null;const row=JSON.parse(raw);if(row.context!==context||typeof row.key!=='string'||!/^[a-f0-9]{64}$/.test(row.fingerprint))throw storageError();return {...row,uncertain:true};}catch{throw storageError();}}
 function remove(context,key){try{const raw=storage.getItem(STORE+context);if(raw&&JSON.parse(raw).key!==key)return true;storage.removeItem(STORE+context);const after=storage.getItem(STORE+context);if(after&&JSON.parse(after).key===key)return false;return true;}catch{return false;}}
 function currentEntry(context){
  let prior=entries.get(context);if(!prior){prior=load(context);if(prior)entries.set(context,prior);}
  if(prior?.completed){if(!remove(context,prior.key))throw storageError();entries.delete(context);prior=load(context);if(prior)entries.set(context,prior);}return prior;
 }
 return {
  peek(context){const entry=currentEntry(context);return entry?{key:entry.key,fingerprint:entry.fingerprint}:null;},
  async get(context,payload){
   const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))));
   const fingerprint=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
   const prior=currentEntry(context);
   if(prior&&prior.fingerprint!==fingerprint)throw new Error('Há um recebimento aguardando confirmação. Reenvie os mesmos dados antes de iniciar outro.');
   if(prior)return prior.key;
   const entry={context,key:uuid(),fingerprint};const encoded=JSON.stringify(entry);
   try{storage.setItem(STORE+context,encoded);if(storage.getItem(STORE+context)!==encoded)throw storageError();}catch{throw storageError();}
   entries.set(context,entry);return entry.key;
  },
  fail(context,key,error){const entry=entries.get(context);if(entry?.key!==key||entry.completed)return;if(error?.confirmedFailure&&!entry.uncertain){entry.completed=true;if(remove(context,key))entries.delete(context);}else{entry.uncertain=true;}},
  complete(context,key){const entry=entries.get(context);if(entry?.key!==key)return false;entry.completed=true;if(!remove(context,key))return false;entries.delete(context);return true;},
 };
}
export function receiptFailureMessage(error,requestKey){
 return requestKey&&!error?.confirmedFailure?'Resultado não confirmado. Reenvie os mesmos dados para conferir a mesma tentativa.':error?.message||'Não foi possível registrar o recebimento.';
}
export const receiptStorageMessage='Recebimento confirmado. Permita o armazenamento do site para liberar esta tentativa antes de iniciar outra entrada.';
