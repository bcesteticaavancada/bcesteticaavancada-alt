# Ensaio real de cópia fictícia BC

Fernando autorizou nesta conversa o envio e a recuperação de arquivo fictício,
depois do consentimento Google e da confirmação das duas pastas. Backups
automáticos/documentos reais continuam fora desta etapa.

Escolha de implementação: função temporária dedicada, sem Storage ou tabelas
clínicas. Ler a credencial apenas dentro do servidor pelo RPC/Vault existente;
nunca retornar tokens. Reutilizar classificação/hash do backup e validação de
pastas do OAuth. Um PDF sintético, explicitamente TESTE DE FLUXO, terá duas
versões em cada destino autorizado. Repetição sequencial deve reutilizar cópias;
download deve ter SHA-256 igual ao original e preservar a versão anterior.

Alternativas: ativar o worker atual varreria documentos reais; copiar token ao
executor exporia credencial. Ambas rejeitadas. Nenhuma migration nova é necessária.

Acionamento por capacidade aleatória de 256 bits, prazo máximo de uma hora,
somente POST sem Origin e corpo fixo. Hash da capacidade no bundle; valor bruto
somente em arquivo temporário privado do executor. Nenhum caminho/arquivo do
chamador é aceito. Flag global de gravação deve continuar exatamente false.
Depois do ensaio, substituir função por resposta fechada, sem acesso ao Vault.

As quatro cópias pequenas e identificadas como teste serão preservadas para
conferência. O ensaio comprova provedor/Vault/Drive, não cobertura do bucket,
concorrência de workers, agendamento, backup de tabelas ou operação contínua.
