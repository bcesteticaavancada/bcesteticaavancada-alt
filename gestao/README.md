# BC Gestão 1.0

Área administrativa autenticada da BC Estética Avançada, isolada do site público e da pré-anamnese.

## Rotas

- `/login/` — entrada por e-mail e senha via Supabase Auth.
- `/admin/` — painel da administradora com agenda geral, clientes, procedimentos, auditoria e financeiro completo.
- `/colaborador/` — agenda individual, clientes compartilhados da clínica, histórico autorizado e **Meu financeiro** com somente os próprios valores.

## Supabase

Projeto exclusivo do BC Gestão:

- nome: `bc-estetica-gestao`
- project ref: `tpqsmerlxquyrzrjbogj`
- região: São Paulo (`sa-east-1`)

O projeto de pré-anamnese não é usado por esta aplicação.

## Segurança

- frontend usa somente a chave pública/publishable do Supabase;
- chaves privilegiadas de servidor, segredos e chaves privadas são proibidos no navegador e no repositório;
- papéis válidos: `admin` e `colaborador`;
- autorização sensível é validada no banco com RLS e RPCs;
- funções privilegiadas ficam no schema `private`, com `SECURITY DEFINER` e `search_path` fixo;
- wrappers públicos usam `SECURITY INVOKER` e `EXECUTE` somente para `authenticated`;
- tabelas financeiras da Fase 5 não são expostas diretamente a `anon` ou `authenticated`;
- auditoria é imutável para usuários autenticados e tem leitura global somente para admin.

## Fase 5 — financeiro e repasses

### Recebimentos

A colaboradora registra um recebimento a partir do atendimento atualmente aberto na própria agenda. O navegador envia apenas o atendimento, valor, forma, data opcional e observação.

O banco deriva e valida:

- profissional;
- cliente;
- procedimento;
- pagamento agregado;
- autoria.

Pagamentos parciais são movimentos independentes em `recebimentos`. O total de `pagamentos.valor_recebido` é recomposto pela soma dos movimentos ativos; histórico não é apagado.

Correção sensível é feita por estorno administrativo. Se o movimento estiver congelado em livro fechado ou pago, a operação exige primeiro o fluxo explícito de revisão correspondente.

### Comissão

A administradora define a regra por **profissional × procedimento**.

O percentual:

- é armazenado no backend;
- nunca é retornado pelas APIs próprias da colaboradora;
- é congelado em cada item do livro quando a semana fecha;
- pode ser visto somente nas rotas administrativas.

### Livros semanais

Cada livro cobre exatamente 7 dias e usa a data local de `America/Sao_Paulo` para decidir em qual semana o recebimento entra.

Fechamento:

1. valida o período;
2. seleciona movimentos ativos da profissional;
3. exige comissão configurada para todos os procedimentos elegíveis;
4. impede reutilização do mesmo movimento;
5. grava produção recebida, valor de repasse e percentual aplicado privado;
6. congela o livro como `fechado`;
7. registra auditoria.

Livro fechado só muda por reabertura explícita para `em_revisao`. Livro `pago` exige estorno do repasse antes de qualquer recálculo que possa alterar o valor já quitado.

### Ciclos e repasses

O fechamento continua semanal, mas a administradora pode configurar ciclo de pagamento por profissional em 7, 15 ou 30 dias.

Um repasse reúne livros fechados elegíveis da mesma profissional. Um livro não pode pertencer simultaneamente a dois repasses ativos.

Ao dar baixa:

- repasse passa a `pago`;
- livros vinculados passam a `pago`;
- operação é auditada.

Ao estornar:

- repasse passa a `estornado`;
- vínculos ativos são liberados;
- livros voltam para `em_revisao`;
- motivo e valores anteriores permanecem auditáveis.

## Visibilidade por papel

### Colaboradora

Pode ver:

- próprios recebimentos;
- produção recebida;
- valor a receber por livro;
- status dos próprios livros;
- próprios repasses e pagamentos realizados pela clínica.

Não pode ver:

- percentual;
- regra de comissão;
- financeiro de outra profissional;
- consolidado geral da clínica;
- controles de fechamento, revisão, recálculo, baixa ou estorno administrativo.

### Administradora

Pode:

- consultar recebimentos de todas as profissionais;
- configurar comissão;
- fechar, reabrir e recalcular livros;
- definir ciclo 7/15/30;
- criar, baixar e estornar repasses;
- consultar a auditoria financeira completa.

## Auditoria financeira

Eventos cobertos na Fase 5:

- `recebimento_created`
- `recebimento_reversed`
- `comissao_updated`
- `livro_closed`
- `livro_reopened`
- `livro_recalculated`
- `repasse_cycle_updated`
- `repasse_created`
- `repasse_paid`
- `repasse_reversed`

## Desenvolvimento e testes

```bash
npm run test:gestao
npm test
```

Antes de aplicar migrations ou homologar o banco, a suíte completa do repositório deve estar verde no CI; testes isolados servem apenas para diagnóstico.

A homologação de banco deve usar apenas dados fictícios e, sempre que possível, uma transação com `ROLLBACK`. Não criar ou alterar paciente, agenda ou pagamento real durante testes técnicos.

## Hospedagem

Quando o BC Gestão for publicado como aplicação isolada na Vercel, usar `gestao` como `rootDirectory`. A rota `/admin/` do site institucional/pre-anamnese permanece separada desta aplicação.
