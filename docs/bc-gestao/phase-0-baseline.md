# BC Gestão 1.0 — Fase 0 Baseline

Data da Fase 0: 2026-10-08

## Baseline do código

- Repositório: `bcesteticaavancada/bcesteticaavancada-alt`
- Branch pública: `main`
- Baseline SHA: `1ae3d6a90b941287d64582f0f3febdf0a74a7c20`
- Branch de trabalho do BC Gestão: `feature/bc-gestao-1`

A branch `feature/bc-gestao-1` foi criada diretamente a partir do SHA acima. Nenhuma implementação do BC Gestão deve ser feita diretamente em `main`.

## Área administrativa já existente

A rota `/admin/` permanece reservada à área privada de pré-anamnese existente nesta fase.

Referências de integridade no baseline:

- `admin/index.html`: `96b4e37eba3b746ff936251cf52966aae16be350`
- `admin/admin.js`: `5f101a9bf9d6ede7da6357288236c8a9699095dd`
- `admin/admin.css`: `d7ae73686e23847986b38541b199954cfe7695f6`

Esses arquivos não foram modificados pela Fase 0.

## Publicação do site

O workflow `.github/workflows/pages.yml` publica o site em GitHub Pages por `push` na branch `main` e faz checkout do conteúdo do repositório antes de enviar o artefato do site.

A branch `feature/bc-gestao-1` não é fonte de publicação do site público.

## Banco e credenciais

Durante a Fase 0:

- nenhuma tabela do Supabase foi criada, alterada ou removida;
- nenhuma migration foi executada;
- nenhuma política RLS foi alterada;
- nenhum usuário de produção foi criado;
- nenhuma credencial, senha, token, `service_role` ou chave privada foi adicionada ao repositório.

## Regra de isolamento

O BC Gestão será desenvolvido de forma isolada. O site institucional e a área atual de pré-anamnese devem continuar independentes enquanto a nova aplicação não for validada e aprovada para integração.

## Rollback

Se uma integração futura do BC Gestão causar regressão no código público:

1. identificar os commits específicos da integração;
2. reverter esses commits ou restaurar o código ao baseline/commit estável imediatamente anterior à integração;
3. não apagar dados do banco como mecanismo de rollback;
4. migrations futuras devem ser reversíveis ou corrigidas por migration forward-safe;
5. confirmar novamente a integridade de `/admin/` e do workflow de Pages antes de republicar.

## Gate da Fase 0

A Fase 1 só pode começar quando:

- `feature/bc-gestao-1` existir e estiver isolada de `main`;
- este manifesto for o único arquivo novo da branch em relação ao baseline;
- `/admin/` permanecer intacto no `main`;
- o workflow de Pages continuar publicando apenas a partir de `main`;
- nenhuma ação de banco de dados tiver sido executada nesta fase.
