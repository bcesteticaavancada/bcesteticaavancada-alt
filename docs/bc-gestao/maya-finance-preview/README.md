# BC Gestão — Maya Intelligence Finance & Business
## Checkpoint da retomada (25/11/2026)
Escopo desta entrega: prova de conceito isolada com dados inventados, sem integração remota. Nenhuma migration aplicada. Nenhum merge ou deploy autorizado. O repositório é público: não incluir identificadores reais, credenciais, valores da clínica ou dados clínicos.

### Auditoria e decisões
- PR #23 é draft aberto; a base main já possui finance-simple-api.js e finance-receipts-api.js. Não reaplicar migrations antigas nem mesclar o PR #23 por pressuposição.
- PR #70 (Maya V2) está mesclado; documentação de acesso existente prevê admin, colaborador e admin_criacao, com restrição financeira para criação.
- Produção Supabase ativa; catálogo contém recebimentos, pagamentos, comissões, livros, repasses e auditoria. RLS habilitado nas tabelas públicas retornadas; a eficácia das políticas exige teste por identidade.
- RPCs existentes: bc_finance_overview, bc_finance_report, bc_finance_my_summary, bc_finance_charge_define, bc_recebimento_registrar_agendamento_v2, bc_recebimento_registrar_v2, bc_finance_expense_create, bc_finance_commission_pay, bc_finance_attempt_reconcile. Reutilizar wrappers atuais e verificar argumentos, erros e autorização no staging.
- Nenhuma branch Supabase encontrada; não criar branch paga sem autorização. Usar Supabase local descartável/CI para testes de banco. Divergência de migrations ainda deve ser reconciliada por comparação de histórico e schema; não reparar produção.
- Workflow Pages está configurado para push em main ou dispatch manual. Não disparar deploy.

### Entregue nesta branch
- engine.mjs: cálculo em centavos inteiros e percentuais em pontos-base, arredondamento de meio centavo para cima, validações, interpretação de uma única frase de exemplo e estado de confirmação local.
- index.html: formulário de conferência, separação de receita, recebimento, saldo, comissão e contribuição estimada; painel de sessão com dados sintéticos, responsivo por CSS. Executar via servidor HTTP local, por exemplo na raiz do checkout: python -m http.server 8000 e abrir /docs/bc-gestao/maya-finance-preview/index.html.
- tests/gestao/maya-finance-preview.test.mjs: 12 cenários; execução das 12 funções de teste no ambiente JS da retomada aprovada antes do commit; execução Node/CI e navegador ainda não verificada nesse momento.
- Nenhuma chamada ao banco, IA generativa, voz, autenticação, armazenamento persistente ou integração real.

### Modelo de integração proposto (não implementado)
Entrada texto/voz -> extração estruturada sem privilégios de escrita -> resolução de profissional, procedimento e atendimento por IDs autorizados -> conferência server-side do saldo e versão de regra -> cálculo determinístico -> prévia com validade e idempotência -> confirmação explícita por admin -> operação transacional/auditada utilizando RPCs existentes -> reconciliação da tentativa -> consulta gerencial.
Não confiar em nomes, papel enviado pelo frontend, texto de IA, comissão digitada ou valores da prévia. Resolver ambiguidades e exigir confirmação novamente após alteração ou expiração. Evitar comandos múltiplos parcialmente aplicados: avaliar transação única no servidor ou reconciliação explícita antes de integração. Uma tentativa com resultado desconhecido não é motivo para gerar nova chave.
Não persistir transcrição bruta sem necessidade, consentimento e retenção definida; não usar prontuário para vendas.

### Regras financeiras
Receita reconhecida: serviço realizado/critério validado pela contabilidade; recebimento: valor informado como recebido, sem presumir liquidação de cartão; saldo a receber: diferença entre receita/obrigação e pagamentos reconciliados; caixa: entradas e saídas efetivamente liquidadas; contribuição: receita menos custos variáveis reconhecidos, taxas e comissão provisionada. DRE gerencial e caixa são modelos separados; pagamentos de comissão não podem reduzir DRE novamente quando já provisionados. Estornos devem referenciar originais. Pacotes, competência, impostos e parcelamento exigem política própria.
Comissão por profissional/procedimento, base, vigência e arredondamento validados pela administração, sem defaults globais. Simulação não é lançamento contábil.

### Matriz proposta
- Admin financeiro: consultar dados autorizados, configurar regras, revisar e confirmar lançamentos; auditoria e estornos.
- Colaborador: somente escopo próprio conforme política vigente; sem visão total, nem comissão alheia; direitos de lançamento já existentes não serão ampliados.
- Admin_criacao: protótipos sintéticos, desenvolvimento e diagnóstico sem acesso a valores, relatórios, transcrições ou dados privados.
- Maya: nunca recebe privilégio próprio de escrita; ações seguem autorização real do usuário no servidor.
- Anônimo: nenhum acesso financeiro.

### Gates para homologação
1. Rodar suíte Node e navegador (desktop/mobile); verificar navegação teclado, foco, estados de erro e confirmação invalidada após edição.
2. Comparar migrações locais/produção por metadados; construir banco local descartável e verificar APIs e políticas RLS com contas sintéticas.
3. Testar negacão de admin_criacao, colaborador fora de escopo e anônimo; revogação de sessão; duplicidade concorrente; falha de rede; estorno; arredondamento; datas de competência e caixa.
4. Integrar fluxo à Maya sem ampliar acesso; criar contrato de extração de texto e voz; testes adversariais de prompt injection e PII.
5. Dashboard: separar DRE, caixa, receber/pagar, comissão, filtros, CSV, metas e indicadores comerciais com denominadores definidos. Validar regras com Mel e contabilidade.
6. Backup/restauração local com dados fictícios, rollback de código e migrations compatíveis; checklist e aprovação antes de merge, deploy ou produção.

### Limitações conhecidas
Interpretador aceita um modelo de frase apenas. Não resolve IDs, regras vigentes, parcelamentos, taxas reais ou duplicidade de negócio (somente chave repetida no simulador). Não registra eventos financeiros reais. Sem visualização gráfica temporal, exportação, DRE, estoque, CLV/CAC ou integração com Maya real nesta entrega. A prévia de margem permite contribuição negativa de forma deliberada. Valores do exemplo não são valores reais da clínica.

### Referências técnicas
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog.md
- https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/23
- https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/70
- gestao/js/finance-simple-api.js; gestao/js/finance-receipts-api.js; docs/bc-gestao/maya-acesso-equipe-2026-10-28.md.
