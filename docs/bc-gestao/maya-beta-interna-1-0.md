# Maya Beta Interna 1.0

Atualizado em 26/10/2026. Desenvolvimento no PR #63, sem merge na principal ou publicação da Maya no site.

## Estado atual

Fernando enviou o documento **Maya Respostas aprovadas pela Mel.docx**, com revisão de 25/10/2026 e parecer de aprovação para os 65 itens e dois complementos. Os textos foram incorporados à biblioteca, totalizando 67 respostas. Esta atualização substitui a situação anterior de revisão pendente; não autoriza publicação, atendimento a clientes ou ações sobre dados reais.

[Incorporação da revisão da Mel](maya-mel-incorporacao-2026-10-26.md) registra origem, alterações, testes e pendências. O [relatório de 25/10](maya-pr63-revisao-2026-10-25.md) permanece como histórico das correções anteriores.

## Objetivo e funcionamento

A Maya é um guia interno para orientar o uso do BC Gestão e consultar explicações pré-escritas sobre estética. A página `gestao/maya-beta/` reutiliza `getCurrentProfile` e `installSessionGuard`, permitindo somente perfis ativos `admin`, `colaborador` e `admin_criacao`.

- As respostas são escolhidas localmente, sem IA generativa ou serviço pago.
- As 65 perguntas originais mantêm seus identificadores. Os complementos tratam de conforto durante a aplicação de Botox e da indisponibilidade de massagem desportiva na BC.
- São 12 itens de aplicativo e 55 informativos, incluindo orientações gerais da clínica. Conforme o documento, os itens de aplicativo se destinam à equipe atual; eventual área de pacientes permanece futura e não foi criada.
- O nome `respostas-65.json` foi mantido por compatibilidade com os caminhos existentes. O conteúdo usa schema 3, com 67 itens, autoria e data de revisão e aprovação de publicação ainda falsa.
- As 29 referências do dossiê anterior e suas notas foram preservadas como contexto histórico. Os textos finais da Mel não recebem automaticamente a classificação científica dos textos antigos.
- A interface diferencia texto revisado pela Mel de orientação adaptada às permissões do perfil de criação.

## Limites de acesso e privacidade

A Maya não consulta clientes, prontuários, agendas, arquivos ou valores. Não cria reservas, registra atendimentos, assina documentos, envia mensagens ou altera permissões. O perfil de criação recebe orientação de consulta e permanece sem acesso financeiro; colaboradoras são direcionadas somente à comissão já permitida no aplicativo.

A sessão é revalidada ao responder, após carregar a biblioteca e nas interações de consulta. Resultados pendentes são descartados após limpar conversa, fechar biblioteca ou revogar acesso. Erros de autenticação apresentam uma orientação recuperável.

Perguntas não são persistidas pela Maya nem repetidas no histórico; o campo é esvaziado. O filtro reduz a exposição acidental, mas não detecta todos os dados pessoais. A equipe deve usar somente perguntas sem dados reais.

O repositório GitHub é público: arquivos da branch podem ser consultados no GitHub. Login e `noindex` não tornam o JSON privado; após eventual deploy estático, o arquivo também será acessível diretamente pelo site. Uma entrega estritamente interna exige solução autenticada no servidor ou decisão explícita sobre quais conteúdos podem ser públicos.

## Homologação antes da publicação

1. Confirmar o Site CI do último commit, incluindo os testes específicos da Maya em Chromium e WebKit.
2. Conferir o uso dos textos revisados com Mel e equipe, em sessões reais de homologação e somente dados fictícios.
3. Validar login, expiração, troca de conta/papel e inativação no ambiente hospedado.
4. Testar Android e iPhone físicos, teclado, zoom, leitor de tela, busca e retorno à gestão.
5. Definir privacidade e público dos conteúdos. A aprovação dos textos não altera as políticas de acesso.
6. Obter aprovação explícita de Fernando e Mel antes de merge e publicação.

## Próxima autonomia

Permanecem propostos os guias por tarefa, atalhos permitidos por perfil e sugestões de assuntos quando a pergunta for ambígua. A alimentação deve usar conteúdos revisados; conversas e dados clínicos não viram conhecimento automaticamente.
