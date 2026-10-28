# Maya V2 — expressões e movimentos

Fernando autorizou avançar à segunda das três versões em 28/10/2026, após a V1 2D. Divisão recuperada: V1 visual 2D; V2 expressões e movimentos; V3 assistente interativa avançada. A V2 será entregue para avaliação em branch própria, com prévia independente; publicação da nova versão permanece separada.

## Intenção e abordagem

Ampliar a presença visual atual sem redesenhar a personagem ou alterar a operação da Maya. Usar os mesmos SVG, CSS e estados já existentes: respiração leve, piscadas espaçadas, cabeça atenta, espera, sorriso e aceno breves. Expressões de boca são visuais; não representam fala ou microfone.

SVG/CSS locais são a escolha técnica do agente: permitem reaproveitar o desenho e não acrescentam dependências. Sequências de imagens aumentariam o peso e separariam expressões do desenho atual. Serviços de avatar/voz não pertencem a esta V2.

## Comportamento

- `ready`: respiração suave, piscadas e leve atenção da cabeça; aceno inicial curto.
- `thinking`: respiração/piscadas, cabeça levemente inclinada, boca neutra e indicador de consulta atual.
- `answered`: sorriso discreto e movimento breve de confirmação da orientação, sem sugerir que uma ação foi executada.
- `unavailable`: boca neutra, sem sorriso ou confirmação; status de tentativa recuperável já existente.
- Movimento manualmente pausado, preferência de movimento reduzido e página oculta interrompem todas as novas animações. A expressão estática e o texto continuam informativos.
- Dimensões e controles atuais preservados em 320 px, tablet e desktop; nenhuma área clicável recebe sobreposição.

## Limites

Somente colaboradoras ativas continuam autorizadas. As 67 respostas da Mel e os 16 guias, autenticação, perfis, dados, financeiro e Drive permanecem intactos. Sem voz, microfone, API paga, modelo novo, consultas a clientes ou execução de operações. Não mesclar/publicar a V2 nesta etapa. A prévia deve declarar que é demonstração visual e funcionar sem conta ou conexão.

## Aceite

Testar CSS e SVG realmente renderizados em Chromium/WebKit: movimentos ativos, boca neutra na espera/falha, sorriso na resposta, ausência de animações durante pausa/redução/aba oculta, retomada e largura de 320 px. Reexecutar a suíte Node e as regressões existentes de concorrência visual, limpeza e sessão. Entregar branch/PR em rascunho e uma prévia clicável, identificando o que ainda depende de avaliação em celulares físicos.
