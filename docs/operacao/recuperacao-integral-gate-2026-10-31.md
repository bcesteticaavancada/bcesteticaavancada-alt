# BC Gestão — gate de recuperação integral antes do domínio próprio

**Conferência:** 31/10/2026, horário de Brasília. **Natureza:** inventário administrativo de leitura, sem exportação adicional, alteração de dados, DNS ou publicação.

**Decisão do responsável técnico:** seguir a sequência segura. O corte do domínio permanece bloqueado até comprovação da recuperação operacional e homologação funcional. O PR #69 continua em rascunho.

## 1. Evidências verificadas nesta rodada

| Frente | Evidência | Limite |
|---|---|---|
| Projeto Supabase | `bc-estetica-gestao` ativo e saudável, PostgreSQL 17.11.0.003, organização no plano Free | Projeto saudável não equivale a restauração testada. |
| Estrutura atual | 52 tabelas em `public`, 19 em `private`, 27 em `auth`, 8 em `storage` e 1 em `vault`; 6 contas Auth | Contagens não comprovam integridade nem funcionamento do Auth. |
| RLS | 52/52 tabelas de `public` com RLS habilitado; 15/19 em `private` | Conferir policies, grants, triggers e funções efetivamente após o restore. |
| Storage | Dois buckets privados; dez objetos no bucket clínico e zero no financeiro | O backup lógico do banco contém metadados, não bytes de objetos. |
| Rotina automática | Único cron ativo: `bc-drive-backup-hourly-v1`, às horas cheias | Não há rotina de snapshot periódico de banco identificada no cron. |
| Backup de arquivos | Seis execuções horárias consecutivas aprovadas; mais recente 31/10 às 07h Brasília; cada uma auditou dez objetos sem falhas nem pendências | Auditoria de arquivos não é backup de Auth, financeiro, banco, Vault ou site. |
| Journal clínico | Dez versões com status `verified` e timestamp de verificação | Não dispensa restauração e confronto independente dos bytes em ambiente isolado. |
| Kit emergencial | A pasta privada de 29/10 contém arquivo cifrado do banco, kit, manifestos, chave de recuperação, pacote das funções hospedadas, bundles Git e dez objetos de Storage totalizando 10.148.553 bytes | Existência/metadata reconferidas; **não** se decifrou nem reexecutou o restore nesta rodada. |
| Ensaio anterior | Relatório de 29/10 registra 115 tabelas e 3.898 linhas recuperadas/comparadas em PostgreSQL descartável, com 407 definições de função e 576 constraints aceitas | Foi uma recuperação **de dados**, não uma réplica operacional de Supabase Auth/RLS/Storage/Edge/Vault. |
| CI do candidato | No HEAD `07916513349c8206b91b4ca5d158612f4063ff5e` do PR #69, Site, Pré-anamnese, Agenda DB e Auth Audit CI passaram | Fixture sintética e migração limpa não substituem um restore de produção. |

## 2. Bloqueios reais e restrições

1. A cópia completa de 29/10 é um snapshot pontual. Gravações posteriores não entram automaticamente. **Antes da virada, obter uma cópia nova, consistente, cifrada, com verificação de integridade.**
2. O plano Free não disponibiliza o caminho gerenciado de restaurar backups físicos para um projeto novo. Conforme a documentação do Supabase, esse recurso requer plano pago e pode gerar cobrança adicional; não criar projeto ou branch pago sem orçamento e aprovação expressa.
3. Mesmo a clonagem gerenciada do banco não copia automaticamente bytes de Storage, Edge Functions, Auth settings/API keys, Realtime settings e várias configurações. Cada componente deve ter procedimento de reprovisionamento e ensaio.
4. A chave de recuperação consta junto dos manifestos na mesma árvore privada do kit. É preciso definir uma custódia independente e segura, sem registrar segredos em GitHub, logs, planilhas abertas ou nesta documentação.
5. O ambiente de execução disponível nesta rodada não expõe Supabase CLI, Docker, `psql` ou `pg_restore`. Não transportar dados reais para CI pública nem simular êxito por contagem de arquivos.
6. As credenciais e chaves-raiz de Vault não são reconstruídas apenas pelo conteúdo cifrado de suas tabelas. A recuperação pode exigir reprovisionamento de segredos e nova autorização de integrações, em ambiente controlado.

## 3. Ensaio operacional necessário — somente em ambiente isolado

**Pré-condições:**

- Ambiente de destino separado, propriedade da BC, com acesso estritamente limitado, custos previamente aprovados e plano de descarte seguro.
- Desabilitar notificações por e-mail/SMTP, agendador, `pg_net`, workers, callbacks OAuth, sincronização Drive e demais efeitos externos até testar cada integração com fixtures.
- Criar snapshot novo do banco sob transação consistente, cifra autenticada, manifesto e SHA-256; preservar RPO/RTO, data de referência e cadeia de custódia. Manter chave fora da única cópia do backup.
- Não utilizar pacientes reais como destinatários de e-mails, links ou ações automatizadas. Não copiar dados clínicos para GitHub Actions, site público ou serviço de IA.

**Critérios de aceitação:**

1. Restaurar schema, dados, índices, constraints, defaults, sequências, policies/RLS, grants, funções e gatilhos em PostgreSQL/Supabase compatível; verificar contagens e integridade sem expor prontuários.
2. Conferir Auth hospedado e rotas de login/recuperação em contas fictícias; verificar sessões, papéis `admin`, `admin_criacao` e `colaborador`, permissões negativas e separação de dados.
3. Restituir buckets privados e dez objetos clínicos atuais a partir do backup; comparar bytes e SHA-256; impedir acesso anônimo. Caso a origem mude, atualizar manifesto e contagens sem revelar nomes dos objetos.
4. Reimplantar versões fixadas das Edge Functions e reconfigurar Auth/SMTP, secrets/Vault e OAuth por canal privado, sem enviar mensagens reais ou reconectar o backup original.
5. Exercitar cenários sintéticos de agenda, prontuário, anamnese/PDF, financeiro e backup, com funções externas desativadas e testes de não regressão.
6. Registrar resultados, evidências sanitizadas, falhas, responsável e tempo de recuperação; revisão técnica e aceite clínico da Mel antes do corte.

## 4. Próxima decisão e janela de corte

**Estado: G1 (recuperação disponível) parcialmente demonstrado; G10 (recuperação integrada) pendente; publicação não liberada.** A próxima decisão é escolher infraestrutura isolada sem custo ou obter cotação/autorização para clone hospedado. Após êxito do ensaio e demais homologações, reconciliar PR #69/integrações, combinar janela de baixo tráfego e aplicar domínio no GitHub Pages e DNS com HTTPS.

Na conta GitHub, `bcesteticaavancada.com.br` consta como **Verified**. O Pages do repositório está configurado para publicar da branch `main`, pasta raiz, e o campo Custom domain estava vazio. Salvar um domínio em publicação por branch cria um `CNAME` no ramo de origem e pode redirecionar a URL legada; não salvar até a janela coordenada. No Registro.br, preservar os dois TXT de verificação Google/GitHub e não alterar zona DNS nesta fase.

**Rollback do corte:** voltar a apresentação/roteamento ao host legado, mantendo o mesmo Supabase e todos os dados. Não restaurar banco automaticamente para desfazer alteração de hostname: isso poderia eliminar gravações posteriores.

## Referências

- [Supabase — backups de banco](https://supabase.com/docs/guides/platform/backups) e [restaurar em projeto novo](https://supabase.com/docs/guides/platform/clone-project).
- [GitHub — domínio personalizado](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
- Relatório privado `BC_Backup_Geral_Revisao_2026-10-29.md`, preservado na pasta de recuperação autorizada da BC; não há links de arquivos clínicos ou credenciais neste registro.
- [PR #69 — migração do domínio](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/69).
