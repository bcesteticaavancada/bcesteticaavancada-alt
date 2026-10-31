# BC: frontend e Auth para domínio próprio — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** preparar a raiz `https://www.bcesteticaavancada.com.br/` sem publicar nem prejudicar a navegação no caminho legado.

**Architecture:** navegação continua relativa à instalação. Metadados de busca apontam para o domínio canônico futuro; o manifesto usa a identidade padrão de `start_url`, preservando a identidade anterior no GitHub. O suporte aceita somente três origens oficiais e gera convites no endereço da origem validada.

**Tech Stack:** HTML/JS estático, Node test runner, LinkeDOM, Playwright, Supabase Edge Functions.

**Spec:** `docs/operacao/migracao-dominio-proprio-bc-2026-10-28.md`, etapas G1 e G4. Continuação autorizada na conversa de 28/10/2026.

## Global Constraints

- Não mesclar, publicar, modificar DNS/Pages, OAuth, Auth hospedado ou dados de pacientes.
- Preservar a origem legada e as duas origens próprias, sem wildcards.
- Não incorporar código de PRs paralelos de Maya/TCLE/backup.
- Testes de integração usam somente dados e serviços fictícios.

## Review Focus

1. Caminhos profundos no domínio novo e no prefixo legado: links e recursos devem resolver para a instalação correta.
2. Identidade PWA no GitHub: omitir `id` precisa manter exatamente o `start_url` anterior; `id: ./` resolveria na raiz da origem e seria incorreto.
3. Origem maliciosa com sufixo/prefixo semelhante: deve ser recusada antes de criar clientes privilegiados.
4. Convite sem Origin: preservar fallback legado para consumidores internos já existentes; sem aceitar destino vindo do corpo.
5. OAuth Drive: fontes implantadas não estão todas neste PR; testes simulados não comprovam configuração hospedada nem aceite de aparelhos físicos.

---

### Task 1: navegação, SEO e PWA

**Files:** `script.js`, `manifest.webmanifest`, páginas HTML públicas, `robots.txt`, `sitemap.xml`; `tests/site/custom-domain-navigation.test.mjs`, `tests/site/pwa-manifest.test.mjs`, `tests/site/seo.test.mjs`.

**Interfaces:** consome as rotas existentes e o link Contato do menu; produz links de rodapé e manifesto válidos na raiz ou no prefixo, sem redirecionamento automático.

- [ ] Escrever testes de identidade/atalhos/ícones no manifesto nas três bases e de rodapé resolvido em páginas profundas. Metadados devem produzir URLs HTTPS no domínio novo; sitemap preserva as 11 rotas e acrescenta `agenda/`.
- [ ] Rodar `node --test tests/site/pwa-manifest.test.mjs tests/site/custom-domain-navigation.test.mjs tests/site/seo.test.mjs`. Esperado: falhas no `id`, rodapé e URLs SEO antigos.
- [ ] Omitir `id`, derivar link do rodapé da navegação instalada e adaptar metadados estáticos. Completar canônicos nas páginas públicas já existentes que não tinham um.
- [ ] Repetir os testes e `npm test`. Esperado: todos passam.
- [ ] Commit `feat(domain): prepare navigation SEO and PWA for custom root`.

### Task 2: suporte e convites nas origens oficiais

**Files:** `supabase/functions/client-support/handler.mjs`; `tests/gestao/support-handler.test.mjs`.

**Interfaces:** `createSupportHandler({makeClients,crypto})` inalterada; consome Origin aprovado e produz CORS exato e `redirectTo` de convite na mesma instalação.

- [ ] Exercitar handler real com OPTIONS e convite nas três origens, origens parecidas maliciosas, ausência de Origin e tentativa de destino no corpo.
- [ ] Rodar `node --test tests/gestao/support-handler.test.mjs`. Esperado: novos domínios falham antes da implementação.
- [ ] Mapear somente as três origens para bases literais, manter fallback legado sem Origin e checagens de autenticação/autorização intactas.
- [ ] Repetir testes e `npm test`. Esperado: todos passam.
- [ ] Commit `fix(domain): allow official origins in support invitations`.

### Task 3: homologação local e registro das configurações externas

**Files:** `scripts/test-custom-domain-browser.mjs`, `tests/edge/custom-domain-cors_test.ts`, `.github/workflows/site-ci.yml`, `docs/operacao/homologacao-dominio-bc-2026-10-28.md`; atualizar plano de migração e runbook sem acionar o corte.

**Interfaces:** consome rotas/manifesto/suporte das tarefas 1–2; produz resultado reproduzível de Chromium/WebKit nas três bases com rede externa bloqueada e lista exata de Redirect URLs a configurar depois.

- [ ] Executar navegação/menu/rodapé/manifesto/login/recuperação/Drive informativo nas bases próprias e legada, em perfis Android/iPhone simulados, com backend fictício e bloqueio de toda requisição externa.
- [ ] Integrar comando ao Site CI. Rodar `node scripts/test-custom-domain-browser.mjs` e `npm test`. Esperado: sem solicitações a produção; rotas/ícones/links carregam sem erro.
- [ ] Rodar 16 cenários HTTP CORS das quatro funções em Deno, sem acesso à rede/banco em runtime. Esperado: origens oficiais preservadas e origens estranhas recusadas antes de autenticação ou processamento.
- [ ] Documentar resultados reais e limites: funções PDF e Drive remoto não homologadas por um simples teste de página; celulares físicos e aprovação administrativa continuam pendentes.
- [ ] Revisão final de toda a diferença, correção de achados relevantes e commit de evidências.
- [ ] Atualizar somente o branch/PR #69, mantendo rascunho. Conferir SHA e estado remoto. Não mesclar.
