# BC Estética — Biblioteca de Procedimentos

Pasta principal das imagens e mídias dos cards de procedimentos.

## Subpastas
- `facial/` — procedimentos faciais
- `corporal/` — procedimentos corporais
- `bem-estar/` — bem-estar
- `autorais/` — protocolos autorais
- `videos/` — vídeos aprovados para a vitrine Protocolos 2.0
- `posters/` — posters WebP dos vídeos
- `familias/` — imagens próprias das famílias de tratamentos, quando disponíveis

## Padrão para imagens
Preferência por **WebP**, nomes em minúsculas, sem acentos e com hífens.

Exemplos:
- `bc-limpeza-de-pele.webp`
- `bc-harmonizacao-facial.webp`
- `bc-sculpt-cryo-abdomen.webp`

## Política de mídia da Protocolos 2.0

Cada tema visual usa `data-video-state` no HTML público:

- `pending` — o MP4 final ainda não foi aprovado ou não está presente no repositório. O card mostra apenas poster/imagem existente e nunca aponta para um arquivo de vídeo inexistente.
- `ready` — o arquivo final aprovado já existe no repositório. O `<video>` deve usar `muted`, `playsinline`, `preload="none"` e `<source data-src="...">` para carregamento progressivo.

Um card só pode mudar de `pending` para `ready` depois de confirmar que o arquivo referenciado existe no repositório e corresponde à mídia aprovada para aquele tema. Não reutilizar outro vídeo apenas para preencher espaço.
