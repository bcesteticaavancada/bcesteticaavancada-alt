# Correções da revisão geral — execução autorizada

Pedido: corrigir os defeitos do relatório de cima para baixo. A autorização de execução foi dada em 17/10/2026 após apresentação do relatório e dos critérios de aceite. Implementação nesta branch, com testes fictícios; sem editar pacientes, agenda ou financeiro reais e sem custos novos.

## Task 1 — Pré-anamnese na base ativa
- Manter formulário/PDF existentes; configurar o projeto ativo.
- Criar recepção privada `bc_pre_anamneses`, funções de listagem/revisão/vínculo e armazenamento no bucket clínico existente. Não criar cliente automaticamente.
- Listar fichas na área administrativa e anexar à pasta correta por ação explícita. Pré-anamnese não finaliza anamnese geral nem libera gates clínicos.
- Backend público: validação, rubrica, repetição segura, limite de envios, sem leitura anônima de tabelas. Reutilizar geração de PDF.
- RED: requisição real do cliente HTTP aponta ao host legado; cobertura de revisão/vínculo e rejeições. GREEN: endpoint ativo, testes Node/Deno e banco efêmero.

## Task 2 — Recebimento e ciclo clínico
- Resolver atendimento a partir de agendamento em RPC, sem presumir IDs iguais.
- Finalização clínica: vincular/criar o atendimento operacional e atualizar agenda uma vez, sem registrar pagamento automaticamente.
- RED: IDs distintos, finalização repetida e não autorizada. GREEN: testes da interface e pgTAP.

## Task 3 — Equipe
- Contas de Aline/Kátia estão ausentes; provisionamento deve usar Auth Admin, nunca inserir manualmente em `auth.users`.
- Configurar perfis, procedimentos e disponibilidade segunda a sábado 09–19h, almoço 12–13h, sem mudar reservas existentes.
- Reutilizar o fluxo autenticado de administração; testar toda matriz de permissões.

## Task 4 — Privacidade e autorização
- Rascunhos transitórios com prazo e descarte do conteúdo de saúde legado.
- Aplicar autorização profissional/procedimento na agenda interna e verificar equipe ativa na finalização.
- Preservar prontuário compartilhado clínico já aprovado; separar dados administrativos de agenda dos clínicos e restringir leituras de arquivos aos contextos autorizados. Não ampliar privilégios da Alice.
- RED: cadastro de outra sessão, usuário inativo, procedimento negado e acesso de arquivo fora do contexto. GREEN: Node/pgTAP.

## Task 5 — Atualização e recuperação de reserva
- Atualizar áreas ao voltar ao app e após mutações, com consultas periódicas limitadas; não sobrescrever formulários em edição.
- Chave estável por tentativa pública; backend devolve mesma confirmação com payload idêntico, recusa reutilização diferente. Timeout e mensagem de resultado incerto.
- RED: retorno do segundo plano, concorrência de refresh, resposta perdida e repetição. GREEN: Node/Deno/pgTAP.

## Task 6 — Revisão e publicação
- `npm test`; Deno check/test; replay e pgTAP em CI; revisão independente da branch; corrigir achados importantes.
- Aplicar migrations aditivas e funções somente no projeto ativo após verificações. Publicar frontend e verificar endpoints sem dados reais.
- Registrar por tarefa o commit, os testes e as limitações materiais.

## Interfaces compartilhadas
Task 1 usa `client_files`/feed e autorização de equipe; Task 4 deve preservar leitura das pré-anamneses explicitamente vinculadas. Task 2 mantém `atendimentos.id` como contrato financeiro e usa `agendamento_id` para resolução. Task 5 reutiliza o mecanismo de conflito, sem segunda tabela de agenda.

## Foco da revisão
Não expor PDF por código público previsível; não criar cliente/vínculo automático por telefone; não marcar pagamento ao finalizar clínica; não permitir troca de payload em repetição; não executar writes de pacientes reais nos testes.
