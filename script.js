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

if(toggle){toggle.addEventListener("click",function(){setMenu(!drawer.classList.contains("is-open"));});}
if(closeButton)closeButton.addEventListener("click",closeMenu);
if(overlay)overlay.addEventListener("click",closeMenu);
if(drawer){drawer.querySelectorAll("a").forEach(function(link){link.addEventListener("click",closeMenu);});}
document.addEventListener("keydown",function(event){if(event.key==="Escape")closeMenu();});

const currentPath=window.location.pathname.replace(/index\.html$/,"");
if(drawer){
  drawer.querySelectorAll("a").forEach(function(link){
    const href=link.getAttribute("href");
    if(!href||href.indexOf("http")===0)return;
    const absolute=new URL(href,window.location.href).pathname.replace(/index\.html$/,"");
    if(absolute===currentPath)link.classList.add("active");
  });
}

function ensureBCFooter(){
  const existing=document.querySelector("footer.footer");
  let footer=document.querySelector("footer.site-footer-bc");
  if(existing){footer=existing;footer.className="site-footer-bc";}
  if(!footer){
    footer=document.createElement("footer");
    footer.className="site-footer-bc";
    const wa=document.querySelector(".whatsapp-float");
    if(wa&&wa.parentNode)wa.parentNode.insertBefore(footer,wa);else document.body.appendChild(footer);
  }
  footer.setAttribute("aria-label","Informações e contato da BC Estética Avançada");
  footer.innerHTML="<div class=\"bc-footer-grid\"><section><span class=\"bc-footer-kicker\">BC Estética Avançada</span><h2 class=\"bc-footer-title\">Menos achismo. Mais ciência.</h2><p class=\"bc-footer-copy\">Avaliação individualizada, planejamento e uma experiência de cuidado pensada para cada pessoa.</p><div class=\"bc-footer-actions\"><a class=\"bc-footer-action wa\" href=\"https://wa.me/5531995184110\" target=\"_blank\" rel=\"noopener\">WhatsApp</a><a class=\"bc-footer-action\" href=\"https://bcesteticaavancada.github.io/bcesteticaavancada-alt/agendamento/\">Faça sua Anamnese <span>(Pré-avaliação)</span></a></div></section><section><span class=\"bc-footer-label\">Onde estamos</span><p class=\"bc-footer-address\">Rua Gávea, 358 — Loja 02 — 2º andar<br>Nova Suissa, Belo Horizonte — MG</p><div style=\"height:18px\"></div><span class=\"bc-footer-label\">Contato</span><div class=\"bc-footer-contact\"><a href=\"tel:+5531995184110\">(31) 99518-4110</a><a href=\"mailto:bcesteticaav@gmail.com\">bcesteticaav@gmail.com</a></div></section><section><span class=\"bc-footer-label\">Localização</span><div class=\"bc-footer-map\"><iframe title=\"Mapa da localização da BC Estética Avançada\" src=\"https://www.google.com/maps?q=Rua%20G%C3%A1vea%2C%20358%2C%20Loja%2002%2C%202%C2%BA%20andar%2C%20Nova%20Suissa%2C%20Belo%20Horizonte%2C%20MG&output=embed\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\" allowfullscreen></iframe><a class=\"bc-footer-map-link\" href=\"https://share.google/eh2hDmG6O5gNHK10i\" target=\"_blank\" rel=\"noopener\">Abrir no Google Maps</a></div></section></div><div class=\"bc-footer-bottom\"><span>BC Estética Avançada • Belo Horizonte — MG</span><span>Atendimento: terça a sábado, 09h às 18h</span></div>";
}
ensureBCFooter();
window.BCMenuReady=true;

(function initBCVideoCampaign(){
  if(window.BCVideoReady)return;
  const dialog=document.getElementById("bcVideoDialog");
  const player=document.getElementById("bcVideoPlayer");
  const title=document.getElementById("bcVideoTitle");
  const close=document.getElementById("bcVideoClose");
  const triggers=document.querySelectorAll("[data-video-src]");
  if(!dialog||!player||!triggers.length)return;
  let lastTrigger=null;

  const posterFallbacks={
    "Rejuvenescimento facial":"assets/05-sala-procedimentos.jpg",
    "Peeling Coreano":"assets/06-sala-atendimento.jpg",
    "Tecnologia corporal":"assets/05-sala-procedimentos.jpg",
    "Massagem e cuidado corporal":"assets/04-sala-massagem.jpg"
  };

  triggers.forEach(function(trigger){
    const poster=trigger.querySelector(".bc-video-poster img");
    const videoTitle=trigger.getAttribute("data-video-title")||"";
    if(poster&&posterFallbacks[videoTitle])poster.setAttribute("src",posterFallbacks[videoTitle]);
  });

  async function resolveVideoSource(originalSrc){
    let src=originalSrc.replace(/\.mp4(?=$|[?#])/i,".txt");
    const response=await fetch(src,{cache:"force-cache"});
    if(!response.ok)throw new Error("Não foi possível carregar o vídeo da BC.");
    const encoded=await response.text();
    if(!encoded.trim().startsWith("data:video/mp4;base64,"))throw new Error("Mídia da BC inválida.");
    return encoded.trim();
  }

  async function openVideo(trigger){
    const originalSrc=trigger.getAttribute("data-video-src");
    if(!originalSrc)return;
    lastTrigger=trigger;
    trigger.setAttribute("aria-busy","true");
    if(title)title.textContent=trigger.getAttribute("data-video-title")||"Vídeo BC";
    try{
      const resolvedSrc=await resolveVideoSource(originalSrc);
      if(lastTrigger!==trigger)return;
      player.src=resolvedSrc;
      player.load();
      if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
      const playing=player.play();
      if(playing&&typeof playing.catch==="function")playing.catch(function(){});
    }catch(error){
      console.warn("BC video:",error);
    }finally{
      trigger.removeAttribute("aria-busy");
    }
  }

  function closeVideo(){
    player.pause();
    try{player.currentTime=0;}catch(error){}
    player.removeAttribute("src");
    player.load();
    if(dialog.open&&typeof dialog.close==="function")dialog.close();else dialog.removeAttribute("open");
    if(lastTrigger&&typeof lastTrigger.focus==="function")lastTrigger.focus();
    lastTrigger=null;
  }

  triggers.forEach(function(trigger){trigger.addEventListener("click",function(){openVideo(trigger);});});
  if(close)close.addEventListener("click",closeVideo);
  dialog.addEventListener("cancel",function(event){event.preventDefault();closeVideo();});
  dialog.addEventListener("click",function(event){if(event.target===dialog)closeVideo();});
  window.BCVideoReady=true;
})();