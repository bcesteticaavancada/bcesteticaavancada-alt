# Ensaio fictício — 24/10/2026

Autorização: Fernando respondeu “Pode seguir autorizado” à proposta de envio e
recuperação de arquivo inteiramente fictício. Não há liberação de backup real.

Checkout isolado backup/drive-homologacao-ficticia-v1; a branch de origem,
documentos e vídeo de outros trabalhos foram preservados. Implementação direta
do plano técnico já autorizado, sem reabrir a escolha genérica de execução.

RED: módulo core.ts inexistente. GREEN: dez testes HTTP com a lógica real e
somente provedores externos substituídos. Primeira tipagem detectou a anotação
genérica de Uint8Array/BlobPart; corrigido com buffer próprio, sem cast.

Revisão independente read-only: nenhum Critical ou Minor; um Important no hash
do download após decodificação UTF-8, que removia BOM. RED reproduzido: resposta
alterada com BOM ainda retornava sucesso. Corrigida leitura limitada dos bytes
 brutos; a verificação posterior passou onze testes e tipagem.

Não há promessa de unicidade concorrente ou disponibilidade imediata da
indexação Drive. Ensaio executado somente de forma sequencial, sem retry
automático de chamadas externas. Quatro fixtures identificadas podem permanecer
nas duas pastas para conferência; nenhum rollback apaga arquivos alheios.

GREEN final: 11/11 testes, tipagem e suíte geral 784/784. Ensaio real retornou
HTTP 200 nas duas chamadas: primeira created=4/reused=2; segunda created=0/reused=6.
PDFs com 729 bytes e hashes idênticos ao recuperar. Quatro IDs de teste preservados.
Fonte implantada v1 comparada integralmente. Em seguida implantado closed.ts
como v2/verify_jwt=true e conferida fonte única sem imports. Capacidade antiga
recusada com 401; arquivos privados do gatilho removidos. Oito hashes anteriores
inalterados e worker automático ausente. Nenhum dado real ou configuração global
foi alterado. CI/PR e relatório são registros do ensaio, não ativação de produção.
