# SDD ledger — plan: docs/superpowers/plans/2026-10-25-apoio-operacional-manual.md

Base main a65b853ce2d1173345b86f4ceab8855ab84c3a6c; checkout restaurado do GitHub após manutenção do workspace. Branch feature/apoio-operacional-manual.

Autorização: escopo e fluxo manual definidos nas mensagens de Fernando; confirmação “Exato”. Não reabrir decisão sobre integração/obrigatoriedade GOV.BR. Contas atuais não serão alteradas por convite ou teste. A biblioteca de TCLEs não será reescrita.

Pre-flight: Task2 consome o contrato HTTP da Task1 documentado no plano; IDs atuais e bc_creation_list preservados. Não há mudança de helpers clínicos/financeiros.

CLI Supabase ausente (command -v retornou1); seguir exceção operacional já usada no projeto: timestamp UTC do executor para o arquivo de migration e CI descartável como runtime do banco. Npm ci instalado sem mudar lockfile. Materialização dos MP4s rastreados em curso para a suíte completa, fora do escopo de alterações.

Em andamento: testes RED do serviço/banco e implementação Task1. Nenhuma alteração em produção realizada.

RED remoto: Site40252143669 falhou porque handler ainda não existia; banco40252143708/job121346168580 falhou em has_function e serviço ausente, como esperado. Suíte anterior preservada. Implementação inicial Node:69 frontend,133 site,625 gestão aprovados. Unidade do handler preserva bytes reais do PDF sintético e usa Auth/SMTP fictícios, sem convite real.

Ruling: descoberta dependência de onboarding — o filtro atende_clientes=true escondia a nova colaboradora da tela da Mel. Incluída conclusão pela administradora: perfis pendentes aparecem para completar identidade e botão Habilitar atendimento. Endpoint exige papel admin, convite desta funcionalidade e identidade preenchida; mantém procedure_scope=explicit e sem gerência. O perfil de criação não recebe essa capacidade. Sem esse ajuste, o cadastro novo dependeria de manutenção manual no banco. Duas regressões observadas RED→GREEN para visibilidade e boundary de ativação.

Primeira implementação: banco40252986873/job121348690436 aprovado (pgTAP/lint/advisors/concorrência). Site40252986883/job121348690434 reprovou somente porque a asserção lia o conteúdo imediatamente após dialog.close(), antes do evento close assíncrono nativo. Cadastro/gravação/download/upload chegaram até esse ponto. Harness passa a aguardar a condição efetiva de limpeza, sem sleep ou ampliação de timeout; comportamento de produção já limpa no evento close e recusa resultado atrasado quando o diálogo está fechado. Suíte local após onboarding:69+133+627, zero falhas.

Revisão independente única no head702aa91 encontrou Critical: falha ambígua na resposta de registro podia apagar PDF já registrado; Important: convite parcial sem recuperação; aviso de upload antigo em outra cliente; upload descartava rascunho cadastral. Zero Minor. Correção única em andamento, cada achado com reprodução RED→GREEN. Não solicitar nova revisão depois dos testes.

Ruling: convites passam a links manuais, gerados por Auth.admin.createUser + generateLink(type=invite), sem SMTP. A identidade nova recebe marcador de app_metadata exclusivamente do servidor ligado à reserva; recuperação só antes de confirmação/primeiro acesso, com a mesma identidade e sem adotar contas existentes. Operador copia/envia o convite, como parte da ação explícita de cadastro. API oficial generateLink e código primário supabase/auth/internal/api/mail.go consultados: invite permite regenerar token apenas de usuário não confirmado. Isso evita e-mail enviado antes de concluir perfil e não depende de configuração SMTP; nenhum link real será gerado nos testes.

Correção planejada do PDF: reserva privada por caminho antes do upload; registro idempotente e descarte serializado pela mesma linha. Limpeza só após estado descartado confirmado; nunca excluir objeto de registro já confirmado ou incerto. Correção de UI: atualizar somente a lista documental, preservando formulário cadastral e validando contexto após cada await.

Fix pass completo: reproduções RED confirmaram exclusão após commit ambíguo, perda do rascunho e aviso em ficha alheia. GREEN:20 testes focados do handler/UI; suíte completa69 frontend+133 site+633 gestão=835 aprovados. Limpeza agora usa discard_upload sob lock da mesma reserva; registro idempotente recupera fileId sem remover bytes. Convite usa identidade marcada no servidor, lease de2min, retomada somente antes de confirmação/uso, e finalização idempotente. Interface apresenta link sem envio automático e o limpa ao sair de Equipe. pgTAP cobre repetição, registro atrasado após descarte, recuperação de convite e bloqueio de conta confirmada. CI final pendente.
