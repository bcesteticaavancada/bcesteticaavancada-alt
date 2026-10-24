# Ensaio fictício Drive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** comprovar cópia, repetição, versões e recuperação no Google real.
**Architecture:** handler temporário dedicado, adaptador servidor Vault e Google,
com capacidade curta; substituir por handler fechado ao terminar.
**Tech Stack:** Deno/TypeScript/WebCrypto e HTTP Google Drive.
**Spec:** `docs/superpowers/specs/2026-10-24-drive-rehearsal-design.md`.

## Global Constraints
- Somente as duas pastas já autorizadas, arquivos gerados pelo próprio ensaio.
- Nunca Storage, dados de clientes, financeiro, cron ou gravação global true.
- Credenciais somente no servidor; gatilho bruto nunca no Git/relatório.

## Review Focus
- Falhas antes/depois do upload não podem expor credenciais.
- Metadados/reutilização precisam pertencer ao run e ao destino exatos.
- Corpo externo não pode ampliar operação ou fornecer conteúdo.
- Consulta a arquivos deve ter filtro por run, pasta e hash.
- Fechamento final não pode conservar código que consulte Vault.

## Task 1 — handler e adaptador
**Files:** `supabase/functions/drive-backup-rehearsal/{core,core_test,runtime,closed}.ts`.
**Interface:** `createRehearsalHandler(config, dependencies)` retorna handler HTTP.
- [x] Escrever testes de autorização, prazo, flag, corpo, identidade, pastas,
  duplicação sequencial, nova versão, recuperação corrompida e erros sanitizados.
- [x] Executar RED por módulo ausente; implementar o mínimo; exigir GREEN.
- [x] Rodar tipagem e suíte geral; revisão independente antes do deploy.

## Task 2 — execução autorizada
- [x] Gerar configuração/capacidade em diretório privado temporário.
- [x] Implantar somente ensaio; provar 403 sem capacidade antes da execução.
- [x] Executar duas vezes: primeira 4 cópias novas/2 reutilizações, segunda
  0 novas/6 reutilizações; hashes e versões anteriores devem coincidir.
- [x] Substituir função por closed.ts e provar bloqueio final.
- [x] Salvar relatório, IDs e hashes, sem credenciais; publicar branch/PR rascunho.
