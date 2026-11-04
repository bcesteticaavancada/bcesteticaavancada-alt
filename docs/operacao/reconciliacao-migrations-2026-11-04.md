# BC — reconciliação das migrations e revisão do relatório Gemini V3

Conferência de 04/11/2026, horário de Brasília. Candidato auditado: PR #78,
commit `1a381f0bd3433e906fda6d8bfe8bd301090062ec`.

## Correção comprovada nesta rodada

As três migrations abaixo foram comparadas com `statements` do histórico
`supabase_migrations.schema_migrations` e com SHA-256 dos bytes UTF-8.
São **idênticas byte a byte**. Somente os arquivos do candidato foram
renomeados; nenhum SQL foi reaplicado e o histórico hospedado foi preservado.

| Operação | Versão anterior no candidato | Versão aplicada e nome atual |
| --- | --- | --- |
| Backup automático | `20261024211953` | `20261025021446_bc_drive_automatic_backup.sql` |
| Invocação com ticket de uso único | `20261025021753` | `20261025042745_bc_drive_backup_one_time_invocation.sql` |
| Rotação OAuth | `20261029132944` | `20261030101934_bc_drive_oauth_safe_rotation.sql` |

Não converter estes arquivos para `CREATE OR REPLACE`, não acrescentar
`IF NOT EXISTS` para encobrir divergências, nem registrar suas versões antigas
como aplicadas. SQL já aplicado é imutável; alterações reais exigem uma nova
migration revisada. As referências operacionais foram atualizadas para os nomes
reconciliados.

## O histórico completo ainda não está reconciliado

A consulta de leitura encontrou 93 migrations em produção e 90 arquivos no
candidato. Antes desta correção, 86 nomes lógicos correspondiam: 21 versões
coincidiam e 65 divergiam. Após as três renomeações, são 24 coincidências e
62 divergências de versão. Há ainda sete nomes somente na produção e quatro
arquivos legados de pré-anamnese sem correspondência neste projeto.

Entre os 86 nomes correspondentes, 43 conteúdos são idênticos em bytes;
18 outros diferem apenas por whitespace final; 25 exigem análise de diff.
Diferença de hash **não** demonstra, sozinha, diferença funcional. Também não
é seguro afirmar equivalência desses 25 por semelhança de nomes.

O inventário sanitizado está em
`migration-history-audit-2026-11-04.json`: versões, nomes, hashes, tamanhos e
caminhos, sem registros clínicos, credenciais ou conteúdo de Vault.
É evidência datada, não leitura contínua da produção.

Consequência: **não executar `supabase db push` genérico a partir desta árvore**.
Renomear apenas estes três arquivos não torna o restante do histórico apto a
push. A continuação deve comparar o histórico completo em diretório isolado,
separar as migrations de projetos distintos e revisar diferenças reais antes
de propor correções. Não usar `migration repair` sem demonstrar equivalência.

## O que o CI e a publicação realmente fazem

- `agenda-db-ci.yml` e `auth-audit-ci.yml` iniciam um banco local descartável,
  normalizam versões legadas com `prepare-supabase-ci-migrations.py` e fazem
  replay local. Esse normalizador é exclusivo de CI e não reconcilia produção.
- `pages.yml` publica arquivos estáticos depois de push em `main`.
  Nenhum workflow auditado executa `db push` contra produção.
- Assim, a afirmação do Gemini V3 de que o merge necessariamente falhará ou
  modificará o banco por estas migrations não foi demonstrada. O risco
  comprovado é executar um push remoto indiscriminado com histórico divergente.
- O CI aprovado do commit anterior não substitui o CI do novo commit nem
  comprova restauração de produção. O resultado do novo HEAD deve ser
  consultado no PR antes de qualquer corte.

## Correções necessárias no procedimento de recuperação

Não executar `db reset` com alvo remoto. Para o procedimento descrito pelo
Gemini, `supabase db restore` e `db dump --schema-only` não constam da referência
CLI consultada: conferir a versão e `--help` antes de instruir sua execução.
O dump de estrutura padrão usa `supabase db dump -f schema.sql`; a restauração
documentada usa `psql` com `ON_ERROR_STOP`, transação e destino isolado.

O dump padrão exclui schemas gerenciados de Auth, Storage e extensões.
A restauração em Supabase precisa preservar a estrutura gerenciada compatível,
tratar dados e modificações próprias de Auth/Storage conforme a documentação
e conferir a integridade referencial completa. Não restaurar somente
`auth.users` nem sobrepor cegamente DDL gerenciado sobre um stack iniciado.

Metadados de Storage não incluem os bytes dos PDFs e imagens. Recuperar
separadamente os objetos e conferir SHA-256 e privacidade. Segredos de Vault
cifrados não provam que as chaves-raiz e integrações são recuperáveis. O ensaio
deve manter cron, transporte de rede, e-mail, OAuth e workers externos
desativados, antes de carregar dados; não permitir que a cópia invoque o
backup de produção ou envie mensagens. Não enviar dumps clínicos para CI público.

O executor desta rodada não possui Docker, Supabase CLI ou psql. Não houve
ensaio de recuperação integral; os ensaios sintéticos de CI não o substituem.
O gate de recuperação operacional permanece pendente.

## Auth, domínio e continuidade

O PR #69 registra seis Redirect URLs salvas em 30/10, e o runbook registra SMTP
configurado em 31/10. São evidências históricas, não confirmação ao vivo nesta
rodada. O conector Supabase não expõe a configuração de Auth/GCP; o painel
consultado solicitou login. Reabrir os painéis e comparar as entradas persistidas,
sem apagar URLs legadas nem alterar o callback do Drive.

A consulta DNS pelo executor falhou inclusive para o host GitHub conhecido,
e o leitor web não conseguiu abrir as três origens. Isso é limitação de
verificação nesta rodada, **não prova de NXDOMAIN nem de indisponibilidade do site**.
Não marcar DNS/HTTPS como aprovados sem evidência atual.

O rollback de hostname preserva o mesmo Supabase e gravações novas. A antiga
origem já usa GitHub Pages; não existe um conjunto universal de "registros DNS
legados" a restaurar sem capturar a zona real. Registrar a baseline antes do
corte, coordenar Pages/DNS e não prometer retorno instantâneo por causa do TTL.
Nunca restaurar o banco para desfazer apenas uma troca de domínio.

## Próximas ações de colaboração com Gemini

1. Gemini: reler este registro e o PR #78 atual; não usar o HEAD antigo como
   prova dos testes do commit novo. Confirmar todos os workflows do novo HEAD.
2. Obter acesso autenticado a Auth, cliente OAuth GCP, Pages e Registro.br;
   devolver apenas URLs/configurações não secretas e evidência datada.
3. Concluir o diff do histórico restante em ambiente isolado; não reaplicar as
   três migrations corrigidas nem executar push/repair remoto para "testar".
4. Disponibilizar um ambiente privado e isolado para o DR, seguindo os requisitos
   acima e o gate de recuperação já documentado. Não contratar recursos pagos.
5. Testar login/recuperação, perfis, agenda, PDF, Picker/Drive, PWA e NFC com
   fixtures e aparelhos Android/iPhone; registrar resultado de cada cenário.
6. Com dependências comprovadas e janela autorizada, executar o runbook de
   domínio. Nenhum bloqueio foi marcado como resolvido apenas por documentação.

## Referências

- [PR #78](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/78)
- [PR #69](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/69)
- [CLI: dump e reset](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Backup e restauração](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Runbook do corte](./corte-dominio-runbook-2026-10-31.md)
- [Gate de recuperação integral](./recuperacao-integral-gate-2026-10-31.md)
