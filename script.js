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

const serviceSelect=document.getElementById("serviceSelect");
const dateGrid=document.getElementById("dateGrid");
const calendarMonth=document.getElementById("calendarMonth");
const prevDays=document.getElementById("prevDays");
const nextDays=document.getElementById("nextDays");
const bookingSubmit=document.getElementById("bookingSubmit");
const bookingStatus=document.getElementById("bookingStatus");

let dateOffset=0;
let selectedDate="";
let selectedTime="";

const weekdayShort=["dom","seg","ter","qua","qui","sex","sáb"];
const monthNames=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function getBookingDates(){
  const dates=[];
  const base=new Date();
  base.setHours(12,0,0,0);
  base.setDate(base.getDate()+dateOffset);
  while(dates.length<7){
    const d=new Date(base);
    d.setDate(base.getDate()+dates.length);
    if(d.getDay()!==0 && d.getDay()!==1) dates.push(d);
  }
  return dates;
}

function renderDates(){
  if(!dateGrid) return;
  dateGrid.innerHTML="";
  const dates=getBookingDates();
  if(calendarMonth){
    const first=dates[0], last=dates[dates.length-1];
    calendarMonth.textContent=first.getMonth()===last.getMonth()
      ? `${monthNames[first.getMonth()]} de ${first.getFullYear()}`
      : `${monthNames[first.getMonth()]} / ${monthNames[last.getMonth()]}`;
  }
  dates.forEach(d=>{
    const iso=d.toISOString().slice(0,10);
    const b=document.createElement("button");
    b.type="button";
    b.className="date-card"+(selectedDate===iso?" selected":"");
    b.innerHTML=`<small>${weekdayShort[d.getDay()]}</small><strong>${String(d.getDate()).padStart(2,"0")}</strong>`;
    b.addEventListener("click",()=>{
      selectedDate=iso;
      renderDates();
      bookingStatus.textContent="";
    });
    dateGrid.appendChild(b);
  });
}

document.querySelectorAll(".time-slot").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".time-slot").forEach(x=>x.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTime=btn.dataset.time || "";
    if(bookingStatus) bookingStatus.textContent="";
  });
});

prevDays?.addEventListener("click",()=>{dateOffset=Math.max(0,dateOffset-7);renderDates();});
nextDays?.addEventListener("click",()=>{dateOffset+=7;renderDates();});

bookingSubmit?.addEventListener("click",()=>{
  const service=serviceSelect?.value || "";
  const name=document.getElementById("clientName")?.value.trim() || "";
  const phone=document.getElementById("clientPhone")?.value.trim() || "";
  if(!service || !selectedDate || !selectedTime || !name || !phone){
    bookingStatus.textContent="Preencha procedimento, data, horário, nome e WhatsApp.";
    return;
  }
  const [y,m,d]=selectedDate.split("-");
  const formattedDate=`${d}/${m}/${y}`;
  const message=`Olá, BC Estética Avançada! Quero solicitar um agendamento.\n\nProcedimento: ${service}\nData preferida: ${formattedDate}\nHorário de preferência: ${selectedTime}\nNome: ${name}\nWhatsApp: ${phone}\n\nPor favor, confirmem a disponibilidade.`;
  window.open("https://wa.me/5531995184110?text="+encodeURIComponent(message),"_blank","noopener");
});

document.getElementById("year").textContent=new Date().getFullYear();
renderDates();