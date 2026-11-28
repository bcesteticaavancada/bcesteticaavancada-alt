export const categories = ['tcle_externo','exame_documento_apresentado','documento_digitalizado','relatorio_externo','outro_clinico'];
export const methods = ['pix','dinheiro','credito','debito','transferencia'];
const text = (maxLength = 120) => ({type:'string', minLength:1, maxLength});
const choice = values => ({type:'string', enum:values});
const integer = maximum => ({type:'integer', minimum:1, maximum});
const date = {type:'string',format:'date'};
const key = {type:'string',pattern:'^[a-f0-9]{64}$'};
const uuid = {type:'string',format:'uuid'};
const object = (properties,required=Object.keys(properties)) => ({type:'object',additionalProperties:false,properties,required});
const array = (items,maxItems) => ({type:'array',items,maxItems});
const personal = {
  nome:text(), telefone:{type:'string',pattern:'^[0-9]{10,11}$'},email:{...text(180),format:'email'},
  data_nascimento:date,cpf:{type:'string',pattern:'^[0-9]{11}$'},logradouro:text(),numero:text(16),
  complemento:text(),bairro:text(80),cidade:text(80),uf:{type:'string',pattern:'^[A-Z]{2}$'},cep:{type:'string',pattern:'^[0-9]{8}$'}
};
const money=integer(1000000000);
const visit={cliente_id:uuid,procedimento:text(),profissional:text(),data:date,hora:{type:'string',pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'}};
function define(label,fields,required){return {label,fields,required};}
export const types={
  cadastro:define('Cadastro', personal, ['nome','telefone']),
  atualizacao_cadastral:define('Atualização cadastral',{cliente_id:uuid,...personal},['cliente_id']),
  atendimento:define('Atendimento e procedimento',{...visit,contratado_centavos:money},Object.keys(visit)),
  recebimento:define('Recebimento',{cliente_id:uuid,atendimento_id:uuid,valor_centavos:money,meio:choice(methods),data:date,conferencia:choice(['recebimento_conferido'])},['cliente_id','atendimento_id','valor_centavos','meio','data','conferencia']),
  despesa:define('Despesa',{descricao:text(),valor_centavos:money,competencia:date,situacao:choice(['a_pagar','paga']),pago_em:date},['descricao','valor_centavos','competencia','situacao']),
  parcelamento:define('Saldo e parcelas a receber',{cliente_id:uuid,atendimento_id:uuid,saldo_centavos:money,parcelas:integer(72),vencimento:date},['cliente_id','atendimento_id','saldo_centavos','parcelas','vencimento']),
  agendamento:define('Agendamento ou retorno',{...visit,finalidade:choice(['agendamento','retorno']),atendimento_id:uuid},Object.keys(visit)),
  documento:define('Pasta privada da cliente',{cliente_id:uuid,titulo:text(),categoria:choice(categories),data:date},['cliente_id','titulo','categoria']),
  vinculo_documental:define('Vínculo ao atendimento',{cliente_id:uuid,documento_id:uuid,atendimento_id:uuid},['cliente_id','documento_id','atendimento_id'])
};
export const engines={texto:['parser_texto_local'],audio:['vosk_wasm_local','transcricao_manual'],fotografia:['tesseract_wasm_local','conferencia_manual'],pdf_texto_nativo:['pdfjs_nativo_local'],pdf_digitalizado:['pdfjs_tesseract_local','conferencia_manual']};
const mime=choice(['text/plain','image/png','image/jpeg','image/webp','application/pdf','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac']);
export const sourceSchema=object({modalidade:choice(Object.keys(engines)),mime_type:mime,sha256_arquivo:key,motor_utilizado:choice([...new Set(Object.values(engines).flat())]),processado_100_local:{const:true},confianca_global:{type:['number','null'],minimum:0,maximum:1}});
const evidenceSchema=object({campo:text(40),trecho:text(160),pagina:{type:['integer','null'],minimum:1,maximum:20}});
const opBase={id:uuid,intake_id:uuid,tipo:choice(Object.keys(types)),campos:{},campos_faltantes:array(text(40),32),evidencias:array(evidenceSchema,20),dependencias:array(uuid,12),
 estado_revisao:choice(['rascunho','em_conferencia','confirmada','cancelada']),identidade_autorizada:uuid,chave_idempotencia:key,
 expira_em:{type:['string','null'],format:'date-time'},resultado:choice(['pendente','registrado_em_homologacao','cancelado']),
 referencia_oficial:{type:'null'},referencia_homologacao:{type:['string','null'],format:'uuid'},origem_captura:sourceSchema};
export const schema={
 $schema:'https://json-schema.org/draft/2020-12/schema',title:'Maya Executiva · envelope sintético v1',
 ...object({versao_contrato:{const:'1.0.0'},intake_id:uuid,chave_idempotencia:key,criado_em:{type:'string',format:'date-time'},origem_captura:sourceSchema,
 governanca:object({ambiente:{const:'homologacao_sintetica'},revisao_humana:{const:true},provedor_externo:{const:false}}),
 entidades:{type:'array',minItems:1,maxItems:12,items:{allOf:[{$ref:'#/$defs/operacao'},{oneOf:Object.entries(types).map(([name,spec])=>({type:'object',properties:{tipo:{const:name},campos:object(spec.fields,[])},required:['tipo','campos']}))}]}}}),
 $defs:{operacao:object(opBase)}
};
export function matchValue(spec,value){
  if(value===null)return Array.isArray(spec.type)&&spec.type.includes('null');
  if(spec.const!==undefined)return value===spec.const;
  if(spec.enum)return spec.enum.includes(value);
  const kind=Array.isArray(spec.type)?spec.type[0]:spec.type;
  if(kind==='integer'||kind==='number')return Number.isFinite(value)&&(kind!=='integer'||Number.isSafeInteger(value))&&value>=spec.minimum&&value<=spec.maximum;
  if(typeof value!=='string'||(spec.minLength&&value.trim().length<spec.minLength)||(spec.maxLength&&value.length>spec.maxLength))return false;
  if(spec.pattern&&!new RegExp(spec.pattern).test(value))return false;
  if(spec.format==='uuid')return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if(spec.format==='date')return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith('0000')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(spec.format==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return true;
}
export function checkedFields(type,fields){
  if(!Object.hasOwn(types,type)||!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('Operação inválida.');
  const clean={...fields};
  if(typeof clean.nome==='string')clean.nome=clean.nome.trim().replace(/\s+/gu,' ');
  if(typeof clean.telefone==='string' && /^\s*(?:\+55\s*)?[\d() -]+\s*$/.test(clean.telefone)){
    clean.telefone=clean.telefone.trim().replace(/^\+55/,'').replace(/\D/g,'');
  }
  for(const [k,v] of Object.entries(clean))if(!Object.hasOwn(types[type].fields,k)||!matchValue(types[type].fields[k],v))throw Error('Confira o campo '+k+'.');
  return clean;
}
export function missing(type,fields){
  const result=types[type].required.filter(k=>fields[k]==null);
  if(fields.nome&&fields.nome.trim().split(/\s+/).length<2)result.push('nome');
  if(type==='atualizacao_cadastral'&&Object.keys(fields).length<2)result.push('alteracao');
  if(type==='despesa'&&fields.situacao==='paga'&&!fields.pago_em)result.push('pago_em');
  if(type==='despesa'&&fields.situacao==='a_pagar'&&fields.pago_em)result.push('situacao');
  if(type==='parcelamento'&&fields.parcelas>fields.saldo_centavos)result.push('parcelas');
  if(type==='agendamento'&&fields.finalidade==='retorno'&&!fields.atendimento_id)result.push('atendimento_id');
  if(fields.data_nascimento&&fields.data_nascimento>new Date().toISOString().slice(0,10))result.push('data_nascimento');
  if(fields.cpf){
    const n=fields.cpf; let valid=!/^(\d)\1{10}$/.test(n);
    for(let k=9;k<11;k++){let sum=0;for(let i=0;i<k;i++)sum+=Number(n[i])*(k+1-i);valid&&=((sum*10)%11)%10===Number(n[k]);}
    if(!valid)result.push('cpf');
  }
  return [...new Set(result)];
}
export function validSource(s){
 if(!s||Object.keys(s).length!==Object.keys(sourceSchema.properties).length)return false;
 if(!Object.entries(sourceSchema.properties).every(([k,v])=>Object.hasOwn(s,k)&&matchValue(v,s[k])))return false;
 const mime=s.mime_type;
 return engines[s.modalidade].includes(s.motor_utilizado)&&({texto:mime==='text/plain',audio:mime.startsWith('audio/'),fotografia:mime.startsWith('image/'),pdf_texto_nativo:mime==='application/pdf',pdf_digitalizado:mime==='application/pdf'})[s.modalidade];
}
