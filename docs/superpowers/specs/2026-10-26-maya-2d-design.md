# Maya 2D na Beta interna

Fernando autorizou a sequência em 26/10/2026: colocar a Maya em 2D assim que possível. Implementação restrita à branch do PR #63, sob a autorização de desenvolvimento já dada. Aparência proposta para homologação; sem autorização de publicação.

## Intenção

Dar presença visual à assistente sem mudar as 67 respostas aprovadas pela Mel, as permissões ou a página inicial. Personagem feminina original, acolhedora, em ilustração vetorial com a paleta bege, castanho e dourado já utilizada pela BC. Não representa uma pessoa real nem uma profissional clínica.

## Abordagens

- SVG e CSS locais: leve, nítido em celular, sem dependência ou assinatura adicional. Escolha técnica do agente para esta primeira versão.
- Imagens em quadros: permitem arte mais detalhada, mas aumentam os arquivos e dificultam ajustes e acessibilidade.
- Avatar com voz ou serviço externo: mais configuração e custo potencial. Não necessário para a etapa visual solicitada.

## Comportamento

Personagem junto à apresentação da Beta, sem flutuar por cima dos controles. Estados visuais: pronta, consultando e orientação disponível. A animação não simula escuta, voz ou execução de tarefas. Status legível independentemente do movimento.

Movimentos breves de boas-vindas e resposta; indicador durante consulta. Botão de pausar/ativar, preferência mantida somente em memória. Respeitar a redução de movimento do sistema e suspender animações quando a página não estiver visível. Ao limpar conversa, descartar estados pendentes; após revogação, não repovoar a interface.

## Limites e validação

Sem APIs novas, armazenamento de conversas, voz, microfone, consultas clínicas ou alterações financeiras. Biblioteca e manifesto da Mel intactos. SVG decorativo fora da árvore de acessibilidade; botões e status acessíveis por teclado. Testar 320 px, desktop, redução de movimento, pausa, carregamento, falha, concorrência e sessão. Chromium/WebKit usam somente perfis fictícios. Homologação humana, celulares físicos, privacidade e aprovação de publicação continuam separadas.
