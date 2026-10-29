# BC Estética — gate de continuidade de dados na migração de domínio

**Data da auditoria:** 29/10/2026, horário de Brasília.
**Estado:** PR #69 em rascunho. **Não publicar nem alterar DNS/produção neste documento.**

## O que foi efetivamente conferido (somente leitura)

- Supabase: `bc-estetica-gestao` / `tpqsmerlxquyrzrjbogj`, estado `ACTIVE_HEALTHY`. Configuração do frontend BC Gestão e agenda continua apontando para o **mesmo projeto**; a troca de hostname não exige copiar ou recriar clientes.
- Contagens agregadas consultadas no banco hospedado: Auth, cadastros, agenda, atendimentos, anamneses, arquivos, consentimentos, financeiro e objetos de Storage. **Nenhuma linha, CPF, nome de cliente ou documento foi lido ou exportado.**
- Buckets `bc-prontuario-private` e `bc-finance-private` continuam marcados como privados.
- Controle privado do backup clínico está habilitado; agendador `0 * * * *` está ativo. Último êxito visto em **29/10/2026 às 07h00 Brasília**, com dez objetos auditados e zero falhas/pendências; seis execuções consultadas tinham status `success`.
- **Limitação essencial:** esse backup horário protege arquivos clínicos do bucket privado, **não comprova backup recuperável de toda a base PostgreSQL**; autenticação, clientes, agenda e financeiro permanecem dependentes da política de backup do Supabase até que uma exportação/restauração íntegra seja verificada.
- PR #69 não contém migrations ou operações de reset deliberadas no diff revisado; a estratégia é reutilizar o mesmo projeto de banco, sem copiar registros.
- PR #74 prepara o retorno OAuth do Drive no domínio novo em outra branch, **sem deploy**.

## Ferramentas preparadas

- `scripts/ops/domain-migration/readonly-snapshot.sql`: uma consulta SQL **somente leitura** que retorna objeto JSON de contagens agregadas, buckets privados, estado do cron, instante da última execução. Foi executada com sucesso contra o projeto de produção em 29/10, **sem alterações**.
- `scripts/ops/domain-migration/compare-snapshots.mjs`: comparação local estrita dos resultados antes/depois; recusa diferenças de totais, projeto diferente, perda de privacidade e cron desativado.
- `tests/site/data-continuity.test.mjs`: testes de dados **fictícios**, executados pelo Site CI, para demonstrar que divergências são sinalizadas e que o site/agenda continuam usando o único Supabase oficial.

### Armazenamento das evidências
Salvar os dois JSONs apenas em pasta administrativa privada de auditoria, sob acesso aprovado pela Mel. **Não anexar as respostas completas ao GitHub, PR, logs públicos, páginas web, Google Search Console ou conversas com pacientes.** O JSON de agregados não substitui o backup do banco.

## Portões obrigatórios antes de habilitar o novo endereço

1. **Backup do banco**: confirmar plano efetivo em Supabase Dashboard → Database → Backups, intervalo de retenção e último backup restaurável; se necessário, executar exportação privada consistentes e testar restauração em ambiente descartável **sem dados reais de pacientes ou conforme autorização/regra de proteção aprovada**. Não iniciar a migração se não houver segurança de recuperação do banco. Os backups do banco **não incluem conteúdo de Storage** (cópia de Storage separada).
2. **Código sem migração de dados**: não alterar migrations existentes, Auth user IDs, chaves de serviços, IDs de bucket, RLS ou destinos Drive durante alteração do domínio; refatorar só URLs e origens permitidas.
3. **Antes (janela controlada)**: sem novos atendimentos/gravações durante a pequena janela de comparação; executar `readonly-snapshot.sql` no projeto oficial e guardar apenas o campo `snapshot` em `antes.json` privado.
4. **Depois (mesma janela)**: executar o SQL novamente e guardar em `depois.json`. Comparar offline com `node scripts/ops/domain-migration/compare-snapshots.mjs antes.json depois.json`. Qualquer divergência **bloqueia** o aceite automático e exige conferência manual. A contagem igual **não prova a integridade linha a linha**.
5. **Testes funcionais sem pacientes reais**: contas de teste aprovadas, login/logout, reset de senha, cargos da Mel/administrador/colaboradora, agendamento, consulta e abertura de documentos fictícios, criação e recuperação de PDFs, Maya e Google Drive; todos com isolamento RLS e sem dados clínicos reais.
6. **Infra**: PR #69 + PR #74 homologados; configurar Auth Redirect URLs permitidas para raízes oficiais; testar callbacks Google; DNS/Pages/HTTPS verificados; URLs privacidade e termos independentes; conferir NFC/QR, sitemap e robots.
7. **Aceite**: aprovação expressa da Mel e administração; documentar janela de publicação e plano de retorno. Se site novo falhar, voltar apresentação/roteamento à origem anterior **sem restaurar/desfazer banco** automaticamente, pois isso poderia apagar registros criados após a troca.

## O que NÃO foi feito

- Nenhum backup completo do Postgres foi gerado nem restaurado nesta fase.
- Nenhuma alteração de Auth, RLS, dados pessoais, DNS, Google Cloud, funções implantadas ou banco em produção.
- Nenhum teste real completo de login/Drive no domínio novo, que ainda não está publicado.
- Nenhum merge dos PRs #69, #73, #74 ou das alterações de TCLE foi autorizado.

## Referências
- [Documentação Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups)
- [GitHub — custom domains e DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
