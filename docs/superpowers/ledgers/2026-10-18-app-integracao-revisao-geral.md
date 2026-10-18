# Execução — plano: docs/superpowers/plans/2026-10-18-app-integracao-revisao-geral.md

Base: 75491461ea154334dc9486d5703c58d28aead5ae. Branch: fix/app-integracao-revisao-geral. Baseline: npm test 723/723, executado durante a auditoria na mesma versão.

Autorização: o usuário pediu corrigir todos os achados em ordem; não há nova espera de confirmação para decisões rotineiras ou publicação das correções autorizadas.

Decisão: reaproveitar o checkout de auditoria criado só para esta tarefa, em branch própria; sem outro worktree redundante.

Task 1: em andamento — recebimento da ficha na base ativa, revisão e vínculo explícito na pasta; não reativar projeto legado.

Task 1: RED host legado e inbox ausente confirmados; GREEN Node: 726/726. Implementados recepção privada, envio na base ativa, PDF e vínculo explícito. Deno e replay SQL aguardando validação; nenhuma migration aplicada em produção.

Task 1: CI Deno completo e Site CI (incluindo Chromium/WebKit) aprovados. Replay SQL passou, pgTAP revelou policy legada de Storage consultando tabela RPC-only sem privilégio; correção por helper privado implementada, sem abrir SELECT direto. Nova execução em andamento.
Task 2: RED reproduziu recebimento com identificador errado. GREEN controlador passa agendamento à RPC que resolve atendimento no banco. Finalização futura cria vínculo operacional e atualiza agenda sem pagamento automático. Atendimento direto reserva agenda antes de iniciar. Admin recebeu registro explícito de recebimento nos cards concluídos.

Revisão independente dos passos 1/2: corrigidos acesso service_role ao schema privado, recuperação explícita de fichas clínicas antigas com vínculo à agenda, reinício explícito de formulário, paginação somente de pendências e publicação imutável de PDF por hash/compare-and-set. Antecipada a privacidade dos rascunhos: removidos dados legados do armazenamento permanente; sessão com TTL de 30 minutos e fallback em memória. RED/GREEN comportamental dos novos caminhos; npm test 733/733. Aguardando novo replay SQL/Deno e revisão.

Contas Aline/Kátia: acesso ao painel Authentication rejeitado pela revisão automática de aprovação, exigindo autorização específica para administração de contas; não contornado. Nenhuma conta, perfil real, consulta ou recebimento real foi alterado. Demais etapas continuam.
