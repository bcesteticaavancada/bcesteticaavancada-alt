# Execução — plano: docs/superpowers/plans/2026-10-22-finance-integrity.md

Base abbe5bd; execução nativa sequencial autorizada pelo usuário. Checkout isolado de auditoria já existente; não recomeçar tarefas após compactação.

Pre-flight: FIN02 chama a implementação de recebimento protegida por FIN01. FIN03 congela livros em lote ativo; FIN04 confere novamente todos os livros antes da baixa. Interfaces compatíveis; wrappers novos de FIN02 substituem os chamadores frontend e recusam escrita antiga.

Ruling: manter o formulário de recebimento focado na entrada; total vem da obrigação inequívoca existente ou versão clínica assinada — produção não contém atendimentos legados/pagamentos — atendimento sem total exige revisão antes de receber; não inferir total pela parcela. Custo: legado sem obrigação precisa ser regularizado antes de cobrar.

Task 1: implementação local concluída — RED100!=600 observado, GREEN sete cenários SQL isolados (parcial, quitação/estorno, total ausente, cobrança apenas de agenda, ambiguidade, excesso, preço mutável). Recompute bloqueia pagamento antes da soma; total não aumenta silenciosamente. npm test769/769. pgTAP financeiro adicionado e fixture da ponte agora inclui versão final. CI PostgreSQL17 e concorrência ainda pendentes; migration não aplicada em produção.

Task 2: implementação local concluída — RED RPC v2 ausente e regressões de formulário observados; GREEN onze cenários SQL isolados cumulativos. Chave por tentativa, payload/autor conferidos, mesmo recibo após replay/estorno e escrita antiga encerrada. Formulários preservam tentativa incerta, inclusive em reload, e não permitem trocar valor silenciosamente; falha definitiva posterior não apaga incerteza anterior. sessionStorage guarda somente IDs opacos/hash, sem valores ou observações. Node774/774. Concorrência PostgreSQL17/CI ainda pendente.

Task 3: implementação local concluída — RED reabertura de livro com lote ativo foi aceita indevidamente; GREEN guarda na reabertura e no recálculo sob bloqueio do livro. Estorno libera revisão e novo lote reflete nova comissão (50→40 no cenário isolado). Catorze cenários SQL isolados cumulativos; Node774/774. Concorrência PostgreSQL17 pendente.

Task 4: implementação local concluída — RED baixa de livro em revisão foi aceita indevidamente; GREEN dezoito cenários SQL isolados cumulativos, incluindo divergência de valor, ausência de livros e baixa coerente. Node774/774. Ordem de bloqueio dos livros estável na criação/baixa. Adicionado teste PostgreSQL real de concorrência (chave repetida, excesso, recebimento/estorno, lote/reabertura e fechamento com recebimento em andamento); aguarda CI. Investigar a possível corrida de fechamento/período antes da publicação. Nenhuma migration financeira aplicada em produção.
