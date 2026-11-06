# Black Friday da Beleza — preparação da campanha

Status: rascunho visual. O convite real ainda será enviado por Fernando.

A página inicial recebe um bloco após os diferenciais, com identidade preta e dourada,
chamada para o grupo VIP e aviso sobre a visibilidade do número dos participantes.
O botão permanece desativado, com “Grupo VIP em breve”, enquanto o link não chega.
Não há preços, percentuais, contagem regressiva ou ofertas ainda não aprovadas.

## Conectar o grupo e revisar a publicação

1. Receber o convite real e confirmar com Fernando que pertence ao grupo da campanha.
2. Validar HTTPS e o domínio exato `chat.whatsapp.com`, sem autenticação ou redirecionador intermediário.
3. Substituir o botão desativado por `<a class="bc-black-friday-cta">`, preservando o texto.
   Usar o convite validado como `href`, `target="_blank"`,
   `rel="noopener noreferrer"` e `aria-describedby="black-friday-privacy"`.
4. Remover o aviso “Grupo VIP em breve” e o comentário de preparação do HTML.
5. Conferir a tela de convite no Android, iPhone e computador, sem adicionar ninguém automaticamente.
6. Fernando e Mel configuram os administradores, as regras de entrada e o envio de mensagens no WhatsApp.
7. Revisar o diff e os testes; publicar somente após a aprovação da versão com o convite real.

O link do grupo estará público no HTML da página. Não usar um grupo com finalidade clínica.
Um clique no botão abre o convite; a entrada é confirmada pela própria pessoa no WhatsApp.
O site não copia mensagens, não identifica participantes e não verifica filiação ao grupo.

## Sequência editorial proposta

| Fase | Publicação |
| --- | --- |
| Pré-Black Friday | Apresentar o grupo, a equipe e os cuidados oferecidos pela BC. |
| Aquecimento | Compartilhar novidades e condições específicas aprovadas pela Mel. |
| Black Friday | Divulgar as ofertas finais, suas condições e como falar com a equipe para agendar. |
| Encerramento | Encerrar a chamada ou adaptá-la para a próxima campanha, após decisão da clínica. |

Mensagem inicial sugerida:

> Bem-vinda ao grupo VIP da Black Friday da Beleza da BC Estética Avançada!
> Por aqui, nossa equipe vai compartilhar as novidades e condições exclusivas da campanha.
> Para dúvidas ou agendamentos, fale com a BC no atendimento particular.

As condições comerciais, os procedimentos e as datas de início e encerramento serão definidos pela Mel.
As novidades serão publicadas manualmente no WhatsApp. Não há integração paga ou disparos automáticos.

## Verificação e recuperação

Executar as regressões existentes do site e conferir o bloco em larguras de 320, 390, 768 e 1440 px.
Conferir a navegação, a agenda e a pré-anamnese existentes.
Verificação executada: `npm run test:site`, 133 testes aprovados, sem falhas.
O ambiente impediu a renderização local no navegador; a revisão visual permanece pendente.
Ainda pendentes: revisão visual responsiva, convite real e teste de abertura no WhatsApp.

Para desfazer somente esta campanha, reverter o commit que a adiciona.
O escopo inclui `index.html`, `black-friday.css` e esta documentação; não altera o banco.
