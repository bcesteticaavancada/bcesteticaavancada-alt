# BC — aplicação controlada dos ajustes de Auth e Drive

Estado: pronto para revisão de aplicação; **nenhuma mudança hospedada, merge ou publicação nesta conferência**.

## Evidência atual

- A conferência autenticada do Dashboard registrada no PR #69 informa apenas o retorno legado de redefinição na allow-list e como Site URL. O SMTP personalizado está desligado; os modelos usam `{{ .ConfirmationURL }}`. Nesta sessão, a entrada segura no painel não foi concluída; não houve nova gravação de configuração.
- O código de Drive mais recente é o PR #74, commit `6189bdc12bc97f094448abcde2ef68cc39960112`. Não substituir essa implementação por uma cópia das funções antigas implantadas.
- Foram reexecutados `deno check` nos três entrypoints e 41 testes direcionados de handler/multidomínio/desbloqueio, todos aprovados, sem rede, conta Google ou dados reais em runtime dos testes.
- Os três workflows do PR #74 estão aprovados no mesmo commit. Os 65 testes e demais ensaios registrados naquele PR têm escopo mais amplo que os 41 reexecutados aqui; não somar os grupos como testes únicos.

## Auth — cinco adições exatas

Preservar todas as entradas existentes. A entrada legada já registrada é:

`https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/redefinir-senha/`

Acrescentar somente os cinco endereços abaixo à allow-list de Redirect URLs:

| Uso | URL a acrescentar |
|---|---|
| Redefinição/convite principal | `https://www.bcesteticaavancada.com.br/gestao/redefinir-senha/` |
| Redefinição/convite sem www | `https://bcesteticaavancada.com.br/gestao/redefinir-senha/` |
| Login principal | `https://www.bcesteticaavancada.com.br/gestao/login/` |
| Login sem www | `https://bcesteticaavancada.com.br/gestao/login/` |
| Login legado | `https://bcesteticaavancada.github.io/bcesteticaavancada-alt/gestao/login/` |

Não usar curingas, não apagar a entrada antiga e não alterar o Site URL nesta preparação. A troca do Site URL pertence à janela de corte, depois de HTTPS e homologação. Conferir novamente a lista atual antes de salvar para preservar eventuais adições posteriores à auditoria.

Salvar endereços permitidos não comprova entrega de e-mail. Com o SMTP padrão do Supabase, destinatários fora da equipe do projeto podem ser recusados; o serviço padrão não é indicado para produção. Para liberar convites/recuperação das colaboradoras, escolher um provedor SMTP, configurar remetente e credenciais no painel seguro e validar entrega com uma conta fictícia aprovada. Não enviar mensagens para a equipe como teste sem instrução específica.

Credenciais SMTP, senha, token e códigos de acesso não devem entrar no GitHub nem no chat. Não desligar confirmação de e-mail ou outras proteções para contornar a falta de SMTP. O Google OAuth do Drive é separado de login social no Supabase; ativar Google no Auth não corrige a conexão de backup.

## Drive — implementação existente e aplicação futura

O PR #74 já corrige:

1. Origens exatas GitHub, www e raiz; retorno à instalação de início, vinculado ao cookie cifrado/autenticado.
2. Consulta de status e Picker com backup ativo, sem interromper o agendador.
3. Reconexão protegida por opt-in separado e rotação atômica, preservando a prontidão das pastas e recusando credencial alterada ou worker em execução.

Para aplicação autorizada, seguir a sequência do próprio PR:

1. Conferir dependências de OAuth/backup, continuidade e recuperação; manter `BC_DRIVE_OAUTH_ENABLE_ACTIVE_RECONNECT` desabilitado.
2. Aplicar somente a migration revisada `20261029132944_bc_drive_oauth_safe_rotation.sql`, depois das dependências existentes. Não executar reset nem aplicação indiscriminada de migrations da branch.
3. Implantar start, callback e setup do mesmo commit. Preservar callback Supabase, conta, client ID, `drive.file`, duas pastas originais, cron e permissões.
4. Homologar status/Picker/origens e continuidade do backup com a administração. A inspeção da central não ativa cópias novas nem amplia a cobertura do worker.
5. Somente depois, decidir sobre a reconexão ativa e consentimento interativo da proprietária; validar refresh e execução posterior do backup.

Permanecem necessários: confirmação do cliente Google e de seu modo Production/Testing, recuperação operacional do projeto, homologação hospedada e aparelhos físicos. Nenhuma dessas condições é provada pelos testes fictícios.

## Próximo ponto de decisão

A implementação do Drive está preparada, mas ainda não foi implantada. O Auth tem as cinco adições delimitadas, mas elas ainda não foram salvas. A configuração de SMTP requer a definição de um serviço e acesso seguro ao painel.

Preservar a restrição de preparação em rascunho: aplicação de migration, funções e configurações hospedadas exige liberação específica da administração, sem antecipar merge, troca de DNS ou publicação do domínio.

## Referências

- [PR #69 — migração e auditoria hospedada do Auth](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/69)
- [PR #74 — implementação do Drive](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/74)
- [Sequência de aplicação do Drive](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/blob/6189bdc12bc97f094448abcde2ef68cc39960112/docs/operacao/drive-desbloqueio-tres-pontos-2026-10-29.md)
- [Supabase — Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase — SMTP personalizado e limites do serviço padrão](https://supabase.com/docs/guides/auth/auth-smtp)
