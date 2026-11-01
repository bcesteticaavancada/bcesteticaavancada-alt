# BC Estética — proposta de permissões clínicas (não implantada)

Status: **rascunho para revisão da Mel**. Nenhuma migração deste conjunto foi aplicada ao projeto hospedado. Todos os testes usam identidades e dados inteiramente fictícios, em banco descartável com `ROLLBACK`.

## Decisão operacional

| Ação | Profissional ativa | Mel, com identidade exclusiva | Outro administrador técnico |
| --- | --- | --- | --- |
| Consultar registros, conforme controles clínicos vigentes | Sim | Sim | Conforme perfil atual |
| Criar cadastro, atendimento ou acrescentar informação permitida pelo fluxo vigente | Sim, respeitando permissões existentes | Sim | Conforme perfil atual |
| Corrigir anamnese **ainda aberta e criada por ela** | Sim, com antes/depois em `audit_log` | Também em seus próprios rascunhos | Não pode corrigir rascunho alheio por ser admin |
| Corrigir **sua** sessão clínica editável | Sim, antes de finalização/assinatura, com histórico | Também em suas próprias sessões | Não pode editar sessão alheia por ser admin |
| Gerar link de anamnese para cliente | **Qualquer profissional ativa**, independentemente de autoria do atendimento | Sim | Conforme perfil atual |
| Corrigir intercorrência ou retirar foto, uso de produto/equipamento de sessão editável | Somente autora da sessão, com histórico | Também em sua sessão | Não por ser admin |
| Anular arquivo clínico já registrado | Não | **Sim**, com motivo e trilha antes/depois | Não |
| Excluir definitivamente linha de clientes, agendamentos, atendimentos, pagamentos, procedimentos ou perfis | Não | **Sim**, somente com identidade vinculada à Mel e políticas vigentes | Não |

**Nota:** anular/estornar não é igual a apagar. Estornos financeiros e alterações pós-assinatura requerem revisão específica dos fluxos existentes. Não apagar arquivos físicos do Storage por conta de um registro anulado.

## Como a segurança está proposta

1. Uma única linha privada `private.bc_final_delete_owner` guardará o ID autenticado de Mel. Não é acessível nem modificável por contas comuns.
2. `private.bc_can_delete_finalized()` exige simultaneamente: perfil de administrador ativo **e** correspondência exata com essa identidade. Ser admin sozinho não basta.
3. Se a identidade ainda não foi configurada, a autorização devolve `false` para todos (**falha fechada**).
4. Seis políticas `AS RESTRICTIVE FOR DELETE` são adicionadas às políticas já existentes: não ampliam leitura, criação nem alteração.
5. Trigger registra `old_data` antes de cada exclusão definitiva feita nessas seis tabelas.
6. RPCs de rascunhos registram dados anteriores e posteriores na auditoria com RLS vigente. A alteração dos anexos definidos como definitivos só passa com a permissão exclusiva de Mel.

## Antes de liberar para produção

- [ ] Confirmar com a própria Mel, por um canal autenticado, qual conta Supabase Auth é exclusivamente dela.
- [ ] Aplicar apenas após revisão de banco, confirmação de backup recuperável e janela de mudança.
- [ ] Configurar a linha privada com o UUID autenticado validado da Mel, em operação de banco aprovada, **fora do GitHub**.
- [ ] Conferir que Fernando/conta de suporte/administradores técnicos **não** constam nessa configuração.
- [ ] Executar `supabase db reset` e `supabase test db` em ambiente local descartável; inspecionar resultados da CI.
- [ ] Revisar rotas, Edge Functions, jobs e integrações com `service_role`, que pode ignorar RLS, antes de atestar o controle de todas as exclusões.
- [ ] Revisar `bc_schedule_block_delete`, fluxos financeiros de estorno e substituição de rascunhos do catálogo para distinguir remoção operacional de exclusão definitiva.
- [ ] Testar fluxos com contas reais **somente após** autorização de implantação da Mel, sem dados reais em logs/prints.

## Limites importantes

A proposta cobre as seis permissões de `DELETE` existentes para `authenticated`, a anulação de `client_files` e as correções clínicas listadas. **Não garante ainda** que toda rota administrativa privilegiada, rotina financeira ou operação `service_role` obedeça à exclusividade de Mel; essas rotas precisam da revisão pré-implantação indicada acima. Também não substitui a política de retenção de prontuários e documentos que deve ser definida com assessoria jurídica/LGPD.

Nunca registrar senhas, tokens, strings de conexão ou dados de clientes em pull requests, capturas ou arquivos de teste.
