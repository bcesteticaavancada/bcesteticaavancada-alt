import {cents} from '../maya-finance-preview/engine.mjs';
import {types} from './contract.mjs';

const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function extract({message='',text='',source,kind='auto',filename=''}){
  // Intent only comes from the operator's message or an explicit type selection.
  // OCR, PDF text and transcripts of attached documents supply field candidates only.
  const intent=normalize(message), data=(text+'\n'+message).slice(0,16000);
  const out=[];
  const first=(rx,group=1)=>data.match(rx)?.[group]?.trim();
  function operation(tipo,values,dependencies=[]){
    const fields={},evidence=[];
    for(const [field,pair] of Object.entries(values)){
      if(!pair||pair[0]==null||pair[0]==='')continue;
      fields[field]=pair[0];
      if(pair[1])evidence.push({campo:field,trecho:String(pair[1]).slice(0,160),pagina:null});
    }
    out.push({tipo,campos:fields,evidencias:evidence,depends:dependencies,origem_captura:source});
  }
  const wanted=(type,rx)=>kind===type||(kind==='auto'&&rx.test(intent));
  const field=(rx,fn=value=>value)=>{const s=first(rx);return s?[fn(s),s]:null;};
  const amount=rx=>field(rx,s=>{try{return cents(s)>0?cents(s):null;}catch{return null;}});
  const cash=/\b(?:pagou|pago|recebi|recebido|recebeu|recebimento)(?:\s+(?:no|via|em)\s+pix)?\s*(?:de\s+)?(?:R\$\s*)?([0-9][\d.,]*\d|\d)/iu;
  const gross=/\b(?:procedimento|contratado|total)(?:\s+de)?\s*[:=]?\s*(?:R\$\s*)?([0-9][\d.,]*\d|\d)/iu;
  const price=amount(gross),paid=amount(cash);
  const day=field(/\b(\d{4}-\d\d-\d\d)\b/u);
  const capturedName=field(/(?:^|[\n;,.]\s*|\b)(?:nome(?: completo)?|cadastre(?: a cliente)?|cliente)\s*:\s*([\p{L}][\p{L}'’-]*(?:[ \t]+[\p{L}][\p{L}'’-]*){1,9})/iu);
  const person={nome:capturedName,telefone:field(/(?:tel(?:efone)?|celular|whatsapp)\s*:?\s*(?:\+55\s*)?(\(?\d{2}\)?\s*\d{4,5}[- ]?\d{4})/iu,s=>s.replace(/\D/g,'')),email:field(/\b([^\s@:;,]+@[^\s@;,]+\.[\p{L}]{2,})\b/iu),cpf:field(/\bcpf\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/iu,s=>s.replace(/\D/g,'')),data_nascimento:field(/nascimento\s*:\s*(\d{4}-\d\d-\d\d)/iu),logradouro:field(/(?:endereço|logradouro)\s*:\s*([^\n;]{2,100})/iu)};
  if(wanted('cadastro',/\b(cadastre|cadastrar|cadastro|crie (?:a |uma )?cliente)\b/) && !/atualiz/.test(intent))operation('cadastro',person);
  if(wanted('atualizacao_cadastral',/atualiz/))operation('atualizacao_cadastral',person);
  const parent=out.some(x=>x.tipo==='cadastro')?['cadastro']:[];
  const visit={procedimento:field(/procedimento\s*:\s*([^;,\n]{2,80})/iu),profissional:field(/profissional\s*:\s*([^;,\n]{2,80})/iu),data:day,hora:field(/\b([01]\d:[0-5]\d|2[0-3]:[0-5]\d)\b/)};
  if(wanted('atendimento',/atendimento|realizou|procedimento de/))operation('atendimento',{...visit,contratado_centavos:price},parent);
  const visitParent=out.some(x=>x.tipo==='atendimento')?[...parent,'atendimento']:parent;
  if(wanted('recebimento',/recebi|recebimento|pagou|recebeu/)){
    const method=field(/\b(pix|dinheiro|crédito|débito|transferência)\b/iu,normalize);
    operation('recebimento',{valor_centavos:paid,meio:method,data:day},visitParent);
  }
  if(wanted('despesa',/despesa|gastamos|gastei|conta a pagar/)){
    operation('despesa',{descricao:field(/(?:descrição|despesa)\s*:\s*([^;\n]{2,100})/iu),valor_centavos:amount(/(?:despesa|gastei|gastamos|valor)\s*(?:de|:)?\s*(?:R\$\s*)?([0-9][\d.,]*\d|\d)/iu),competencia:day,situacao:field(/\b(a pagar|paga)\b/iu,v=>normalize(v).replace(' ','_'))});
  }
  if(wanted('parcelamento',/parcel|restante|saldo|pendente/)){
    const balance=price&&paid&&price[0]>paid[0]?[price[0]-paid[0],price[1]+' menos '+paid[1]]:amount(/(?:saldo|restante)\s*(?:de|:)?\s*(?:R\$\s*)?([0-9][\d.,]*\d|\d)/iu);
    operation('parcelamento',{saldo_centavos:balance,parcelas:field(/\b(\d{1,2})\s*(?:parcelas?|x\b)/iu,Number),vencimento:field(/vencimento\s*:\s*(\d{4}-\d\d-\d\d)/iu)},visitParent);
  }
  if(wanted('agendamento',/retorno|agend/)){
    const isReturn=/retorno/.test(intent);
    operation('agendamento',{procedimento:visit.procedimento,profissional:visit.profissional,finalidade:[isReturn?'retorno':'agendamento']},isReturn?visitParent:parent);
  }
  const file=source.modalidade==='fotografia'||source.modalidade.startsWith('pdf_');
  if(file&&(kind==='auto'||kind==='documento'||kind==='vinculo_documental'))operation('documento',{titulo:[filename.slice(0,120)||'Documento',''],categoria:[/\btcle\b/i.test(data)?'tcle_externo':'documento_digitalizado','']},parent);
  if(file&&(kind==='vinculo_documental'||(kind==='auto'&&out.some(x=>x.tipo==='atendimento'))))operation('vinculo_documental',{},[...visitParent,'documento']);
  if(kind!=='auto'&&!Object.hasOwn(types,kind))throw Error('Tipo de operação indisponível.');
  return out;
}
