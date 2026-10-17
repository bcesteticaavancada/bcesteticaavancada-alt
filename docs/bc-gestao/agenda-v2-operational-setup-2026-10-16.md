# Agenda V2 — horários e permissões operacionais

Configuração solicitada por Fernando em 16/10/2026 e aplicada ao projeto `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`).

## Regra autorizada e aplicada

- Segunda a sábado, das 09h às 19h, com pausa das 12h às 13h.
- Último início às 18h para os procedimentos de 60 minutos. Procedimentos mais longos têm o último início antecipado para terminar até as 19h e não atravessam o almoço.
- Foram materializadas as datas de 16/10/2026 a 16/10/2027: 314 dias e 314 pausas por profissional. Domingos fechados. A grade pública permanece de 15 em 15 minutos.
- Renovar o horizonte antes de 16/10/2027; esta configuração usa os dias de disponibilidade existentes no produto, sem criar rotina automática ou promessa de recorrência indefinida.
- O usuário escolheu 60 minutos para os 28 procedimentos sem duração. Foram preservadas Limpeza de pele (90 min) e Limpeza de pele com peeling (100 min).

| Profissional | Regra solicitada | Situação |
| --- | --- | --- |
| Alice | Todos os 30 procedimentos, incluindo injetáveis | Aplicada |
| Mel | Todos os 30 procedimentos, incluindo injetáveis | Aplicada |
| Aline | Procedimentos de pele, sem botox nem preenchimento | E-mail recebido; conta Auth ainda não criada |
| Kátia | Família de massagens e drenagens | E-mail recebido; conta Auth ainda não criada |

Há um procedimento ativo agrupado de massagem: “Massagem (relaxante, drenagem ou redutora)”. Não foi criado um protocolo clínico ou preço novo de massagem desportiva por suposição. A seleção final para Aline/Kátia será conferida ao cadastrar as contas.

Os 30 procedimentos passaram a exigir autorização explícita por profissional. Isso permite aplicar as restrições de Aline/Kátia sem que o modo geral libere todo o catálogo automaticamente. Alice e Mel têm 30 autorizações ativas cada. Papéis de administração e capabilities não foram modificados.

## Aplicação e possibilidade de reversão

Script: `scripts/operations/agenda-default-hours-2026-10-16.sql`. É um registro operacional, não uma migration de schema. O arquivo versionado termina em `ROLLBACK` e não é executado pelo deploy/CI.

Primeiro foi feito o dry-run completo. A consulta posterior confirmou zero dias/pausas criados e 28 durações ainda ausentes, comprovando o rollback. Depois, o mesmo SQL foi executado com `COMMIT`.

Registro de auditoria: `04538d12-607b-4d00-99b1-d174e61ea70c`, ação `agenda_operational_setup`, chave `2026-10-16-universal-hours-v1`.

O registro preserva os valores anteriores de duração/modo dos 30 procedimentos, as 6 permissões anteriores, a disponibilidade anterior e os IDs das 628 disponibilidades e 628 pausas criadas. O ator foi registrado como operação externa, sem simular login de Mel. O campo obrigatório de responsável pelas configurações referencia a administradora verificada da clínica.

Uma reversão deve usar esse registro e conferir intervenções posteriores da equipe antes de restaurar configurações. Não apagar ou cancelar reservas como parte de uma reversão. O script recusa reaplicação da mesma chave de operação.

## Verificação

- 30 procedimentos públicos com duração válida; distribuição 28 × 60 min, 1 × 90 min e 1 × 100 min.
- Endpoint público de profissionais validado para todos os 30 procedimentos: 60 combinações, sempre Alice e Mel.
- 628 dias habilitados e 628 pausas; zero janela inválida ou domingo habilitado.
- Consulta pública de sábado inclui 09h e 18h para massagem de 60 minutos; não oferece horário que atravesse 12h–13h ou termine após 19h.
- Nenhum paciente, cliente, atendimento ou agendamento foi criado ou editado por esta configuração. A contagem desses registros permaneceu igual à anterior.
- Textos da home, clínica, contato e rodapé comum, dados estruturados de abertura e padrão do formulário de disponibilidade ajustados para o novo horário. Suíte local completa: 693 testes aprovados (62 pré-anamnese, 99 site, 532 gestão).
- A revisão independente identificou horário antigo no JSON-LD; corrigido para segunda a sábado em duas janelas, 09h–12h e 13h–19h, com a asserção existente atualizada.

## Pendências

E-mails de Aline e Kátia recebidos; criar os acessos Auth e validar os perfis, aplicar a seleção de procedimentos e o mesmo horário para elas. Concluir a reserva fictícia controlada até a gestão e a validação em Android/iPhone/PWA antes de declarar a homologação operacional completa.
