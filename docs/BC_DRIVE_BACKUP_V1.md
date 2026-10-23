# BC Estética Avançada — backup paralelo Drive (rascunho revisado)

Data: 23/10/2026. Branch: `backup/drive-paralelo-v1`.

> **Sem implantação, publicação, agendamento, merge ou transferência clínica real.** O Supabase continua principal. Este código aceita somente homologação com arquivos fictícios.

## Estado e limites

O worker existente foi separado em regras (`core.ts`), adaptador Supabase REST (`source.ts`), transporte Drive (`drive.ts`), execução (`worker.ts`), manifesto/recuperação (`restore.ts`) e entrada de servidor (`index.ts`). O site e as políticas de acesso não foram alterados. Não há dependências externas no worker nem importação JSR necessária para executá-lo. O Deno de CI foi fixado em 2.9.6; compatibilidade com o runtime Supabase real ainda precisa de teste controlado.

| Controle | Valor atual |
| --- | --- |
| Escopo aceito | `test`; qualquer outro bloqueia antes de listar ou transferir |
| Origem permitida | Apenas `homologacao/drive-backup/` no bucket `bc-prontuario-private` |
| Escrita | Desligada por padrão; flag não habilita arquivos clínicos reais |
| Lote | Até 12 arquivos elegíveis por execução |
| Tamanho | Até 5.000.000 bytes por objeto (5 MB); bucket permite 8 MiB |
| Varredura Supabase | 3.000 itens de listagem, incluindo pastas; páginas de 100 |
| Varredura Drive | Até 12.000 arquivos e 120 páginas por pasta |
| Tempo | Orçamento total de 105 s; até 15 s por requisição; sem repetição automática de upload |
| Tipos | PDF, JPEG, PNG e WebP; metadados inválidos ou tipos desconhecidos não são enviados |

Estes são limites de proteção, não promessa de capacidade produtiva. Objetos/versões acumulados podem esgotar a varredura. A ativação clínica exige controle distribuído de concorrência, índice/filas persistentes, reavaliação dos limites, tratamento de falhas recorrentes sem travar a fila e aprovação. Esta revisão **não implementa** esses componentes e não oferece uma flag que contorne o bloqueio clínico.

## Proteções implementadas

1. Somente POST com segredo forte de servidor em `x-bc-backup-secret`. Sem CORS ou chamada pelo site/Maya. O adaptador restringe o projeto Supabase, recusa redirecionamentos e limita a leitura por streaming.
2. Inspeção sem OAuth, download de corpos ou upload. Somente metadados do namespace fictício; arquivos não suportados tornam a inspeção malsucedida e bloqueiam o lote inteiro antes de uploads.
3. Escopo Google estritamente `drive.file`. Antes de qualquer corpo de origem, valida as quatro pastas: proprietário `decolarbh@gmail.com`, permissões somente da conta proprietária e da Mel, conforme allowlist fechada de servidor, evidência de pasta gravável e subpastas diretamente ligadas à raiz. IDs devem ser distintos. Evidência ausente ou acesso amplo bloqueia.
4. Lista/pagina os destinos privados, usa SHA-256 de bucket/caminho como chave e nomes sem o nome/caminho original. Filtra nomes financeiros inclusive com acentos e separadores; apenas famílias conhecidas são elegíveis.
5. Cria objeto para conteúdo novo; não apaga ou substitui versões anteriores. Compara tamanho e `sha256Checksum` calculado pelo Google, não apenas um hash repetido em `appProperties`.
6. Cria manifesto JSON privado por versão com projeto, bucket, caminho original, chave, data da origem, ID Drive, MIME, tamanho e SHA-256. A recuperação exige SHA-256 do manifesto e chave de origem obtidos de referência confiável separada, nunca inferidos do próprio JSON entregue. O manifesto **contém informação necessária à restauração e pode conter identificadores sensíveis no caminho**; mantém-se privado, fora de logs/frontend. Hash no nome não anonimiza o conteúdo.
7. Marca a conclusão somente após objeto e manifesto verificados. Data alterada com conteúdo idêntico reutiliza a cópia. Falha após upload/manifesto/confirmação é reparada na próxima execução sequencial, sem duplicar o conteúdo já encontrado.
8. `restoreBytes` verifica a referência confiável do manifesto, identidade de origem, caminho permitido, projeto, tamanho e hash, e produz bytes de recuperação. Não grava no Supabase nem sobrescreve documentos. A restauração real ainda não foi executada.
9. Respostas contêm contadores e erro genérico, sem nome, caminho, credencial ou corpo de erro do provedor. Não há registro persistente de status ou alertas ativos.

## Evidência obtida sem ler documentos reais

Consulta de configuração e agregados de metadados do projeto `tpqsmerlxquyrzrjbogj`, em 23/10/2026:

- Bucket privado; limite de 8.388.608 bytes; tipos permitidos PDF/JPEG/PNG/WebP.
- Sete objetos: 1 PDF, 4 JPEG e 2 PNG. Nenhum ultrapassava 8 MiB; maior objeto com 2.527.450 bytes.
- Reconferência por família, sem nomes individuais: 1 em `documentos`, 3 em `arquivos-clientes`, 2 em `assinaturas`, 1 em `identificacao`. Nenhum corpo foi acessado; cobertura de todos os geradores ainda depende de homologação e inventário autorizado futuro.
- Metadados da raiz e das quatro subpastas do handoff indicam as duas contas autorizadas (proprietária e Mel), sem permissão pública na reconferência de raiz e destinos. Isso não comprova autorização do novo cliente OAuth e não garante que as permissões permaneçam iguais depois.

## Cobertura prevista pelo código do aplicativo

| Gerador/uso existente | Família de caminho | Destino futuro |
| --- | --- | --- |
| PDF de anamnese e documentos clínicos | `documentos/...` | Clínica |
| Ficha/rubrica de pré-anamnese | `pre-anamneses/...` | Clínica |
| Assinatura de documento | `assinaturas/...` | Clínica |
| Fotos de tratamento | `fotos-clinicas/...` | Arquivos de clientes, preservando a classificação existente na branch |
| Foto de identificação | `identificacao/...` | Arquivos de clientes |
| Anexos de cliente | `arquivos-clientes/...` | Arquivos de clientes |
| Cadastros, questionários, agenda e registros somente PostgreSQL | Tabelas | Fora da rotina |
| PDF somente baixado no navegador, sem persistência no bucket | Sem objeto persistido | Fora da rotina |
| Site, vídeos e Maya | Arquivos de mídia/repositório | Fora deste worker |
| Financeiro | Caminhos financeiros/tabelas | Fora da rotina; permissões intactas |

Na homologação, cada família elegível só é lida **dentro do prefixo fictício**. O inventário agregado não prova que todos os documentos da aplicação viram arquivos no bucket. Não há backup SQL/PITR ou garantia de recuperação completa da aplicação.

## Pastas de destino existentes

| Pasta | ID |
| --- | --- |
| Raiz privada | `1Ax1FUrgxpBdgHgBTsriMtQGYK37GMK_y` |
| 01 — Documentos clínicos | `1cnahFxCbJH06YBEAJkaqTqEIdgcwwE0Y` |
| 02 — Arquivos de clientes | `1A8xBkQ7ws5pElNqIRNTASXeBnttOu97N` |
| 03 — Site/Maya/mídias, fora deste worker | `1rR9CfdXLVPZZSkyYDv2tPk3jlj4RMyAQ` |
| 04 — Manifestos/relatórios | `1s7LTdxb24dDYpzdHThKIEAEFdwwvmfjh` |

A pasta antiga “BC Estética” não foi usada nem teve permissões alteradas. O problema de compartilhamento público relatado no handoff continua como tarefa separada.

## Execução local e CI sem rede

```bash
deno task --config supabase/functions/drive-backup/deno.json test
deno task --config supabase/functions/drive-backup/deno.json check
deno task --config supabase/functions/drive-backup/deno.json fmt
npm test
```

Os testes do backup não recebem permissões Deno de rede, ambiente, leitura ou escrita. Usam somente conteúdo fictício em memória e transporte HTTP simulado. Não requerem nem aceitam credenciais reais. A suíte testa envio/retorno binário, manifesto, hash, versões, repetição, paginação, limites, autenticação, privacidade e interrupções. Ela não substitui teste com os provedores reais.

## Homologação real futura — execução manual e isolada

Pré-requisitos: concluir a preparação descrita em `BC_DRIVE_OAUTH_PREPARACAO.md`, aprovação específica para implantar em ambiente reservado e confirmação de que o namespace contém apenas material fictício. Se o ambiente for compartilhado, não incluir dados reais no teste. Somente uma execução por vez, sem scheduler.

1. Criar PDF/PNG fictício, sem dado pessoal, em `homologacao/drive-backup/documentos/cliente-ficticio/`. Registrar hash/tamanho localmente no relatório reservado.
2. Com escrita desligada, confirmar contadores da inspeção e ausência de uploads. Validar também namespace vazio e tipo/tamanho indevidos.
3. Com aprovação para um envio de teste, autorizar explicitamente as quatro pastas no novo cliente OAuth, verificar privacidade e habilitar escrita somente de teste.
4. Enviar uma versão, baixar a cópia/manifesto pelo ambiente reservado e conferir SHA-256, bytes, tamanho, pasta, permissões e caminho de recuperação. Não usar documento real como amostra.
5. Executar novamente: nenhuma cópia adicional; alterar só metadados: reutilização; alterar bytes: nova versão e preservação da anterior.
6. Testar falha de autorização, indisponibilidade e interrupção depois do objeto/manifesto. Confirmar reparo e que nenhuma resposta/log contém segredo ou caminho.
7. Executar `restoreBytes` em cópia de teste, fornecer o digest confiável registrado separadamente e a chave de origem esperada, conferir corrupção detectada e recuperar para destino de homologação separado, sem sobrescrever a origem. Registrar evidências. Desligar escrita e suspender acionador ao terminar.

Para produção, obter aprovação final de Fernando e Mel depois de resolver concorrência, fila persistente, cobertura/inventário completo, status/alertas e política de restauração/retenção. Drive não é cópia imutável: as contas com permissão de edição podem modificar ou excluir arquivos. Manter referência de integridade independente e testar restauração periodicamente.

A redução de 8 MiB para 5 MB no worker segue a orientação de multipart da [API Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads). Objetos entre 5 MB e 8 MiB bloqueiam o lote: transporte resumível e teste real de capacidade continuam pendentes. Nenhum objeto do inventário agregado excedeu 5 MB. Respostas JSON têm limite de leitura e busca Drive incompleta é recusada.
