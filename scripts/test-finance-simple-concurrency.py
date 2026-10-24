#!/usr/bin/env python3
"""Financial races exclusively on the disposable loopback Supabase CI database."""
import re
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PSQL=['psql','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
ENV={**os.environ,'PGPASSWORD':'postgres','PGCONNECT_TIMEOUT':'5'}
ADMIN='d1000000-0000-4000-8000-000000000001'
WORKER='d1000000-0000-4000-8000-000000000003'
CLIENT='d1000000-0000-4000-8000-000000000005'
PROCEDURE='d1000000-0000-4000-8000-000000000006'
TREATMENT='d1000000-0000-4000-8000-000000000091'
APPOINTMENT='d1000000-0000-4000-8000-000000000092'

def sql(query):
 r=subprocess.run(PSQL,input=query,text=True,capture_output=True,env=ENV,timeout=30)
 if r.returncode:raise AssertionError(r.stderr)
 return r.stdout.strip()

def auth(query):
 return f"select set_config('request.jwt.claim.sub','{ADMIN}',true); set local role authenticated; {query}"

def key(n):return f'd2000000-0000-4000-8000-{n:012d}'

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

fixture=Path('supabase/tests/fixtures/agenda.psql').read_text().replace('a1000000','d1000000').replace('-agenda@example.invalid','-simple-race@example.invalid').replace('Procedimento fictício CI','Procedimento simples corrida CI')
seed=fixture+f"""
select set_config('request.jwt.claim.sub','{WORKER}',false);
insert into public.agendamentos(id,cliente_id,colaboradora_user_id,procedimento_id,inicio,fim,status,created_by)
select '{APPOINTMENT}','{CLIENT}','{WORKER}','{PROCEDURE}',slot,slot+interval '30 minutes','agendado','{WORKER}' from test_clock;
insert into public.clinical_treatments(id,cliente_id,procedimento_id,procedure_version_id,profissional_user_id,agendamento_id,treatment_date,price_mode_snapshot,base_price_snapshot,final_price,created_by,status)
select '{TREATMENT}','{CLIENT}','{PROCEDURE}',pg_temp.f('version'),'{WORKER}','{APPOINTMENT}',day,'fixed',600,600,'{WORKER}','em_atendimento' from test_clock;
alter table public.clinical_treatment_versions disable trigger bc_external_consent_snapshot_before_version_insert;
insert into public.clinical_treatment_versions(treatment_id,version,snapshot,created_by) select id,1,jsonb_build_object('treatment',to_jsonb(t)),'{WORKER}' from public.clinical_treatments t where id='{TREATMENT}';
alter table public.clinical_treatment_versions enable trigger bc_external_consent_snapshot_before_version_insert;
update public.clinical_treatments t set current_version_id=v.id from public.clinical_treatment_versions v where v.treatment_id=t.id and t.id='{TREATMENT}';
update public.clinical_treatments set status='finalizado' where id='{TREATMENT}';
select operational_attendance_id from public.clinical_treatments where id='{TREATMENT}';
"""
ATTENDANCE=first_value(sql(seed))
RECEIVED_AT=first_value(sql("select now();"))
START=first_value(sql(f"select date_trunc('week','{RECEIVED_AT}'::timestamptz at time zone 'America/Sao_Paulo')::date;"))
END=first_value(sql(f"select '{START}'::date+6;"))
CLOSE=f"select public.bc_livro_fechar('{WORKER}','{START}','{END}');"

# All data below belong exclusively to this disposable fixture.
sql("update private.bc_finance_settings set simple_mode=true where id;")
legacy_clear=clear
def clear():
 sql(f"delete from private.bc_finance_abandoned_attempts where actor_id='{ADMIN}';delete from private.bc_commission_items where professional_id='{WORKER}';delete from private.bc_commission_payments where professional_id='{WORKER}';delete from private.bc_finance_expenses where created_by='{ADMIN}';")
 legacy_clear()
 sql('begin; '+auth(f"select public.bc_finance_commissions_apply('{WORKER}',30,array['{PROCEDURE}'::uuid]);")+' commit;')
def item_ids():return sql(f"select id from private.bc_commission_items where professional_id='{WORKER}' and state='pending' order by id;").splitlines()
def pay(n,items,amount=30):
 array=','.join("'"+i+"'::uuid" for i in items)
 return f"select public.bc_finance_commission_pay('{key(n)}','{WORKER}',array[{array}],{amount});"
def single_receipt(n=10):return first_value(sql('begin; '+auth(receipt(n))+' commit;'))

clear();single_receipt();items=item_ids()
with ThreadPoolExecutor(max_workers=8) as pool:ids=list(pool.map(lambda _:first_value(sql('begin; '+auth(pay(100,items))+' commit;')),range(8)))
assert len(set(ids))==1,ids
assert sql(f"select count(*) from private.bc_commission_payments where professional_id='{WORKER}';")=='1'
print('PASS simple payment: eight retries, one payment',flush=True)
clear();single_receipt();items=item_ids();overlap(pay(101,items),pay(102,items),'55000')
assert sql(f"select sum(amount) from private.bc_commission_payments where professional_id='{WORKER}' and state='paid';")=='30.00'
print('PASS simple payment: competing keys cannot pay the same commission twice',flush=True)
clear();single_receipt();items=item_ids();overlap(pay(103,items),receipt(11))
assert sql(f"select sum(amount) from private.bc_commission_items where professional_id='{WORKER}' and state='pending';")=='30.00'
assert sql(f"select sum(amount) from private.bc_commission_payments where professional_id='{WORKER}' and state='paid';")=='30.00'
print('PASS simple payment: later receipt remains pending',flush=True)
for reverse_first in (False,True):
 clear();r=single_receipt();items=item_ids();reverse=f"select public.bc_recebimento_estornar('{r}','Correção fictícia CI');"
 overlap(reverse if reverse_first else pay(104,items),pay(104,items) if reverse_first else reverse,'55000')
 expected='void' if reverse_first else 'paid'
 assert sql(f"select state from private.bc_commission_items where receipt_id='{r}';")==expected
 print(f'PASS simple payment/reversal order {reverse_first}',flush=True)
for rule_first in (False,True):
 clear();rule=f"select public.bc_finance_commissions_apply('{WORKER}',40,array['{PROCEDURE}'::uuid]);"
 overlap(rule if rule_first else receipt(12),receipt(12) if rule_first else rule)
 expected='40.0000' if rule_first else '30.0000'
 assert sql(f"select rate_snapshot from private.bc_commission_items where professional_id='{WORKER}';")==expected
 print(f'PASS simple rate snapshot order {rule_first}',flush=True)
clear();expense=f"select public.bc_finance_expense_create('{key(500)}','Material fictício',25);"
with ThreadPoolExecutor(max_workers=8) as pool:ids=list(pool.map(lambda _:first_value(sql('begin; '+auth(expense)+' commit;')),range(8)))
assert len(set(ids))==1,ids
assert sql(f"select count(*) from private.bc_finance_expenses where created_by='{ADMIN}';")=='1'
print('PASS simple expense: eight retries, one expense',flush=True)
# Recovery either sees an in-flight commit or atomically closes its key.
for kind in ('receipt','expense','payment'):
 for recovery_first in (False,True):
  clear()
  if kind=='payment':single_receipt();items=item_ids()
  number={'receipt':601,'expense':602,'payment':603}[kind]
  write=receipt(number) if kind=='receipt' else (f"select public.bc_finance_expense_create('{key(number)}','Late expense fixture',25);" if kind=='expense' else pay(number,items))
  context=f"'{APPOINTMENT}'::uuid" if kind=='receipt' else 'null::uuid'
  recover=f"select public.bc_finance_attempt_reconcile('{kind}','{key(number)}',{context});"
  overlap(recover if recovery_first else write,write if recovery_first else recover,'22023' if recovery_first else None)
  table={'receipt':'public.recebimentos','expense':'private.bc_finance_expenses','payment':'private.bc_commission_payments'}[kind]
  assert sql(f"select count(*) from {table} where request_key='{key(number)}';")==('0' if recovery_first else '1')
  print(f'PASS {kind}: recovery/arrival order {recovery_first} never duplicates money',flush=True)
print('All simple financial concurrency checks passed. Disposable database only.',flush=True)
