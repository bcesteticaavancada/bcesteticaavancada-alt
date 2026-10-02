const toggle=document.getElementById("menuToggle");
const drawer=document.getElementById("siteDrawer");
const overlay=document.getElementById("menuOverlay");
const closeButton=document.getElementById("drawerClose");
let lastFocusedElement=null;

function setMenu(open){
  if(!toggle||!drawer||!overlay)return;
  if(open) lastFocusedElement=document.activeElement;
  toggle.classList.toggle("is-open",open);
  drawer.classList.toggle("is-open",open);
  overlay.classList.toggle("is-open",open);
  toggle.setAttribute("aria-expanded",String(open));
  toggle.setAttribute("aria-label",open?"Fechar menu":"Abrir menu");
  drawer.setAttribute("aria-hidden",String(!open));
  overlay.setAttribute("aria-hidden",String(!open));
  document.body.classList.toggle("menu-open",open);
  if(open) closeButton?.focus();
  else lastFocusedElement?.focus?.();
}

function closeMenu(){setMenu(false)}

toggle?.addEventListener("click",()=>setMenu(!drawer.classList.contains("is-open")));
closeButton?.addEventListener("click",closeMenu);
overlay?.addEventListener("click",closeMenu);

drawer?.querySelectorAll("a").forEach(link=>{
  link.addEventListener("click",closeMenu);
});

document.addEventListener("keydown",(event)=>{
  if(event.key==="Escape"&&drawer?.classList.contains("is-open")) closeMenu();
});

const currentPath=window.location.pathname.replace(/index\.html$/,"");
drawer?.querySelectorAll("a").forEach(link=>{
  const href=link.getAttribute("href");
  if(!href||href.startsWith("http"))return;
  const absolute=new URL(href,window.location.href).pathname.replace(/index\.html$/,"");
  if(absolute===currentPath)link.classList.add("active");
});

let startX=0,startY=0;
document.addEventListener("touchstart",(event)=>{
  if(!event.touches[0]||drawer?.classList.contains("is-open"))return;
  startX=event.touches[0].clientX;
  startY=event.touches[0].clientY;
},{passive:true});

document.addEventListener("touchend",(event)=>{
  if(!event.changedTouches[0]||drawer?.classList.contains("is-open"))return;
  const endX=event.changedTouches[0].clientX;
  const endY=event.changedTouches[0].clientY;
  const dx=endX-startX,dy=endY-startY;
  if(startX<24&&dx>70&&Math.abs(dy)<50)setMenu(true);
},{passive:true});
