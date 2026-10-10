# BC Gestão — Fase 5: verificação de implantação

Data da homologação: 2026-10-10

Projeto Supabase homologado: `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`, São Paulo).

## Migrations aplicadas

As migrations da Fase 5 foram aplicadas no projeto correto, sem uso do banco da pré-anamnese:

1. `bc_gestao_phase5_financial_foundation`
2. `bc_gestao_phase5_receipts_rpc`
3. `bc_gestao_phase5_books_rpc`
4. `bc_gestao_phase5_payouts_rpc`
5. `bc_gestao_phase5_audit_hardening`
6. `bc_gestao_phase5_audit_hardening_followup`

O follow-up de auditoria foi criado depois de uma inspeção ao vivo detectar privilégios legados herdados em `audit_log`. Ele revoga todos os privilégios de `anon` e `authenticated` e devolve somente `SELECT` a `authenticated`, ainda protegido pela policy RLS `audit_log_admin_select` com `private.is_bc_admin()`.

## Verificação de segurança ao vivo

Foi validado diretamente no banco que:

- as sete tabelas financeiras da Fase 5 estão com RLS habilitado;
- `anon` e `authenticated` não possuem DML direto nas tabelas financeiras;
- as operações do browser passam pelos wrappers RPC públicos aprovados;
- `anon` não possui `EXECUTE` nos RPCs financeiros;
- `authenticated` possui `EXECUTE` somente nos wrappers públicos necessários;
- `audit_log` ficou sem privilégios para `anon`;
- `authenticated` possui apenas `SELECT` em `audit_log`;
- a leitura de `audit_log` continua restrita por RLS à administradora;
- os RPCs próprios da colaboradora não retornam percentual de comissão.

Os advisors de segurança e desempenho do Supabase também foram executados após a implantação. O padrão de tabelas financeiras com RLS e sem policies próprias é intencional: elas não são API direta do browser e não possuem grants para `anon`/`authenticated`; o acesso ocorre por RPCs controlados.

## Homologação funcional transacional

A homologação funcional foi executada no banco ao vivo exclusivamente com fixtures fictícias dentro de uma transação encerrada com `ROLLBACK`.

O cenário cobriu:

1. criação de cliente, procedimento, agendamento e atendimento fictícios em 2099;
2. configuração administrativa de comissão em 40%;
3. configuração de ciclo de repasse em 15 dias;
4. tentativa de colaboradora alterar comissão, que foi bloqueada;
5. primeiro recebimento parcial de R$ 100,00;
6. segundo recebimento parcial de R$ 50,00 em outra semana;
7. recomposição do pagamento agregado em R$ 150,00 com status parcial;
8. leitura dos próprios recebimentos pela colaboradora;
9. fechamento de dois livros semanais de sete dias;
10. apuração de R$ 40,00 e R$ 20,00 de repasse nos dois livros;
11. leitura dos próprios livros pela colaboradora;
12. criação de um repasse agrupando os dois livros;
13. bloqueio de tentativa de incluir os mesmos livros em outro repasse ativo;
14. baixa do repasse, marcando o lote e os livros como pagos;
15. bloqueio de reabertura direta de livro pago;
16. leitura do próprio repasse pela colaboradora;
17. estorno administrativo do repasse;
18. retorno dos livros para `em_revisao` e liberação dos vínculos ativos;
19. alteração da comissão para 50%;
20. recálculo explícito dos dois livros, totalizando R$ 75,00;
21. confirmação dos eventos financeiros correspondentes na auditoria.

Depois do `ROLLBACK`, uma segunda verificação confirmou **zero resíduo** das fixtures: nenhum cliente/procedimento fictício, nenhum agendamento/atendimento de 2099, nenhum livro e nenhum repasse de homologação permaneceu no banco.

## CI

Antes de aplicar as migrations, o CI oficial completo do repositório ficou verde, incluindo a suíte `BC Gestão tests`. Depois do follow-up de hardening, o CI oficial foi executado novamente e os testes da Gestão permaneceram verdes.

O gate final para integração continua sendo: CI completo verde no commit atual da branch, revisão do diff e PR em modo draft. Nenhum merge é realizado automaticamente.
