const APPOINTMENT_SELECT = `
  id,
  cliente_id,
  colaboradora_user_id,
  procedimento_id,
  inicio,
  fim,
  status,
  observacao_administrativa,
  clientes(id,nome,telefone,email),
  procedimentos(id,nome,duracao_padrao)
`;

const HISTORY_SELECT = `
  id,
  agendamento_id,
  cliente_id,
  colaboradora_user_id,
  procedimento_id,
  data_atendimento,
  queixa_objetivo,
  observacoes,
  reacoes,
  intercorrencias,
  feedback_cliente,
  orientacoes,
  recomendacao_proxima_sessao,
  procedimentos(id,nome)
`;

function ensureClient(client) {
  if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') throw new Error('Cliente Supabase indisponível.');
}
function cleanRequired(value,label){const clean=String(value??'').trim();if(!clean)throw new Error(`${label} é obrigatório.`);return clean;}
function cleanOptional(value){const clean=String(value??'').trim();return clean||null;}
function throwIfError(error,fallback){if(error)throw new Error(error.message||fallback);}
async function resolveQuery(query,fallback){const {data,error}=await query;throwIfError(error,fallback);return data??[];}

export async function listOwnAppointments({client,userId,fromIso,toIso}){
  ensureClient(client);cleanRequired(userId,'Profissional');cleanRequired(fromIso,'Início do período');cleanRequired(toIso,'Fim do período');
  return resolveQuery(client.from('agendamentos').select(APPOINTMENT_SELECT).eq('colaboradora_user_id',userId).gte('inicio',fromIso).lt('inicio',toIso).order('inicio',{ascending:true}),'Não foi possível carregar sua agenda.');
}
export async function listAdminAppointments({client,fromIso,toIso}){
  ensureClient(client);cleanRequired(fromIso,'Início do período');cleanRequired(toIso,'Fim do período');
  return resolveQuery(client.from('agendamentos').select(APPOINTMENT_SELECT).gte('inicio',fromIso).lt('inicio',toIso).order('inicio',{ascending:true}),'Não foi possível carregar a agenda administrativa.');
}
export { listClients as listAdminClients, createClient } from './clientes-api.js';
export async function listActiveProcedures({client}){
  ensureClient(client);
  return resolveQuery(client.from('procedimentos').select('id,nome,duracao_padrao,ativo').eq('ativo',true).order('nome',{ascending:true}),'Não foi possível carregar os procedimentos.');
}
export async function listStaffDirectory({client}){ensureClient(client);const {data,error}=await client.rpc('bc_staff_directory',{});throwIfError(error,'Não foi possível carregar a equipe.');return data??[];}
export async function listActiveCollaborators({client}){return listStaffDirectory({client});}
export async function createAppointment({client,clienteId,colaboradoraUserId,procedimentoId,inicioIso,fimIso=null,observacao=null}){
  ensureClient(client);const {data,error}=await client.rpc('bc_agendamento_create',{p_cliente_id:cleanRequired(clienteId,'Cliente'),p_colaboradora_user_id:cleanRequired(colaboradoraUserId,'Profissional'),p_procedimento_id:cleanRequired(procedimentoId,'Procedimento'),p_inicio:cleanRequired(inicioIso,'Horário inicial'),p_fim:fimIso?String(fimIso).trim():null,p_observacao:cleanOptional(observacao)});throwIfError(error,'Não foi possível criar o agendamento.');return data;
}
export async function updateAppointment({client,appointmentId,procedimentoId,inicioIso,fimIso=null,observacao=null}){
  ensureClient(client);const {data,error}=await client.rpc('bc_agendamento_update',{p_agendamento_id:cleanRequired(appointmentId,'Agendamento'),p_procedimento_id:cleanRequired(procedimentoId,'Procedimento'),p_inicio:cleanRequired(inicioIso,'Horário inicial'),p_fim:fimIso?String(fimIso).trim():null,p_observacao:cleanOptional(observacao)});throwIfError(error,'Não foi possível atualizar o agendamento.');return data;
}
export async function setAppointmentStatus({client,appointmentId,status}){ensureClient(client);const {data,error}=await client.rpc('bc_set_agendamento_status',{p_agendamento_id:cleanRequired(appointmentId,'Agendamento'),p_status:cleanRequired(status,'Status')});throwIfError(error,'Não foi possível atualizar o status do agendamento.');return data;}
export async function listAuthorizedHistory({client,clienteId}){ensureClient(client);return resolveQuery(client.from('atendimentos').select(HISTORY_SELECT).eq('cliente_id',cleanRequired(clienteId,'Cliente')).order('data_atendimento',{ascending:false}),'Não foi possível carregar o histórico autorizado.');}
export async function registerAttendance({client,appointmentId,fields={}}){
  ensureClient(client);const allowedFields=['queixa_objetivo','observacoes','reacoes','intercorrencias','feedback_cliente','orientacoes','recomendacao_proxima_sessao'];const payload={p_agendamento_id:cleanRequired(appointmentId,'Agendamento')};for(const field of allowedFields)payload[`p_${field}`]=String(fields[field]??'').trim();const {data,error}=await client.rpc('bc_registrar_atendimento',payload);throwIfError(error,'Não foi possível registrar o atendimento.');return data;
}
