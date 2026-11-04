#!/usr/bin/env python3
"""Real concurrent connections, ONLY against disposable loopback Supabase CI."""
import json
import os
from pathlib import Path
import subprocess
import time

PSQL = ['psql', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
ENV = {**os.environ, 'PGPASSWORD': 'postgres', 'PGCONNECT_TIMEOUT': '5'}
AUTHOR = 'b8000000-0000-4000-8000-000000000001'
TREATMENT = 'b8000000-0000-4000-8000-000000000006'
SECOND = 'b8000000-0000-4000-8000-000000000008'


def sql(query):
    result = subprocess.run(PSQL, input=query, text=True, capture_output=True, env=ENV, timeout=20)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1]


def operation(treatment, name, extra_days=0):
    return (f"select set_config('request.jwt.claim.sub','{AUTHOR}',true); set local role authenticated; "
            f"select public.bc_treatment_product_usage_add_text('{treatment}','{name}','QA-RACE',current_date+365+{extra_days},1,'mL');\n")


def race(name, conflicting_expiry=False):
    first = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=ENV)
    second = None
    try:
        first.stdin.write('begin;\n' + operation(TREATMENT, name) + '\\echo PR80_UNCOMMITTED\n')
        first.stdin.flush()
        while True:
            line = first.stdout.readline()
            assert line, first.stderr.read()
            if line.strip() == 'PR80_UNCOMMITTED':
                break
        second = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env={**ENV, 'PGAPPNAME': 'pr80-manual-race'})
        second.stdin.write('begin;\n' + operation(SECOND, name.upper(), 1 if conflicting_expiry else 0) + 'commit;\n')
        second.stdin.close()
        # Prove that B is waiting on A's product advisory lock before releasing A.
        deadline = time.monotonic() + 10
        waiting = False
        while time.monotonic() < deadline:
            waiting = sql("select exists(select 1 from pg_stat_activity where application_name='pr80-manual-race' and wait_event_type='Lock' and wait_event='advisory');") == 't'
            if waiting:
                break
            time.sleep(0.03)
        assert waiting, 'Second connection never waited on product lock'
        first.stdin.write('commit;\n')
        first.stdin.close()
        first.wait(timeout=15)
        second.wait(timeout=15)
        assert first.returncode == 0, first.stderr.read()
        if conflicting_expiry:
            assert second.returncode != 0 and '22023' in second.stderr.read(), 'Conflicting expiry must fail'
        else:
            assert second.returncode == 0, second.stderr.read()
        summary = json.loads(sql(f"""
          select json_build_object(
            'products',count(distinct p.id),'lots',count(distinct l.id),
            'usages',count(distinct u.id),'authors',count(distinct u.created_by))
          from public.clinical_products p
          left join public.clinical_product_lots l on l.product_id=p.id
          left join public.clinical_treatment_product_usages u on u.product_id=p.id
          where lower(p.name)=lower('{name}');
        """))
        assert summary == {'products': 1, 'lots': 1, 'usages': 1 if conflicting_expiry else 2, 'authors': 1}, summary
        print(f"PASS {name}: real advisory wait, {summary}, conflicting_expiry={conflicting_expiry}", flush=True)
    finally:
        for process in [first, second]:
            if process and process.poll() is None:
                process.kill()
                process.wait()


sql(Path('supabase/tests/fixtures/treatment_products.psql').read_text())
race('Produto concorrente PR80')
race('Produto validade concorrente PR80', conflicting_expiry=True)
print('All product/lot concurrency checks passed. Disposable database only.', flush=True)
