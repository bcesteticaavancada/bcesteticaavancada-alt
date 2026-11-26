function cents(value){
 const s=String(value??'').trim();
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))throw Error('Informe um valor em reais, com até dois centavos decimais.');
 const [whole,decimal='']=s.replace(/\./g,'').split(',');
 const n=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<0||n>1000000000)throw Error('Valor fora do limite da demonstração.');
 return n;
}

function rate(value){const n=cents(value);if(n>10000)throw Error('Comissão deve estar entre 0 e 100%.');return n;}

function preview(input){
 const professional=String(input.professional??'').trim(),procedure=String(input.procedure??'').trim(),method=String(input.method??'').trim();
 if(!professional||!procedure||!['pix','dinheiro','credito','debito','pendente'].includes(method))throw Error('Preencha profissional, procedimento e meio de pagamento.');
 const gross=cents(input.gross),received=cents(input.received),cost=cents(input.cost),fee=cents(input.fee),bps=rate(input.commission);
 if(!gross||received>gross||((method==='pendente')!==(received===0)))throw Error('Confira o total, o recebido e o meio de pagamento.');
 if(!['gross','received'].includes(input.basis))throw Error('Selecione a base de comissão.');
 const commission=Math.floor(((input.basis==='gross'?gross:received)*bps+5000)/10000);
 return Object.freeze({professional,procedure,method,gross,received,cost,fee,bps,basis:input.basis,commission,outstanding:gross-received,contribution:gross-cost-fee-commission});
}

function parseExample(text){
 const m=String(text??'').trim().match(/^Hoje\s+a\s+([\p{L}][\p{L}\s'-]{0,60}?)\s+realizou\s+um\s+procedimento\s+de\s+(?:R\$\s*)?([\d.,]+)\s+reais,\s+recebeu\s+no\s+Pix,\s+a\s+comissão\s+dela\s+é\s+de\s+([\d,]+)%\s+e\s+gastamos\s+(?:R\$\s*)?([\d.,]+)\s+reais\s+de\s+material\.?$/iu);
 if(!m)throw Error('Formato demonstrativo não reconhecido. Preencha os campos manualmente; nenhuma informação foi presumida.');
 return {professional:m[1],procedure:'',gross:m[2],received:m[2],method:'pix',commission:m[3],cost:m[4],fee:'',basis:''};
}

function commitPreview(state,draft,key){
 if(!draft||!key||state.some(x=>x.key===key))throw Error('Prévia ausente ou já confirmada.');
 return [...state,Object.freeze({...draft,key})];
}
export {cents,rate,preview,parseExample,commitPreview};
