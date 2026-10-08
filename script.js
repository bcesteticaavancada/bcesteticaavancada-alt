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

function ensureBCFooter(){
  if(document.querySelector('footer[data-bc-footer="home"]'))return;
  const existing=document.querySelector("footer.footer");
  let footer=document.querySelector("footer.site-footer-bc");
  if(existing){
    footer=existing;
    footer.className="site-footer-bc";
  }
  if(!footer){
    footer=document.createElement("footer");
    footer.className="site-footer-bc";
    const wa=document.querySelector(".whatsapp-float");
    if(wa&&wa.parentNode) wa.parentNode.insertBefore(footer,wa);
    else document.body.appendChild(footer);
  }
  footer.setAttribute("aria-label","Informações e contato da BC Estética Avançada");
  footer.innerHTML="\n<footer class=\"site-footer-bc\" aria-label=\"Informações e contato da BC Estética Avançada\">\n  <div class=\"bc-footer-grid\">\n    <section>\n      <span class=\"bc-footer-kicker\">BC Estética Avançada</span>\n      <h2 class=\"bc-footer-title\">Menos achismo. Mais ciência.</h2>\n      <p class=\"bc-footer-copy\">Avaliação individualizada, planejamento e uma experiência de cuidado pensada para cada pessoa.</p>\n      <div class=\"bc-footer-actions\">\n        <a class=\"bc-footer-action wa\" href=\"https://wa.me/5531995184110\" target=\"_blank\" rel=\"noopener\" aria-label=\"Falar com a BC Estética pelo WhatsApp\">\n          <span aria-hidden=\"true\">◉</span> WhatsApp\n        </a>\n        <a class=\"bc-footer-action\" href=\"https://bcesteticaavancada.github.io/bcesteticaavancada-alt/agendamento/\">\n          Faça sua Anamnese <span>(Pré-avaliação)</span>\n        </a>\n      </div>\n    </section>\n\n    <section>\n      <span class=\"bc-footer-label\">Onde estamos</span>\n      <p class=\"bc-footer-address\">Rua Gávea, 358 — Loja 02 — 2º andar<br>Nova Suissa, Belo Horizonte — MG</p>\n      <div style=\"height:18px\"></div>\n      <span class=\"bc-footer-label\">Contato</span>\n      <div class=\"bc-footer-contact\">\n        <a href=\"tel:+5531995184110\">(31) 99518-4110</a>\n        <a href=\"mailto:bcesteticaav@gmail.com\">bcesteticaav@gmail.com</a>\n      </div>\n    </section>\n\n    <section>\n      <span class=\"bc-footer-label\">Localização</span>\n      <div class=\"bc-footer-map\">\n        <iframe\n          title=\"Mapa da localização da BC Estética Avançada\"\n          src=\"https://www.google.com/maps?q=Rua%20G%C3%A1vea%2C%20358%2C%20Loja%2002%2C%202%C2%BA%20andar%2C%20Nova%20Suissa%2C%20Belo%20Horizonte%2C%20MG&output=embed\"\n          loading=\"lazy\"\n          referrerpolicy=\"no-referrer-when-downgrade\"\n          allowfullscreen>\n        </iframe>\n        <a class=\"bc-footer-map-link\" href=\"https://share.google/eh2hDmG6O5gNHK10i\" target=\"_blank\" rel=\"noopener\">\n          Abrir no Google Maps\n        </a>\n      </div>\n    </section>\n  </div>\n  <div class=\"bc-footer-bottom\">\n    <span>BC Estética Avançada • Belo Horizonte — MG</span>\n    <span>Atendimento: terça a sábado, 09h às 18h</span>\n  </div>\n</footer>";
}
ensureBCFooter();

function installInnerPageHeaderOffset(){
  if(document.querySelector(".home-editorial"))return;
  if(document.getElementById("bc-inner-header-left-offset"))return;

  const style=document.createElement("style");
  style.id="bc-inner-header-left-offset";
  style.textContent=`
.site-header .header-inner{
  transform:translateX(-10vw)!important;
}`;
  document.head.appendChild(style);
}
installInnerPageHeaderOffset();

function installHomeHeroFullBleedFix(){
  if(!document.querySelector(".home-editorial"))return;
  if(document.getElementById("bc-home-hero-fullbleed-fix"))return;

  const style=document.createElement("style");
  style.id="bc-home-hero-fullbleed-fix";
  style.textContent=`
@media(max-width:700px){
  .site-header .header-inner{
    transform:translateX(-5vw)!important;
  }
  .home-hero .hero-team-wrap{
    position:absolute!important;
    inset:0!important;
    width:100%!important;
    height:100%!important;
    min-height:0!important;
    margin:0!important;
    transform:none!important;
    overflow:hidden!important;
  }
  .home-hero .hero-team-image{
    position:absolute!important;
    inset:0!important;
    width:100%!important;
    height:100%!important;
    max-width:none!important;
    margin:0!important;
    object-fit:cover!important;
    object-position:74% center!important;
    transform:none!important;
    filter:brightness(1.08) contrast(1.03) saturate(1.02)!important;
  }
  .home-hero::before{
    background:
      linear-gradient(90deg,rgba(6,4,3,.32) 0%,rgba(9,6,4,.20) 31%,rgba(10,7,5,.10) 52%,rgba(10,7,5,.02) 80%),
      linear-gradient(180deg,rgba(255,229,185,.015),transparent 42%,rgba(0,0,0,.05))!important;
  }
  .home-hero .hero-actions,
  .home-hero .hero-treatment-link{
    transform:translateY(15vh)!important;
  }
}`;
  document.head.appendChild(style);
}
installHomeHeroFullBleedFix();

window.BCMenuReady=true;