# Google Analytics 4 — BC Estética (integração em rascunho)

**Situação:** preparação não publicada. Dependente do PR #69 (migração para o domínio próprio). Não mesclar ou publicar sem homologação.

## Dados públicos

- Fluxo: BC Estética Avançada - Web.
- ID de medição: `G-240XLK51VK` (identificador público, não segredo).
- Destinos previstos: `https://www.bcesteticaavancada.com.br/` e `https://bcesteticaavancada.com.br/`.
- Medição inicial: apenas visualização de página institucional após consentimento explícito.

## Limites de privacidade

O arquivo `analytics-public.js` está referenciado somente em dez páginas institucionais. A tag não é carregada antes do aceite. O visitante pode alterar a preferência pelo botão no rodapé.

- A URL do evento contém somente origem + caminho, sem consulta ou fragmento.
- O referrer contém só a origem, sem caminho ou consulta.
- Nenhum evento customizado de formulário, anamnese, agendamento, contato, WhatsApp ou dados clínicos foi adicionado.
- Rotas `gestao/`, `admin/`, `agenda/`, `agendamento/`, `backup/`, `nfc/` e `instalar/` não carregam o arquivo.
- Sinais do Google e anúncios personalizados estão desabilitados na configuração da tag.
- Recusa impede carregamento de script do Google; revogação provoca recarregamento.
- Aceite/recusa é armazenado no navegador por origem, via localStorage.

**Verificação no painel GA4 (03/11/2026):** identificador `G-240XLK51VK` confirmado diretamente no fluxo `16261909241` da propriedade BC. Opções de rolagens, pesquisa no site e engajamento de vídeo foram desativadas e salvas; cliques de saída, interações com formulário e downloads já estavam desligados. Após reabrir o painel, todas essas seis opções estavam inativas; restou apenas a opção de visualização de página. A tag proposta mantém `send_page_view: false` e envia um único evento manual de página consentida. A coleta real ainda não foi testada e depende da publicação autorizada.

**Atenção:** esta verificação não substitui a revisão jurídica/LGPD. A política de privacidade e os testes em celulares continuam pendentes.

## Bloqueios antes do merge/publicação

1. **Concluído em 03/11/2026:** conferidas no painel GA4 as seis medições automáticas não essenciais, todas inativas após salvar. Reconfirmar se o painel for alterado.
2. Mel revisar o texto do consentimento e a política de privacidade, inclusive a retenção de dados.
3. Rodar `npm run test:site` e confirmar CI sem falhas, usando apenas dados fictícios.
4. Validar visual e funcionalmente no Android e iPhone os botões de aceitar, recusar e alterar preferências.
5. No domínio final (www e raiz), validar uma visita com aceite e o relatório Tempo real do GA4 sem inserir informações de pacientes.
6. Confirmar ausência de tag duplicada por Google Tag Manager ou outros meios.
7. Reconfigurar TalkToData para a nova propriedade da BC; a conexão anterior apontava para outro negócio.

**Dependência de domínio:** PR empilhado no PR #69. Se #69 for mesclado, reavaliar a base do PR do GA4 para main após os testes. Não mexer em DNS, Auth, Search Console ou Drive nesta rodada.
