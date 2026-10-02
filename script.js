const menuToggle=document.getElementById("menuToggle");
const siteNav=document.getElementById("siteNav");

function closeMenu(){
  siteNav?.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded","false");
  document.body.classList.remove("menu-open");
}

menuToggle?.addEventListener("click",()=>{
  const open=siteNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded",String(open));
  document.body.classList.toggle("menu-open",open);
});

siteNav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
document.addEventListener("keydown",e=>{if(e.key==="Escape") closeMenu();});
document.getElementById("year").textContent=new Date().getFullYear();