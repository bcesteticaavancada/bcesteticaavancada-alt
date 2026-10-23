# BC Drive OAuth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** preparar o fluxo de autorização próprio da BC, sem enviar arquivos e sem implantação.
**Architecture:** três Edge Functions Deno, protocolo compartilhado com state/PKCE, armazenamento servidor no Vault e página separada com Picker. Transportes externos são injetados nos testes; a produção fica sem alterações.
**Tech Stack:** TypeScript/Deno Web APIs, JavaScript ES modules, PostgreSQL/Supabase Vault, Node/linkedom.
**Spec:** `docs/superpowers/specs/2026-10-23-drive-oauth-preparacao-design.md`.

## Global Constraints

- Somente `decolarbh@gmail.com` e as duas pastas da spec; escopo único `drive.file`.
- Sem Storage, prontuários, agenda, financeiro, upload, agendamento, deploy ou merge.
- `BC_DRIVE_BACKUP_ENABLE_WRITES=false`; setup exige flag explícita.
- Client secret e refresh token só no servidor; tokens e códigos nunca nos logs ou redirects.
- Native/execução sequencial conforme continuidade já autorizada; decisões materiais registradas.

## Review Focus

- Callback sem cookie, state trocado/expirado/repetido: nenhum token persistido.
- Conta errada, sessão revogada e escopo amplo: nenhuma conexão considerada válida.
- Picker devolve pasta diferente ou permissões públicas: nenhuma confirmação de pastas.
- Falha de rede, Vault ou resposta OAuth malformada: mensagem fixa, sem vazamento.
- Flag ausente ou uploads habilitados: nenhum transporte Google/Storage acionado.

## Task 1: protocolo e handlers HTTP

**Files:** `supabase/functions/_shared/drive-oauth/{protocol,handler}.ts` e respectivos `_test.ts`; entrypoints `drive-oauth-{start,callback,setup}/index.ts`.
**Interfaces:** `createOAuthHandler(kind, config, dependencies): (Request) => Promise<Response>`; `Config` contém URLs, client ID/secret, flags e chave Picker; dependências são `fetch`, `store(operation,payload)` e relógio.

- [x] Escrever testes do fluxo real de requests: flags, sessão, cookie criptografado, PKCE, state de uso único, consentimento, conta, escopo, cancelamento, token ausente, erros sem credenciais.
- [x] Executar e observar RED por implementação ausente.
- [x] Implementar protocolo e handlers mínimos, usando somente Web APIs e erros de código fixo.
- [x] Executar testes e type-check; exigir GREEN sem rede real.

## Task 2: adaptador servidor e banco privado

**Files:** `_shared/drive-oauth/runtime.ts`, nova migration `bc_drive_oauth_test_setup`, `scripts/test-drive-oauth-db.mjs`.
**Interfaces:** RPC `public.bc_drive_oauth_store(text,jsonb)` somente `service_role`, delega implementação em `private`; operações `start`, `consume`, `save`, `read`, `status`, `ready`.

- [x] Escrever teste SQL local: anon/authenticated negados, state consumido uma vez/expirado, token atualizado sem expor status, troca de conta negada, confirmação somente dos IDs fixos.
- [x] Observar RED antes da migration.
- [x] Gerar migration por CLI; implementar grants explícitos, RLS, trava de atualização e Vault. Runtime usa REST Auth e RPC sem dependências externas.
- [x] Executar teste SQL com Vault simulado apenas na fronteira e type-check; documentar limite da simulação.

## Task 3: página de configuração e Picker

**Files:** `gestao/configurar-drive/{index.html,setup.js,setup.css}`, `tests/gestao/drive-oauth-setup.test.mjs`.
**Interfaces:** controlador recebe cliente Auth e transportes; formulário navega ao start; Picker recebe access token apenas em memória e IDs selecionados são enviados ao setup.

- [x] Testar sessão ausente, início sem token no URL, seleção fora da lista, cancelamento e confirmação somente após resposta servidor.
- [x] Observar RED, implementar página e controlador sem módulos clínicos.
- [x] Executar testes e conferir layout de celular com dados simulados.

## Task 4: documentação, CI e revisão

**Files:** `docs/BC_DRIVE_OAUTH_TEST_SETUP.md`, workflow CI dedicado, ledger e PR draft.

- [x] Registrar requisitos de instalação, chave Picker restrita, flags, comandos de testes, rollback e ausência de integração com worker.
- [x] Rodar testes OAuth/SQL/UI, testes existentes de backup e `npm test`; registrar falhas preexistentes se houver.
- [x] Revisar diff inteiro com contexto fresco; corrigir problemas importantes com teste primeiro.
- [x] Commit na branch própria, publicar PR draft e verificar branch remota. Não implantar funções/migrations.
