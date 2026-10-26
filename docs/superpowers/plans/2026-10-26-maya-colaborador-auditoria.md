# Maya: liberação para colaboradoras e auditoria

Autorização de Fernando em 26/10/2026: liberar inicialmente somente na interface da colaboradora, ampliar informações sobre o app, revisar o esquema anterior, testar amplamente e entregar relatório. Publicação restrita autorizada nesta mensagem; visitante, administrador e criação não entram nesta primeira liberação.

## Decisões e limites

- Manter as 67 respostas clínicas/revisadas pela Mel intactas. Acrescentar apenas guias operacionais extraídos das telas atuais, com fontes no código e atalhos de navegação, sem ações automáticas.
- Restringir entrada da Maya a `colaborador` ativo e retirar links dos painéis admin/criação. Manter guarda de sessão e revogação durante consultas.
- Conteúdo educativo estático é público no repositório; sessão protege a interface e as ações do app, não torna os arquivos privados. Nenhum dado real entra na Maya.
- Conta administrativa da auditoria será criada e autenticada em Supabase efêmero no CI e removida ao terminar. Permite exercitar autenticação real sem abrir prontuários ou financeiro reais. Credenciais aleatórias não serão publicadas ou conservadas como acesso permanente.
- Não alterar perfil de Fernando, regras financeiras, backup ou identidades da equipe. Inspeção de produção limita-se a metadados de infraestrutura/permissão e rotas públicas.

## Sequência

1. [x] Reler plano técnico e protótipo originais; conferir esquema/perfis atuais, advisors e funções instaladas.
2. [x] Sincronizar main na branch da Maya em checkout isolado, preservando mudanças recentes de suporte e Drive.
3. [ ] Testar primeiro a restrição por papel, guias operacionais e navegação sem dados pessoais; implementar a liberação para colaboradoras.
4. [ ] Acrescentar ensaio efêmero de Auth/RLS com conta real de teste e senha aleatória, sem serviços de produção.
5. [ ] Executar testes Node, navegador Chromium/WebKit, banco/concorrência e varredura pública de links/recursos. Separar falha comprovada de lacuna não testada.
6. [ ] Revisão independente única, correções necessárias, CI aprovado, publicação autorizada somente da versão restrita.
7. [ ] Conferir versão publicada e entregar relatório de funcionamento, simplificações e pendências.

## Registro inicial

Main observado: `d0cd61cb`; Maya: `6b6fa0c9`. Alice é colaboradora chefe com capacidades de agenda e biblioteca; Aline e Kátia colaboradoras; Mel admin; Fernando admin_criacao. Vínculos e capacidades preservados. Nenhuma branch Supabase de testes existente.

Advisors: proteção contra senhas vazadas desativada; avisos de funções SECURITY DEFINER precisam ser avaliados por autorização interna, não removidos indiscriminadamente; índices/FKs sugeridos não provam lentidão. Quatro tabelas privadas sem RLS não concedem SELECT a anon/authenticated. Nenhum conteúdo clínico ou valor financeiro foi lido.
