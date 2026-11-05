self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 // Deliberately generic: no patient or procedure data on the lock screen.
 event.waitUntil(self.registration.showNotification('BC Gestão — retorno',{
  body:'Você tem um lembrete de retorno. Abra a gestão para conferir.',
  icon:'/assets/app/icon-192.png',badge:'/assets/app/icon-192.png',
  tag:'bc-retorno',data:{url:'/gestao/login/#lembretes'},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=tabs.find(tab=>new URL(tab.url).pathname.startsWith('/gestao/'));
  if(existing){const url=new URL(existing.url);if(/\/gestao\/(admin|colaborador|login)\//.test(url.pathname)){url.hash='lembretes';await existing.navigate(url.href);}await existing.focus();return;}
  await self.clients.openWindow('/gestao/login/#lembretes');
 })());
});
