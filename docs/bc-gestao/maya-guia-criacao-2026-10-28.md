# Maya — orientação para administração e criação

Data: 28/10/2026 (Brasil).

## Entrega desta etapa

Ampliar os guias estáticos da Maya para os papéis ativos `admin` e `admin_criacao`, mantendo o comportamento atual das colaboradoras. O pedido de Fernando cobre orientação sobre recursos diretos e indiretos, arquitetura, criação e planejamento. Não cria um agente executor, editor de código, conta técnica permanente ou integração paga.

Oito assuntos: mapa dos recursos; arquitetura atual; organização de uma melhoria; publicação e recuperação de versões; domínio próprio; backup e recuperação; planejamento da área do cliente; IA de criação dentro do site. Cada orientação deve distinguir recursos já existentes de propostas futuras. Os atalhos levam somente a áreas existentes, com o painel correspondente ao papel.

Guias são conteúdo estático público do repositório, filtrado na interface por papel. Não contêm segredos, dados de pacientes ou informação financeira. O filtro não substitui autorização no servidor. A biblioteca clínica de 67 respostas revisadas pela Mel, os papéis, a autenticação e o backend permanecem intactos.

## O que já existe

HTML/CSS/JavaScript publicados por GitHub Pages; BC Gestão autenticado com painel administrativo, colaboradora e criação; Supabase para autenticação, banco, arquivos privados e funções; configuração de backup Drive em tela reservada; Maya com respostas locais e navegação. A página pública do backup descreve a rotina horária, mas esta revisão de conteúdo não verifica execução nem restauração reais.

O painel de criação oferece consultas da operação, apoio cadastral/documental e convites conforme as permissões já existentes. Não oferece editor de páginas nem acesso financeiro. A arquitetura pretendida aproveita essa base.

## Proposta futura: espaço de criação no próprio site

Há três etapas complementares, ainda sem implementação desse novo espaço:

1. **Orientação agora:** Maya conhece melhor a estrutura e ajuda a formular melhorias sem consumo de IA generativa.
2. **Estúdio privado de projetos:** pedidos, decisões, versões, prévias e resultados de testes dentro do painel. Quando houver IA, o servidor autentica a pessoa e limita as ferramentas. Primeiro construir em ambiente separado e com dados fictícios; publicar apenas após revisão. Para editar código, precisa de executor isolado ou serviço de agentes apropriado; o navegador não recebe credenciais de publicação.
3. **Ponte de trabalho com ChatGPT/Codex:** ferramentas autenticadas por MCP podem compartilhar os projetos autorizados. Um chat próprio no site pode usar a API, com histórico mantido pelo aplicativo. Compartilhar projetos não importa nem sincroniza automaticamente o histórico desta conversa. Disponibilidade do conector na conta e custo de execução precisam ser confirmados na implementação.

A recomendação é começar com pedidos e prévias e só depois autorizar operações de código. Um editor genérico e um agente com administração irrestrita não são necessários para a primeira versão. A interface pode centralizar o trabalho enquanto GitHub, Supabase e um serviço de IA continuam atendendo o servidor.

A documentação atual oferece Sign in with ChatGPT com uso do plano para clientes elegíveis. Isso não deve ser prometido para o site da clínica: aplicações comerciais/remotamente hospedadas têm condições de participação e a elegibilidade da BC não foi confirmada. A alternativa por API tem cobrança de consumo. Mesmo quando o login ChatGPT está disponível, ele não concede acesso às conversas do usuário. Conferir o caminho e o custo antes de ativar IA.

## Exemplo: área do cliente

A primeira entrega deve definir o que a cliente pode consultar: por exemplo seus horários e documentos explicitamente liberados. Precisa de identidade própria, vínculo validado ao cadastro e autorização no servidor para cada registro. Não reutilizar contas de colaboradoras nem liberar o prontuário interno inteiro. Testar duas clientes fictícias, acesso cruzado bloqueado, logout, recuperação e revogação antes de publicação. Este documento é uma proposta, não declara a área criada.

## Domínio

Fernando informou `bcesteticaavancada.com.br`; o contexto anterior registra preparação de DNS, sem migração confirmada. Não houve alteração de DNS, CNAME, origem OAuth ou URLs de autenticação nesta etapa. Usar rotas relativas nos guias e conferir domínio/HTTPS/login/recuperação/integrações antes da migração. A aquisição do domínio não muda a capacidade de executar código no servidor.

## Validação e limites

Base: `1ef46253fe15f6b9ee88aedeb91204ca6602f83d`.

- A suíte direcionada de base passou com 87 testes.
- Duas regressões foram reproduzidas: perguntas sobre os recursos não abriam guias para `admin` e `admin_criacao`.
- Após a ampliação, os 71 testes do runtime e os 939 testes Node do projeto passaram sem falhas (69 anamnese, 133 site e 737 gestão).
- Os testes exercitam o runtime real da Maya com perfil e biblioteca fictícios, verificando destinos, reconhecimento e restrição de papéis.
- O ensaio de navegador continua isolado de serviços de produção e inclui os novos guias nos dois perfis administrativos.
- Não houve teste de execução de IA, integração de conversas, área do cliente ou alterações automáticas: esses recursos ainda não foram construídos.

## Referências verificadas

- [GitHub Pages: hospedagem estática e domínio próprio](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Codex em aplicações: SDK, app-server e ferramentas](https://developers.openai.com/blog/codex-as-a-platform)
- [Agents API: sessões, ferramentas, ambiente e cobrança](https://developers.openai.com/api/docs/guides/agents-api/overview)
- [ChatKit: chat integrado com servidor próprio](https://developers.openai.com/api/docs/guides/chatkit)
- [Plugins e MCP para ChatGPT/Codex](https://developers.openai.com/plugins/build/app-quickstart)
- [Autorização OAuth para MCP](https://developers.openai.com/plugins/build/auth)
- [Sign in with ChatGPT: disponibilidade, plano e limites de acesso](https://developers.openai.com/siwc/quickstart)
- [Uso do plano em aplicações abertas/locais e requisitos para hospedadas](https://developers.openai.com/siwc/token-sharing-open-source)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

Não criar nova integração no Agent Builder: a documentação atual informa descontinuação em 30/11/2026. Isso não afeta a Maya estática atual.

