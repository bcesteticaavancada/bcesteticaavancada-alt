# Central de Inteligência e Integrações BC

## Estado e acesso
O módulo em `/gestao/integracoes/` atende os perfis ativos admin e admin_criacao em homologação. O menu de cada perfil e a Maya interna abrem a Central. O frontend bloqueia o projeto Supabase de produção e os endereços públicos da clínica. A prévia de revisão deve usar um checkout de homologação com a configuração pública de login da gestão apontando ao Supabase de teste. O servidor exige uma origem exata e um projeto isolado. O diretório público contém somente código, rótulos e configuração publicável. Dados operacionais e tokens pertencem ao backend.

## Operações implementadas
| Operação | Origem | Limite |
| --- | --- | --- |
| Estado, uso, últimas operações e erros | Supabase de homologação | Sessão verificada em Auth e perfil ativo em staff_profiles a cada chamada. Histórico apenas da identidade atual. |
| Busca | Search Console Search Analytics | Totais de 28 dias com três dias de defasagem, incluindo CTR e posição, sem dimensão pessoal. |
| Visitas | GA4 Data API | Sessões e visualizações agregadas, hostname oficial. Requer propriedade conferida. |
| Testes | GitHub REST | Últimos workflows de PR no SHA do PR SEO #92. |
| Desempenho | PageSpeed Insights | Métricas de campo disponíveis e nota de laboratório em campos distintos. |
| Caixa | PostgreSQL | Totais obtidos de funções financeiras existentes com o JWT do usuário. A política financeira da clínica é conferida novamente no banco. |
| Roque e Maya | Guias locais da Maya | Pergunta e histórico temporários no navegador. Compartilhamento apenas de guias institucionais selecionados; nenhuma cópia de prontuário ou conversa para o modelo. |
| Nota de gestão | OpenAI Responses API | Entrada por tema fechado, sem conversas, ferramentas ou dados operacionais. Requer teto de uso, aprovação de custo e confirmação por ação. |
| Documento | Google Drive API | Cria Google Docs técnico numa pasta fixa. Confirmação humana, sem compartilhamento automático. |
| Planilha de indicadores | Navegador | Exporta o resultado mostrado em CSV; abertura em Sheets pelo administrador. |
| Backup | Módulo existente | A Central explicita a ausência de telemetria do worker. Recuperação segue o procedimento do backup privado. |

A voz, quando disponível, exige reconhecimento local suportado e instalado pelo navegador. O texto volta ao campo para revisão. Renderização de números usa pt-BR. A conta criadora não recebe dados financeiros ou clínicos. A camada paga é optativa e começa desligada.

## Preparar o ambiente isolado
1. No checkout descartável, usar Supabase local ou um projeto de homologação explicitamente separado. No CI, o normalizador existente trata versões legadas somente no checkout efêmero. Aplicar a nova migration exclusivamente na base de teste. Configurar Auth e os perfis fictícios pelo fluxo habitual da gestão. Não importar banco ou arquivos da clínica.
2. Apontar `gestao/js/config.js` da prévia para URL e chave publicável do mesmo Supabase que o login utiliza. Nunca usar chave administrativa nesse arquivo nem comitar configuração privada. Servir o site por HTTP local ou origem HTTPS de homologação e entrar pelo login da gestão. Para rodar a matriz sem OAuth, use `npm ci && node scripts/test-central-browser.mjs` após instalar Chromium e WebKit do Playwright. Os fixtures funcionam sem serviços externos.
3. A Edge Function `bc-central` usa o runtime Supabase. Definir no servidor `BC_ENV=homologacao`, `BC_CENTRAL_ORIGIN` e `BC_STAGING_SUPABASE_URL` com correspondência exata com a URL Supabase do runtime. As chaves nativas anon e service_role ficam no servidor. A service_role é usada somente pelas três RPCs do diário, nunca para leitura financeira. A API valida o Bearer em Auth em cada operação. Os segredos de assinatura e provedores não vão no frontend.
4. Configurar `BC_APPROVAL_SECRET` aleatório com pelo menos 32 caracteres. Uma prévia de ação externa recebe confirmação assinada por HMAC ligada a usuário, ação, tema e chave, com cinco minutos de validade. Até 20 operações por minuto por perfil e dez chamadas de cada tipo externo oneroso por 24 horas no ambiente inteiro. Se o provedor respondeu de forma incerta, conferir o histórico e a pasta pelo identificador da requisição antes de nova tentativa.
5. Para cada conexão Google opcional, usar um cliente OAuth Desktop de teste com PKCE na estação do administrador. Configurar localmente `BC_GOOGLE_CLIENT_ID`, `BC_GOOGLE_CLIENT_SECRET` e `BC_GOOGLE_ADMIN_EMAIL`; executar `node scripts/operations/central-google-oauth.mjs search`, `analytics` ou `workspace` conforme a autorização. O callback aceita uma única resposta em loopback, confere state e identidade verificada. O token fica em arquivo local privado fora do checkout. Transferir por cofre ao backend e eliminar a cópia de transporte conforme a política da clínica. Cada grant precisa do escopo específico; usar clientes distintos se o Google acumular permissões. Neste caso, configurar instâncias isoladas do adaptador ou escolher credenciais com escopos mínimos antes de ativar.
6. Configurar as mesmas credenciais de cliente e conta autorizada no servidor. Os refresh tokens ficam em `BC_GSC_REFRESH_TOKEN`, `BC_GA4_REFRESH_TOKEN` e `BC_REPORT_REFRESH_TOKEN`. A Search Console requer acesso de leitura à propriedade de domínio, GA4 Viewer e ID numérico em `BC_GA4_PROPERTY_ID`. Drive requer `drive.file` e uma pasta de teste em `BC_STAGING_FOLDER` criada ou selecionada para esse aplicativo. Escopos mais amplos bloqueiam a chamada. Revalidar conta e escopo a cada refresh. O OAuth do backup continua com sua própria finalidade.
7. Para uma prova paga futura, configurar projeto OpenAI específico, modelo autorizado, chave no servidor, orçamento/alertas da conta e `BC_OPENAI_SPEND_APPROVED=yes`. O teto de saída é 360 tokens e o modelo recebe uma única pergunta institucional fixa. Rever política de retenção do provedor antes de modificar o contrato. Geração aceita apenas saídas completas.
8. Testar nova, cancelada, expirada, repetida, falha do provedor e permissão revogada. Ensaio de restauração usa somente arquivos fictícios e comparação de hash em destino isolado. Nenhum job criado aqui agenda mensagens, tarefas no calendário ou publicações.

## Limites desta versão
O cadastro de custos, comissões e movimentações continua nos módulos financeiros existentes. O simulador e as métricas comerciais evoluem no PR #91; fidelidade no #89. A base de 67 respostas da Maya conserva o conteúdo revisado. A geração clínica da Maya, memória durável de chat, atualização automática do Drive, Sheets/Slides/Calendar por API, prontuários, pagamentos e ações externas de marketing ficam fora do fluxo da Central nesta revisão. Uma cópia Drive só está recuperada após ensaio documentado no ambiente de teste.

## Reversão e acesso mínimo
Para parar os testes, desligar a função ou remover BC_ENV. Desabilitar a autorização de custo e revogar apenas os grants de teste, se criados. Reverter o commit de interface e menus em branch de homologação. Preservar a tabela de auditoria e qualquer documento criado; não fazer DROP nem apagar dados como parte do rollback. Antes de promoção, revisar política de retenção do histórico técnico, RLS com identidades independentes, orçamento, finalidade dos indicadores, acesso ao backup e validação em dispositivos reais.
