# Apoio operacional — equipe, cadastro e documentos

Estado: levantamento concluído e fluxo manual esclarecido por Fernando em25/10/2026. Ampliação de acesso ainda não implementada. O app coleta as assinaturas, gera o PDF e recebe a cópia devolvida; a assinatura GOV.BR ocorre externamente, por iniciativa da própria cliente.

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
- A origem GOV.BR é declarada no upload. Não foi encontrada validação criptográfica GOV.BR/ITI no fluxo de arquivos, nem ligação da cópia assinada ao documento original por signed_copy_of_document_id. O hash de armazenamento comprova integridade dos bytes registrados, não autentica por si só a assinatura digital. A ausência de integração/validação automática não é um defeito a corrigir neste escopo manual confirmado.
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

### Consentimento: assinaturas no app e devolução manual

Fluxo confirmado por Fernando:

1. A profissional revisa a ficha de consentimento do procedimento e esclarece as dúvidas da cliente.
2. Cliente/responsável e profissional assinam na tela do aplicativo.
3. O app gera o PDF com essas assinaturas. A profissional baixa o arquivo e o encaminha manualmente à cliente.
4. A cliente assina o PDF pelo GOV.BR, fora do aplicativo, baixa o documento assinado e o devolve à clínica.
5. A profissional ou o apoio autorizado anexa o PDF devolvido à ficha da mesma cliente. Preservar o PDF gerado pelo app e a cópia devolvida como arquivos separados, com autoria e data de anexação.

O documento é um Termo de Consentimento Livre e Esclarecido (TCLE), com informações e riscos do procedimento. A revisão dos conteúdos específicos continua sob a responsável técnica.

O escopo do aplicativo termina em gerar/baixar o PDF e receber/guardar o anexo devolvido. Não desenvolver integração, login, API, validação automática, consulta a GOV.BR/ITI, assinatura em nome da cliente nem envio automático. Não introduzir bloqueio do atendimento ou acompanhamento obrigatório de etapas GOV.BR. A origem declarada de um anexo não deve ser apresentada como verificação automática de assinatura.

Para cópias devolvidas após o encerramento, preservar o atendimento e os documentos originais imutáveis; anexar o arquivo como registro posterior, sem retroagir datas nem modificar a versão assinada.

## Definição encerrada

Fernando esclareceu que a assinatura externa é uma etapa manual da cliente. A pergunta anterior sobre tornar GOV.BR obrigatório antes do procedimento foi retirada do escopo. Permanecem as regras clínicas já existentes do aplicativo; nenhuma exigência GOV.BR nova deve ser criada.

## Execução delimitada

Implementar os convites e o apoio cadastral autorizados com permissões e auditoria. Na parte documental, priorizar a simplicidade das ações já descritas: assinar no app, baixar/enviar o PDF e anexar a cópia devolvida. Testes de acesso devem negar criação de administrador, dados financeiros, assinatura por terceiros e troca de documento entre clientes. Testes documentais devem preservar os bytes dos dois arquivos e o atendimento encerrado. Qualquer integração automática a GOV.BR/ITI está fora desta entrega.

## Fontes oficiais consultadas

- [Assinatura Eletrônica — Governo Digital](https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica): conta prata/ouro; baixar pelo serviço, sem imprimir para PDF; validação no ITI.
- [VALIDAR — ITI](https://validar.iti.gov.br/).
- [Guia de Atuação Segura — CFBM](https://cfbm.gov.br/guia-para-atuacao-segura-da-biomedicina-estetica/): referência institucional para revisão pela responsável técnica. O arquivo completo do guia não pôde ser obtido nesta sessão; não é declarado como revisão clínica concluída.

Este documento registra levantamento e proposta técnica; não certifica conformidade clínica/jurídica de todos os termos e não libera novas permissões.
