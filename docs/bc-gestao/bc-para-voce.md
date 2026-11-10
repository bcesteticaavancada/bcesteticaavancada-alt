# BC para Você

O portal da cliente usa os atendimentos e a agenda do BC Gestão. A cliente encontra o histórico, as fichas pós, os termos e as fotos liberadas para ela, além dos retornos, do canal de dúvidas e dos Pontos BC.

## Fundação em revisão

- O BC Gestão prepara um cadastro espelho quando Mel ou uma colaboradora salva uma nova cliente. O espelho guarda o vínculo com o cadastro interno e a data de preparação. O cadastro básico continua aceitando nome e telefone.
- **BC Gestão → Clientes → Resumo** mostra o estado da ativação, o total de pontos e o nível para a equipe clínica.
- A administradora configura quantos pontos cada procedimento concede na **Biblioteca de Procedimentos**. Zero desativa a concessão futura. O lançamento ocorre na conclusão, usa a regra daquele momento e tem o atendimento como chave. Reabrir e concluir a mesma ficha preserva o lançamento original.
- As regras comerciais começam vazias. Pontuação retroativa, validade dos cupons e benefícios reais dependem de uma definição da clínica. A prévia interativa usa cadastros e benefícios fictícios.

## Ativação da conta

1. A equipe confirma o contato com a cliente e emite um convite individual, temporário e de uso único.
2. A cliente abre o convite, confirma o contato e define a senha pessoal. O servidor vincula o identificador da conta à chave interna da cliente, com trilha de auditoria.
3. A entrada começa pelo e-mail verificado. Para aceitar CPF como identificador adicional, o servidor precisa resolver o CPF cadastrado sem revelar e-mail, existência de conta ou dados clínicos. Limitar tentativas e usar o contato verificado na recuperação.
4. Tratar e-mail compartilhado, alteração de contato, cadastro duplicado, menor com responsável e revogação. Liberar cada vínculo após verificação da equipe.

As identidades de clientes e as permissões da equipe têm fronteiras distintas. Cada consulta de documento, imagem, agenda ou mensagem deriva a cliente da sessão autenticada no servidor. O link temporário de agenda do primeiro rascunho tem escopo de horários.

## Do atendimento ao portal

| Ação no BC Gestão | O que aparece no portal |
|---|---|
| A clínica aprova o PDF pós de uma versão do procedimento | Modelo pronto para futuras conclusões daquela versão |
| A profissional finaliza o atendimento | Procedimento e data, PDF pós aprovado para a versão usada e Pontos BC configurados |
| A equipe libera um consentimento ou fotos do atendimento | Arquivos específicos daquele cadastro, conferidos novamente em cada download |
| A cliente solicita remarcação ou retorno | Pedido em análise até confirmação pela equipe no Gestão |
| A cliente envia uma dúvida | Conversa privada com a equipe clínica, vinculada à cliente e ao atendimento quando informado |

Vincular o PDF pós aprovado à versão do procedimento registrada naquele atendimento. Se a ficha pós ainda aguarda aprovação, mostrar esse estado e permitir liberação posterior. Orientações individualizadas entram como conteúdo próprio para a cliente. As fotos de antes e depois ficam privadas e precisam de autorização de compartilhamento. Os termos aparecem após a liberação pela equipe. Manter os arquivos em armazenamento privado, com autorização por item e acesso de curta duração.

## Pontos BC

| Procedimento | Pontos de exemplo |
|---|---:|
| Limpeza de pele | 50 |
| Peeling | 100 |
| Botox | 250 |

A clínica pode definir os pontos por procedimento levando em conta preço e margem. Uma alteração de tabela vale para as próximas conclusões. O preço do atendimento e o saldo de pontos são informações distintas.

| Nível | Pontos acumulados | Benefício de exemplo |
|---|---:|---|
| Em adesão | 0 a 999 | Acompanhamento do progresso |
| Bronze | 1.000 | Voucher de boas-vindas |
| Prata | 2.000 | Desconto em serviço elegível |
| Ouro | 4.000 | Sessão de massagem selecionada |
| Pérola | 6.000 | Crédito em cuidado selecionado |
| Diamante | 10.000 | Benefício exclusivo da linha Diamond |

Proposta para homologação comercial. Cada nível libera um voucher individual uma vez e a equipe confirma o resgate. Os pontos acumulados continuam contando para o nível após o resgate. Definir serviços elegíveis, validade e política de estorno antes de emitir cupons reais.

## Aceite em homologação

- Preparar dois cadastros fictícios pela mesma entrada usada no Gestão. Validar convite expirado, uso único, recuperação, arquivamento e troca de contato.
- Verificar que trocar o identificador de um atendimento, documento, foto ou conversa pela URL continua bloqueando o acesso cruzado. Conferir também o acesso às áreas internas com uma conta de cliente.
- Finalizar um Botox fictício com a regra de 250 pontos e a ficha pós aprovada. Conferir o PDF da versão certa, a pontuação e a mudança de nível. Reabrir e concluir novamente para checar a deduplicação.
- Testar o retorno com confirmação da equipe e a conversa privada nos dois perfis. Conferir o fluxo em celular antes de liberar o site.
