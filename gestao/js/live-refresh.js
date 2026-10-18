const CHANGE_EVENT='bc:data-changed';
const CHANNEL='bc-gestao-invalidation-v1';
const EDITABLE='input:not([type="button"]):not([type="submit"]),textarea,select,[contenteditable="true"]';

export function notifyAppChange(view=globalThis.window) {
  if(!view)return;
  try {view.dispatchEvent(new view.Event(CHANGE_EVENT));} catch { /* Invalidation cannot turn a committed write into a failure. */ }
  try {if(view.BroadcastChannel) {const channel=new view.BroadcastChannel(CHANNEL);channel.postMessage({type:'invalidate'});channel.close();}} catch { /* Polling covers browsers that block channels. */ }
}

export function isMutationRpc(name) {
  return /(?:^|_)(?:create|update|set|registrar|register|upsert|finalize|finalizar|link|archive|confirm|prepare|reopen|correct|remove|void|publish|cancel|close|pay|reverse|save|recalculate|apply|delete|settle|reactivate|inactivate|grant|revoke)(?:_|$)/.test(name) || name==='bc_quick_visit';
}

export function startLiveRefresh({root=document,view=root.defaultView||globalThis.window,tasks=[],authorize=null,intervalMs=30000,onError=()=>{}}={}) {
  let inFlight=null,stopped=false;
  function markDirty(event){const field=event.target.closest?.(EDITABLE);if(!field || field.closest('.bcg-inline-filters'))return;const form=field.closest('form');if(form)form.dataset.bcDirty='true';else if((field.type==='checkbox'&&!field.checked)||field.value==='')delete field.dataset.bcDirty;else field.dataset.bcDirty='true';}
  function clearDirty(event){if(event.target.tagName==='FORM'){delete event.target.dataset.bcDirty;event.target.querySelectorAll('[data-bc-dirty]').forEach(node=>delete node.dataset.bcDirty);}}
  function canRefresh(task){
    const scope=task.scope?.();
    if(task.scope && (!scope || scope.closest?.('[hidden]')))return false;
    if(scope?.querySelector?.('[data-bc-dirty="true"],form button:disabled[type="submit"]'))return false;
    const focused=root.activeElement;
    return !(scope?.contains?.(focused) && focused?.matches?.(EDITABLE));
  }
  function refresh(){
    if(stopped || root.visibilityState==='hidden' || view.navigator?.onLine===false)return Promise.resolve();
    if(inFlight)return inFlight;
    const run=async()=>{
      if(authorize && !await authorize())return;
      const results=await Promise.allSettled(tasks.filter(canRefresh).map(task=>task.refresh({quiet:true,canApply:()=>!stopped && root.visibilityState!=='hidden' && canRefresh(task)})));
      for(const result of results)if(result.status==='rejected')onError(result.reason);
    };
    inFlight=run().catch(onError).finally(()=>{inFlight=null;});return inFlight;
  }
  const trigger=()=>{refresh();};
  root.addEventListener('input',markDirty);root.addEventListener('change',markDirty);root.addEventListener('reset',clearDirty);
  root.addEventListener('visibilitychange',trigger);
  for(const event of ['focus','pageshow','online',CHANGE_EVENT])view.addEventListener(event,trigger);
  let channel=null;try {if(view.BroadcastChannel)channel=new view.BroadcastChannel(CHANNEL);} catch { /* Polling remains available. */ }
  if(channel)channel.onmessage=event=>{if(event.data?.type==='invalidate')trigger();};
  const timer=view.setInterval(trigger,Math.max(15000,intervalMs));
  function stop(){stopped=true;view.clearInterval(timer);channel?.close();root.removeEventListener('input',markDirty);root.removeEventListener('change',markDirty);root.removeEventListener('reset',clearDirty);root.removeEventListener('visibilitychange',trigger);for(const event of ['focus','pageshow','online',CHANGE_EVENT])view.removeEventListener(event,trigger);view.removeEventListener('pagehide',onPageHide);}
  function onPageHide(event){if(!event.persisted)stop();}
  view.addEventListener('pagehide',onPageHide);
  return {refresh,stop};
}
