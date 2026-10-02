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
function closeMenu(){setMenu(false)}

if(toggle){
  toggle.addEventListener("click",function(){
    setMenu(!drawer.classList.contains("is-open"));
  });
}
if(closeButton)closeButton.addEventListener("click",closeMenu);
if(overlay)overlay.addEventListener("click",closeMenu);
if(drawer){
  drawer.querySelectorAll("a").forEach(function(link){
    link.addEventListener("click",closeMenu);
  });
}
document.addEventListener("keydown",function(event){
  if(event.key==="Escape")closeMenu();
});

const currentPath=window.location.pathname.replace(/index\.html$/,"");
if(drawer){
  drawer.querySelectorAll("a").forEach(function(link){
    const href=link.getAttribute("href");
    if(!href||href.indexOf("http")===0)return;
    const absolute=new URL(href,window.location.href).pathname.replace(/index\.html$/,"");
    if(absolute===currentPath)link.classList.add("active");
  });
}

window.BCMenuReady=true;