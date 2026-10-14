# BC Estética — Biblioteca de Procedimentos

Pasta principal das imagens e mídias dos cards de procedimentos.

## Organização existente
- `facial/` — procedimentos faciais já organizados nessa categoria
- `corporal/` — procedimentos corporais já organizados nessa categoria
- `bem-estar/` — bem-estar
- `autorais/` — protocolos autorais
- `catalogo/` — imagens do catálogo histórico e referências visuais
- `miniaturas/` — miniaturas já existentes no projeto

## Mídias da Protocolos 2.0

Vídeos e posters aprovados usados pela vitrine da página de Protocolos ficam **diretamente em `assets/procedimentos/`**, sem criar subpastas extras só para `videos` ou `posters`.

Exemplo aprovado atual:
- `botox.mp4` — vídeo final de Toxina Botulínica
- `botox.webp` — poster WebP correspondente

Para novas mídias, prefira o mesmo padrão simples de nomes: `<tema>.mp4` e `<tema>.webp`, sempre em minúsculas, sem acentos e com hífens quando necessário.

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
