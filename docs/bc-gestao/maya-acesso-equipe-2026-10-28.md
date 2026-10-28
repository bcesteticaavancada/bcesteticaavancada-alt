# Maya — acesso da equipe e administradores

Fernando autorizou em 28/10/2026 revisar e publicar a Maya para colaboradoras, administradores e administrador de criação, incluindo Mel e Fernando. Essa autorização substitui a restrição anterior de entrada exclusiva para colaboradoras.

## Implementação

- Atalho Ajuda da Maya e entrada no menu dos três painéis autenticados.
- A Maya aceita somente perfis ativos com papel `colaborador`, `admin` ou `admin_criacao`, validados pelo mesmo módulo de sessão atual. Retorna ao painel correspondente.
- Os guias mantêm destinos e instruções conforme o perfil. Administradora usa seu próprio painel; criação recebe navegação e apoio cadastral, convites e cópias documentais já existentes. Nenhum atalho financeiro ou instrução de ação clínica para criação.
- Administradora não depende dos booleanos exclusivos de colaboradora chefe para receber guias administrativos. Capacidades das colaboradoras continuam verificadas como booleano verdadeiro.
- Orientações antigas que descreviam o apoio de criação como apenas consulta foram atualizadas com base em `creation-panel.js`, `support-panel.js` e `support-api.js`. PDFs dependem das assinaturas e geração pela responsável; cópias devolvidas preservam o original, e revisão/vínculo clínicos ficam com a profissional.
- Biblioteca clínica de 67 respostas e manifesto da Mel preservados. Sem mudanças em autenticação, papéis reais, RLS, financeiro, Drive, voz, microfone ou execução de ações pela Maya.

## Revisão e aceite

Nove regressões de entrada/guia/contexto falharam antes da implementação e passaram após a liberação. A revisão inclui acesso dos três papéis, inativos e desconhecidos bloqueados, revogação em consulta pendente, rotas por perfil, financeiro de criação negado e manutenção da restrição de comissão própria da colaboradora.

O navegador usa os links/HTML reais dos painéis com operações fictícias e a autenticação da Maya com SDK fictício. Exercita entrada, retorno, respostas e guias nos três papéis, celulares de 320 px, desktop, privacidade e movimentos. Os testes reais de Auth/RLS são feitos somente em Supabase local descartável no CI; não devem ser interpretados como login real nas contas de Mel/Fernando.

A inspeção de produção confirmou vínculos de autenticação e perfis ativos de Mel, Fernando e colaboradoras, sem ler prontuários ou valores. Advisors mantêm avisos anteriores sobre funções privilegiadas e proteção de senhas; não foram aplicadas mudanças de permissões ou índices fora desta liberação. [Referência de segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Sequência de execução

1. Confirmar vínculos e escopo atual; escrever regressões e observar falhas.
2. Acrescentar entradas e orientar por papel sem modificar permissões do sistema.
3. Executar Node, navegador, Auth/RLS e banco; conferir revisão independente e imagens.
4. Publicar após os checks aprovados e verificar a versão pública e os três atalhos.
5. Entregar relatório com resultados e limites, incluindo uso em aparelhos físicos e entrega real de e-mails ainda não comprovados.
