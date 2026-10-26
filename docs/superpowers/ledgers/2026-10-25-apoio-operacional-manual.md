# SDD ledger — plan: docs/superpowers/plans/2026-10-25-apoio-operacional-manual.md

Base main a65b853ce2d1173345b86f4ceab8855ab84c3a6c; checkout restaurado do GitHub após manutenção do workspace. Branch feature/apoio-operacional-manual.

Autorização: escopo e fluxo manual definidos nas mensagens de Fernando; confirmação “Exato”. Não reabrir decisão sobre integração/obrigatoriedade GOV.BR. Contas atuais não serão alteradas por convite ou teste. A biblioteca de TCLEs não será reescrita.

Pre-flight: Task2 consome o contrato HTTP da Task1 documentado no plano; IDs atuais e bc_creation_list preservados. Não há mudança de helpers clínicos/financeiros.

CLI Supabase ausente (command -v retornou1); seguir exceção operacional já usada no projeto: timestamp UTC do executor para o arquivo de migration e CI descartável como runtime do banco. Npm ci instalado sem mudar lockfile. Materialização dos MP4s rastreados em curso para a suíte completa, fora do escopo de alterações.

Em andamento: testes RED do serviço/banco e implementação Task1. Nenhuma alteração em produção realizada.
