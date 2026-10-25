# Backup automático privado — ativação autorizada em 24/10/2026

Fernando solicitou explicitamente ativar o backup automático após a homologação
real de quatro PDFs fictícios. A autorização cobre implantar e agendar cópias
reais dos arquivos do bucket `bc-prontuario-private` nas duas pastas já
consentidas. Não cobre financeiro, tabelas de clientes/prontuários, compartilhamento
público, mudanças de papéis ou exportação desses dados para o ambiente local.

## Abordagem e decisões de implementação

Usar a Edge Function `drive-backup`, a conexão OAuth existente no Vault e
Supabase Cron/pg_net. O aplicativo e o navegador não participam das execuções.
Um acionador externo acrescentaria outra credencial e dependência; executar no
navegador dependeria de uma sessão aberta. O caminho de servidor já planejado
é adotado. A frequência de uma hora é decisão de implementação, comunicada
ao usuário. Não foi prometido tempo real.

O servidor verifica novamente conta, escopo `drive.file`, proprietário e
permissões das duas pastas em cada execução. Destinos fixos são os de
`_shared/drive-oauth/protocol.ts`. Apenas decolarbh e Mel são permitidos.
O refresh token sai do Vault somente dentro da Edge Function.

**Controle de ativação definitivo:** `private.bc_drive_backup_control.enabled`,
protegido por RLS, ausência de grants e lease. O mesmo controle bloqueia o acionador
e todas as operações do journal. A variável Edge `BC_DRIVE_BACKUP_ENABLE_WRITES`
da preparação fica como guard do antigo fluxo de teste OAuth; não controla o
worker V2. Este ajuste elimina dois estados de configuração divergentes e permite
ativar/pausar pelo conector administrativo já autorizado, sem sessão do dashboard.
Foi decidido durante a implementação, após o login web não ter sido concluído;
nenhuma credencial/permissão é obtida ou ampliada por esse ajuste.

## Controle e integridade

Cada acionamento gera um ticket aleatório de uso único, válido por dois minutos.
Seu hash e validade ficam em tabela privada; a RPC interna o consome atomicamente.
O pg_net transporta somente esse ticket descartável, não a credencial OAuth nem
uma chave permanente. Não aparece em Git, outputs, chat ou frontend.
RLS e ausência de grants bloqueiam usuários nas tabelas privadas. A RPC pública
é apenas adaptador PostgREST, invoker, EXECUTE exclusivo de service_role.

Lease de dez minutos e prazo total de 110 segundos impedem sobreposição.
Por execução: no máximo 3.000 nós, 12 objetos novos/alterados e 12 auditorias,
12 MiB por objeto. O lote enumera antes de copiar; raiz desconhecida o bloqueia.
Financeiro é excluído mesmo em subpastas. Falhas e limites aparecem em contadores,
nunca em logs com nomes, caminhos, tokens ou conteúdos. Dois cursores independentes
avançam nos itens tentados, inclusive nas falhas, para cópia e auditoria. O journal
é consultado apenas pelas chaves atuais, em respostas de até 100 registros.

Cada versão de conteúdo recebe ID do Drive previamente reservado em um journal
privado, antes do upload. Uma repetição utiliza esse mesmo ID, inclusive depois
de timeout ou falha de confirmação. Nenhuma versão é substituída ou apagada.
Download da cópia e SHA-256 dos bytes crus confirmam cada versão; auditorias
rotativas revalidam cópias existentes. O journal associa caminho original,
hash, ID e versão para recuperação administrativa. Não exportar o journal no chat.

## Implantação e limites

Código e SQL serão testados e terão uma revisão independente antes da
implantação. Implantar inicialmente com o controle DB desligado. Após
conferir bundle e privilégios, habilitar o controle DB e
cron horário; disparar primeira execução e repetição pelo mesmo acionador.
Persistir apenas evidências agregadas. Manter rollback que desabilita o controle
e o cron sem apagar nenhuma cópia.

O Google ainda estava em Testing na configuração inicial: o refresh token pode
expirar em sete dias. Ativação operacional não significa conexão permanente.
Falha de renovação deve ser registrada; publicar o app Google e reautorizar é
uma etapa administrativa distinta se ainda necessária.

O pg_net usa uma fila pertencente à plataforma. A tentativa inicial de REVOKE
não removeu os grants que pertencem a supabase_admin; a verificação real detectou
isso antes de qualquer acionamento. Por isso o protocolo foi reduzido para tickets
descartáveis. Um operador SQL que lesse a fila poderia tentar antecipar a mesma
execução permitida enquanto o ticket ainda estivesse válido, mas não obteria
credenciais de Google/Supabase nem uma autorização reutilizável. O endpoint aceita
somente a ação fixa e os destinos já consentidos. Nenhum papel de aplicação possui
login SQL direto. A fila não é usada para transportar documentos.

Backups do banco SQL/PITR, mídias do site e desastre completo não são entregues
por esta rotina. Não mesclar as branches de preparação inteiras em main.
