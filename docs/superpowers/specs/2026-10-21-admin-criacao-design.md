# Admin de Criação sem financeiro

Objetivo autorizado: separar a identidade de Fernando da identidade profissional Alice, preservar o histórico clínico de Alice e permitir que Fernando acompanhe a operação sem acesso financeiro. E-mails confirmados pelo usuário em 21/10/2026. O trabalho financeiro anterior permanece registrado com quatro defeitos pendentes; este incremento não é um fluxo de caixa nem uma integração contábil.

## Permissões

Novo papel `admin_criacao`, independente de `admin` e `colaborador`. Painel próprio, somente consulta, com busca e paginação. Mel continua administradora financeira. Alice continua colaboradora chefe. Fernando não atende clientes, não assina documentos como profissional e não administra o próprio papel. A assistência técnica continua pelas integrações autorizadas do projeto, sem criar conta humana para o assistente.

A nova identidade não entra em `is_bc_admin`, `is_bc_active_staff` nem `is_bc_active_colaborador`. Políticas restritivas impedem leitura direta e mutação das tabelas da aplicação, exceto a leitura do próprio perfil. O único acesso operacional novo é uma RPC autenticada com projeções explícitas, limite de 50 registros e busca sobre os campos já selecionados. Nenhum parâmetro escolhe livremente tabela ou coluna.

## Consulta

Agenda de todas as profissionais, clientes, equipe, procedimentos, atendimentos clínicos, estados das anamneses e pré-anamneses, documentos, alertas, produtos/lotes, equipamentos, disponibilidade, bloqueios, intercorrências e eventos operacionais de auditoria. Os campos financeiros, preços, comissões, repasses, conteúdo bruto da auditoria e caminhos de arquivos ficam excluídos na origem da resposta. Documentos aparecem como metadados; PDFs e anexos não são liberados porque podem conter valores. Snapshots e JSON clínicos livres também não são expostos por este painel. Essa restrição precisa ficar clara ao usuário: é acompanhamento operacional, não cópia integral do prontuário.

## Identidades e ativação

Preservar UUID profissional de Alice e alterar seu e-mail usando Supabase Auth oficial. Depois convidar Fernando em seu e-mail e configurar perfil `admin_criacao`, sem permissões clínicas. Atualização de credencial no navegador exige etapa manual do titular conforme política da ferramenta; não usar SQL para alterar `auth.users`. Não ativar o acesso de Fernando antes da publicação e verificação das regras.

## Verificação e reversão

Testes de roteamento e revogação de sessão; teste real de SQL isolado com dados fictícios para paginação, projeções, acesso negado a todas as tabelas e RPCs financeiras e perfil inativo. Suíte completa do projeto e CI de banco PostgreSQL/Supabase. Sem lançamentos financeiros ou prontuários de teste na produção. Desativar o novo perfil revoga o acesso; a migração não altera funções nem dados financeiros e mantém os dois papéis atuais.
