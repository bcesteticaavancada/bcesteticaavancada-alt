# Incorporação da revisão da Mel

Recebido de Fernando em 26/10/2026. Documento de origem: **Maya Respostas aprovadas pela Mel.docx**, revisão datada de 25/10/2026. A declaração inicial e os 67 pareceres aprovam o conteúdo. O documento não contém comentários ou alterações controladas.

SHA-256 do original: `54832998ef2b37da0d788bc1cb629a7ce5fe100369401f3af861604d80f4d8ff`.

## Alterações realizadas

- Substituídos os textos dos 65 itens pelas versões finais da Mel, preservando perguntas e identificadores.
- Incluídos os complementos `botox-conforto` (item 02a) e `massagem-desportiva-agendamento` (item 17a), com vínculo aos respectivos assuntos. São 67 respostas e 229 gatilhos.
- Atualizadas as respostas de funcionamento para terça a sábado, das 9h às 19h, e confirmação dos pré-pedidos pelo WhatsApp. Isso atualiza o conteúdo da Maya; não altera a configuração operacional da agenda.
- Pedidos de agendamento/oferta de massagem desportiva ou esportiva encontram a resposta de que a BC não realiza esse serviço, inclusive quando a biblioteca estiver indisponível. Nesse caso é usado o mesmo texto aprovado do item 17a, evitando a orientação genérica para agendar.
- Mantidas as regras do documento sobre respostas ao assunto perguntado, ausência de travessões e envio de dados clínicos somente pela área própria. Os textos finais não incluem o termo ou o nome de aparelho retirados pela Mel.
- Removido somente o fragmento isolado `Mo` ao final de uma frase do item 04. Nenhuma outra afirmação clínica foi reescrita nesta incorporação.
- Registrados autoria, data, item de origem e aprovação de conteúdo. O [manifesto de aprovação](maya-mel-aprovacao-2026-10-25.json) guarda os hashes das perguntas e respostas finais para detectar alterações posteriores.
- Schema atualizado para 3. A biblioteca exige os metadados de revisão e continua com `publication_approval=false`, inclusive por item. A aprovação dos textos não libera publicação ou novos perfis.
- Referências e notas do dossiê anterior foram preservadas como histórico. A interface as identifica como contexto anterior, sem atribuir automaticamente sua classificação científica às novas formulações.
- Preservadas as orientações de consulta para criação e as restrições financeiras. O texto adaptado ao perfil é identificado separadamente do texto de origem revisado pela Mel.

## Validação

Baseline retomada: 870 testes aprovados. Após a incorporação: **885 testes aprovados**, sendo 69 de anamnese, 133 do site e 683 da gestão, sem falhas. O subconjunto de Maya e sessão possui **73 testes**, incluídos nesse total.

Novos casos verificam fidelidade aos 67 pareceres, origem/data da aprovação, vínculo dos complementos, horário/WhatsApp, indisponibilidade de massagem desportiva, metadados incompletos, separação entre aprovação e publicação e manutenção do bloqueio de perfil de paciente. Casos novos falharam contra a biblioteca antiga antes da implementação. As 67 perguntas e os 229 gatilhos foram exercitados, com 296 correspondências corretas.

O script de navegador passou a conferir também as duas regras operacionais revisadas e a falha de biblioteca para serviço indisponível. A homologação no ambiente hospedado e em dispositivos físicos continua separada dos testes com fixtures. Consulte os checks do último commit do PR #63 para a execução Chromium/WebKit.

## Pendências e autorização

A pendência de revisão dos textos pela Mel foi atendida pelo documento enviado. Continuam pendentes a validação de uso da Beta pela equipe, sessões no ambiente hospedado com dados fictícios, aparelhos físicos e decisão sobre acesso ao JSON estático no repositório público.

Esta atualização não modifica Supabase, dados reais, backup, permissões financeiras ou páginas públicas. Não faz merge na principal nem publica a Maya. Fernando e Mel ainda precisam autorizar o lançamento após a homologação e a definição de privacidade.
