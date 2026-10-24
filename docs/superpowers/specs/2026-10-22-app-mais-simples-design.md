# BC Gestão — revisão para uma rotina mais simples

Data: 22/10/2026. Status: proposta concreta para revisão de Fernando; não implementada.

Base examinada: main 71a2d87024f6f161bdca7b111035ad270325f65c, árvore d86ad08e9a084cda3cee9654cb086b78346e8ca0. Consulta ao banco ativo somente para leitura de estrutura e contagens. Nenhuma regra financeira, conta, atendimento ou tela de produção foi alterada nesta revisão.

## O que Fernando pediu

Menos etapas e menos informação simultânea. Agenda, sessão e financeiro devem conversar sem repetir o lançamento. Mel precisa enxergar o valor devido à profissional e marcar quando pagou. Método de pagamento e comprovante são opcionais. Uma despesa simples deve poder ser registrada e entrar no resumo baixado pela Mel. As telas e palavras devem ser comuns à equipe; permissões, autoria clínica, habilitações e valores individuais continuam separados.

## O que a revisão encontrou

| Área | Evidência atual | Ajuste proposto |
|---|---|---|
| Financeiro da Mel | Oito blocos simultâneos, cinco formulários e 17 campos, antes dos itens dinâmicos | Uma visão com resumo, comissões pendentes e lançamentos. Formulários abrem só ao tocar na ação correspondente. |
| Comissão | Depende de fechar livro semanal, criar lote e depois dar baixa | Valor calculado a cada recebimento e pagamento direto pela Mel, sem exigir fechamento semanal. |
| Configuração | Zero regras de comissão ativas no banco | Mel informa uma vez os percentuais realmente combinados; nenhum percentual será presumido. |
| Valores da colaboradora | Reprodução isolada: R$60 já pagos aparecem também como R$60 “A receber” | “A receber” soma apenas o que permanece pendente; “Pago” soma pagamentos válidos. |
| Valores da Mel | Reprodução isolada: livro fechado com R$60 devidos, sem lote, mostra R$0 em aberto | Toda comissão devida aparece imediatamente; criar lote deixa de ser pré-requisito. |
| Sessão | Formulário operacional antigo e prontuário formal coexistem como caminhos de registro | Um único caminho “Atender”, usando o agendamento e o prontuário formal. Histórico antigo permanece consultável. |
| Agenda e clientes | Formulários de novo agendamento e novo cadastro permanecem expostos | Lista/calendário primeiro; “Novo agendamento” e “Novo cliente” abrem os campos quando necessários. |
| Cadastro | Nome/telefone já bastam, mas CPF, nascimento, e-mail e complementos continuam expostos | Mostrar nome e telefone primeiro, com “Completar cadastro” para o restante. Pendência opcional não parece impedimento para agendar. |
| Pré-anamnese | Recepção em área separada, exigindo voltar ao cadastro | Pendência acessível no contexto da cliente/agenda; o vínculo continua explicitamente confirmado para evitar associação errada. |
| Configurações | Identificação profissional aparece em Procedimentos; auditoria e manutenção disputam espaço com a rotina | Equipe, comissões, catálogo e histórico de alterações ficam em Configurações. |
| Inicialização | Painéis ocultos são carregados em sequência; falha no financeiro pode impedir a instalação da atualização das outras áreas | Cada área carrega quando aberta e informa sua própria falha, preservando as outras e os campos em edição. |
| Site público | Onze links principais; “Agendar” e “Agendamento” levam a caminhos diferentes | Um destino principal “Agendar”, com navegação agrupada e fichas/vídeos acessíveis no contexto. Preservar URLs existentes. |

Na consulta desta revisão havia zero pagamentos, recebimentos, livros, repasses e ciclos cadastrados. Isso facilita a transição, mas a implantação deve conferir novamente esse estado e preservar qualquer registro surgido depois.

## Caminho recomendado

Reaproveitar agenda, prontuário, recebimentos, autenticação e proteções já testadas; simplificar o que as pessoas fazem e substituir a dependência obrigatória dos livros semanais para comissões novas.

A alternativa de apenas esconder formulários reduziria a poluição visual, mas manteria a obrigação de fechar semanas e criar lotes. Ela não entrega a ação direta de pagamento pedida por Fernando. Não é a opção recomendada.

## A rotina proposta

| Ação da equipe | O sistema faz |
|---|---|
| Agendar cliente | Reaproveita cadastro, profissional e procedimento; não registra dinheiro recebido. |
| Tocar em “Atender” | Abre ou continua o prontuário correto, com os dados do agendamento preenchidos. |
| Concluir e assinar a sessão | Registra uma única cobrança pelo valor final da sessão, visível como “A receber da cliente”. |
| Confirmar “Cliente pagou” | Usa o saldo preenchido; registra uma única entrada e calcula a comissão combinada. “Receber outro valor” permite parcela. |
| Mel tocar em “Marcar como pago” | Confirma profissional e total já exibidos, registra o pagamento e atualiza os dois painéis. Não realiza transferência bancária. |
| Mel lançar despesa | Pede descrição e valor; data vem preenchida com hoje. Método, observação e comprovante são opcionais. |
| Mel tocar em “Baixar resumo” | Baixa o resumo do período com entradas, comissões pagas, demais despesas e totais. |

**Regra proposta para validação:** a sessão concluída gera valor a receber; comissão a pagar nasce sobre o dinheiro confirmado como recebido, inclusive proporcionalmente em parcelas. Criar um procedimento no catálogo ou apenas reservar um horário não significa receita recebida. Essa distinção cabe em rótulos simples, sem outro formulário contábil.

“Cliente pagou” nunca vem confirmado automaticamente. Concluir a sessão reaproveita o valor, mas exige uma confirmação explícita para registrar entrada de dinheiro; se ainda não recebeu, o valor permanece a receber.

O valor do procedimento vem da sessão final assinada. Avaliações gratuitas não geram cobrança fictícia. Atendimento com valor desconhecido permanece com pendência de valor; não se inventa cobrança nem comissão. Ausência de configuração financeira não bloqueia o registro clínico.

## Como ficará o financeiro

Uma página, começando pelo mês atual:

- Resumo: Entradas, Saídas e Saldo do período. “Saldo” significa entradas menos saídas registradas, não saldo de conta bancária nem lucro.
- “Comissões a pagar”: uma linha por profissional, com total pendente e ação “Marcar como pago”. Abrir a linha mostra sessões, valores e datas.
- “Pagas”: histórico consultável, sem misturar com o valor ainda devido.
- “Lançamentos”: recebimentos e despesas; detalhes se abrem quando solicitados.
- Ações: “Nova despesa”, “Baixar resumo” e “Configurar comissões”, esta última em menu secundário.

Não haverá exigência de ciclo 7/15/30, escolher livro, fechar semana, criar lote ou recalcular para pagar uma comissão nova. O total geral pendente não depende do filtro usado para consultar um histórico; seleção para pagamento mostra claramente quais valores serão quitados.

Na confirmação do pagamento, data de hoje e total já vêm prontos. Método de pagamento e anexo não são obrigatórios. Comprovante pode ser acrescentado depois. Falha no envio do arquivo não transforma um pagamento já salvo em “não pago”; a mensagem oferece nova tentativa somente do anexo.

Cada colaboradora vê “Minha comissão”: valores pendentes, pagos e histórico próprio. Percentuais internos e valores de outras pessoas não entram na sua resposta de dados. Fernando permanece sem consultas, exportações ou comprovantes financeiros.

Configuração inicial: manter a combinação profissional/procedimento já suportada, oferecendo aplicar o mesmo percentual aos procedimentos autorizados de uma profissional em uma ação. Exceções são abertas somente quando necessárias. Mudanças futuras não recalculam valores anteriores silenciosamente. Quando faltar uma regra, a Mel vê “Definir comissão”; não apresentar zero como se já estivesse acordado.

## Navegação e interação comuns

- Acesso diário: Agenda, Clientes e Financeiro/Minha comissão, conforme o papel. Configurações fica em segundo plano.
- Um botão principal por tarefa: Agendar, Atender, Concluir, Confirmar recebimento ou Marcar como pago.
- Mesmos nomes e disposição em celular e tablet; diferenças resultam das permissões e do procedimento, não de versões divergentes da mesma tarefa.
- Cliente, sessão, profissional e valor são reaproveitados entre áreas. Ao salvar, os painéis envolvidos se atualizam sem apagar formulários em edição.
- Prontuário mostra a etapa atual; consentimentos, alertas, assinatura e dados específicos continuam obrigatórios quando aplicáveis, sem várias seções abertas ao mesmo tempo.
- Itens de estoque, equipamentos, fotos e documentos aparecem dentro da sessão/cliente quando pertinentes; não se cria um novo caminho obrigatório para cada setor.
- O perfil de criação usa a mesma linguagem e organização, mantendo apenas as projeções operacionais autorizadas.

Site público, depois do financeiro: concentrar ações em Agendar e WhatsApp; agrupar conteúdo em Tratamentos, Resultados e Equipe/Clínica. Vídeos, ambientes e perfil da Mel permanecem acessíveis dentro desses grupos. Login continua acessível. O calendário já pedido para a home e para a página de agendamento é preservado; ambos usam as mesmas regras e disponibilidade. Não apagar páginas, mídias ou alterar o NFC nesta revisão.

## Relatório simples para baixar

Período escolhido, identificação da clínica configurada no sistema, entradas confirmadas, comissões efetivamente pagas, demais despesas pagas, estornos identificados e totais. Saídas não incluem comissão apenas prevista. Comissão paga entra como saída uma única vez, sem exigir lançamento manual duplicado. Datas e valores do relatório conferem com o mesmo período mostrado na tela, usando America/Sao_Paulo.

Oferecer PDF simples e CSV. O resumo não contém prontuário, diagnóstico ou conteúdo clínico. Documentos fiscais não são inventados quando não cadastrados. O título é “Resumo financeiro do período”; não prometer declaração fiscal enviada, integração bancária ou entrega automática ao contador.

## Base técnica necessária, sem novas etapas para a equipe

1. Criar a cobrança ao concluir a versão assinada, com vínculo único à sessão e ao atendimento. Repetir a confirmação não duplica valor nem substitui o total pela parcela.
2. Registrar comissão por movimento de recebimento, com percentual e valor congelados internamente. Nova leitura administrativa agrupa pendentes; leitura individual omite percentuais. Regra ausente gera pendência explícita para configuração administrativa.
3. Pagamento direto seleciona os itens realmente exibidos e calcula o total no servidor, com chave de tentativa e bloqueios transacionais. Se o valor mudou, pedir revisão do total em vez de quitar algo diferente do que foi mostrado. Uma comissão não pode integrar dois pagamentos válidos.
4. Recebimento parcial, estorno e correção permanecem auditáveis. Alterar regra de comissão não muda pagamento já realizado. Correções administrativas ficam em ação secundária com confirmação, sem formulário de recálculo na rotina.
5. Despesas manuais têm criação sem duplicidade, dados mínimos e acesso administrativo. Pagamento de comissão gera sua saída automaticamente. “Marcar como pago” registra a confirmação da Mel, não movimenta conta bancária.
6. Anexos financeiros ficam em armazenamento privado próprio, com acesso validado por registro; não herdam as permissões do prontuário. Mel e a destinatária podem consultar o comprovante do pagamento correspondente. Criação e outras colaboradoras não podem acessar.
7. As tabelas e RPCs antigas não são apagadas. Novas comissões não dependem de fechamento por semana, que impediria receber normalmente após pagar no meio do período. Históricos antigos continuam conciliáveis, sem dupla cobrança ou dupla comissão entre os dois modelos. Se surgirem movimentos antes da implantação, validar uma estratégia explícita de transição antes de ativar a rotina nova.
8. O carregamento de cada painel e a atualização entre áreas devem ter tratamento próprio de falha. Sessão, autorização e proteção contra dados antigos continuam centrais; um erro financeiro não impede usar Agenda/Clientes.

## Ordem para executar sem ampliar demais o trabalho

1. Financeiro simples integrado à conclusão/recebimento: valores corretos, comissão automática e pagamento direto com comprovante opcional; eliminar o segundo caminho de registro da sessão e apresentar a ação contextual.
2. Despesa mínima e resumo para baixar, usando os mesmos movimentos da tela.
3. Limpeza de Agenda/Clientes e configurações, com a mesma navegação por papel e sem perder o contexto.
4. Ajustar navegação pública sem mudar links existentes nem iniciar redesenho de identidade visual.

Cada etapa deve ser validada separadamente antes de publicar a seguinte. Não adicionar conciliação bancária, nota fiscal, integrações contábeis, permissões por exceção ou módulos novos fora do pedido.

## Verificação antes de publicar

- Marcar uma comissão como paga exige no máximo dois toques a partir da lista de pendentes: escolher o pagamento e confirmar o total já preenchido. Baixar o resumo mensal padrão exige uma ação a partir do financeiro.
- Sessão, cobrança, entrada, comissão e pagamento mantêm vínculos únicos mesmo com clique duplo, rede interrompida ou duas operações simultâneas.
- Sessão concluída e ainda não recebida não aumenta Entradas nem comissão disponível para pagamento.
- Parcela de R$100 em uma cobrança de R$600 preserva saldo de R$500; a comissão considera somente os R$100. Exemplos de percentual em testes são fictícios.
- Pagar no meio da semana não bloqueia novos recebimentos daquela profissional e não exige fechar outra semana.
- Pagamento concluído zera os itens quitados em “A receber”; itens surgidos depois continuam pendentes. A visão administrativa inclui todo valor devido, sem depender de lote.
- Comprovante ausente não impede pagar; envio que falhou pode ser repetido sem repetir o pagamento.
- Cobrança, comissões e despesas não entram duas vezes no resumo; os totais de tela, PDF e CSV conferem, incluindo estornos e limites do período.
- Colaboradora só consulta seus valores e comprovantes; criação continua sem financeiro; autoria clínica e habilitações continuam exigidas no servidor.
- Agenda/Clientes continuam utilizáveis quando outra área falha; alterações se propagam sem perder campos preenchidos.
- Conferência em celular e tablet mede a tarefa inteira, não apenas a presença dos botões. Não usar pacientes ou pagamentos reais como dados de teste.

## Situação desta entrega

Revisão de código, estrutura e produção realizada; dois resumos enganosos reproduzidos com dados fictícios em DOM isolado. Documento revisado quanto a escopo, duplicidade financeira, privacidade e compatibilidade. A proposta aguarda a revisão de Fernando antes de alterar os fluxos e o cálculo em produção.
