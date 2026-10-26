# Apoio operacional e consentimento manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executar nesta sessão e solicitar uma revisão independente da alteração completa antes de integrar.

**Goal:** permitir a Fernando adicionar colaboradoras, corrigir cadastros e cuidar das cópias de consentimento, sob as permissões operacionais autorizadas.

**Architecture:** Edge Function client-support autentica usuário e sessão; RPC exclusiva de service_role executa operações transacionais com escopo fixo, valida perfil ativo e registra autoria. A interface de criação consome somente esse endpoint e a consulta operacional existente. Assinaturas e PDFs primários continuam nos módulos clínicos existentes; a etapa externa permanece manual.

**Tech Stack:** HTML/CSS/JS existentes, Supabase Auth/Storage/Postgres/Edge, Node test, pgTAP e Playwright.

**Spec:** docs/superpowers/specs/2026-10-25-apoio-operacional-manual-design.md

## Global Constraints

- Não integrar, validar automaticamente, fazer login ou impor bloqueio GOV.BR.
- Manter assinatura da cliente/responsável e da profissional no app e preservar PDFs originais.
- Não liberar financeiro, tabelas brutas ou assinatura/alteração clínica ao perfil de criação.
- Convites somente para novas colaboradoras; nunca alterar conta existente ou conceder administração/capacidades clínicas pelo convite.
- Nenhum convite/e-mail de teste real; testes de Auth/SMTP somente com dublês ou banco descartável.

## Review Focus

- Sessão revogada ou perfil desativado deve impedir cada operação privilegiada.
- Troca rápida de cliente e resposta atrasada não podem alterar/exibir dados na pasta errada.
- Cópia devolvida deve pertencer à cliente do documento original e preservar os bytes do arquivo.
- Repetição de convite e conta existente não podem modificar identidades ou conceder papel adicional.
- Falha de registro após upload não deve disponibilizar arquivo órfão; erros não devem expor chaves, URLs permanentes ou dados financeiros.

### Task 1: Serviço e banco

Files: supabase/migrations/*_bc_support_operations.sql; supabase/tests/database/support_operations.test.sql; supabase/functions/client-support/{index.ts,handler.mjs,deno.json}; tests/gestao/support-handler.test.mjs.

Interface: POST autenticado para client-support. JSON actions client_get(clientId,reason), client_update(clientId,expectedUpdatedAt,patch,reason), download(clientId,documentId,kind,reason), invite(name,email). Multipart upload_returned(clientId,documentId,reason,file). Respostas client_get/client_update contêm client projetado, documents contém metadados sem caminhos; download retorna URL temporária/filename; invite retorna somente sucesso; upload retorna fileId.

- [ ] Escrever testes de limites de autenticação/role, atualização concorrente, cliente trocado, privilégio indevido, bytes e convite duplicado. Executar RED.
- [ ] Implementar RPC somente service_role e handler. Preservar is_bc_active_staff/is_bc_admin e políticas existentes.
- [ ] Rodar testes Node e pgTAP/lint/advisors no CI descartável. Expected: aprovação e zero mensagens enviadas a destinatários reais.

### Task 2: Interface de apoio e fluxo simples

Files: gestao/js/{support-api,support-panel}.js; gestao/criacao/index.html; creation-panel.js; assets/creation.css; client-documents-panel.js; testes respectivos e script de navegador.

Interface: RPC/endpoint Task1; botão Adicionar colaboradora na área Equipe; Abrir cadastro por cliente; formulário progressivo em diálogo e lista de PDFs de consentimento/anamnese já emitidos, com upload da cópia devolvida do consentimento. Preservar navegação e detalhes existentes.

- [ ] Escrever regressões de contexto, erros e rejeição de payload indevido. Executar RED.
- [ ] Implementar UI simples, sem campo de papel/permissão financeira ou controles GOV.BR.
- [ ] Rodar npm test e testes de navegador em Chromium/WebKit/celular/tablet. Expected: aprovação sem overflow, sem regressões e sem conexões GOV.BR.

### Task 3: Revisão, publicação e verificação

- [ ] Revisão independente única; achados relevantes reproduzidos e corrigidos com testes.
- [ ] CI completo e assessoria de segurança; migration/Edge publicadas sem operações com dados reais.
- [ ] Integrar site, confirmar bytes publicados, verificar negação sem sessão e registrar limitações/evidências.
