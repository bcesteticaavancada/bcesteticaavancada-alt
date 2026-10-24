// Inicialização independente: uma área indisponível não interrompe as demais.
export function startDashboard({root=document,areas={},authorize=async()=>true}={}){
 const states=new Map();let stopped=false,opening=0;
 function showError(name,error){const panel=root.getElementById(name);if(!panel||stopped)return;let host=panel.querySelector('[data-area-error]');if(!host){host=root.createElement('div');host.dataset.areaError='true';host.className='bcg-editor-card';host.setAttribute('role','status');panel.prepend(host);}host.replaceChildren();const p=root.createElement('p');p.textContent=error?.message||'Não foi possível carregar esta área.';host.append(p);const button=root.createElement('button');button.type='button';button.className='bcg-small-button';button.textContent='Recarregar aplicativo';button.onclick=()=>root.defaultView?.location?.reload();host.append(button);}
 async function open(name){const version=++opening;if(stopped||!areas[name])return null;
  try{if(!await authorize()||stopped||version!==opening)return null;}catch(error){showError(name,error);return null;}
  root.querySelectorAll('[data-area-panel]').forEach(p=>{p.hidden=p.id!==name;});root.querySelectorAll('[data-area-context]').forEach(p=>{if(p.dataset.areaContext!==name)p.hidden=true;});
  root.querySelectorAll('[data-area-target]').forEach(link=>{if(link.dataset.areaTarget===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  let state=states.get(name);if(!state){state={runtime:null,error:null};states.set(name,state);state.promise=Promise.resolve().then(()=>areas[name].init()).then(runtime=>{state.runtime=runtime||{};return state.runtime;}).catch(error=>{state.error=error;showError(name,error);return null;});}
  if(state.error)showError(name,state.error);return state.promise;
 }
 function refresh(name,options={}){if(stopped)return Promise.resolve(null);const state=states.get(name);return state?.runtime?.refresh?state.runtime.refresh(options):Promise.resolve(null);}
 const changed=event=>{open(event.detail?.area).catch(()=>{});};root.addEventListener('bc:area-changed',changed);
 const first=root.querySelector('[data-area-target][aria-current="page"]')?.dataset.areaTarget||Object.keys(areas)[0];
 const runtime={open,refresh,get:name=>states.get(name)?.runtime||null,destroy(){stopped=true;++opening;root.removeEventListener('bc:area-changed',changed);for(const state of states.values())state.runtime?.destroy?.();}};
 runtime.ready=open(first);return runtime;
}
