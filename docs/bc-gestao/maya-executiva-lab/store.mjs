import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {types,checkedFields,missing,validSource} from './contract.mjs';
import {identify} from './media-format.mjs';
import {canReadCash,reviewTtlMs} from '../../../supabase/functions/bc-central/handler.mjs';
export const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const fault=(status,message)=>Object.assign(new Error(message),{status});
const deny=()=>{throw fault(403,'Acesso indisponível para este perfil ou registro.');};
const normalize=s=>s.trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ');
const read=row=>row&&JSON.parse(row.body);
const isId=s=>typeof s==='string'&&/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(s);
const reference={cliente_id:'cadastro',atendimento_id:'atendimento',documento_id:'documento'};
const depField={cadastro:'cliente_id',atendimento:'atendimento_id',documento:'documento_id'};
const clinicTime = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export const clinicTimestamp = date => clinicTime.format(date);
export const actorDemo='00000000-0000-4000-8000-000000000001';
export class ReviewStore {
 constructor({clock=Date.now,beforeCommit=()=>{},databasePath=':memory:'}={}){
  this.clock=clock;this.beforeCommit=beforeCommit;
  this.db=new DatabaseSync(databasePath);
  this.db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,role TEXT NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)));
    CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,actor TEXT NOT NULL,session TEXT NOT NULL,body TEXT NOT NULL,proof TEXT,expires INTEGER,version TEXT);
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,actor TEXT NOT NULL,kind TEXT NOT NULL,uniq TEXT NOT NULL,body TEXT NOT NULL,UNIQUE(actor,kind,uniq));
    CREATE TABLE IF NOT EXISTS originals(id TEXT PRIMARY KEY REFERENCES records(id),actor TEXT NOT NULL,hash TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,UNIQUE(actor,hash));
    CREATE TABLE IF NOT EXISTS quota(id TEXT PRIMARY KEY,day TEXT NOT NULL,month TEXT NOT NULL,micros INTEGER NOT NULL,units INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,role TEXT NOT NULL,event TEXT NOT NULL,op TEXT NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS cash_reservation ON audit(op) WHERE kind='caixa' AND event='iniciada';`);
 }
 transaction(fn){
  this.db.exec('BEGIN IMMEDIATE');
  try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 authorize(p){if(!canReadCash(p)||!isId(p.id)||!p.session)deny();if(p.until<=this.clock())throw fault(401,'Sessão expirada.');}
 event(p,op,event){this.db.prepare('INSERT INTO audit(actor,role,event,op,kind,at) VALUES(?,?,?,?,?,?)').run(p.id,p.role,event,op.id,op.tipo,this.clock());}
 profile(id){
  const row=this.db.prepare('SELECT id,role,active FROM profiles WHERE id=?').get(id);
  return row && {...row,active:row.active===1};
 }
 get(p,id){
  this.authorize(p);
  const row=this.db.prepare('SELECT * FROM drafts WHERE id=? AND actor=? AND session=?').get(id,p.id,p.session);
  if(!row)deny();return row;
 }
 record(p,id,type){
  this.authorize(p);const row=this.db.prepare('SELECT * FROM records WHERE id=? AND actor=? AND kind=?').get(id,p.id,type);
  if(!row)deny();return read(row);
 }
 list(p,type){
  this.authorize(p);if(!['cadastro','atendimento','documento'].includes(type))deny();
  return this.db.prepare('SELECT id,body FROM records WHERE actor=? AND kind=? ORDER BY rowid DESC LIMIT 120').all(p.id,type).map(r=>{
    const f=read(r);return {id:r.id,nome:f.nome||f.titulo||f.procedimento,telefone:f.telefone?.slice(-4),cliente_id:f.cliente_id};
  });
 }
 history(p){this.authorize(p);return this.db.prepare('SELECT actor,role,kind,event,op,at FROM audit WHERE actor=? ORDER BY id DESC LIMIT 60').all(p.id);}
 clientFile(p,id){
  const client=this.record(p,id,'cadastro');
  const rows=this.db.prepare("SELECT id,kind,body FROM records WHERE actor=? AND json_extract(body,'$.cliente_id')=? ORDER BY rowid").all(p.id,id);
  const visits=new Map(rows.filter(r=>r.kind==='atendimento').map(r=>[r.id,{id:r.id,...read(r),retornos:[],documentos:[],recebimentos:[]}]));
  for(const row of rows){
   const f=read(row),visit=visits.get(f.atendimento_id);
   if(!visit)continue;
   if(row.kind==='agendamento')visit.retornos.push({id:row.id,data:f.data,hora:f.hora});
   if(row.kind==='vinculo_documental')visit.documentos.push({id:f.documento_id,categoria:this.record(p,f.documento_id,'documento').categoria});
   if(row.kind==='recebimento')visit.recebimentos.push({id:row.id,data:f.data,valor_centavos:f.valor_centavos});
  }
  return {...client,atendimentos:[...visits.values()]};
 }
 save(p,op,proof=null,expires=null,version=null){
  this.db.prepare('UPDATE drafts SET body=?,proof=?,expires=?,version=? WHERE id=? AND actor=? AND session=?').run(JSON.stringify(op),proof,expires,version,op.id,p.id,p.session);
 }
 intake(p,proposals){
  this.authorize(p);
  if(!Array.isArray(proposals)||!proposals.length||proposals.length>12)throw fault(400,'Escolha até 12 operações por solicitação.');
  return this.transaction(()=>{
    const intake_id=randomUUID(),created=new Date(this.clock()).toISOString(),byType=new Map();
    const ops=proposals.map(s=>{
      if(!s||Object.keys(s).some(k=>!['tipo','campos','evidencias','depends','origem_captura'].includes(k))||!validSource(s.origem_captura))throw fault(400,'Origem inválida.');
      const f=checkedFields(s.tipo,s.campos);
      if(!Array.isArray(s.evidencias)||s.evidencias.length>20||s.evidencias.some(e=>!e||!Object.hasOwn(f,e.campo)||typeof e.trecho!=='string'||!e.trecho.length||e.trecho.length>160||(e.pagina!==null&&!(Number.isInteger(e.pagina)&&e.pagina>=1&&e.pagina<=20))))throw fault(400,'Evidência inválida.');
      if(!Array.isArray(s.depends)||s.depends.length>3||new Set(s.depends).size!==s.depends.length||s.depends.some(t=>!byType.has(t)||!Object.hasOwn(types[s.tipo].fields,depField[t])))throw fault(400,'Dependência inválida.');
      const op={id:randomUUID(),intake_id,tipo:s.tipo,campos:f,campos_faltantes:missing(s.tipo,f),evidencias:s.evidencias.map(({campo,trecho,pagina})=>({campo,trecho,pagina})),dependencias:s.depends.map(t=>byType.get(t)),estado_revisao:'rascunho',identidade_autorizada:p.id,chave_idempotencia:this.key(p,s.tipo,f,s.origem_captura),expira_em:null,resultado:'pendente',referencia_oficial:null,referencia_homologacao:null,origem_captura:s.origem_captura};
      this.db.prepare('INSERT INTO drafts(id,actor,session,body) VALUES(?,?,?,?)').run(op.id,p.id,p.session,JSON.stringify(op));
      this.event(p,op,'rascunho');
      byType.set(s.tipo,op.id);return op;
    });
    return {versao_contrato:'1.0.0',intake_id,chave_idempotencia:digest(canonical([p.id,ops.map(o=>o.chave_idempotencia)])),criado_em:created,origem_captura:ops[0].origem_captura,governanca:{ambiente:'homologacao_sintetica',revisao_humana:true,provedor_externo:false},entidades:ops};
  });
 }
 key(p,type,fields,source){return digest(canonical([p.id,type,fields,source.sha256_arquivo]));}
 validateObjects(p,op,f){
  for(const [field,type] of Object.entries(reference)){
   if(!f[field])continue;const other=this.record(p,f[field],type);
   if(type!=='cadastro'&&other.cliente_id!==f.cliente_id)throw fault(409,'O cadastro e o documento ou atendimento pertencem a clientes diferentes.');
   if(op.tipo==='agendamento'&&type==='atendimento'){
    const at=f.data+' '+f.hora;
    if(at<=other.data+' '+other.hora || at<=clinicTimestamp(this.clock()))throw fault(422,'Escolha um retorno futuro, após o atendimento.');
   }
  }
  if(op.tipo==='recebimento'||op.tipo==='parcelamento'){
   const visit=this.record(p,f.atendimento_id,'atendimento');
   const prior=this.db.prepare("SELECT body FROM records WHERE actor=? AND kind='recebimento' AND json_extract(body,'$.atendimento_id')=?").all(p.id,f.atendimento_id);
   const paid=prior.reduce((sum,row)=>sum+read(row).valor_centavos,0);
   const amount=f.valor_centavos??f.saldo_centavos;
   if(visit.contratado_centavos&&paid+amount>visit.contratado_centavos)throw fault(409,'O valor ultrapassa o saldo do atendimento.');
  }
 }
 review(p,id,fields,{homonimo=false}={}){
  const op=read(this.get(p,id));
  if(!['rascunho','em_conferencia'].includes(op.estado_revisao))throw fault(409,'Cartão encerrado.');
  const f=checkedFields(op.tipo,fields);
  for(const dep of op.dependencias){
   const parent=read(this.get(p,dep));if(parent.estado_revisao!=='confirmada')throw fault(409,'Confira a etapa anterior antes de continuar.');
   const target=depField[parent.tipo];
   if(f[target]&&f[target]!==parent.referencia_homologacao)throw fault(409,'Destino diferente da etapa confirmada.');
   f[target]=parent.referencia_homologacao;
  }
  const absent=missing(op.tipo,f);
  if(absent.length)throw fault(422,'Confira os campos: '+absent.join(', ')+'.');
  this.validateObjects(p,op,f);
  if(['cadastro','atualizacao_cadastral'].includes(op.tipo)){
   const others=this.db.prepare("SELECT id,body FROM records WHERE actor=? AND kind='cadastro'").all(p.id);
   for(const r of others){
    if(r.id===f.cliente_id)continue;
    const other=read(r);
    if((f.telefone&&f.telefone===other.telefone)||(f.cpf&&f.cpf===other.cpf))throw fault(409,'Já existe cadastro com esse telefone ou CPF. Selecione a cliente existente.');
    if(f.nome&&normalize(f.nome)===normalize(other.nome)&&homonimo!==true)throw fault(409,'Há uma cliente homônima. Confira o telefone e sinalize a revisão.');
   }
  }
  if(op.tipo==='documento'&&!['fotografia','pdf_texto_nativo','pdf_digitalizado'].includes(op.origem_captura.modalidade))throw fault(422,'Selecione o arquivo original.');
  const token=randomBytes(32).toString('hex'),expires=this.clock()+reviewTtlMs;
  op.evidencias=op.evidencias.filter(e=>op.campos[e.campo]===f[e.campo]);
  Object.assign(op,{campos:f,campos_faltantes:[],estado_revisao:'em_conferencia',expira_em:new Date(expires).toISOString(),chave_idempotencia:this.key(p,op.tipo,f,op.origem_captura)});
  this.transaction(()=>{
   this.save(p,op,digest(token),expires,digest(canonical([p.id,p.session,op,homonimo===true])));
   this.event(p,op,'revisada');
  });
  return {op,token};
 }
 invalidate(p,id){
  const op=read(this.get(p,id));if(!['rascunho','em_conferencia'].includes(op.estado_revisao))throw fault(409,'Cartão encerrado.');
  op.expira_em=null;op.estado_revisao='rascunho';this.transaction(()=>{this.save(p,op);this.event(p,op,'revisao_invalidada');});return op;
 }
 cancel(p,id){
  const op=read(this.get(p,id));if(op.estado_revisao==='confirmada')throw fault(409,'Cartão já confirmado.');
  if(op.estado_revisao!=='cancelada'){op.estado_revisao='cancelada';op.resultado='cancelado';op.expira_em=null;this.transaction(()=>{this.save(p,op);this.event(p,op,'cancelada');});}
  return op;
 }
 confirm(p,id,token,bytes){
  const result=this.transaction(()=>{
   const row=this.get(p,id),op=read(row);
   if(typeof token!=='string'||token.length!==64||!row.proof||!timingSafeEqual(Buffer.from(row.proof),Buffer.from(digest(token)))){
    this.event(p,op,'revisao_invalida');return fault(403,'Revisão inválida ou substituída.');
   }
   if(row.expires<=this.clock()){
    this.event(p,op,'expirada');
    return fault(409,'A confirmação expirou. Revise novamente.');
   }
   if(op.estado_revisao==='confirmada'){this.event(p,op,'repeticao_idempotente');return op;}
   if(op.estado_revisao!=='em_conferencia')throw fault(409,'Revise novamente.');
   if(![false,true].some(ack=>row.version===digest(canonical([p.id,p.session,op,ack]))))throw fault(409,'O conteúdo revisado mudou.');
   const f=op.campos;
   if(op.tipo==='documento'){
    if(!bytes||identify(bytes,op.origem_captura.mime_type)!==op.origem_captura.mime_type||digest(bytes)!==op.origem_captura.sha256_arquivo)throw fault(422,'O original não corresponde ao documento revisado.');
    if(this.db.prepare('SELECT 1 FROM originals WHERE actor=? AND hash=?').get(p.id,op.origem_captura.sha256_arquivo)){
     this.event(p,op,'repeticao_idempotente');return fault(409,'Este original já está arquivado.');
    }
   }else if(bytes)throw fault(422,'Este cartão não aceita arquivo.');
   let uniq=op.chave_idempotencia;
   if(op.tipo==='recebimento')uniq=digest(canonical([f.atendimento_id,f.data,f.meio,f.valor_centavos]));
   if(op.tipo==='vinculo_documental')uniq=digest(canonical([f.documento_id,f.atendimento_id]));
   if(op.tipo==='parcelamento')uniq=digest(canonical([f.atendimento_id,f.vencimento]));
   if(this.db.prepare('SELECT id FROM records WHERE actor=? AND kind=? AND uniq=?').get(p.id,op.tipo,uniq)){
    this.event(p,op,'repeticao_idempotente');return fault(409,'Já existe uma operação equivalente. Confira o histórico.');
   }
   this.validateObjects(p,op,f);
   if(['cadastro','atualizacao_cadastral'].includes(op.tipo)){
    const concurrent=this.db.prepare("SELECT id,body FROM records WHERE actor=? AND kind='cadastro'").all(p.id);
    const acknowledged=row.version===digest(canonical([p.id,p.session,op,true]));
    for(const other of concurrent){if(other.id===f.cliente_id)continue;const c=read(other);
     if((f.telefone&&f.telefone===c.telefone)||(f.cpf&&f.cpf===c.cpf)||(f.nome&&normalize(f.nome)===normalize(c.nome)&&!acknowledged))throw fault(409,'Existe um cadastro coincidente. Revise a identificação.');}
   }
   const ref=randomUUID();
   this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(ref,p.id,op.tipo,uniq,JSON.stringify(f));
   if(op.tipo==='atualizacao_cadastral'){
    const {cliente_id,...patch}=f, prior=this.record(p,cliente_id,'cadastro');
    this.db.prepare('UPDATE records SET body=? WHERE id=? AND actor=?').run(JSON.stringify({...prior,...patch}),cliente_id,p.id);
   }
   if(bytes)this.db.prepare('INSERT INTO originals VALUES(?,?,?,?,?)').run(ref,p.id,digest(bytes),op.origem_captura.mime_type,bytes);
   this.beforeCommit(op);
   Object.assign(op,{estado_revisao:'confirmada',resultado:'registrado_em_homologacao',referencia_homologacao:op.tipo==='atualizacao_cadastral'?f.cliente_id:ref,expira_em:null});
   this.save(p,op,row.proof,row.expires,null);this.event(p,op,'confirmada');return op;
  });
  // A rejected review can commit its audit entry without committing a business record.
  if(result instanceof Error)throw result;
  return result;
 }
}
