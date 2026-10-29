# BC Estética Avançada — aplicativo mobile (protótipo isolado)

Este diretório contém a **primeira implementação de interface própria em React Native / Expo** da BC. Não é uma WebView, não redireciona para o site e não compartilha o HTML do GitHub Pages. O mesmo backend da BC poderá ser conectado futuramente por APIs autenticadas, após homologação.

## Estado atual

- ✅ Interface nativa de demonstração: Início, Cuidados, Agenda, Contato, Minha BC.
- ✅ Catálogo inicial institucional de procedimentos e pesquisa/filtros.
- ✅ Seletores locais de procedimento, profissional, data e horário (simulação).
- ✅ Adaptador de leitura da Agenda V2 (catálogo, profissionais, dias e slots), sem ação de gravação.
- ✅ Testes automatizados com fixtures fictícias e cliente HTTP injetado, sem rede real.
- ✅ Prévia da futura área da cliente e comunicação.
- 🔒 **Sem conexão à produção ou envio de dados**: as ações de reserva e mensagem informam explicitamente que são demonstração.
- 🔒 Sem acesso a pacientes, prontuários, PDFs, Drive, Maya Beta, financeiro ou autenticação.
- 🚫 Sem publicação, merge automático, credenciais, analytics ou transmissão de dados pessoais.

A lista de profissionais é apenas para demonstração de navegação, **não** representa validação clínica da autorização de cada profissional para determinado procedimento. A associação real procedimento↔profissional deve vir das regras já homologadas no backend.

## Executar

Requisitos: Node.js compatível com Expo SDK 57 (22.13+), npm e Expo Go compatível com SDK 57 ou um development build.

```bash
cd mobile
npm install
npx expo install --fix
npm run check
npm start
```

Abra o QR Code no Expo Go compatível com SDK 57. A versão de Expo Go nas lojas pode mudar: em 29/10/2026 o Expo SDK 58 já foi lançado, mas a transição de Expo Go ainda estava em andamento. Se o Expo Go instalado não suportar SDK 57, use development build ou atualize o projeto com validação de dependências.

O projeto ainda não contém ícone/splash finais, assinatura AAB/IPA nem configuração EAS de publicação. A identidade BC usa uma paleta rose gold provisória inspirada nas orientações existentes.

## Arquitetura pretendida (fases posteriores)

1. Verificar contrato de dados da BC Gestão (agendamento público, clientes, papéis, profissionais e consentimentos). O contrato de leitura da Agenda V2 já foi mapeado; a ligação à interface ainda é pendente.
2. Implementar login seguro via Supabase Auth, PKCE/deep links, biometria opcional e encerramento de sessão.
3. Criar endpoints/Edge Functions autorizados para o aplicativo. Nenhuma chave de serviço ou token administrativo pode entrar no app.
4. Preservar o banco atual; usar RLS por cliente e colaboradora, com testes de isolamento e auditoria.
5. Conectar agenda real apenas quando seu contrato, regras de horários e idempotência forem homologados.
6. Mensagens privadas cliente↔colaboradora com permissão por vínculo, políticas de retenção, moderação operacional e notificações sem dados sensíveis na tela bloqueada.
7. Área da cliente: procedimentos concluídos, orientações, documentos aprovados e links temporários controlados para PDFs privados, sem download/cache automático do histórico clínico.
8. Homologar LGPD, política de privacidade, exclusão de conta, testes físicos Android/iOS e requisitos das lojas.

As implementações da Maya, do Drive, do TCLE e da migração de domínio em PRs separados **não são alteradas** por esta branch.

## Regras de segurança antes de integrar

- Não acessar ou replicar dados clínicos no app sem autorização RLS por usuário e vínculo.
- Não colocar `service_role`, segredos, credenciais ou nomes/documentos reais no código.
- Não anexar dados clínicos em push notifications, logs e telas de prévia.
- Não modificar o backend de produção durante experimentos; fixtures apenas fictícias.
- Seguir as exigências de exclusão, transparência, retenção legal e teste de conta das duas lojas.
- Sem merge/publicação até autorização expressa de Fernando e revisão clínica de Mel.

## Critérios de conclusão desta etapa

- App abre diretamente na interface BC e navega entre cinco áreas sem carregar o website.
- Listagem e busca de procedimentos funcionam localmente.
- Agenda oferece somente seleção de preferências; a confirmação informa que não foi registrada.
- Nenhuma mensagem é enviada ou armazenada fora da memória local da tela.
- TypeScript passa no CI.
- A instalação em aparelho Android físico permanece pendente.
