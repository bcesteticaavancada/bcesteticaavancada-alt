# Calendário mensal público — 17/10/2026

Layout aprovado: calendário em destaque, escolha do dia antes do procedimento, painel de atendimento por toque. Celular: painel inferior; tablet: modal central; desktop: painel lateral. Setas de mês e Hoje. Janela civil de consulta e reserva: mês atual até +12 meses inclusive, fuso America/Sao_Paulo.

O endpoint `overview` consulta uma RPC restrita a service_role e retorna somente datas/booleanos. Um dia livre exige um slot real de algum procedimento publicado e profissional autorizado. O painel mostra somente profissionais com slots reais para o procedimento/dia escolhido. RLS, bloqueios, almoço, duração, concorrência e rate limiting permanecem aplicáveis na confirmação.

Migration adicional: `20261017111622_bc_public_agenda_month_overview.sql`. Nenhuma disponibilidade, cliente ou agendamento é criado por ela. Não usar normalização de histórico do CI no banco hospedado.

## Validação antes do rollout

- 12 testes de comportamento do calendário e formulário com DOM real, incluindo resposta obsoleta, erro inicial recuperável, conflito e submit duplicado.
- Suíte Node completa: 708 testes esperados (62 pré-anamnese, 114 site, 532 gestão).
- Banco descartável: 68 migrations, 205 assertions pgTAP e seis cenários concorrentes esperados; Advisors em WARN bloqueiam o CI.
- Navegadores automatizados: Chromium e WebKit em 320, 390, 768, 1024 e 1440px; meses futuros, modal, seleção, confirmação fictícia, overflow e troca de breakpoint. Chamadas interceptadas; não alteram produção. Capturas disponíveis no artefato do Site CI.

CI, implantação e verificação hospedada ainda pendentes ao preparar este documento. Teste automatizado não equivale a teste em aparelho físico ou PWA instalada. Atualizar esta seção após o rollout.

## Sequência e recuperação

Conferir histórico hospedado; preservar as três definições de funções substituídas para rollback; aplicar apenas a migration adicional; publicar Edge Function mantendo configuração pública existente; validar overview e slots reais por consultas sem reserva; integrar frontend após CI verde. Para rollback, restaurar frontend/Edge anteriores e as três definições preservadas, removendo somente RPC/helper/índice novos. Preservar registros e reservas existentes.
