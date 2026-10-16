#!/usr/bin/env python3
"""Integration races against ONLY the disposable Supabase CI database on loopback.

The first connection signals after its INSERT, keeping its transaction open.
The second connection attempts an overlapping reservation before the first commits.
There are no production URLs, credentials or configurable remote targets here.
"""
import os
from pathlib import Path
import subprocess

PSQL = ['psql','-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
ENV = {**os.environ, 'PGPASSWORD':'postgres', 'PGCONNECT_TIMEOUT':'5'}
WORKER = 'a1000000-0000-4000-8000-000000000003'
CHIEF = 'a1000000-0000-4000-8000-000000000002'
CLIENT = 'a1000000-0000-4000-8000-000000000005'
PROCEDURE = 'a1000000-0000-4000-8000-000000000006'

def sql(query):
    result = subprocess.run(PSQL,input=query,text=True,capture_output=True,env=ENV,timeout=30)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()

def operation(channel, start, end=None, origin='d'):
    if channel=='site':
        return f"set local role service_role; select public.bc_public_agenda_book('Pessoa Corrida CI','31900000001','{WORKER}','{PROCEDURE}','{start}',repeat('{origin}',64));"
    return (f"select set_config('request.jwt.claim.sub','{CHIEF}',true); set local role authenticated; "
            f"select public.bc_agendamento_create('{CLIENT}','{WORKER}','{PROCEDURE}','{start}',{repr(end) if end else 'null'});")

def race(label, first, second):
    sql(f"delete from public.agendamentos where colaboradora_user_id='{WORKER}';")
    process = subprocess.Popen(PSQL,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=ENV)
    try:
        process.stdin.write('begin;\n'+first+"\n\\echo RESERVED_UNCOMMITTED\nselect pg_sleep(1);\ncommit;\n")
        process.stdin.close()
        before=[]
        while True:
            line=process.stdout.readline()
            assert line, f'{label}: first reservation failed: {process.stderr.read()}'
            if line.strip()=='RESERVED_UNCOMMITTED': break
            before.append(line)
        loser=subprocess.run(PSQL,input='begin;\n'+second+'\ncommit;',text=True,capture_output=True,env=ENV,timeout=15)
        process.wait(timeout=15)
        assert process.returncode==0, process.stderr.read()
        # Public operations preserve rate-limit attempts and return a controlled
        # error envelope; internal RPCs raise exclusion_violation (23P01).
        assert '23P01' in loser.stderr+loser.stdout, f'{label}: missing controlled conflict: {loser.stdout} {loser.stderr}'
        count=sql(f"select count(*) from public.agendamentos where colaboradora_user_id='{WORKER}' and status not in ('cancelado','faltou');")
        assert count=='1', f'{label}: {count} reservations persisted'
        print(f'PASS {label}: one commit, one controlled conflict, zero overlap',flush=True)
    finally:
        if process.poll() is None: process.kill(); process.wait()

fixture=Path('scripts/fixtures/agenda.sql').read_text()
slot=sql(fixture+'\nselect slot from test_clock;').splitlines()[-1]
shifted=sql(f"select '{slot}'::timestamptz + interval '15 minutes';").splitlines()[-1]
race('site/site same start',operation('site',slot,origin='d'),operation('site',slot,origin='e'))
race('site/site overlapping interval',operation('site',slot,origin='f'),operation('site',shifted,origin='g'))
race('site/internal',operation('site',slot,origin='h'),operation('internal',slot))
race('internal/site',operation('internal',slot),operation('site',slot,origin='i'))
midnight=sql("select (current_date+3)::timestamp at time zone 'America/Sao_Paulo';").splitlines()[-1]
start=sql(f"select '{midnight}'::timestamptz-interval '15 minutes';").splitlines()[-1]
end=sql(f"select '{midnight}'::timestamptz+interval '15 minutes';").splitlines()[-1]
race('internal across midnight',operation('internal',start,end),operation('internal',midnight))
print('All 5 concurrency scenarios passed. Disposable fixture removed with CI database.')
