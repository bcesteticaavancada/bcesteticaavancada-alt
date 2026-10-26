# Apoio operacional e consentimento manual — desenho autorizado

Fernando delimitou apoio a novas colaboradoras, cadastro de pacientes e cópias documentais, com financeiro reservado à Mel. Confirmou “Exato” para assinaturas da profissional e cliente no app, PDF baixado/enviado manualmente, assinatura externa pela cliente e anexo do PDF devolvido. Não há integração ou validação automática GOV.BR nem nova exigência clínica. Textos dos TCLEs não são alterados nesta entrega.

Escolha: funções operacionais específicas com auditoria. Promover o perfil de criação para admin pleno abriria financeiro; usar login alheio perderia autoria. A identidade de criação permanece não clínica e não financeira.

## Ações

- Convite com nome/e-mail para uma nova colaboradora: papel fixo colaborador, sem gerenciar agendas/procedimentos e sem atender clientes até configuração pela Mel. Convite não altera conta existente e registra autora/origem.
- Pasta de apoio: corrigir nome, contatos, CPF/nascimento, endereço e responsável legal; sem arquivar cliente, mudar autoria ou reescrever documentos assinados. Atualização usa versão consultada para impedir perda de edição concorrente.
- Documentos: baixar PDF de anamnese/consentimento já emitido e com assinaturas primárias; anexar PDF devolvido vinculado ao consentimento original da mesma cliente, preservando os dois arquivos. Não liberar comprovantes, documentos financeiros ou toda a coleção de anexos externos ao perfil de criação.
- A profissional continua usando sua própria pasta clínica para colher assinaturas e gerar o PDF. A funcionalidade de apoio não assina ou libera procedimento em seu lugar.

## Segurança e dados

Um único endpoint servidor valida token e session_id real pertencente ao usuário, além do perfil atual. Somente service_role executa a nova RPC. Listas/edições têm projeções fixas e whitelist; não há SQL dinâmico vindo do cliente. Tabelas auxiliares privadas têm RLS e nenhum acesso bruto por anon/authenticated. Não mudar helpers clínicos/financeiros existentes.

O serviço guarda cópias novas com upsert=false, valida PDF e limite8MB, calcula hash e registra o vínculo de cliente/documento e a autoria em transação. Nomear origem como upload manual, sem declarar assinatura GOV.BR verificada. URL de download é temporária. Não gerar links permanentes para conteúdo clínico nem enviar arquivos automaticamente a terceiros.

## Interface

Preservar os três atalhos da gestão. Em Equipe, expor um formulário recolhido de convite. Em Clientes, botão Abrir cadastro abre diálogo com os dados básicos, campos opcionais recolhidos e PDFs permitidos. Cada arquivo original pode ser baixado para envio manual, e cada consentimento pode receber uma cópia devolvida. Mostrar sucesso/erro no contexto certo e manter os dados digitados em caso de falha.

## Critérios de entrega

Negar sessão revogada/inativa, papel colaborador no apoio administrativo, mudanças de role/permissões, dados financeiros e documento de outra cliente. Convite concorrente é reservado no banco e conta já existente não é tocada. Cobrir respostas atrasadas, gravação concorrente, rollback de registro e limpeza de upload. Testes não enviam e-mail real nem abrem prontuários reais. Uma revisão independente, CI, implantação e confirmação da versão publicada encerram a entrega.

Ajuste da revisão: convite por link pessoal gerado no servidor (createUser + generateLink), para cópia e envio manual pelo operador; sem envio SMTP. Recuperação limitada à conta nova marcada pelo servidor, ainda não confirmada nem utilizada; lease e finalização idempotente. Upload usa reserva privada, registro idempotente e descarte serializado. Atualização documental preserva rascunho cadastral e o contexto do paciente.
