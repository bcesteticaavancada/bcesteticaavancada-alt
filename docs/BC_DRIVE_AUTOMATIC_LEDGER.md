# SDD ledger — plan: docs/superpowers/plans/2026-10-24-drive-automatic.md

- Base local: fd1efdb; parent remoto a preservar: dec003cf2aebf32402e25b1299823b9cf691dbfc.
- Ruling: prosseguir sem nova rodada de aprovação — usuário pediu expressamente ativar agora após fases/testes já aprovados — nenhuma ampliação para SQL/financeiro.
- Ruling: execução nativa com uma revisão final independente — tarefa contínua autorizada, sem delegar implementação.
- Pré-verificação: conexão pronta, bucket privado; worker ainda ausente; pg_cron/pg_net disponíveis mas não instalados.
- Changelog Supabase consultado: avisos TLS futuros não alteram este runtime moderno; usar docs atuais de cron/Vault.
- Task 1: complete — testes RED por módulo ausente, depois 13 testes GREEN incluindo corrupção/BOM, retorno incerto, lease, backlog e OAuth expirado. Core sem dependência externa de assertions.
- Task 2: complete — SQL RED com migration vazia, depois 8 testes PGlite GREEN. Vault/pg_net simulados apenas localmente; integração real ainda será verificada. Typecheck passou; 784 testes existentes passaram.
- Ruling: SQL denylist e journal privados não alteram nenhum grant de colaboradoras; tentativa de REVOKE da queue pg_net exige confirmação real, pois a tabela pertence à plataforma.
- Bloqueio identificado para última etapa: sessão web do painel expirou. O conector não gerencia Edge Secrets. Preparar todos os itens/revisão/implantação desativada antes da intervenção de login, se necessária.
- Revisão independente local concluída: nenhum Critical, dois Important (rotação de falhas em cópia e auditoria), um Minor (journal histórico). Todos tratados no mesmo fix pass com testes de regressão RED/GREEN; IDs reservados, autenticação e isolamento foram considerados adequados. A tentativa inicial do revisor falhou por limite de uso; retomada leu/reproduziu o código sem acessar serviços.
- Ruling: controle de escrita definitivo em `private.bc_drive_backup_control.enabled` — o conector administrativo está autorizado e o booleano privado já era validado em claim/journal/invoke. Remover guard Edge duplicado, que pertencia à preparação, evita divergência entre dois gates. RLS, auth por capability e validações de escopo/destino permanecem. Não houve login automatizado após browserAuth retornar declined.
- Fix pass: cursores independentes avançam nas tentativas falhas; snapshots só das chaves atuais em lotes de 100; verify_jwt=false explícito em config.toml, consistente com auth própria. OAuth e rehearsal publicados não serão alterados.
- Integração: migration inicial aplicada e bundle do worker verificado, ainda desativado. ACLs das tabelas privadas e RPC corretos. Queue da plataforma manteve grants PUBLIC apesar da tentativa de REVOKE; nenhum segredo foi enfileirado.
- Ruling: substituir o transporte da capability permanente por ticket de uso único com TTL de dois minutos, hash privado e consumo atômico. Credenciais OAuth ficam exclusivamente no Vault/Edge. A capability legada criada na primeira migration fica sem uso; invoke V2 não a lê. Testes RED/GREEN de expiração, repetição, SQL invoker e ACL.
