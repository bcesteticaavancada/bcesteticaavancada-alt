#!/usr/bin/env bash
# Run under the clinic's Cloud Shell. No login, API activation, IAM or billing changes.
set -uo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1 CLOUDSDK_CORE_DISABLE_USAGE_REPORTING=true
domain="${BC_DOMAIN:-bcesteticaavancada.com.br}"
account="${BC_AUDIT_ACCOUNT:?Informe o e-mail administrativo esperado em BC_AUDIT_ACCOUNT}"
private_tmp=$(mktemp -d) || exit 1
chmod 700 "$private_tmp"
trap 'rm -rf -- "$private_tmp"' EXIT
g(){ gcloud --quiet "$@"; }
# Report errors independently. Empty stdout on error is never an empty inventory.
read_json(){
  local tag=$1
  shift
  if ! g "$@" --format=json >"$private_tmp/out" 2>"$private_tmp/err"; then
    local reason=INCONCLUSIVO
    if grep -Eqi 'PERMISSION_DENIED|permission denied|does not have permission|not have.*permission' "$private_tmp/err"; then reason=SEM_PERMISSAO
    elif grep -Eqi 'SERVICE_DISABLED|has not been used|disabled' "$private_tmp/err"; then reason=API_INDISPONIVEL; fi
    echo "$tag $reason" >&2
    return 1
  fi
}
readonly salt="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export BC_AUDIT_SALT="$salt"
# Read only the public shape of responses. IAM identifiers are pseudonymized for sharing.
summary(){
 python3 - "$private_tmp/out" "$1" <<'PY'
import hashlib,hmac,json,os,sys
rows=json.load(open(sys.argv[1])); kind=sys.argv[2]
def alias(x):
 return hmac.new(os.environ['BC_AUDIT_SALT'].encode(),str(x).encode(),hashlib.sha256).hexdigest()[:12]
if kind=='iam':
 for b in rows.get('bindings',[]):
  print(b['role'], 'condicional' if b.get('condition') else 'direta', [(s.partition(':')[0],alias(s)) for s in b.get('members',[])])
elif kind=='accounts':
 for v in rows: print('conta',alias(v.get('name')),'aberta',v.get('open'))
elif kind=='billing':
 print('billingEnabled',rows.get('billingEnabled','desconhecido'),'conta',alias(rows['billingAccountName']) if rows.get('billingAccountName') else 'sem-vinculo-informado')
elif kind=='api':
 for v in rows: print(v['config']['name'])
elif kind=='sa':
 for v in rows: print('identidade',alias(v.get('email')),'disabled',v.get('disabled',False))
elif kind=='keys':
 for v in rows: print('chave',alias(v.get('name')),v.get('keyType'),v.get('keyOrigin'),v.get('validAfterTime'),v.get('validBeforeTime'))
if isinstance(rows,list) and not rows: print('LISTA_VISIVEL_VAZIA')
PY
}
if ! active=$(g auth list --filter='status:ACTIVE' --format='value(account)'); then exit 2; fi
if [[ "$active" != "$account" ]]; then echo 'Identidade ativa diferente da identidade esperada. Auditoria interrompida.' >&2; exit 2; fi
echo 'Identidade esperada confirmada.'
read_json ORGANIZACOES organizations list || exit 3
org=$(python3 - "$private_tmp/out" "$domain" <<'PY'
import json,sys
matches=[str(x['name']).split('/')[-1] for x in json.load(open(sys.argv[1])) if x.get('displayName','').casefold()==sys.argv[2].casefold() and x.get('state',x.get('lifecycleState','ACTIVE'))=='ACTIVE']
if len(matches)==1 and matches[0].isdigit(): print(matches[0])
PY
)
if [[ -z "$org" ]]; then echo 'Organização não identificada de forma única entre as visíveis. Cobertura inconclusiva.'; exit 3; fi
echo "Organização confirmada pelo domínio: $org"
if read_json IAM_ORG organizations get-iam-policy "$org"; then summary iam; fi
if read_json BILLING_VISIVEL billing accounts list; then summary accounts; fi
if ! read_json PROJETOS projects list; then exit 4; fi
python3 -c 'import json,sys; print("\n".join(v["projectId"] for v in json.load(open(sys.argv[1]))))' "$private_tmp/out" >"$private_tmp/projects"
checked=0;unresolved=0
while IFS= read -r project; do
 [[ -n "$project" ]] || continue
 if ! read_json ANCESTRAIS projects get-ancestors "$project"; then unresolved=$((unresolved+1)); continue; fi
 if ! python3 -c 'import json,sys; sys.exit(not any(x.get("type")=="organization" and str(x.get("id"))==sys.argv[2] for x in json.load(open(sys.argv[1]))))' "$private_tmp/out" "$org"; then continue; fi
 checked=$((checked+1));echo "PROJETO $project"
 if read_json VINCULO billing projects describe "$project"; then summary billing; fi
 if read_json SERVICOS services list --enabled --project="$project"; then summary api; fi
 if read_json IAM_PROJETO projects get-iam-policy "$project"; then summary iam; fi
 if read_json CONTAS_SERVICO iam service-accounts list --project="$project"; then
  summary sa
  python3 -c 'import json,sys; print("\n".join(v["email"] for v in json.load(open(sys.argv[1]))))' "$private_tmp/out" >"$private_tmp/sa"
  while IFS= read -r identity; do
   [[ -n "$identity" ]] || continue
   if read_json METADADOS_CHAVES iam service-accounts keys list --iam-account="$identity" --project="$project"; then summary keys; fi
  done <"$private_tmp/sa"
 fi
done <"$private_tmp/projects"
echo "Projetos visíveis com ancestral confirmado: $checked. Ancestralidade inconclusiva: $unresolved."
echo 'Cobertura limitada pela identidade e pelos recursos ativos visíveis. Verifique Audience e Clients na Google Auth Platform, sem abrir segredos.'
