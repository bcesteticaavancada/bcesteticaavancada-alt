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

Mídias aprovadas atuais:
- `botox.mp4` — vídeo final de Toxina Botulínica
- `botox.webp` — poster WebP correspondente
- `bioestimulador.mp4` / `bioestimulador.webp` — versão de 30 s com o áudio fornecido pelo usuário
- `black-peel.mp4` / `black-peel.webp` — versão científica narrada completa
- `despigmentacao.mp4` / `despigmentacao.webp` — versão científica narrada completa
- `microagulhamento.mp4` / `microagulhamento.webp` — edição cinematográfica anterior

Para novas mídias, prefira o mesmo padrão simples de nomes: `<tema>.mp4` e `<tema>.webp`, sempre em minúsculas, sem acentos e com hífens quando necessário.

## Padrão para imagens
Preferência por **WebP**, nomes em minúsculas, sem acentos e com hífens.

Exemplos:
- `bc-limpeza-de-pele.webp`
- `bc-harmonizacao-facial.webp`
- `bc-sculpt-cryo-abdomen.webp`

## Política de mídia

A faixa de seleção exibe somente arquivos disponíveis, identificados por `data-video-state="ready"`. Cada miniatura é um link direto para o MP4, utilizável sem JavaScript. Vídeos ainda sem arquivo final permanecem fora da faixa; os tratamentos continuam no catálogo.

O player é único, com `controls`, `playsinline` e `preload="none"`. O primeiro vídeo aguarda reprodução voluntária. Ao terminar, ele avança para o próximo preservando volume e preferência de som; ao final da lista, para. Se o navegador bloquear a continuidade, informa que é preciso tocar em reproduzir. Rolagem para fora da área do player e aplicativo em segundo plano pausam o vídeo.

Não baixar toda a lista antecipadamente. Os MP4s H.264/AAC usam fast start. As versões científicas longas preservam a narração completa, sem corte para 30 segundos. Os posters novos são extraídos do próprio vídeo; imagens do catálogo continuam ilustrativas.
