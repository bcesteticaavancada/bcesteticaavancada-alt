# BC para Você

O portal da cliente usa os atendimentos e a agenda do BC Gestão. A cliente encontra o histórico, as fichas pós, os termos e as fotos liberadas para ela, além dos retornos, do canal de dúvidas e dos Pontos BC.

## Fundação em revisão

- O BC Gestão prepara um cadastro espelho quando Mel ou uma colaboradora salva uma nova cliente. O espelho guarda o vínculo com o cadastro interno e a data de preparação. O cadastro básico continua aceitando nome e telefone.
- **BC Gestão → Clientes → Resumo** consulta automaticamente o estado da ativação, o total de pontos, o nível, o progresso até o próximo e a quantidade de créditos pendentes de revisão. Há também botão para atualizar.
- A administradora configura quantos pontos cada procedimento concede na **Biblioteca de Procedimentos**. Zero desativa a concessão futura. O lançamento ocorre na conclusão, usa a regra daquele momento e tem o atendimento como chave. Reabrir e concluir a mesma ficha preserva o lançamento original.
- As regras manuais começam vazias. O cálculo misto foi preparado com uma chave de homologação **desligada por padrão**, e não credita automaticamente após aplicar a migration até aprovação expressa de ativação. Regras manuais anteriores continuam válidas. Pontuação retroativa, resolução de créditos pendentes, validade dos cupons e benefícios reais dependem de definição da clínica. A prévia interativa usa cadastros e benefícios fictícios.

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

## Pontos BC — escala comercial proposta para homologação

**Modelo misto aprovado para preparação de homologação:** 1 Ponto BC por R$ 1, arredondado para o inteiro mais próximo. Em procedimentos de valor fixo, a referência é o preço-base congelado na ficha. Nos serviços com valor “a partir de”, a referência passa a ser o preço final confirmado na ficha. Por exemplo: R$ 190 gera 190 pontos, R$ 990 gera 990 e um valor final de R$ 2.990 gera 2.990. O número de pontos não equivale a reais resgatáveis ou cashback.

Os valores abaixo são os **valores-base do catálogo inicial do repositório**, não uma confirmação dos preços atuais praticados pela clínica. Na Biblioteca de Procedimentos, a tela administrativa organiza as sugestões do menor para o maior valor. A administradora pode manter o cálculo misto, definir uma exceção manual ou desativar o crédito do procedimento com uma regra manual de zero ponto. **A ativação global automática permanece desligada até o corte homologado.** Nas linhas **“a partir de”**, os pontos da tabela são somente referência do mínimo: o crédito real depende do preço final confirmado. Alterações de preço não mudam eventos já concedidos.

| Procedimento | Valor-base do catálogo | Pontos sugeridos |
|---|---:|---:|
| Tratamento de Vasinhos | R$ 180 | 180 |
| Limpeza de pele | R$ 190 | 190 |
| Reset Glow™ | R$ 190 | 190 |
| Jato de Plasma | a partir de R$ 190 | 190 |
| Massagem (relaxante, drenagem ou redutora) | R$ 195 | 195 |
| Peeling | a partir de R$ 195 | 195 |
| Limpeza de pele com peeling | R$ 219 | 219 |
| Despigmentação | a partir de R$ 250 | 250 |
| Remoção a Laser | a partir de R$ 250 | 250 |
| Black peel | R$ 390 | 390 |
| Aplicação de enzimas | a partir de R$ 390 | 390 |
| Fort Brow™ | R$ 390 | 390 |
| Lipo de Papada | a partir de R$ 390 | 390 |
| Tratamento para Estrias | a partir de R$ 390 | 390 |
| Fort Hair™ | R$ 490 | 490 |
| Microagulhamento | a partir de R$ 490 | 490 |
| Radiofrequência / criofrequência fracionada | a partir de R$ 490 | 490 |
| Skinbooster | a partir de R$ 490 | 490 |
| Sculpt Cryo™ | R$ 590 | 590 |
| Botox Nefertiti | R$ 690 | 690 |
| Monaco Glow™ | R$ 890 | 890 |
| Botox terço superior | R$ 990 | 990 |
| Fort Hair Plus™ | R$ 990 | 990 |
| Harmonização Facial / Preenchimento | a partir de R$ 990 | 990 |
| Profhilo | R$ 990 | 990 |
| Ultrassom microfocado | a partir de R$ 990 | 990 |
| Bioestimulador | a partir de R$ 1.390 | 1.390 |
| Botox full face | R$ 1.390 | 1.390 |
| Skin Reset™ | a partir de R$ 1.990 | 1.990 |
| Face Reset™ | a partir de R$ 2.990 | 2.990 |

Quando o preço-base for gratuito ou não estiver definido, não sugerir pontos. A Mel poderá usar zero para impedir concessão ou aprovar uma regra específica. A atualização de uma regra vale somente para os próximos atendimentos finalizados, e a pontuação concedida em cada conclusão permanece registrada.

### Motor automático misto e salvaguardas

1. A migration `20261111165430_bc_para_voce_mixed_points_homologation.sql` acrescenta `private.bc_para_voce_program_settings` com `automatic_enabled=false` e `effective_at=null`. Não há habilitação automática, nem publicação ou SQL no projeto produtivo nesta etapa.
2. Uma regra manual por procedimento tem prioridade (inclusive zero, que desativa o crédito). Sem override, o modelo misto só calcula pontos após o programa ter sido habilitado e atingido a data efetiva aprovada. A remoção da regra manual restaura o modelo misto, **não** ativa o programa global.
3. O crédito acontece na transição de atendimento clínico para `finalizado`, em trigger no banco, com uma chave única por atendimento. Isso evita duplicação em reconclusões, sem confiar em pontuação enviada pelo navegador.
4. O registro guarda pontos concedidos, fonte do cálculo, preço de referência usado e versão da política. Preço ausente/inválido fica marcado `pending_price`; ciclos com `cycle_key` ficam `pending_cycle` (ambos com zero até revisão), evitando multiplicar pontuação de pacote.
5. O resumo interno mostra a soma dos créditos e conta as pendências. Dados financeiros e registros clínicos não ficam disponíveis publicamente; a área externa ainda depende de autenticação da cliente.
6. Não há conversão automática de pendências, estorno, cálculo retroativo ou resgate real nesta etapa. Definir um procedimento de conciliação de recebimentos, pacotes e estornos antes de ativar produção.

Para homologação no banco **isolado**, o teste `bc_para_voce_mixed_points.test.sql` habilita temporariamente a flag em uma transação revertida por `ROLLBACK` e verifica valor fixo, final variável, falta de preço, ciclo, reconclusão, permissão e restauração da regra mista. Não executar esse teste contra dados reais.

| Nível | Pontos acumulados | Benefício de exemplo |
|---|---:|---|
| Em adesão | 0 a 999 | Acompanhamento do progresso |
| Bronze | 1.000 | Voucher de boas-vindas |
| Prata | 2.000 | Desconto em serviço elegível |
| Ouro | 4.000 | Sessão de massagem selecionada |
| Pérola | 6.000 | Crédito em cuidado selecionado |
| Diamante | 10.000 | Benefício exclusivo da linha Diamond |

**Progressão pretendida:** Bronze equivale a aproximadamente seis limpezas de R$ 190 ou uma sessão acima de R$ 1.000; Prata exige mais 1.000 pontos após Bronze; Ouro mais 2.000; Pérola mais 2.000; Diamante mais 4.000. Assim, uma cliente de serviços menores avança por recorrência, enquanto uma cliente de serviços avançados progride proporcionalmente ao valor, sem receber benefícios monetários automaticamente. Os limiares são cumulativos, nunca reiniciam entre níveis. Esta é uma proposta a calibrar após conhecer frequência real de visitas, margem e orçamento de recompensas.

Proposta para homologação comercial. Cada nível prevê um voucher individual uma vez e a equipe confirma o resgate. Os pontos acumulados continuam contando para o nível após o resgate. Definir serviços elegíveis, validade, política de estorno, elegibilidade por campanha e custo máximo dos benefícios antes de emitir cupons reais. A interface administrativa sugere as 30 pontuações e apresenta o modo misto; a ativação automática global e os cupons continuam bloqueados.

## Aceite em homologação

- Preparar dois cadastros fictícios pela mesma entrada usada no Gestão. Validar convite expirado, uso único, recuperação, arquivamento e troca de contato.
- Verificar que trocar o identificador de um atendimento, documento, foto ou conversa pela URL continua bloqueando o acesso cruzado. Conferir também o acesso às áreas internas com uma conta de cliente.
- Finalizar um Botox fictício com a regra de 250 pontos e a ficha pós aprovada. Conferir o PDF da versão certa, a pontuação e a mudança de nível. Reabrir e concluir novamente para checar a deduplicação.
- Em outra sessão fictícia, habilitar a flag somente no PostgreSQL isolado e comprovar: valor fixo usa base; “a partir de” usa valor final; sem preço/ciclo não credita; reconclusão não duplica; colaboradora não altera política; o BC Gestão mostra pendências.
- Revisar a tabela real de preços com a Mel, definir se o Monaco Glow e outros protocolos representam pacote ou sessão, conferir política de devolução, regras de resgate e data efetiva. Manter o motor automático desativado até esse aceite.
- Testar o retorno com confirmação da equipe e a conversa privada nos dois perfis. Conferir o fluxo em celular antes de liberar o site.
