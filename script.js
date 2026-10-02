const menuToggle=document.getElementById("menuToggle");const siteNav=document.getElementById("siteNav");
menuToggle?.addEventListener("click",()=>{const open=siteNav.classList.toggle("open");menuToggle.setAttribute("aria-expanded",String(open));});
siteNav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{siteNav.classList.remove("open");menuToggle?.setAttribute("aria-expanded","false");}));
document.getElementById("year").textContent=new Date().getFullYear();