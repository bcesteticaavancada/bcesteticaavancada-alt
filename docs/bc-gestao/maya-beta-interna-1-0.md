# Maya Beta Interna 1.0 — BC Estética Avançada
Data: 24/10/2026
Estado: **ramificação de desenvolvimento / PR rascunho**. **Não publicado**.

Revisão técnica de 25/10: [correções, testes, riscos e próxima autonomia](maya-pr63-revisao-2026-10-25.md). Não publicado significa sem deploy no site; o repositório GitHub é público e permite consultar os arquivos da branch.

## Objetivo
Iniciar uso interno controlado: responder dúvidas administrativas sobre acesso, cadastro, agenda, anamnese, atendimento, documentos e permissões com linguagem pt-BR, dentro do contexto do BC Gestão.

## Escopo implementado
- Página separada em gestao/maya-beta/, sem alterações nas páginas existentes.
- Reutiliza o login Supabase e staff_profiles do BC Gestão; permite somente papéis ativos admin, colaborador e admin_criacao.
- Validação de sessão com getCurrentProfile antes de exibir a interface; installSessionGuard revalida antes de cada resposta.
- Oito tópicos administrativos pré-escritos; perguntas são classificadas localmente, sem chamadas à IA externa nem consultas a dados de clientes.
- As 65 respostas do protótipo Maya v0.8.3 (13 de aplicativo, 52 informativas) estão disponíveis na Beta para **consulta interna**, mediante autorização expressa de Fernando. **Todas seguem pendentes da revisão técnica da Mel.** A liberação não significa homologação clínica nem publicação para clientes.
- O texto original da pergunta não é exibido no histórico, nem persistido no navegador ou enviado ao banco pela Maya. Entradas com padrões de dados sensíveis são descartadas. Para respostas da biblioteca, o navegador solicita somente o JSON estático da própria página.
- Restrições por perfil: admin pode consultar caixa no próprio BC Gestão, colaboradora só pode ver sua comissão; admin_criacao não tem acesso financeiro nem clínico completo.
- A Maya não cria agendamentos, altera prontuários, lança valores ou assina documentos.

## Evidências utilizadas
- Relatório docs/superpowers/ledgers/2026-10-24-teste-fluxo-real.md, com 14 grupos de testes reais do BC Gestão. Esses resultados não são homologação da Maya conectada.
- Interfaces gestao/admin/index.html, gestao/colaborador/index.html, gestao/criacao/index.html; autenticação em gestao/js/auth.js.
- Protótipo Maya v0.8.3 armazenado no Drive como referência de UX e conteúdo de treinamento.

## Segurança e limites
O HTML estático não contém dados de pacientes. A interface permanece oculta até a autorização. O meta noindex não é um mecanismo de controle de acesso; a autenticação é essencial. O filtro de entrada reduz risco de exposição acidental, mas não identifica todos os possíveis dados pessoais. A primeira utilização deve ficar restrita a perguntas administrativas sem dados reais.
Esta Beta não é IA generativa nem está conectada às funções administrativas ou clínicas do aplicativo. É um assistente guiado de informações aprováveis.
Não há link no menu atual. Não incluir até concluir validações e obter aprovação.

## Critérios antes do lançamento interno
1. Testes automatizados da gestão e teste da Maya aprovados no CI.
2. Homologação com login real autorizado: Mel, colaboradora, perfil de criação, não autenticado, inativo e troca de sessão.
3. Teste físico Android e iPhone: teclado, zoom, navegação e desconexão.
4. Revisão das respostas administrativas pela Mel; conteúdo clínico segue indisponível.
5. Revisão de privacidade: nenhuma informação de clientes em logs, armazenamento ou chamadas novas.
6. Aprovação explícita antes de merge, inclusão no menu e publicação.
7. Nova revisão de segurança antes de permitir qualquer consulta ou alteração de dados reais.

## Publicação
Nesta etapa, nenhum merge no main, nenhum deploy de Pages e nenhuma alteração em Supabase foram feitos.

## Revisão de 24/10 — privacidade e navegação
- A pergunta original não é repetida no histórico; a Maya mostra apenas o assunto classificado. O campo é esvaziado após envio e há um botão de limpar a conversa.
- Adicionados testes de execução com DOM simulado: acesso anônimo/inativo, perfis, privacidade, descarte de dados pessoais, limpeza e bloqueio após revogação.
- Os três painéis internos (administração, colaboradora e criação) receberam um atalho para a Maya **somente na ramificação do PR #63**. Nenhuma alteração foi publicada no site.
- O conteúdo permanece pré-escrito e a Maya não usa IA generativa nesta etapa.

## Plano de homologação interna
1. Confirmar todos os workflows do PR #63 aprovados.
2. Mel confere as orientações administrativas e limitações de escopo.
3. Testar em sessão real da própria equipe após liberação controlada, sem digitar dados de clientes.
4. Conferir login, expiração, troca de identidade e bloqueio de perfil inativo.
5. Avaliar Android e iPhone físicos, incluindo teclado, zoom, toque, retorno à gestão e limpeza do chat.
6. Só após aprovação expressa, mesclar e publicar a página com o atalho interno. Manter dúvidas clínicas e atendimento a clientes desativados.

## Liberação das 65 respostas — decisão de 24/10/2026
- Fernando autorizou a consulta interna dos 65 itens na Maya Beta. A origem é o arquivo privado `2026-10-24_Maya_Prototipo_v0.8.3_FLUXO_BC_REFERENCIA_TESTE.html`.
- Arquivo da biblioteca na ramificação: `gestao/maya-beta/respostas-65.json`. Perguntas, respostas, gatilhos e fontes foram preservados. Campo `review`: `pendente` para todas.
- Uma busca por assunto permite encontrar as respostas; a Maya pode responder perguntas correspondentes a um gatilho. A interface informa revisão técnica pendente. Não deve responder diagnósticos, doses, indicações específicas ou detalhes de pacientes.
- **Limitação importante:** o JSON é arquivo estático. Após um eventual merge/publicação do GitHub Pages, o URL direto do JSON poderá ser lido sem autenticação, mesmo que a interface exija login. Como os textos são gerais e não contêm pacientes, isso não equivale a vazamento de dados sensíveis; porém ainda é um motivo para manter publicação bloqueada até que o público de cada resposta seja aprovado ou exista entrega autenticada pelo servidor.
- Cópia no Drive: JSON das 65 respostas + documento de revisão integral para a Mel. A publicação ao público externo permanece proibida nesta fase.
- Revisão humana e validação em aparelho físico continuam pendentes. **Não converter esta autorização interna em selo de aprovação clínica.**
