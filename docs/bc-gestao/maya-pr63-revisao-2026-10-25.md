# Revisão da Maya — PR #63

Data: 25/10/2026. Base examinada: `2380b7f9b9b0a24782a6628cc14a33ba4a03659f`.
Estado: desenvolvimento na branch do PR, sem merge ou publicação no site.

## Resultado

A Beta pode avançar para homologação interna após as checagens do último commit. Ainda não está aprovada para publicação ou atendimento a clientes. A revisão encontrou problemas de orientação por perfil, operações assíncronas e tratamento de falhas, corrigidos nesta atualização. Não foram alteradas políticas do Supabase nem permissões financeiras.

## Alterações realizadas

- Orientações de cadastro, agenda, anamnese, atendimento e documentos respeitam o perfil `admin_criacao`, que consulta a operação. Nove respostas operacionais da biblioteca recebem orientação compatível com esse perfil, tanto no diálogo quanto na consulta. O JSON original das 65 respostas permanece intacto.
- Autorização é revalidada após carregar a biblioteca, antes de mostrar resultados. Busca e abertura de respostas também verificam a sessão. Logout, inativação, troca de conta e mudança de papel são cobertos por regressões usando a proteção de sessão real do aplicativo e serviços simulados localmente.
- Limpar conversa ou fechar biblioteca invalida os respectivos resultados que ainda estejam carregando.
- Falha na revalidação da sessão mostra aviso recuperável e bloqueia o conteúdo solicitado, sem rejeição assíncrona não tratada.
- Perguntas como “O que é microagulhamento?”, “Como funciona o peeling?” e “O que é radiofrequência?” reconhecem gatilhos existentes. A introdução é removida de forma limitada e o assunto precisa corresponder a um gatilho exato e único; não há geração de texto médico. Pedidos de dose e alternativas com “ou” sem correspondência cadastrada não selecionam uma explicação por trecho.
- Criado `scripts/test-maya-browser.mjs` e incluída sua execução no Site CI, com Chromium e WebKit e capturas de tela somente de fixtures.

## Testes e evidências

| Verificação | Resultado local |
|---|---|
| Suíte antes das alterações | 846 aprovados: 69 anamnese, 133 site, 644 gestão |
| Suíte final `npm test` | 865 aprovados: 69 anamnese, 133 site, 663 gestão; zero falhas |
| Maya + revogação de sessão | 58 aprovados; incluídos no total acima |
| Novas regressões de runtime | 19 testes adicionais; casos com biblioteca adiada reproduziram falhas antes das correções |
| Correspondência da biblioteca | As 65 perguntas e os 219 gatilhos foram exercitados, com 284 correspondências corretas |
| Navegador local | 10 cenários aprovados no Chromium 153: três papéis em 320 e 1280 px, anônimo, limpar durante espera, inativar durante espera e erro de conexão |
| Integridade da alteração | `git diff --check` aprovado; JSON das respostas sem alteração |

Os testes de navegador carregam o HTML e os módulos reais de autenticação da Maya. O SDK é substituído por fixtures em memória, e solicitações externas são bloqueadas. Só é permitida a consulta ao próprio `staff_profiles`; não há leitura de clientes, clínica, financeiro ou credenciais de produção. Testes de injeção verificam texto literal e rejeição de links fora das fontes permitidas.

O ensaio local usou um Chromium alternativo porque o instalador padrão do ambiente não disponibilizou seu binário. WebKit e o Chromium padrão devem ser comprovados pelo Site CI do último commit. Isso não substitui Android/iPhone físicos, login hospedado, RLS ou avaliação profissional. Os workflows anteriores do head original estavam aprovados, mas não cobriam os novos cenários da Maya.

## Riscos e pendências

1. **Acesso ao conteúdo:** o repositório GitHub é público. Os arquivos da branch já podem ser consultados no GitHub; rascunho e `noindex` não os tornam privados. Após deploy estático, o JSON também poderá ser acessado diretamente pelo site. Para uma biblioteca estritamente interna, será necessária entrega autenticada pelo servidor ou uma decisão explícita sobre quais textos podem ser públicos. Não há dados de pacientes neste JSON.
2. **Homologação clínica:** as 52 respostas informativas e as 29 referências continuam pendentes da Mel. Testes de quantidade, links e campos não comprovam adequação científica, contraindicações ou compatibilidade com os produtos e protocolos da BC. Houve amostragem de referências oficiais de Anvisa, FDA e AAD, sem aprovação clínica integral nesta revisão.
3. **Conteúdo operacional:** parte dos 13 textos herdados do protótipo ainda fala em funcionalidades previstas, versão offline ou validação futura. Conferir as telas atuais e reescrever esses passos com a equipe antes de tratá-los como instruções homologadas.
4. **Uso real:** testar sessão hospedada, expiração, troca de identidade e inativação com contas de homologação e dados fictícios. Validar teclado, zoom, toque e leitor de tela; nenhum teste local representa homologação em aparelho físico.
5. **Privacidade da entrada:** o filtro é uma redução de risco, não um detector completo de dados pessoais. A Maya não persiste perguntas, mas a equipe deve continuar sem digitar dados de clientes.
6. **Busca:** foram acrescentadas variações diretas, não compreensão livre de linguagem. Há bloqueios conservadores para alguns padrões de dose e alternativas, mas eles não representam detecção universal de ambiguidade ou triagem clínica. Fora de uma correspondência segura, orientar a escolha de assunto ou ajuda humana.

## Próxima autonomia recomendada

Manter a próxima fase gratuita, com conteúdo revisado e navegação guiada, aproveitando os módulos já existentes:

| Melhoria | Comportamento proposto | Validação necessária |
|---|---|---|
| Guias por tarefa | Passos curtos para cadastrar, agendar, conferir anamnese e registrar atendimento, adaptados ao perfil | Mel confirma rótulos e passos nas telas atuais; criação continua em consulta |
| Atalhos permitidos | Abrir a área correta da gestão após escolha da pessoa, sem preencher ou executar operações | Conferir destinos e suporte a navegação em cada painel; não presumir que hashes funcionem no painel de criação |
| Sugestões de assuntos | Quando houver mais de uma correspondência, mostrar até três perguntas para a pessoa escolher | Não inferir diagnóstico, dose ou procedimento indicado |
| Transparência no diálogo | Exibir fonte, estado e data de revisão também na resposta do chat | Aprovação humana explícita por item, sem transformar revisão pendente em selo clínico |

A alimentação da Maya deve ocorrer por conteúdos aprovados, sem aprender automaticamente com conversas ou dados clínicos. IA paga, acesso a prontuários e ações administrativas não são necessários para essa fase.

## O que depende de Fernando ou Mel

- Mel: homologar as respostas operacionais e informativas, riscos, nomenclaturas e aderência ao trabalho real da equipe.
- Fernando e Mel: decidir público de cada conteúdo e como será protegido; aprovar o escopo da próxima fase e a publicação somente após homologação.
- Merge, deploy, atendimento a clientes, ações reais e quaisquer consultas clínicas/financeiras continuam fora desta atualização.

Referências oficiais consultadas por amostragem: [Anvisa — cosméticos em tratamentos estéticos](https://www.gov.br/anvisa/pt-br/assuntos/cosmeticos/cosmeticos-para-tratamentos-esteticos), [FDA — radiofrequência com microagulhamento](https://www.fda.gov/medical-devices/safety-communications/potential-risks-certain-uses-radiofrequency-rf-microneedling-fda-safety-communication), [AAD — toxina botulínica](https://www.aad.org/public/cosmetic/wrinkles/botulinum-toxin-faqs).
