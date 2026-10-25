# Área de criação — fluxo mais leve

Fernando pediu otimizar sua área de gerenciamento. Este refinamento segue a simplificação já autorizada e o desenho de admin de criação: acompanhamento operacional, com o financeiro restrito na origem.

## Escolha de interface

Adotar atalhos para Agenda, Clientes e Equipe, mantendo as outras consultas em “Todas as áreas”, agrupadas por assunto. Uma nova página de indicadores exigiria mais consultas ao entrar e acrescentaria informação; um redesenho do aplicativo inteiro ampliaria o pedido. Os atalhos refinam a tela existente e mantêm uma única consulta por vez.

## Comportamento

- Cabeçalho compacto “Minha gestão”, identificado como Admin de Criação.
- Título da consulta sempre acompanha a área selecionada; busca com ação explícita e opção de limpar.
- Preservar busca e página de cada área durante a sessão, inclusive ao voltar pelos atalhos. Não persistir dados pessoais no navegador.
- URL identifica a área e permite navegação pelo histórico, com validação contra a lista autorizada.
- Mostrar o essencial de cada registro; dados adicionais permanecem em detalhes recolhidos.
- Atualização automática discreta preserva detalhes abertos e não interfere em busca/filtro em uso.
- Recolher explicações longas sobre acesso. Sem consultas paralelas às dezesseis áreas ao entrar.
- Manter todos os campos atualmente permitidos, restrições financeiras, autenticação, paginação de 50 e RPC existentes. Nenhuma migração ou alteração de conta.

## Verificação

Regressões de estado, concorrência, retorno entre áreas, limpeza de busca e atualização discreta. Navegação real Chromium/WebKit em celular e tablet, com API fictícia e nenhuma sessão de produção: atalhos, áreas secundárias, histórico, busca, paginação, detalhe e recuperação de erro. Suítes existentes completas e Site CI antes de publicar.
