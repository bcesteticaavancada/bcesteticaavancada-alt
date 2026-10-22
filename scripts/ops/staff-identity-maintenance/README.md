# Manutenção de identidade da equipe

Os módulos são rotinas administrativas de uso único. O entrypoint versionado da Edge Function está encerrado e retorna 410. Não implantar os módulos como API permanente.

Uma ativação temporária revisada exige ID de tarefa privada em `audit_log`, hash SHA-256 de chave aleatória e prazo curto literal no wrapper. A chave é validada antes de criar o cliente privilegiado; o cliente usa somente as variáveis do ambiente Edge e não recebe cabeçalhos da requisição. O corpo HTTP não escolhe contas. A tarefa é reivindicada atomicamente antes de qualquer alteração no Auth.

`handler.mjs` preserva o UUID profissional, recusa identidades alternativas, troca o e-mail pelo Auth Admin, invalida a senha antiga e solicita redefinição ao titular. `invite.mjs` exige uma separação anterior concluída e o e-mail liberado correspondente; cria uma identidade distinta pelo convite oficial. Nenhuma rotina concede papéis. O provisionamento do perfil exige conferência separada do UUID registrado pela tarefa concluída.

Após a execução, conferir identidade, vínculo profissional, sessões, auditoria e resposta da solicitação de e-mail. Substituir imediatamente o wrapper ativo pelo entrypoint 410 com JWT obrigatório e eliminar a chave de ativação. Não versionar chaves, tarefas de produção, senhas ou links de convite/recuperação. O aceite da API não comprova entrega do e-mail.

Regressões: `node --test tests/gestao/staff-identity-maintenance.test.mjs tests/gestao/staff-invitation-maintenance.test.mjs`.
