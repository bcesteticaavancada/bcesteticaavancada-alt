import {getPushPublicKey,savePushSubscription,removePushSubscription} from './return-reminders-api.js';
export function pushAvailability(env=globalThis){
 if(!env.isSecureContext)return 'Abra o BC Gestão pelo endereço seguro https://www.bcesteticaavancada.com.br/.';
 if(!env.navigator?.serviceWorker||!env.PushManager||!env.Notification)return 'No iPhone, adicione o BC à Tela de Início e abra pelo ícone. Seus lembretes continuam disponíveis nesta tela.';
 if(env.Notification.permission==='denied')return 'As notificações estão bloqueadas nas configurações deste navegador. Seus lembretes continuam nesta tela.';
 return '';
}
function keyBytes(value){const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export async function enableReturnPush({client,env=globalThis}={}){
 const unavailable=pushAvailability(env);if(unavailable)throw Error(unavailable);
 // Permission must be requested directly from the tap, before network awaits (Safari).
 const permission=await env.Notification.requestPermission();if(permission!=='granted')throw Error('Permissão não concedida. O lembrete permanece na gestão.');
 const publicKey=await getPushPublicKey({client});if(!publicKey)throw Error('Notificações do aparelho ainda estão sendo configuradas. Use a caixa de lembretes.');
 const registration=await env.navigator.serviceWorker.register('/gestao/return-reminder-sw.js',{scope:'/gestao/'});
 await env.navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
 await savePushSubscription({client,subscription:subscription.toJSON()});return subscription;
}
export async function disableReturnPush({client,env=globalThis}={}){
 if(!env.navigator?.serviceWorker)return;
 const registration=await env.navigator.serviceWorker.getRegistration('/gestao/');
 const subscription=await registration?.pushManager?.getSubscription();if(!subscription)return;
 await removePushSubscription({client,endpoint:subscription.endpoint});await subscription.unsubscribe();
}
