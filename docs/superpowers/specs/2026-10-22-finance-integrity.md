# Integridade financeira — quatro defeitos reproduzidos

Autorização: corrigir os defeitos em ordem, mantendo o perfil Admin de Criação sem financeiro. A revisão mostrou base financeira vazia; não criar operações reais para testar.

FIN01: a primeira parcela não define a cobrança. Usar obrigação existente inequívoca (inclusive apenas vinculada à agenda) ou o preço da versão assinada do atendimento finalizado. R$600 com entrada R$100 permanece parcial e deixa R$500. Recusar total ausente, cobrança ambígua e recebimento acima do saldo. Estorno mantém o valor original e recalcula sob bloqueio do pagamento.

FIN02: reenvio da mesma tentativa deve retornar o mesmo recebimento, mesmo após perda da resposta; tentativa diferente não deve ser confundida. Chave obrigatória no novo protocolo; mesmo identificador com conteúdo/autor diferente é recusado. Tentativas pendentes sobrevivem ao recarregamento sem armazenar dados pessoais ou financeiros. Clientes antigos recebem orientação para atualizar a página.

FIN03: livro vinculado a lote de repasse ativo precisa ter esse lote estornado antes de revisão/recálculo. Proteger também estados inconsistentes anteriores. Depois do estorno, recalcular e formar novo lote com o novo valor.

FIN04: baixa exige livros fechados, da mesma profissional e soma igual ao lote. Revisão, vínculo ausente ou divergência impede toda a operação; preservar auditoria e autorização administrativa.

Fluxo de caixa com despesas, conciliação e exportação ao contador não está implementado; estas correções estabilizam a base existente, sem criar um módulo contábil novo.
