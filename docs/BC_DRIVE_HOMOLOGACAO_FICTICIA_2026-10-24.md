# BC — cópia e recuperação fictícia no Google Drive

**Resultado: aprovado nas duas pastas autorizadas.** Execução real em 24/10/2026,
run `b37e00b1-c2b2-4bdc-93aa-8564ca73c177`. Fernando autorizou o ensaio após
concluir o consentimento Google e a confirmação das duas pastas.

## O que foi comprovado

| Verificação | Resultado real |
| --- | --- |
| Acesso ao token pelo RPC/Vault, somente dentro do servidor | Aprovado |
| Renovação OAuth e conta Google correta | Aprovado |
| Duas pastas e arquivos com permissões privadas esperadas | Aprovado |
| PDF gerado sem dados reais, duas versões em cada destino | 4 arquivos de 729 bytes |
| Repetição da primeira versão na primeira execução | 2 reutilizações, sem cópia extra |
| Segunda execução completa | 0 arquivos novos, 6 reutilizações |
| Download dos PDFs e SHA-256 sobre bytes brutos | Idêntico aos originais |
| Versão anterior após criar a seguinte | Preservada e recuperável nas duas pastas |
| Chamada sem capacidade de teste | HTTP 403, antes de acessar credenciais |
| Fechamento do acionador temporário | Bundle fechado v2, JWT exigido; capacidade antiga recusada com HTTP 401 |

Os dois relatórios JSON em `docs/evidence/drive-rehearsal-...-first.json` e
`...-second.json` guardam IDs, hashes, tamanhos e contadores; não contêm tokens.
As quatro cópias permanecem identificadas por `TESTE_BC_BACKUP_...` para conferência.

## Arquivos fictícios preservados

| Destino | Versão | ID Google Drive | Bytes |
| --- | --- | --- | ---: |
| Documentos clínicos | 1 | `1lhDud2Nag2SjbMLxn25eE5Ileci1zYIF` | 729 |
| Documentos clínicos | 2 | `1xXlhRNgeraiqym9YI-Tgl9zkIaMfYjdf` | 729 |
| Arquivos de clientes | 1 | `1ktc8Jsz7IdftsT7WQ-7JSUMvdUUGkUuv` | 729 |
| Arquivos de clientes | 2 | `1yz9LFXODZzljzWPSmX8erIsF7fQaI1LP` | 729 |

SHA-256 da versão 1, tanto original quanto recuperada:
`bf5beaecf064f916a86431bbf491843b1276e0b9611f0400a909508678ffc0c4`.
SHA-256 da versão 2, tanto original quanto recuperada:
`802ac5acfcbe77dbbffb248d4edc774e2279923144047ecb94f53acc9a3138e0`.

## Implementação e fechamento

Uma função separada gerou somente PDFs marcados **TESTE DE FLUXO — SEM VALIDADE
CLÍNICA**. Não aceita caminhos, conteúdo ou pastas do chamador, não consulta
Storage nem tabelas clínicas e exige que a flag geral de gravação continue false.
Capacidade aleatória de 256 bits com prazo de 30 minutos; valor bruto somente em
arquivo temporário privado, eliminado depois do bloqueio final. O bundle de
execução foi recuperado pelo conector e comparado integralmente ao revisado.

Após as duas execuções, a função `drive-backup-rehearsal` foi substituída por
`closed.ts`, sem imports, Vault, credenciais ou rede, e com verify_jwt=true.
Código recuperado confirmou o fechamento. SHA-256 do bundle final:
`c37758657503ebdbeaefe1aefa36865d0348514515480a0fdfdd819c8ba53678`.
Os oito bundles preexistentes mantiveram seus hashes. O worker `drive-backup`
continua ausente. Nenhuma migration, agendamento ou permissão financeira mudou.

## Validação do código

11 testes do ensaio, tipagem dos três módulos e 784 testes gerais aprovados.
Revisão independente identificou uma falha no hash após decodificação UTF-8:
um BOM poderia ser normalizado. Teste RED reproduziu sucesso indevido; leitura
limitada de bytes brutos corrigiu o problema e os 11 testes passaram. A execução
real foi feita somente depois dessa correção. Não houve outros achados críticos
ou importantes pendentes para este ensaio específico.

## Limites e próxima etapa

Este resultado homologa Vault/OAuth/Drive com dados sintéticos e chamadas
sequenciais. Não homologa a varredura do bucket, leitura de documentos reais,
concorrência de workers, envio retomável, cobertura de tabelas, agendamento,
alertas ou operação contínua. Não há retry automático em falhas ou timeouts.
O aplicativo OAuth ainda está em Testing, conforme a configuração anterior.

O backup automático permanece desligado. Próxima etapa: adaptar/revisar o worker
de produção para usar Vault e os destinos consentidos, validar seleção/cobertura
sem transferir dados reais e preparar a ativação específica. Não ampliar o
escopo Google nem copiar a raiz/manifestos sem autorização. A varredura do bucket
e transferências clínicas reais não foram executadas neste ensaio.

Fontes primárias usadas na preparação: documentação Google de
[uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
e [busca de arquivos](https://developers.google.com/workspace/drive/api/guides/search-files).
