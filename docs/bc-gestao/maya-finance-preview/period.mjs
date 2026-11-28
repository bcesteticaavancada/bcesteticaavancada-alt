import {cashScenario,commercialPeriod} from './engine.mjs';
const brl=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const ratio=n=>n===null?'Sem base de cálculo':n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
for(const [id,calculate,labels,formats] of [
  ['caixa',cashScenario,['Saldo realizado','Saldo projetado','Meta de recebimentos'],[brl,brl,ratio]],
  ['comercial',commercialPeriod,['Conversão','Retenção da coorte','Recorrência no período','Satisfação entre respondentes'],[ratio,ratio,ratio,ratio]]
]){
  const form=document.getElementById(id),out=form.querySelector('output');
  form.addEventListener('input',()=>out.replaceChildren());
  form.addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const values=Object.values(calculate(Object.fromEntries(new FormData(form))));
      out.textContent=labels.map((label,i)=>label+': '+formats[i](values[i])).join('\n');
    }catch(error){out.textContent=error.message;}
  });
}
const Recognition=globalThis.SpeechRecognition,dictate=document.getElementById('dictate');
if(Recognition && 'processLocally' in Recognition.prototype){
  dictate.hidden=false;
  dictate.onclick=()=>{
    try{
      const recognizer=new Recognition();
      recognizer.processLocally=true;recognizer.lang='pt-BR';
      recognizer.onresult=e=>{
        const field=document.getElementById('utterance');field.value=e.results[0][0].transcript;
        field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();
      };
      recognizer.onerror=()=>{document.getElementById('voiceStatus').textContent='Ditado local indisponível. Digite o exemplo para revisão.';};
      recognizer.start();
    }catch{document.getElementById('voiceStatus').textContent='O dispositivo não iniciou o ditado local.';}
  };
}
