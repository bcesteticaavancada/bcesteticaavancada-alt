# BC Estética Avançada — entrega operacional

Revisão de 04/11/2026. Este documento descreve a versão publicada e os pontos necessários para concluir o aceite da Mel.

## Acesso oficial

Use https://www.bcesteticaavancada.com.br/ e escolha **BC Gestão**. A entrada direta é https://www.bcesteticaavancada.com.br/gestao/login/.

Cada pessoa usa sua conta. A Mel administra a operação clínica; as colaboradoras seguem as permissões dos próprios atendimentos. Fernando usa o Admin de Criação para apoio operacional, sem lançamento clínico ou financeiro.

## Registro do atendimento

1. Abra ou cadastre a cliente. O cadastro inicial exige nome e telefone; complemente os demais dados quando necessário.
2. Abra o atendimento e escolha o procedimento autorizado para a profissional. Confira anamnese e os requisitos apresentados na sessão.
3. Em **Produtos e lotes**, digite Produto, Lote, Validade do lote, Quantidade e Unidade. A unidade pode ser ajustada, por exemplo mL, unidade ou g.
4. Clique **Registrar uso**. Produtos e lotes novos são cadastrados automaticamente; as sugestões permitem reutilizar os existentes.
5. Confira o uso na lista e reabra o atendimento para confirmar a gravação. Se houver mensagem de resposta de rede incerta, confira o histórico antes de repetir o lançamento.
6. Preencha a ficha e o **Relatório / Parecer do Atendimento**. Use **Salvar parecer** e resolva os requisitos indicados para finalizar.
7. O fluxo atual aceita consentimento na tela ou TCLE externo revisado e vinculado pela profissional. A assinatura deve ser feita pelas próprias pessoas responsáveis.
8. Revise o conteúdo antes de **Concluir finalização**. A versão final mantém os dados clínicos e passa para somente leitura. Abra o histórico e confira o PDF.

Lotes vencidos, validade divergente de um lote existente e quantidade não positiva são recusados. A finalização impede alteração dos produtos daquela versão.

## Conferência final com dados fictícios

Use cliente e atendimento identificados como **HOMOLOGAÇÃO — FICTÍCIO**. Exemplo: Produto **Bioestimulador FICTÍCIO PR80**, lote **QA-PR80-01**, validade futura, quantidade **1,5**, unidade **mL**.

Depois de salvar, atualize a página e confira produto, lote, validade, quantidade, unidade e autoria. Prepare a finalização pelos requisitos normais e confira o PDF hospedado. Repita o acesso no celular utilizado pela Mel. Este aceite ainda não foi concluído pela conta profissional.

## Backup

O backup automático de arquivos privados está ativo, com execução a cada hora. A revisão conferiu cinco execuções recentes bem-sucedidas e dez objetos verificados.

Também existe um backup lógico cifrado de todas as tabelas e do catálogo, capturado antes da implantação do PR80: 117 tabelas e 4.346 registros, com recuperação isolada conferida. Essa captura não equivale a um backup completo automático do banco após cada gravação. Essa automação e a recuperação integral do serviço permanecem como etapas próprias.

## Situação da revisão

- PR80 publicado: digitação manual de produtos e lotes, rastreabilidade, autoria e validações.
- Domínio oficial com `www`: páginas principais, agenda pública e entrada do Gestão disponíveis na revisão.
- Preparado nesta revisão: metadados/SEO e identidade do app no domínio oficial; alinhamento do código das funções às origens já aceitas no servidor; URL pública da logo na pré-anamnese.
- Pendente: publicação dos ajustes preparados, diagnóstico do endereço sem `www` que retornou HTTP 503 nas duas consultas e aceite do fluxo completo pela Mel.
- Evoluções em rascunho não fazem parte de um aceite já concluído: backup completo a cada gravação, contingência de acesso, novo fluxo de TCLE, GA4 e aplicativo móvel nativo.

Não é necessário inserir novamente produtos no catálogo antes de lançar o uso pelo novo formulário.
