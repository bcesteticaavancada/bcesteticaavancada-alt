# BC Estética Avançada — cópia paralela para Google Drive (V1, preparação)

> **Não está publicado, implantado ou agendado.** Esta branch é um ensaio técnico.
> O site, Maya, agenda, banco e documentos de produção permanecem intactos.

## Finalidade
Preservar uma cópia paralela dos **objetos do bucket privado**
`bc-prontuario-private` (PDFs gerados, anexos, assinaturas e imagens clínicas),
sem depender do Drive para o funcionamento do aplicativo. Financeiro não é copiado.
Não há compartilhamento público.

Fluxo futuro:
1. O servidor Supabase lista arquivos do bucket privado (sem nomes de clientes nos logs).
2. A função consulta o Drive pela indexação privada `appProperties.bcSourceKey` (hash do caminho original).
3. Para itens novos/alterados, baixa do bucket, calcula SHA-256 e cria **novo arquivo com hash no nome** na pasta privada. Nunca apaga ou substitui uma cópia anterior.
4. Retorna contadores de itens analisados, novos e falhos, sem dados clínicos.
5. Um agendamento de servidor, **ainda inexistente**, executará a função em intervalos regulares. Falhas na cópia não impedem registros clínicos.

## Pastas privadas preparadas previamente, ainda NÃO conectadas à função

- Raiz: `1Ax1FUrgxpBdgHgBTsriMtQGYK37GMK_y` — BC Estética Avançada - Backups Privados
- `01_Anamneses_e_Documentos_Clinicos`: `1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y`
- `02_Arquivos_de_Clientes`: `1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N`
- `03_Site_Maya_e_Midias`: `1rR9CfdXLVPZZSkyYDv2tPk3jlj4RMyAQ`
- `04_Manifestos_e_Relatorios_de_Backup`: `1s7LTdxb24dDYpzdHThKIEAEFdwwvmfjh`

**ATENÇÃO:** acesso Google Drive concedido ao ChatGPT não pode ser reutilizado pela função Supabase. Para o escopo mínimo `drive.file`, o novo aplicativo OAuth precisará receber acesso explícito às pastas existentes por meio de um seletor Google Drive/Picker. Um token `drive.file` sozinho **não garante acesso** às pastas criadas por outra conexão. Não usar escopo global `drive` sem avaliação de privacidade e consentimento específicos.

## Pré-requisitos para habilitação futura (não realizados)

1. Escolher um projeto Google Cloud de propriedade da Mel/BC; habilitar Drive API e registrar cliente OAuth.
2. Usar `https://www.googleapis.com/auth/drive.file` e selecionar/autorizá-las no aplicativo. Alternativamente, criar uma pasta própria pelo aplicativo OAuth e migrar o destino após aprovação. **Não pedir nem compartilhar tokens no chat, GitHub ou JS público.**
3. Obter refresh token com `access_type=offline` e armazenar no **Supabase Edge Function Secrets**. Apps OAuth externas em **Testing** geralmente recebem refresh tokens com expiração de sete dias; avaliar status de publicação e requisitos de verificação antes de declarar o backup permanente.
4. Registrar estes secrets no servidor (valores abaixo são somente nomes):
   - `BC_DRIVE_BACKUP_RUN_SECRET`: segredo aleatório forte (pelo menos 32 caracteres), usado exclusivamente pelo acionador do servidor;
   - `BC_DRIVE_CLIENT_ID`, `BC_DRIVE_CLIENT_SECRET`, `BC_DRIVE_REFRESH_TOKEN`;
   - `BC_DRIVE_FOLDER_CLINICAL`, `BC_DRIVE_FOLDER_CLIENT`;
   - `BC_DRIVE_BACKUP_ENABLE_WRITES`: `false` até homologação; depois `true` com aprovação.
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` permanecem apenas no ambiente Supabase.
5. Só após testes com **arquivos fictícios** e aprovação, implantar a função com invocação interna protegida por `x-bc-backup-secret` (sem CORS) e agendar via Supabase Cron/Vault. Nunca chamar pelo navegador/site ou expor o segredo à Maia.
6. Conferir permissões de cada pasta e habilitar alertas de falha, conferência de hashes por restauração periódica e rotina de recuperação antes de declarar operação regular.

## Proteções nesta V1
- Sem modificações no site ou DB, sem envio de dados clínicos nesta branch.
- Bloqueio de uploads até `BC_DRIVE_BACKUP_ENABLE_WRITES=true`.
- Leitura exclusivamente pelo `service_role` **no servidor**, nunca no frontend.
- Exclusão defensiva de pastas com nomes financeiros; a V1 varre somente o bucket clínico.
- Nome dos arquivos no Drive anonimizado por hash do caminho e hash do conteúdo.
- Novo objeto para cada versão detectada, sem sobrescrever backups antigos.
- Lote de até 12 arquivos por execução, 12 MiB por arquivo, máximo de 3.000 nós. Exceder limites dispara alerta técnico; não declarar cobertura completa.
- A função não exporta dados de Postgres. **Registros financeiros, cadastros e dados clínicos que existam somente no banco não estão cobertos.** Backups SQL/PITR são outro projeto e exigem autorização/regras próprias.
- Não é cópia imutável, criptografia adicional no cliente ou disaster recovery completo; é uma cópia paralela privada sujeita às políticas e disponibilidade do Google Drive.
- Apenas Fernando e Mel têm acesso à conta de destino segundo confirmação expressa de 23/10/2026; revalidar permissões periodicamente. O papel de Fernando no aplicativo não concede automaticamente acesso irrestrito via interface da BC — o Drive é um repositório administrativo separado.

## Testes locais/CI

```bash
deno test supabase/functions/drive-backup/core_test.ts
deno check --config supabase/functions/drive-backup/deno.json supabase/functions/drive-backup/index.ts
```

Estas verificações cobrem regras de seleção e tipagem; **não** testam Google OAuth real, permissões das pastas, upload real ou restauração. Uma homologação E2E com dados fictícios ainda é obrigatória.

## Decisão para a próxima fase

A função fica sem implantação até que Fernando/Mel autorizem a integração OAuth diretamente no Google (sem enviar credenciais em conversa) e aprovem um teste controlado. O trabalho não deve afetar a rotina da Mel ou das colaboradoras.
