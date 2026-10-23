import {money,dateTime} from './finance-view.js';
const names={receipt:'Recebimento',commission_payment:'Comissão paga',payment:'Comissão paga',expense:'Despesa'};
const clean=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ');
const csvCell=value=>{let s=clean(value);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const decimal=n=>Number(n||0).toFixed(2).replace('.',',');
export function financeReportCsv(report){
 const lines=[['Resumo financeiro do período',report.clinic],['De',report.from,'Até',report.to],['Gerado em',dateTime(report.generated_at)],[],['Data','Tipo','Descrição','Entrada/Saída','Valor (R$)','Situação','Incluído nos totais']];
 for(const r of report.rows||[])lines.push([dateTime(r.occurred_at),names[r.kind]||r.kind,r.description,r.direction==='in'?'Entrada':'Saída',decimal(r.amount),r.included?'Confirmado':'Cancelado',r.included?'Sim':'Não']);
 lines.push([],['Entradas (R$)',decimal(report.totals.income)],['Saídas (R$)',decimal(report.totals.expense)],['Saldo do período (R$)',decimal(report.totals.balance)]);
 return '\uFEFF'+lines.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
function pdfText(value){return clean(value).replace(/[—–]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7e\xa0-\xff]/g,'?').replace(/[()\\]/g,'\\$&').replace(/[\xa0-\xff]/g,c=>'\\'+c.charCodeAt(0).toString(8).padStart(3,'0'));}
function wrap(value,width=90){const text=clean(value),out=[];let line='';for(const word of text.split(/\s+/)){if(line&&line.length+word.length+1>width){out.push(line);line='';}let rest=word;while(rest.length>width){if(line){out.push(line);line='';}out.push(rest.slice(0,width));rest=rest.slice(width);}line+=(line?' ':'')+rest;}if(line||!out.length)out.push(line);return out;}
export function financeReportPdf(report){
 const pages=[];let commands=[],y=0;
 const text=(value,x,y,size=10,font='F1')=>`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET\n`;
 function page(){if(commands.length)pages.push(commands.join(''));commands=[text(report.clinic||'BC Estética Avançada',44,796,17,'F2'),text('Resumo financeiro do período',44,772,13,'F2'),text(`${report.from} a ${report.to} | Gerado em ${dateTime(report.generated_at)}`,44,752,9),text(`Entradas: ${money(report.totals.income)}   Saídas: ${money(report.totals.expense)}   Saldo: ${money(report.totals.balance)}`,44,728,10,'F2'),'0.8 G 44 715 m 551 715 l S\n'];y=694;}
 page();
 for(const row of report.rows||[]){
  const description=wrap(row.description);const needed=31+description.length*12;
  if(y-needed<65)page();
  commands.push(text(`${dateTime(row.occurred_at)} | ${names[row.kind]||row.kind} | ${row.direction==='in'?'Entrada':'Saída'}: ${money(row.amount)}`,44,y,9,'F3'));y-=14;
  commands.push(text(row.included?'Confirmado - incluído nos totais':'Cancelado - excluído dos totais',44,y,9));y-=13;
  for(const line of description){if(y<65)page();commands.push(text(line,44,y,9,'F3'));y-=12;}y-=10;
 }
 if(!(report.rows||[]).length)commands.push(text('Nenhum movimento no período.',44,y));
 pages.push(commands.join(''));
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'];
 const kids=[];
 pages.forEach((stream,i)=>{const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);stream+=text(`Página ${i+1} de ${pages.length} | Resumo dos lançamentos registrados`,44,36,8);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamId} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);});
 objects[1]=`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=pdf.length;
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Uint8Array.from(pdf,c=>c.charCodeAt(0));
}
export function downloadFinanceReport({report,format,root=document}){const pdf=format==='pdf',blob=new Blob([pdf?financeReportPdf(report):financeReportCsv(report)],{type:pdf?'application/pdf':'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=root.createElement('a');a.href=url;a.download=`bc-resumo-${report.from}-${report.to}.${pdf?'pdf':'csv'}`;root.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
