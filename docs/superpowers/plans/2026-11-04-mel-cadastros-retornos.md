# Mel: cadastros e retornos — Implementation Plan

> **For agentic workers:** executar neste atendimento com superpowers:executing-plans, tarefa por tarefa.

**Goal:** permitir os cadastros e equipamentos livres e entregar lembrete de retorno na gestão e no aparelho.
**Architecture:** JavaScript existente, RPCs autorizadas, fila persistente Postgres e despachante Web Push. Cadastros e lembretes isolados dos documentos assinados.
**Tech Stack:** JavaScript, Supabase Postgres/RPC/Edge Functions, Web Push.
**Spec:** ../specs/2026-11-04-mel-cadastros-retornos.md

## Global Constraints
- Manter papéis; `admin_criacao` sem dados clínicos.
- Brasília para datas/horas; nenhum nome clínico na notificação do aparelho.
- Testes com dados fictícios, sem escrita clínica de teste na produção.
- Aplicar somente a migration nova depois de validar localmente.

## Review Focus
- Nomes inéditos e HTML malicioso: persistência com escape; zero dependência de catálogo vazio.
- Reenvio simultâneo: catálogo único por nome; submissão e entrega idempotentes.
- Reagendamento/cancelamento: revisão antiga não pode disparar aviso novo.
- Conta desativada/sem papel clínico: negar RPC e entrega; não alterar dono de assinatura.
- iPhone, permissão recusada e sem Push: manter caixa de lembretes utilizável.

### Task 1: Equipamentos e cadastros
**Files:** treatment-equipment-api.js, treatment-6d-panel.js, clinical-catalog-panel.js, dashboard-boot.js, páginas admin/colaborador, nova migration.
- [ ] Testar campo aberto, validação e preservação dos parâmetros.
- [ ] Implementar RPC `bc_treatment_equipment_usage_add_text` e catálogo editável da administradora.
- [ ] Validar navegação e gravação com backend isolado.

### Task 2: Preenchimento e correções
**Files:** treatment-panel.js, treatment-api.js, nova migration.
- [ ] Reproduzir bloqueio do parecer em rascunho.
- [ ] Liberar estados editáveis, preservando congelamento na finalização; expor correção com nova versão.
- [ ] Cobrir acesso de administradora e negação a outra profissional.

### Task 3: Retorno e notificações
**Files:** return-reminders-api.js, return-reminders-panel.js, return-notifications.js, gestao/return-reminder-sw.js, supabase/functions/return-reminders/*, nova migration.
- [ ] Testar fuso, autorização, revisão, envio, falhas e cancelamento.
- [ ] Implementar lembrete independente do parecer e caixa acessível no menu.
- [ ] Implementar assinatura Push por aparelho e fila/cron no servidor.
- [ ] Validar permissões e degradação para caixa interna.

### Task 4: Entrega
- [ ] Rodar testes frontend e SQL relevantes; revisar diff e permissões.
- [ ] Enviar PR, conferir CI no SHA exato, aplicar migration específica e despachante.
- [ ] Publicar alterações autorizadas e verificar arquivos hospedados e agendador.
- [ ] Registrar limites de ativação no aparelho da Mel e instruções de uso.
