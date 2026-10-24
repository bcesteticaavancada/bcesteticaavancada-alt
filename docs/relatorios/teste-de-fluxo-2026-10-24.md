# BC Gestão — relatório de teste de fluxo

**Data da execução:** 24/10/2026  
**Situação:** concluído; correções publicadas; acesso temporário encerrado.

Este relatório preserva o resultado dos testes autorizados por Fernando para consulta posterior. Os resultados correspondem aos cenários executados nesta data.

## Resultado por área

| Área | O que foi verificado | Resultado |
| --- | --- | --- |
| Cadastro | Cadastro, revisão e arquivamento de cliente fictício, com validação de autoria | Aprovado |
| Agenda | Disponibilidade e conflito de horários | Aprovado |
| Prontuário | Anamnese, alertas, atendimento, documentos e assinatura | Aprovado |
| Produtos e equipamentos | Catálogo, lotes, uso em atendimento e permissões | Aprovado após correção |
| Fotos e intercorrências | Registro, consentimento e restrições de autoria | Aprovado após correção |
| Arquivos e PDFs | Upload real, download privado, assinatura PNG, geração hospedada e repetição sem duplicação | Aprovado |
| Financeiro | Receita, despesa, comissão, pagamento, comprovante opcional e estorno | Aprovado em simulação revertida |
| Permissões | Administração, colaboradora, administração de criação e perfil inativo | Restrições verificadas |

## Correções publicadas

Vinte funções internas de produtos, equipamentos, fotos e intercorrências estavam sem a permissão de execução necessária ao usuário autenticado. A correção liberou esses pontos de entrada protegidos, mantendo as verificações de perfil ativo, gestão e autoria.

O texto da entrada da gestão também foi atualizado para refletir o acesso disponível.

## Financeiro

O ensaio simulou R$ 200,00 de entrada e R$ 55,00 de saída, com saldo de R$ 145,00. Repetição, comissão pendente e estornos foram verificados.

A transação foi revertida ao terminar. Nenhum recebimento, pagamento, despesa ou comissão desse ensaio foi efetivado no caixa. Os resultados ficaram registrados na auditoria com a classificação **TESTE DE FLUXO**.

## Evidências

- **14 grupos de testes práticos** aprovados, utilizando os módulos do aplicativo, SDK e serviços reais.
- **607 testes da gestão** aprovados.
- **512 verificações do banco** aprovadas, além de lint, advisors e concorrência.
- Verificações do site aprovadas, incluindo Chromium e WebKit.
- PDF clínico fictício gerado e baixado: **2 páginas, 9.823 bytes**. Conteúdo, hash e primeira página inspecionados; repetição da geração confirmada sem duplicação.
- Publicação da gestão confirmada com resposta HTTP 200 e HTML correspondente ao revisado.

A execução utilizou API e componentes reais, com renderização do financeiro em ambiente de teste. Não representa uma navegação manual autenticada em todas as telas. Os resultados não substituem novas verificações após alterações futuras.

## Encerramento do teste

O login temporário foi excluído logicamente: senha removida, perfil inativo, sessões e tokens de renovação zerados. Tentativas de login, renovação e acesso com o token antigo foram efetivamente negadas.

A identificação técnica de autoria foi preservada no histórico dos documentos. O cliente, procedimento e arquivos fictícios ficaram arquivados ou inativos e identificados como **TESTE DE FLUXO**, sem validade clínica. As contas reais da equipe não foram alteradas.

## Referências para consulta

- [Correções integradas — PR 60](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/60)
- [Registro técnico completo da execução](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/blob/a15bce2227b0d587975fa36a6dc544579f63e340/docs/superpowers/ledgers/2026-10-24-teste-fluxo-real.md)
- [Verificação do site](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40111533927)
- [Verificação do banco](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40111533932)
- [Verificação da pré-anamnese](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40111533945)
- [Publicação das correções](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40112286928)
