# Convite Diamond em tela inteira

Pedido de Fernando em 6 de novembro de 2026: ampliar a foto para preencher o fundo da página, dar uma apresentação glamourosa e oferecer um link de divulgação para o WhatsApp.

A implementação mantém `/diamond/` como destino único. A fotografia original do casal passa a ocupar todo o viewport, atrás das duas seções, com enquadramento responsivo, aproximação lenta e iluminação dourada. Gradientes sobre a foto preservam a leitura e os botões. A imagem original permanece intacta no repositório; o enquadramento de fundo usa `cover`.

O movimento é feito em CSS, sem vídeo, áudio ou novas dependências. Há controle nativo para pausar e retomar, inclusive sem JavaScript. A preferência do sistema por movimento reduzido mantém o fundo parado. O convite do grupo e o conteúdo comercial existente permanecem iguais.

O botão Compartilhar convite no WhatsApp abre um rascunho com uma mensagem e o endereço público da página. O envio e a escolha dos destinatários são feitos pela pessoa; o site não envia mensagens. Os metadados Open Graph apresentam uma capa PNG de 1536 × 864 e aproximadamente 237 KB. O movimento pertence à página aberta, não à imagem da prévia do aplicativo; a exibição da prévia depende do WhatsApp e das configurações de quem compartilha.

Validação: regressão geral; fundo cobrindo 320, 390, 768 e 1440 px em Chromium/WebKit; ausência de rolagem horizontal; foto carregada; movimento reduzido; pausa e retomada; links nativos com JavaScript desativado; destino do compartilhamento passando pelo site. O resultado e a publicação são registrados no PR desta alteração. Não há alterações de banco, autenticação, informações clínicas ou financeiro.

Referências: [Open Graph](https://ogp.me/) e [WhatsApp — link com mensagem preenchida](https://faq.whatsapp.com/5913398998672934).
