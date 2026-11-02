# BC Estética — proposta de dupla contingência e permissões clínicas (NÃO IMPLANTADA)

**Status: rascunho PR #76. Nenhuma migração foi aplicada ao projeto Supabase hospedado.**
Banco de testes descartável, dados e identidades sintéticos e `ROLLBACK`. A operação clínica continua sob responsabilidade da Mel; Fernando atua exclusivamente no suporte tático e recuperação.

## Matriz de acesso proposta

| Operação | Profissional ativa | Mel (admin, responsável clínica) | Fernando (admin_criacao, contingência técnica) |
| --- | --- | --- | --- |
| Consultar, cadastrar e acrescentar informação dentro dos fluxos autorizados | Sim | Sim | Somente nos serviços de suporte já autorizados |
| Gerar link de anamnese para cliente | **Qualquer profissional ativa**, mesmo que não atenda a cliente | Sim | Não por ser suporte técnico |
| Corrigir **sua** anamnese aberta | Sim, com antes/depois em auditoria | Sim | Não |
| Corrigir **sua** sessão clínica em rascunho | Sim, com antes/depois em auditoria | Sim | Não |
| Editar ficha clínica já finalizada/assinada | Não, requer fluxo clínico específico | Não pela simples permissão DELETE | Não: **sem edição silenciosa** |
| Corrigir dados cadastrais de cliente pelo serviço de suporte existente | Conforme fluxo clínico | Sim | Sim, com justificativa e antes/depois em `bc_support_service` |
| Anular documento já registrado, mantendo arquivo e histórico | Não | Sim, com motivo | Sim, **somente identidade configurada + MFA AAL2**, com motivo |
| Excluir definitivamente linhas das seis tabelas protegidas | Não | Sim, com identidade `clinical_owner` e RLS | Sim, **somente pela RPC emergencial**: identidade `technical_backup`, MFA AAL2, motivo de 10–500 caracteres e auditoria |
| Excluir contas de Mel ou Fernando vinculadas à contingência | Não | Não | Não |
| Alterar regras, publicar ou gerir produto | Fora do escopo | Decisão operacional da Mel | Não sem autorização específica da Mel |

As seis tabelas cobertas por gate e trigger são: `agendamentos`, `atendimentos`, `clientes`, `pagamentos`, `procedimentos` e `staff_profiles`.

## Proteções implementadas **apenas no código proposto**

1. `private.bc_final_delete_operators` guarda **duas identidades individuais**, com escopos exclusivos `clinical_owner` e `technical_backup`. A configuração é privada, não legível nem alterável pelo cliente API. Nenhum e-mail, senha ou UUID real é semeado no Git.
2. `private.bc_can_delete_finalized()` exige vínculo com perfil ativo. Para a Mel exige `admin`; para Fernando, `admin_criacao` **e token de sessão AAL2** (segundo fator de autenticação válido). Se faltarem as identidades, os acessos falham fechados.
3. Seis políticas `AS RESTRICTIVE FOR DELETE` preservam as políticas permissivas anteriores; não concedem leitura/escrita geral. O papel `admin_criacao` permanece impedido por `bc_creation_no_raw_access` de manipular diretamente tabelas clínicas.
4. `public.bc_support_delete_finalized(entity,id,reason)` é **exclusiva para contingência técnica**; usa função interna `SECURITY DEFINER` porque o perfil `admin_criacao` é bloqueado no RLS geral. Confere identidade configurada, MFA, tabela permitida, motivo; grava auditoria antes/depois e identidade individual. Não recebe SQL arbitrário do cliente; a tabela vem de uma lista fixa.
5. `public.bc_client_file_void` permite anulação auditada a ambas as identidades configuradas, sem remover conteúdo do Storage. A correção de cadastros via `bc_support_service` continua restrita a ações existentes com justificativa.
6. Rascunhos de anamnese e sessão mantêm autor e histórico de alterações, sem permitir alteração de conteúdo de outras profissionais. Qualquer profissional ativa pode gerar o link remoto de anamnese.

## Testes de aceitação incluídos

- Sem operadores cadastrados: nem outro administrador recebe exclusão.
- Profissional comum não apaga registros finais nem edita rascunho alheio.
- Mel configurada pode excluir pela política e não apagar seu próprio perfil; o registro excluído é auditado.
- Suporte sem MFA AAL2: acesso negado.
- Suporte com MFA AAL2: ainda sem DELETE direto, mas pode usar RPC fechada com motivo válido.
- Tabela não permitida, tentativa de remover a conta Mel ou motivo insuficiente: negados.
- RPC técnica grava autoria, motivo e snapshot anterior; anulação de arquivo preserva identidade.
- Envios de links remotos de anamnese continuam permitidos a qualquer profissional ativa.

## Bloqueios para produção

- [ ] Mel confirmar **diretamente** que aceita o segundo operador e quais classes de exclusão o suporte pode executar.
- [ ] Confirmar contas individuais no Supabase Auth por canal confiável (e-mail validado não basta para delegação clínica); configurar cada UUID privado sem compartilhamento de senha.
- [ ] Configurar MFA resistente a perda de aparelho para Fernando, com códigos de recuperação guardados separadamente, e testar restauração de acesso da Mel.
- [ ] Fazer backup criptografado **com restauração testada**, respeitando retenção legal e LGPD, e ter plano de reversão.
- [ ] Revisar Edge Functions, `service_role`, SQL de agendamento, Storage e rotinas financeiras que podem contornar RLS; avaliar consistência/fk e política de retenção antes de permitir DELETE definitivo.
- [ ] Executar testes de banco em ambiente isolado e avaliar os resultados da CI; validar casos reais apenas com dados pseudonimizados e autorização explícita.
- [ ] **Não publicar, mesclar PR ou aplicar migrações** até liberação específica da Mel.

## Limitações

Este desenho não torna o sistema inteiro imune a exclusões via `postgres`, `service_role` ou integrações privilegiadas. Também não substitui o fluxo de correção com versão de prontuários assinados, uma política de retenção de documentos clínicos, a análise de proteção de dados pessoais nem revisão de operações financeiras. Uma conta técnica não recebe autorização clínica automática.

O app Autosync for Google Drive (Android) pode ser considerado para **cópias locais secundárias de artefatos já permitidos**, usando sincronização de **envio apenas** para pasta dedicada e sem dados de pacientes até concluir avaliação de privacidade. Não é backup do banco Supabase; não usar espelhamento bidirecional como solução de recuperação.
