# BC Gestão simples — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** entregar o fluxo aprovado: sessão vinculada, recebimento único, comissão imediata, pagamento direto, despesa mínima, resumo baixável e navegação enxuta.
**Architecture:** reutilizar recebimentos v2 e sua serialização; adicionar comissões por recebimento e pagamentos diretos, sem fechamento semanal obrigatório. RPCs validam papel e identidade; leitura e arquivo financeiro permanecem separados do prontuário. O backend legado é preservado para histórico/testes, com corte explícito que impede usar os dois modelos no mesmo movimento.
**Tech Stack:** JavaScript ES modules, Node/linkedom, PostgreSQL17/Supabase, pgTAP, Playwright; PDF simples gerado localmente a partir dos mesmos dados do relatório.
**Spec:** docs/superpowers/specs/2026-10-22-app-mais-simples-design.md, aprovada por Fernando em 22/10: “Ótimo pode seguir aprovado”.

## Global Constraints

- Concluir sessão cria cobrança, nunca recebimento automático. Comissão incide somente sobre dinheiro confirmado como recebido.
- Método e comprovante de pagamento opcionais; nenhum percentual é presumido.
- Individualidade, habilitação, autoria clínica, permissões e bloqueio financeiro de Admin de Criação permanecem no servidor.
- Nenhum paciente, assinatura ou movimento financeiro real de teste. Não apagar históricos.
- Datas da clínica em America/Sao_Paulo; dinheiro validado em centavos, rejeitando NaN/Infinity.
- Execução nativa sequencial e publicação autorizadas no contexto; sem nova escolha de executor ou confirmação genérica entre tarefas.

## Review Focus

- Recebimento e pagamento simultâneos: o pagamento quita exatamente os itens/total exibidos; novo item permanece pendente.
- Resposta perdida: mesma tentativa não duplica recebimento, comissão, pagamento, despesa ou anexo; resultado confirmado não vira falha por atualização de lista.
- Comissão não configurada e procedimento gratuito: registrar clínica sem inventar total ou percentual; pendência explícita somente onde aplicável.
- Anexo opcional falhou: pagamento continua salvo; tentativa seguinte repete apenas o anexo, com acesso restrito ao registro.
- Corte entre legado e simples: não apurar ou pagar a mesma entrada nos dois modelos; não bloquear novos recebimentos depois de pagar no meio da semana.

## Task 1: Base financeira simples e transição protegida

**Files:** novas migrations `bc_finance_simple_core`, `bc_finance_simple_read`, `bc_finance_simple_enable`; novo `supabase/tests/database/finance_simple.test.sql`; fixtures de testes legados explicitam modo legado; novo `scripts/test-finance-simple-concurrency.py`.
**Interfaces:**
- `bc_finance_overview(p_from date,p_to date,p_professional uuid default null)->jsonb`: resumo do período, pendências globais, recebimentos, despesas, pagamentos e configurações.
- `bc_finance_my_summary(p_from date,p_to date)->jsonb`: valores próprios sem percentuais internos.
- `bc_finance_appointment_summary(p_appointment_id uuid)->jsonb`: cobrança/saldo e permissão de recebimento da própria sessão ou administração.
- `bc_finance_commission_pay(p_request_key uuid,p_professional uuid,p_item_ids uuid[],p_expected_total numeric,p_method text default null,p_paid_at timestamptz default null)->uuid`.
- `bc_finance_commission_reverse(p_payment_id uuid,p_reason text)->uuid`.
- `bc_finance_commissions_apply(p_professional uuid,p_percent numeric,p_procedure_ids uuid[] default null)->integer`: regra por combinação; null aplica às opções autorizadas.
- `bc_finance_expense_create(p_request_key uuid,p_description text,p_amount numeric,p_paid_at timestamptz default null,p_method text default null,p_note text default null)->uuid` e `bc_finance_expense_reverse(p_expense_id uuid,p_reason text)->uuid`.
- `bc_finance_report(p_from date,p_to date)->jsonb`: linhas e totais comuns à tela e exportações; cancelados identificados, excluídos dos totais válidos.
- `bc_finance_operation_result(p_kind text,p_request_key uuid)->jsonb`: confirmação administrativa por chave, sem expor payload interno.

- [ ] Escrever testes SQL isolados e pgTAP antes da implementação: sessão600 gera obrigação600/recebido0; entrada100 preserva saldo500; comissão fictícia30%=30, falta de regra gera pendência; clique repetido retorna mesmo UUID; pago sai de pendente; entrada posterior continua permitida; estorno de entrada com comissão paga bloqueado; regra alterada não muda snapshot; despesas e relatório não duplicam; papéis indevidos42501.
- [ ] Observar RED por ausência das novas interfaces; registrar a saída.
- [ ] Implementar entidades privadas de comissão por recebimento, pagamento, despesa e modo simples; chave única por operação, mutex por profissional antes de row locks, snapshot imutável e auditoria. Cobrança idempotente após finalização clínica assinada. Atualização de regra só resolve itens ainda sem percentual.
- [ ] Proteger contra escrita legada após ativação. Testes antigos rodam explicitamente no modo legado descartável; novos testes verificam o modo simples, inclusive rejeição das escritas antigas. Ativação em produção exige ausência de movimentos legados não migrados; falha aborta o corte em vez de descartar registros.
- [ ] GREEN SQL isolado, pgTAP/concorrência no PostgreSQL17 e revisão de grants/RLS. Commit da tarefa.

## Task 2: Um caminho de atendimento e recebimento contextual

**Files:** novo `gestao/js/finance-receipt-panel.js`; modificar `finance-receipts-api.js`, `agenda-treatment-bridge.js`, `treatment-panel.js`, `admin-agenda.js`, `colaborador-agenda.js`, `gestao/colaborador/index.html`; testes dos controladores e de integração clínica/financeira.
**Interfaces:** `mountAppointmentReceipt({client,root,appointmentId,onChanged})->{refresh,destroy}` usa Task1 e `createReceiptAttempt`; `registerReceiptForAppointment` mantém requestKey e usa `nao_informado` somente quando método opcional não foi informado.

- [ ] RED: Atender abre a sessão existente sem botão intermediário; dados de agenda reaproveitados; sessão concluída mostra saldo preenchido; receber parcela ou total não repete cliente/procedimento; rede incerta preserva chave; outra profissional não recebe contexto mutável; formulário operacional antigo não é mais entrada para novas sessões.
- [ ] Implementar um componente de recebimento usado pela sessão e agenda. Somente confirmação explícita registra dinheiro. Detalhes opcionais começam recolhidos; recebimento confirmado atualiza os setores sem limpar outro formulário.
- [ ] GREEN Node de agenda/tratamento/recebimentos, mantendo consentimentos e assinaturas. Commit da tarefa.

## Task 3: Pagamento direto, despesas, comprovante e relatório

**Files:** novo `gestao/js/finance-simple-api.js`, `finance-report.js`, `finance-attachments.js`; substituir interface/controlador de `admin-finance.js` e `colaborador-finance.js`; ajustar HTML admin/colaborador e `gestao/assets/finance.css`; nova migration `bc_finance_simple_files`; testes Node e pgTAP de anexos; QA do PDF.
**Interfaces:** API chama as RPCs Task1 com validação/readback; relatório exporta `financeReportCsv(report)->string` e `financeReportPdf(report)->Uint8Array`.
- `bc_finance_attachment_reserve(p_kind text,p_entity_id uuid,p_name text,p_mime text,p_size bigint,p_request_key uuid)->jsonb` retorna id/path privado.
- `bc_finance_attachment_complete(p_attachment_id uuid)->jsonb` verifica objeto; leitura de metadados e Storage exige admin ou destinatária do pagamento. Admin de Criação nunca acessa. Bucket privado com tamanho/tipos permitidos.

- [ ] RED: R$60 pagos não aparecem a receber; valor devido aparece sem lote; dois toques para pagar sem método/anexo; parcial falhou somente upload; nova despesa pede descrição/valor com data pronta; falta de regra tem ação de configuração; visão própria não mostra percentuais nem alheios; CSV/PDF e tela conferem, incluindo cancelados e datas-limite; texto malicioso não injeta HTML/fórmula CSV/PDF.
- [ ] Implementar página financeira com resumo do período, pendentes por profissional, histórico pago e lançamentos. Configuração de comissão em detalhe secundário; ação em massa para procedimentos autorizados. Confirmar profissional/itens/total antes de pagar e preservar tentativa incerta.
- [ ] Implementar despesa mínima e resumo PDF/CSV sem dados clínicos. Comissões pagas entram como saída automaticamente uma vez. Anexo pode ser enviado depois; falha de arquivo não repete pagamento. Corrigir pagamentos/despesas somente por administração, com confirmação e histórico.
- [ ] GREEN Node/pgTAP e renderização de PDF de exemplo fictício em múltiplas páginas, além da verificação de texto/totais. Commit da tarefa.

## Task 4: Navegação comum e áreas independentes

**Files:** `gestao/admin/index.html`, `gestao/colaborador/index.html`, `gestao/criacao/index.html`, `gestao/js/shell.js`, novo `dashboard-runtime.js`, `clientes-panel.js`, `clientes-folder.js`, CSS de navegação; testes Node/browser.
**Interfaces:** `startDashboard({root,areas,authorize})->{open,refresh,destroy}` inicializa área quando aberta, trata falha local e mantém invalidação/dirty-state já existentes. Evento de área não perde contexto nem contorna `requireRole`.

- [ ] RED: agenda disponível quando financeiro falha; form de criar cadastro/agendamento começa recolhido e abre por botão; primeiro cadastro só nome/telefone expostos; pré-anamnese ligada à cliente exige confirmação; configurações agrupam equipe/catálogo/auditoria; perfil criação continua sem financeiro.
- [ ] Implementar acessos diários Agenda/Clientes/Financeiro e menu secundário de configurações. Uma área falha sem impedir as outras. Preservar foco, formulário em edição, autoria e conteúdo clínico específico. Evitar duplicar formulários entre papéis.
- [ ] GREEN Node, Chromium/WebKit e verificações celular/tablet. Commit da tarefa.

## Task 5: Navegação pública enxuta e publicação

**Files:** navegação comum pública em `index.html`, páginas existentes e script compartilhado correspondente; testes de links/menu/agenda. Não alterar imagens, NFC, conteúdo clínico ou trabalhos paralelos.
**Interfaces:** destino canônico `agenda/` para Agendar; manter `agendamento/#preAnamneseForm` e URLs existentes acessíveis em seus contextos, sem duplicar disponibilidade.

- [ ] RED: navegação pública agrupa Tratamentos, Resultados, Equipe/Clínica, Agendar e Contato; Login acessível; home e página de agenda continuam com calendário; URLs anteriores funcionam.
- [ ] Implementar agrupamento de menu e ações consistentes, preservando páginas e links; GREEN testes do site e browser. Commit da tarefa.
- [ ] Revisão independente da branch, uma rodada de correções materiais com RED→GREEN e suíte completa; registrar decisões e limites.
- [ ] Conferir produção, aplicar migrations revisadas/ativação sem dados reais de teste, integrar a branch autorizada, conferir deploy e SHA256 dos arquivos publicados. Conferir papéis, RPCs e Storage por leitura.

## Handoff e continuidade

Método preservado: execução nativa, tarefas sequenciais, uma revisão independente final. A aprovação expressa de Fernando cobre a proposta e a continuação do trabalho; não reabrir escolha de executor nem pedir confirmação genérica entre as etapas. Questão que altere escopo ou implique apagar dados reais exige nova análise concreta.
