#!/usr/bin/env python3
"""Financial races exclusively on the disposable loopback Supabase CI database."""
import re
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PSQL=['psql','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
ENV={**os.environ,'PGPASSWORD':'postgres','PGCONNECT_TIMEOUT':'5'}
ADMIN='f1000000-0000-4000-8000-000000000001'
WORKER='f1000000-0000-4000-8000-000000000003'
CLIENT='f1000000-0000-4000-8000-000000000005'
PROCEDURE='f1000000-0000-4000-8000-000000000006'
TREATMENT='f1000000-0000-4000-8000-000000000091'
APPOINTMENT='f1000000-0000-4000-8000-000000000092'

def sql(query):
 r=subprocess.run(PSQL,input=query,text=True,capture_output=True,env=ENV,timeout=30)
 if r.returncode:raise AssertionError(r.stderr)
 return r.stdout.strip()

def auth(query):
 return f"select set_config('request.jwt.claim.sub','{ADMIN}',true); set local role authenticated; {query}"

def key(n):return f'f2000000-0000-4000-8000-{n:012d}'

def receipt(n,amount=100):
 return f"select public.bc_recebimento_registrar_v2('{key(n)}','{ATTENDANCE}',{amount},'pix','{RECEIVED_AT}',null);"

def first_value(output):
 ids=re.findall(r'(?m)^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$',output)
 if ids:return ids[-1]
 return [line for line in output.splitlines() if line not in ('BEGIN','COMMIT','SET')][-1]

def clear():
 sql(f"delete from public.repasse_livros where repasse_id in(select id from public.repasses where profissional_user_id='{WORKER}'); delete from public.repasses where profissional_user_id='{WORKER}'; delete from public.livro_financeiro_itens where livro_id in(select id from public.livros_financeiros where profissional_user_id='{WORKER}'); delete from public.livros_financeiros where profissional_user_id='{WORKER}'; delete from public.recebimentos where profissional_user_id='{WORKER}'; delete from public.pagamentos where atendimento_id='{ATTENDANCE}';")

def overlap(first,second,expected_error=None):
 p=subprocess.Popen(PSQL,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
 try:
  p.stdin.write('begin;\n'+auth(first)+"\n\\echo FINANCE_READY\nselect pg_sleep(1);\ncommit;\n");p.stdin.close()
  while True:
   line=p.stdout.readline()
   assert line,p.stderr.read()
   if line.strip()=='FINANCE_READY':break
  loser=subprocess.run(PSQL,input='begin; '+auth(second)+' commit;',text=True,capture_output=True,env=ENV,timeout=20)
  p.wait(timeout=10);assert p.returncode==0,p.stderr.read()
  if expected_error:assert expected_error in loser.stderr,(loser.stdout,loser.stderr)
  else:assert loser.returncode==0,loser.stderr
 finally:
  if p.poll() is None:p.kill();p.wait()

fixture=Path('supabase/tests/fixtures/agenda.psql').read_text().replace('a1000000','f1000000').replace('-agenda@example.invalid','-finance-race@example.invalid').replace('Procedimento fictício CI','Procedimento financeiro corrida CI')
seed=fixture+f"""
select set_config('request.jwt.claim.sub','{WORKER}',false);
insert into public.agendamentos(id,cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,created_by)
select '{APPOINTMENT}','{CLIENT}','{WORKER}','{PROCEDURE}',slot,slot+interval '30 minutes','agendado','{WORKER}' from test_clock;
insert into public.clinical_treatments(id,cliente_id,procedimento_id,procedure_version_id,profissional_user_id,agendamento_id,treatment_date,price_mode_snapshot,base_price_snapshot,final_price,created_by,status)
select '{TREATMENT}','{CLIENT}','{PROCEDURE}',pg_temp.f('version'),'{WORKER}','{APPOINTMENT}',day,'fixed',600,600,'{WORKER}','em_atendimento' from test_clock;
insert into public.clinical_treatment_versions(treatment_id,version,snapshot,created_by) select id,1,jsonb_build_object('treatment',to_jsonb(t)),'{WORKER}' from public.clinical_treatments t where id='{TREATMENT}';
update public.clinical_treatments t set current_version_id=v.id from public.clinical_treatment_versions v where v.treatment_id=t.id and t.id='{TREATMENT}';
update public.clinical_treatments set status='finalizado' where id='{TREATMENT}';
select operational_attendance_id from public.clinical_treatments where id='{TREATMENT}';
"""
ATTENDANCE=first_value(sql(seed))
RECEIVED_AT=first_value(sql("select now();"))
START=first_value(sql(f"select date_trunc('week','{RECEIVED_AT}'::timestamptz at time zone 'America/Sao_Paulo')::date;"))
END=first_value(sql(f"select '{START}'::date+6;"))
CLOSE=f"select public.bc_livro_fechar('{WORKER}','{START}','{END}');"

clear()
with ThreadPoolExecutor(max_workers=8) as pool:ids=list(pool.map(lambda _:first_value(sql('begin; '+auth(receipt(1))+' commit;')),range(8)))
assert len(set(ids))==1,ids
assert sql(f"select count(*) from public.recebimentos where profissional_user_id='{WORKER}';")=='1'
print('PASS FIN02: eight identical requests, one receipt',flush=True)

clear()
overlap(receipt(2,400),receipt(3,400),'22023')
assert sql(f"select valor_recebido from public.pagamentos where atendimento_id='{ATTENDANCE}';")=='400.00'
print('PASS FIN01: competing receipts cannot exceed remaining charge',flush=True)

for reverse_first in (False,True):
 clear();r=first_value(sql('begin; '+auth(receipt(4))+' commit;'))
 reverse=f"select public.bc_recebimento_estornar('{r}','Estorno fictício CI');"
 overlap(reverse if reverse_first else receipt(5,500),receipt(5,500) if reverse_first else reverse)
 assert sql(f"select valor_recebido=(select sum(valor) from public.recebimentos where pagamento_id=p.id and status='ativo') and valor_recebido=500 and valor_total=600 from public.pagamentos p where atendimento_id='{ATTENDANCE}';")=='t'
 print(f'PASS FIN01: receipt/reversal serialization order {reverse_first}',flush=True)

clear();sql('begin; '+auth(f"select public.bc_comissao_set('{WORKER}','{PROCEDURE}',50); "+receipt(6))+' commit;')
b=first_value(sql('begin; '+auth(CLOSE)+' commit;'))
create=f"select public.bc_repasse_criar('{WORKER}',array['{b}'::uuid]);"
reopen=f"select public.bc_livro_reabrir('{b}','Revisão fictícia CI');"
overlap(create,reopen,'55000')
print('PASS FIN03: concurrent payout creation freezes book review',flush=True)

# Closing must include an already-running receipt; no late unbooked movement.
clear();overlap(receipt(7),CLOSE)
assert sql(f"select producao_recebida from public.livros_financeiros where profissional_user_id='{WORKER}';")=='100.00'
assert sql(f"select count(*) from public.livro_financeiro_itens li join public.recebimentos r on r.id=li.movimento_recebimento_id where r.profissional_user_id='{WORKER}';")=='1'
print('PASS financial period: closing includes the in-flight receipt',flush=True)
print('All financial concurrency checks passed. Disposable CI database only.',flush=True)
