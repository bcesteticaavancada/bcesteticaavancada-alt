# Fase 6A — checklist pré-merge

## Escopo entregue
- Cadastro rápido v2: nome, CPF, data de nascimento e telefone obrigatórios; e-mail opcional.
- CPF normalizado e único no banco; duplicidade semelhante tratada na UI.
- Idade sempre derivada; menor de 18 anos exige responsável legal.
- Endereço estruturado na Pasta da Cliente.
- Linha do tempo clínica compartilhada entre equipe autorizada, sem dados financeiros cruzados.
- Foto de identificação por câmera/galeria em bucket privado, histórico preservado e URL assinada.
- Admin pode arquivar/reativar; colaboradora não recebe esse controle.
- Migrations aplicadas somente em `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).

## Verificações
- CI da branch verde no commit `8ea81b402a40cc90566025d6dd6d3f946a06efa3`.
- Bucket `bc-prontuario-private`: `public=false`, limite 8 MiB.
- RLS ativo em `cliente_identificacao_fotos`.
- `authenticated`: EXECUTE nos RPCs públicos; `anon`: sem EXECUTE.
- Tabela de metadados de foto: leitura direta apenas; sem INSERT/UPDATE/DELETE direto para `authenticated`.
- Nenhuma linha de foto criada durante aplicação/homologação.
- Nenhum cadastro legado foi preenchido automaticamente pelas novas colunas.
- Advisor de segurança sem novo achado da 6A.
- Advisor de performance apontou FK `created_by` sem índice; corrigido em migration separada. Contagem caiu de 25 para 24.
- `/admin/` legado não aparece no diff da branch.

## Observação de homologação
A camada de gestão bloqueou um bloco SQL anônimo usado apenas para tentar agrupar cenários negativos de homologação. A tentativa não alterou dados. Os invariantes continuam cobertos por testes de contrato, constraints/RPCs e verificações de grants; qualquer validação visual autenticada restante deve usar conta de equipe e dados fictícios, sem paciente real.
