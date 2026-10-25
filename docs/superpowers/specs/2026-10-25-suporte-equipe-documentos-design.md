# Apoio operacional — equipe, cadastro e documentos

Estado: levantamento concluído; ampliação de acesso e novo fluxo documental ainda não implementados. Falta definir com Fernando o momento obrigatório da assinatura GOV.BR antes de fechar o desenho dos bloqueios clínicos.

## Pedido e escopo

Fernando restringiu a próxima etapa a adicionar colaboradoras e ajudar em questões gerais do site: editar cadastro de paciente, abrir sua pasta em necessidade de suporte, disponibilizar cópias e acompanhar as fichas imprescindíveis de procedimentos. Metas e métricas ficam fora desta etapa. O financeiro continua restrito à Mel.

## Situação conferida em 25/10/2026

Consulta somente a metadados e à biblioteca de procedimentos no projeto atual; nenhum prontuário individual foi aberto e nenhuma conta foi alterada.

- Existem 30 procedimentos ativos, todos com versão publicada, exigência de anamnese e orientações pré/pós registradas. Os módulos específicos possuem campos estruturados.
- Existem termos-base para as classes não injetável e injetável/invasivo, com versão2 publicada. Versões anteriores permanecem no histórico.
- Cinco procedimentos têm complemento específico no consentimento: Botox terço superior, Botox full face, Botox Nefertiti, Harmonização Facial / Preenchimento e Bioestimulador. Os outros25 não têm suplemento específico e usam o termo-base da classe. Isso não significa ausência total de ficha; a suficiência clínica dos textos deve ser revisada pela responsável técnica antes de novas publicações.
- O consentimento interno coleta assinatura gráfica na tela da cliente/responsável e da profissional e pode gerar PDF. A assinatura gráfica não é declarada equivalente à assinatura digital GOV.BR.
- A pasta aceita PDF, JPEG, PNG e WebP de até8MB, com título, categoria, origem e data opcional. Upload registra SHA-256 e utiliza armazenamento privado, sem sobrescrever o arquivo.
- Há categoria TCLE externo e origem GOV.BR. O vínculo como consentimento exige PDF da mesma cliente, não anulado, compatível com o atendimento e revisado pela própria profissional responsável, antes de iniciar o procedimento.
- Hoje o bloqueio clínico aceita consentimento interno finalizado OU TCLE externo compatível. Não existem duas etapas obrigatórias sucessivas tela → GOV.BR.
- A origem GOV.BR é declarada no upload. Não foi encontrada validação criptográfica GOV.BR/ITI no fluxo de arquivos, nem ligação da cópia assinada ao documento original por signed_copy_of_document_id. O hash de armazenamento comprova integridade dos bytes registrados, não autentica por si só a assinatura digital.
- A área admin_criacao permanece de consulta: ainda não oferece edição de paciente, convite de colaboradora ou download clínico. O endpoint antigo de manutenção de identidade foi encerrado com HTTP410; não constitui gestão permanente de equipe.

Evidências no código: gestao/js/anamnese-controller.js, treatment-panel.js, client-documents-panel.js, client-files-api.js, clinical-documents-api.js; supabase/migrations/20261014014000_bc_gestao_external_consents.sql; supabase/functions/staff-identity-maintenance/index.ts. A biblioteca/colunas e funções pertinentes foram confirmadas por consultas somente de leitura ao banco.

## Abordagem recomendada

Permissões operacionais específicas no perfil de criação, com funções próprias e auditoria. Torná-lo administrador pleno incluiria acesso financeiro; compartilhar a conta de outra profissional perderia a autoria do suporte. Nenhuma dessas alternativas atende ao pedido.

### Equipe

- Convidar exclusivamente colaboradoras, com entrada e definição de senha pela própria titular.
- Nenhuma atribuição de perfil administrador ou alteração do acesso da Mel/Fernando por esta tela.
- Operação privilegiada de Auth somente no servidor, sem chave secreta no navegador e sem endpoint temporário reaproveitado.
- Registrar quem convidou e a titular destinatária. Não enviar convite sem a ação explícita correspondente.

### Pacientes e apoio

- Abrir a pasta com a conta própria de Fernando; não assumir a identidade da paciente nem a da profissional.
- Editar dados cadastrais autorizados com registro de antes/depois. Não reescrever dados congelados de documentos assinados.
- Apoio urgente registra motivo, sem autorizar assinatura, avaliação clínica ou desbloqueio de exigências clínicas no lugar da profissional.
- Disponibilizar cópias clínicas permitidas, com confirmação da cliente/destinatário. Controles financeiros permanecem excluídos. Arquivos externos não devem ganhar acesso irrestrito apenas por estarem anexados.

### Fichas e assinatura GOV.BR

1. Profissional revisa o conteúdo e a versão da ficha/TCLE do procedimento e esclarece as dúvidas da cliente.
2. Cliente/responsável e profissional assinam na tela; documento é fechado e PDF original preservado.
3. Profissional baixa e entrega o PDF à cliente para assinatura no serviço oficial GOV.BR, com a conta da própria cliente.
4. O PDF digital assinado é devolvido. Conferir identidade do signatário e a validação no serviço oficial ITI. Recebido não equivale a verificado.
5. Anexar os bytes originais do PDF assinado como uma nova cópia vinculada à cliente, ao atendimento e à versão do documento de origem; guardar autoria, data e resultado da conferência. Preservar o PDF anterior e os dois hashes, que naturalmente diferem.
6. Manter a sequência visível e simples: assinatura na tela → aguardando GOV.BR → recebido → conferido. Não regenerar, editar, comprimir ou imprimir em PDF a cópia já assinada digitalmente.

O documento de ciência dos riscos do procedimento deve ser identificado como Termo de Consentimento Livre e Esclarecido (TCLE). Uma avaliação de risco cirúrgico, quando indicada e apresentada, é outro documento clínico; não é o nome genérico do consentimento estético. Textos específicos devem descrever o procedimento efetivamente planejado e passar pela responsável técnica, sem prometer resultado nem criar exoneração de responsabilidade.

Para assinaturas devolvidas após o encerramento, a solução precisa preservar o atendimento imutável e registrar a cópia como documento posterior; não retroagir consentimento nem modificar a versão original assinada.

## Decisão pendente

GOV.BR deve ser exigido antes de iniciar o procedimento, ou será uma confirmação documental complementar após a assinatura na tela? A resposta define se existe bloqueio clínico adicional ou apenas acompanhamento de pendência documental. O sistema atual não foi alterado nessa matéria.

## Próxima execução, após fechar essa decisão

Primeiro implementar convites e apoio cadastral com permissões e auditoria; depois vincular cópias assinadas e estados de conferência. Testes de acesso devem negar criação de administrador, dados financeiros, assinatura por terceiros e troca de documento entre clientes. Testes documentais devem preservar os bytes do PDF e o atendimento encerrado. Não exigir uma integração automática ao GOV.BR para o fluxo manual funcionar.

## Fontes oficiais consultadas

- [Assinatura Eletrônica — Governo Digital](https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica): conta prata/ouro; baixar pelo serviço, sem imprimir para PDF; validação no ITI.
- [VALIDAR — ITI](https://validar.iti.gov.br/).
- [Guia de Atuação Segura — CFBM](https://cfbm.gov.br/guia-para-atuacao-segura-da-biomedicina-estetica/): referência institucional para revisão pela responsável técnica. O arquivo completo do guia não pôde ser obtido nesta sessão; não é declarado como revisão clínica concluída.

Este documento registra levantamento e proposta técnica; não certifica conformidade clínica/jurídica de todos os termos e não libera novas permissões.
