# BC Estética — runbook controlado para o domínio próprio

**Conferência:** 31/10/2026 (Brasília)  
**Destino canônico planejado:** `https://www.bcesteticaavancada.com.br/`  
**Origem preservada:** `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/`  
**Estado:** PREPARADO / CORTE NÃO EXECUTADO. Este documento não autoriza publicação.

## 1. Estado observado

- **GitHub:** PR #69 (`feature/bc-dominio-proprio-preparacao`) aberto e em rascunho, HEAD `b3584789829f5337feb4cc4f63839ed076ce1305`; PR #74 também aberto em rascunho, HEAD `6189bdc12bc97f094448abcde2ef68cc39960112`. Nenhum merge foi feito nesta conferência.
- **Testes:** no HEAD conferido do PR #69, os workflows Pre-anamnese CI, BC Auth Audit CI, Site CI e Agenda DB CI estavam aprovados. Os testes simulados não substituem testes em celulares físicos nem nas três origens reais.
- **Site legado:** abriu e exibiu a página inicial e agenda em 31/10/2026; não interromper até o corte completo.
- **DNS público do Registro.br:** NS autoritativos `b.sec.dns.br` e `c.sec.dns.br`; na consulta de 31/10, o domínio raiz não retornou registros A e `www` retornou NXDOMAIN (sem CNAME). Navegação HTTPS de `www` e raiz falhou antes de carregar o site. Portanto o domínio NÃO está publicado na nova origem.
- **GitHub Pages:** site implantado por `.github/workflows/pages.yml` após push em `main`; para publicação por GitHub Actions, não é necessário adicionar arquivo `CNAME`. O estado da opção Custom domain em Settings > Pages ainda depende de leitura autenticada.
- **Auth:** as seis Redirect URLs previstas foram registradas na conferência administrativa anterior, Site URL legada preservada; SMTP customizado foi salvo e dois pedidos de recuperação registrados. Confirmação de recebimento/uso não equivale à homologação em todos os celulares.
- **Dados:** mesmo projeto Supabase e mesmos buckets devem ser preservados. O backup clínico por hora não equivale ao backup integral PostgreSQL. A exportação emergencial cifrada e a recuperação lógica isolada já realizadas não comprovam restauração operacional completa de Auth/RLS/Storage/Vault.
- **Segurança:** há avisos do linter sobre funções SECURITY DEFINER. As duas funções anônimas de anamnese foram inspecionadas e chamam implementações privadas com hash de token, validade, revogação e restrição de campos. Isso não substitui auditoria integral nem autoriza revogar EXECUTE indiscriminadamente.

## 2. Portões antes da janela de corte

Todos devem ser registrados como aprovados, com data e responsável:

- [ ] Aceite expresso da gestora clínica Mel e da administração para a publicação definitiva.
- [ ] Recuperação operacional isolada do projeto homologada, incluindo usuários Auth, RLS, gatilhos, metadados Storage e estratégia para segredos/Vault, ou uma decisão de risco explícita documentada pela administração.
- [ ] Testes físicos Android e iPhone: login/logout, redefinição, perfis, agenda, Maya vigente, PDFs fictícios, Picker e Google Drive, sem dados de pacientes.
- [ ] Integração e homologação das alterações de domínio do PR #69 com as dependências corretas do PR #74. Não mesclar PRs paralelos (Maya Beta/V2, TCLE, backup por gravação) por consequência.
- [ ] Conferência do rollback, janela de manutenção, DNS e acesso autenticado a Registro.br e Settings > Pages do repositório.
- [ ] Snapshot de contagens e privacidade anterior ao corte, usando `scripts/ops/domain-migration/readonly-snapshot.sql`, salvo **somente** em pasta administrativa privada; nunca no PR.

## 3. Sequência da janela autorizada

1. Informar a equipe da janela. Pausar novas gravações apenas durante a comparação antes/depois; não suspender o backup automático.
2. Revalidar `main`, HEAD dos PRs, CI, funções implantadas e estado das origens. Resolver dependências antes do merge, sem migrations desnecessárias.
3. Publicar somente o conjunto homologado no GitHub Pages, mantendo plano de retorno explícito. O workflow `pages.yml` publica automaticamente a partir da `main`; não fazer merge isolado com dependências ausentes.
4. Em **Settings > Pages** do repositório da aplicação, salvar o domínio canônico `www.bcesteticaavancada.com.br`. Coordenar imediatamente o DNS com esse passo, pois uma configuração parcial pode afetar acessos legados.
5. No Registro.br, preservar os TXT de propriedade (GitHub/Search Console), NS, MX e demais serviços existentes. Aplicar somente os registros de tráfego aprovados:

   | Tipo | Host | Destino |
   | --- | --- | --- |
   | CNAME | `www` | `bcesteticaavancada.github.io` |
   | A | `@`/raiz | `185.199.108.153` |
   | A | `@`/raiz | `185.199.109.153` |
   | A | `@`/raiz | `185.199.110.153` |
   | A | `@`/raiz | `185.199.111.153` |

6. Conferir DNS em resolutores públicos e certificado HTTPS. Habilitar **Enforce HTTPS** quando disponível. Não contornar erros de certificado. A propagação pode levar até 24 horas.
7. Validar `/`, `/gestao/login/`, `/agenda/`, `/agendamento/`, `/backup/`, `/backup/privacidade/`, `/backup/termos/`, manifestações PWA, sitemap, recursos e redirecionamento raiz→www.
8. Testar sessão e recuperação em novo domínio sem reutilizar cookies da origem GitHub; conferir Auth, CORS, PDFs fictícios, Drive/Picker e NFC/QR.
9. Executar segundo snapshot privado e comparar com o primeiro via `scripts/ops/domain-migration/compare-snapshots.mjs`. Divergências exigem investigação manual; contagens iguais não provam integridade linha a linha.
10. Liberar gravações e divulgar o domínio novo somente após aceite explícito dos testes.

## 4. Reversão

Em falha crítica de Auth, agenda, documentos, privacidade ou HTTPS, parar a divulgação e coordenar retorno de DNS/Pages ao endereço anterior com cuidado para não deixar domínio órfão ou suscetível a takeover. Se necessário, reverter mudanças de código por commits de reversão revisados. **Nunca restaurar automaticamente o banco de produção**, pois isso pode descartar registros novos. Preservar evidências e reavaliar com a administração antes de tentar novo corte.

## 5. Pendências desta conferência

- DNS ainda não apontado.
- Settings > Pages indisponível na sessão de navegador não autenticada.
- Aceite clínico de corte e restauração operacional completa não comprovados nesta rodada.
- PRs seguem em rascunho. Nenhum DNS, merge, segredo, dado clínico ou função implantada foi alterado.

## Referências

- [PR #69 — Migração da BC](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/69)
- [PR #74 — OAuth/Drive](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/74)
- [GitHub Pages — custom domain e DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Gate de integridade de dados](./bc-dominio-gate-integridade-dados-2026-10-29.md)
