-- Testes apenas no Supabase LOCAL descartável (rollback + identidades sintéticas).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../fixtures/agenda.psql

select is((
  select count(*)::integer from pg_policies
  where schemaname='public'
    and tablename in ('agendamentos','atendimentos','clientes','pagamentos','procedimentos','staff_profiles')
    and policyname='bc_final_delete_two_operators'
    and cmd='DELETE' and permissive='RESTRICTIVE'
    and 'authenticated'=any(roles)
),6,'Seis exclusões definitivas exigem gate restrito, sem ampliar permissões');

select ok(not has_table_privilege('authenticated','private.bc_final_delete_operators','SELECT'),
  'Equipe não lê configuração privada dos dois operadores');
select ok(not has_table_privilege('authenticated','private.bc_final_delete_operators','INSERT'),
  'Equipe não pode se autoconceder identidade de contingência');
select ok(not has_table_privilege('service_role','private.bc_final_delete_operators','UPDATE'),
  'Operadores não são alteráveis pela API com service_role');

-- Sem configuração: todos falham fechados.
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is(private.bc_can_delete_finalized(),false,'Admin técnico não tem exclusão automática');
reset role;

-- A identidade da Mel aqui é a colaboradora FICTÍCIA "chief", para exercício do gate.
-- Em implantação real o UUID só é definido fora do repositório.
update public.staff_profiles set role='admin' where user_id=pg_temp.f('chief');
insert into private.bc_final_delete_operators(scope,user_id) values('clinical_owner',pg_temp.f('chief'));
insert into fixture values('delete_procedure','a4000000-0000-4000-8000-000000000001');
insert into public.procedimentos(id,nome,duracao_padrao,ativo,created_by)
values(pg_temp.f('delete_procedure'),'Procedimento descartável CI',25,true,pg_temp.f('admin'));

select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select is(private.bc_can_delete_finalized(),false,'Outro administrador não se torna Mel');
delete from public.procedimentos where id=pg_temp.f('delete_procedure');
select is((select count(*)::integer from public.procedimentos
  where id=pg_temp.f('delete_procedure')),1,'Admin técnico não exclui registro definitivo');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select is(private.bc_can_delete_finalized(),false,'Profissional comum não exclui definitivo');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select is(private.bc_can_delete_finalized(),true,'A identidade configurada Mel, ativa e admin, recebe autorização');
delete from public.procedimentos where id=pg_temp.f('delete_procedure');
select is((select count(*)::integer from public.procedimentos
  where id=pg_temp.f('delete_procedure')),0,'Mel exclui definitivamente pela política clínica');
delete from public.staff_profiles where user_id=pg_temp.f('chief');
select is((select count(*)::integer from public.staff_profiles
  where user_id=pg_temp.f('chief')),1,'Mel não pode excluir o próprio perfil por engano');
reset role;

select is((select old_data->>'nome' from public.audit_log
  where action='record_definitively_deleted' and entity_type='procedimentos'
    and entity_id=pg_temp.f('delete_procedure') order by created_at desc limit 1),
  'Procedimento descartável CI','Exclusão definitiva guarda snapshot antes da remoção');
select is((select actor_user_id from public.audit_log
  where action='record_definitively_deleted' and entity_id=pg_temp.f('delete_procedure')
  order by created_at desc limit 1),pg_temp.f('chief'),'Histórico identifica quem excluiu');

-- Correção de anamnese: apenas autora, mantendo antes e depois por pergunta.
select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
insert into fixture values('draft_anam',public.bc_anamnese_begin(pg_temp.f('client'),'presencial'));
select lives_ok(format('select public.bc_anamnese_save_answers(%L,%L)',
  pg_temp.f('draft_anam'),'{"queixa_principal":"Queixa fictícia 1"}'),
  'Autora pode preencher seu rascunho');
select lives_ok(format('select public.bc_anamnese_save_answers(%L,%L)',
  pg_temp.f('draft_anam'),'{"queixa_principal":"Queixa fictícia 2"}'),
  'Autora pode retificar seu rascunho');
reset role;
select is((select old_data->>'answer' from public.audit_log
  where action='anamnese_draft_answer_corrected' and entity_id=pg_temp.f('draft_anam')
  and old_data is not null order by created_at desc limit 1),
  'Queixa fictícia 1','Histórico da anamnese preserva resposta anterior');
select is((select new_data->>'answer' from public.audit_log
  where action='anamnese_draft_answer_corrected' and entity_id=pg_temp.f('draft_anam')
  and old_data is not null order by created_at desc limit 1),
  'Queixa fictícia 2','Histórico da anamnese registra correção');

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select throws_ok(format('select public.bc_anamnese_save_answers(%L,%L)',
  pg_temp.f('draft_anam'),'{"queixa_principal":"Alteração indevida"}'),
  '42501',null,'Outra profissional não edita rascunho alheio');
select lives_ok(format('select public.bc_anamnese_create_remote_link(%L)',pg_temp.f('draft_anam')),
  'Qualquer profissional ativa pode gerar link de anamnese, mesmo não sendo autora');
reset role;

-- Ficha clínica: autoria e trilha antes/depois de campos editáveis.
select set_config('request.jwt.claim.sub',pg_temp.f('worker')::text,true);
set local role authenticated;
insert into fixture values('draft_treat',public.bc_treatment_create(pg_temp.f('client'),pg_temp.f('procedure')));
select lives_ok(format('select public.bc_treatment_update_draft(%L,%L)',
  pg_temp.f('draft_treat'),'{"objetivo":"Plano fictício original"}'),
  'Autora corrige sua própria ficha em rascunho');
select lives_ok(format('select public.bc_treatment_update_draft(%L,%L)',
  pg_temp.f('draft_treat'),'{"objetivo":"Plano fictício corrigido"}'),
  'Nova correção preserva linha anterior');
reset role;
select is((select old_data->>'objetivo' from public.audit_log
  where action='clinical_treatment_draft_updated' and entity_id=pg_temp.f('draft_treat')
  and old_data->>'objetivo'='Plano fictício original' limit 1),
  'Plano fictício original','Auditoria da ficha mantém o conteúdo antigo');
select is((select new_data->>'objetivo' from public.audit_log
  where action='clinical_treatment_draft_updated' and entity_id=pg_temp.f('draft_treat')
  and new_data->>'objetivo'='Plano fictício corrigido' limit 1),
  'Plano fictício corrigido','Auditoria da ficha registra conteúdo corrigido');

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select throws_ok(format('select public.bc_treatment_update_draft(%L,%L)',
  pg_temp.f('draft_treat'),'{"objetivo":"Alteração indevida"}'),
  '42501',null,'Outra profissional não altera ficha de sessão alheia');
reset role;

-- Documento já registrado é definitivo: nem admin técnico pode anulá-lo.
insert into fixture values('file_final','a4000000-0000-4000-8000-000000000002');
insert into public.client_files(id,cliente_id,title,category,origin,storage_path,
    mime_type,size_bytes,sha256,uploaded_by)
values(pg_temp.f('file_final'),pg_temp.f('client'),'Documento fictício','outro_clinico',
  'upload_manual','ci/delete-protection/documento.pdf','application/pdf',100,
  repeat('b',64),pg_temp.f('worker'));
select set_config('request.jwt.claim.sub',pg_temp.f('admin')::text,true);
set local role authenticated;
select throws_ok(format('select public.bc_client_file_void(%L,%L)',
  pg_temp.f('file_final'),'Tentativa não permitida'),
  '42501',null,'Admin técnico não anula documento definitivo');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.f('chief')::text,true);
set local role authenticated;
select lives_ok(format('select public.bc_client_file_void(%L,%L)',
  pg_temp.f('file_final'),'Correção autorizada fictícia'),
  'Somente Mel pode anular documento definitivo com justificativa');
reset role;
select is((select void_reason from public.client_files where id=pg_temp.f('file_final')),
  'Correção autorizada fictícia','Anulação deixa motivo sem apagar documento');
select is((select old_data->>'voided_at' from public.audit_log
  where action='client_file_voided' and entity_id=pg_temp.f('file_final') limit 1),
  null,'Auditoria registra documento originalmente válido');
select ok((select (new_data->>'voided_at') is not null from public.audit_log
  where action='client_file_voided' and entity_id=pg_temp.f('file_final') limit 1),
  'Auditoria registra momento de anulação');

-- Segurança redundante: suporte tático não recebe poderes clínicos gerais.
-- AAL1, operador não cadastrado e alteração sem motivo devem falhar.
reset role;
update public.staff_profiles
   set role='admin_criacao',atende_clientes=false,
       pode_gerenciar_agendas=false,pode_gerenciar_procedimentos=false,
       procedure_scope='explicit'
 where user_id=pg_temp.f('ordinary');
insert into private.bc_final_delete_operators(scope,user_id)
values('technical_backup',pg_temp.f('ordinary'));
insert into fixture values('support_delete_procedure',
  'a4000000-0000-4000-8000-000000000003');
insert into public.procedimentos(id,nome,duracao_padrao,ativo,created_by)
values(pg_temp.f('support_delete_procedure'),'Exclusão emergência CI',20,true,pg_temp.f('admin'));

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
set local role authenticated;
select is(private.bc_can_delete_finalized(),false,
  'Suporte sem MFA AAL2 não possui autorização final');
select throws_ok(format(
  'select public.bc_support_delete_finalized(%L,%L,%L)',
  'procedimentos',pg_temp.f('support_delete_procedure'),
  'Solicitação de contingência fictícia'),
  '42501',null,'Suporte sem AAL2 não pode apagar por RPC');
reset role;

select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
select is(private.bc_can_delete_finalized(),true,
  'Suporte autorizado precisa de papel próprio, vínculo e MFA AAL2');
select throws_ok(format(
  'select public.bc_support_delete_finalized(%L,%L,%L)',
  'procedimentos',pg_temp.f('support_delete_procedure'),'breve'),
  '22023',null,'Motivo insuficiente bloqueia exclusão');
select throws_ok(format(
  'select public.bc_support_delete_finalized(%L,%L,%L)',
  'audit_log',pg_temp.f('support_delete_procedure'),
  'Motivo suficientemente detalhado'),
  '22023',null,'Lista fechada impede remover trilha de auditoria');
select throws_ok(format(
  'select public.bc_support_delete_finalized(%L,%L,%L)',
  'staff_profiles',pg_temp.f('chief'),
  'Não remover a conta da responsável'),
  '42501',null,'Suporte não remove conta protegida da Mel');
delete from public.procedimentos where id=pg_temp.f('support_delete_procedure');
reset role;
select is((select count(*)::integer from public.procedimentos
  where id=pg_temp.f('support_delete_procedure')),1,
  'Admin técnico continua sem DELETE direto na tabela');
select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
select lives_ok(format(
  'select public.bc_support_delete_finalized(%L,%L,%L)',
  'procedimentos',pg_temp.f('support_delete_procedure'),
  'Correção emergencial técnica fictícia'),
  'Suporte contingencial remove item somente via RPC justificada');
reset role;
select is((select count(*)::integer from public.procedimentos
  where id=pg_temp.f('support_delete_procedure')),0,
  'RPC emergencial efetivamente removeu o item de teste');
select is((select actor_user_id from public.audit_log
  where action='technical_support_final_delete'
    and entity_id=pg_temp.f('support_delete_procedure')
  order by created_at desc limit 1),pg_temp.f('ordinary'),
  'Auditoria aponta a conta técnica que executou a contingência');
select is((select new_data->>'reason' from public.audit_log
  where action='technical_support_final_delete'
    and entity_id=pg_temp.f('support_delete_procedure')
  order by created_at desc limit 1),
  'Correção emergencial técnica fictícia','Auditoria exige motivo da exclusão');

-- Anulação preserva o documento, com autoria e trilha antes/depois.
insert into fixture values('backup_file',
  'a4000000-0000-4000-8000-000000000004');
insert into public.client_files(id,cliente_id,title,category,origin,storage_path,
    mime_type,size_bytes,sha256,uploaded_by)
values(pg_temp.f('backup_file'),pg_temp.f('client'),'Anexo técnico fictício',
  'outro_clinico','upload_manual','ci/delete-protection/suporte.pdf',
  'application/pdf',100,repeat('c',64),pg_temp.f('worker'));
select set_config('request.jwt.claim.sub',pg_temp.f('ordinary')::text,true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
select lives_ok(format('select public.bc_client_file_void(%L,%L)',
  pg_temp.f('backup_file'),'Anulação emergencial autorizada'),
  'Suporte com MFA anula documento sem apagar o arquivo');
reset role;
select is((select voided_by from public.client_files
  where id=pg_temp.f('backup_file')),pg_temp.f('ordinary'),
  'Anulação de suporte preserva a identidade individual');

select * from finish();
rollback;
