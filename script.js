const toggle=document.getElementById("menuToggle");
const drawer=document.getElementById("siteDrawer");
const overlay=document.getElementById("menuOverlay");
const closeButton=document.getElementById("drawerClose");

function setMenu(open){
  if(!toggle||!drawer||!overlay)return;
  toggle.classList.toggle("is-open",open);
  drawer.classList.toggle("is-open",open);
  overlay.classList.toggle("is-open",open);
  toggle.setAttribute("aria-expanded",String(open));
  toggle.setAttribute("aria-label",open?"Fechar menu":"Abrir menu");
  drawer.setAttribute("aria-hidden",String(!open));
  overlay.setAttribute("aria-hidden",String(!open));
  document.body.classList.toggle("menu-open",open);
}

toggle?.addEventListener("click",()=>setMenu(!drawer.classList.contains("is-open")));
closeButton?.addEventListener("click",()=>setMenu(false));
overlay?.addEventListener("click",()=>setMenu(false));
drawer?.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>setMenu(false)));
document.addEventListener("keydown",(event)=>{
  if(event.key==="Escape")setMenu(false);
});
document.addEventListener("click",(event)=>{
  if(event.target.closest(".drawer-nav a"))setMenu(false);
});