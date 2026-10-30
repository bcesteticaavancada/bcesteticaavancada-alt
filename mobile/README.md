# BC Estética Avançada — aplicativo mobile (protótipo isolado)

Este diretório contém a **primeira implementação de interface própria em React Native / Expo** da BC. Não é uma WebView, não redireciona para o site e não compartilha o HTML do GitHub Pages. O mesmo backend da BC poderá ser conectado futuramente por APIs autenticadas, após homologação.

## Estado atual — V0.5 (Black · Rose Gold · Ouro Branco, em revisão)

- ✨ Tipografia ampliada e contrastes reforçados em navegação, agenda, catálogo, contato e área da cliente.
- ✨ Identidade premium preto/rose gold/ouro branco com superfícies claras e painéis escuros de alto contraste.
- ✨ Fotos institucionais locais da equipe: Mel, Alice, Aline, Kátia e imagem coletiva da BC; Vânia é exibida com a foto coletiva, aguardando retrato individual confirmado.
- ✨ Logotipo dourado sem fundo em cabeçalho e splash; preservados os ícones originais do protótipo.
- 🔒 Nada é enviado ao backend, nenhuma foto clínica privada foi importada e nada foi publicado na loja.

### Histórico da V0.4

- ✨ Home com composição editorial e camadas rose gold/champagne, selo da marca, assinatura BC, cartões refinados, ambientes e equipe ilustrada por monogramas (sem fotos pessoais).
- ✨ Catálogo e detalhes de procedimentos com painéis premium; telas de Agenda, Contato e Minha BC com identidade visual própria e coesa.
- ✨ Apresentação institucional de Mel, Alice, Aline, Kátia e Vânia, sem validar permissões clínicas e sem habilitar contato real.
- ✅ Sem novos pacotes, permissões do sistema, segredos ou dependências remotas.
- 🔒 A V0.4 continua 100% demonstrativa; documentos, dados reais, agendamento e mensagens permanecem desconectados.

### Histórico da V0.3

- ✅ Marca BC oficial incorporada ao bundle: logotipo local, ícone do aplicativo e tela inicial.
- ✅ Home editorial rose gold/vinho com foto real da recepção, cartões de procedimentos, galeria dos ambientes e jornada informativa.
- ✅ Imagens dos espaços vêm dos arquivos públicos institucionais já mantidos pela BC no repositório; sem carregamento remoto de fotos e sem dados clínicos.

- ✅ Interface nativa de demonstração: Início, Cuidados, Agenda, Contato, Minha BC.
- ✅ Catálogo inicial institucional de procedimentos e pesquisa/filtros.
- ✅ Tela da Agenda V2 ligada ao contrato de leitura por fixtures: catálogo, profissionais, mês/dia e horários; calendário com meses completos e domingos indisponíveis.
- ✅ Seletores locais de procedimento, profissional, data e horário (simulação).
- ✅ Adaptador de leitura da Agenda V2 (catálogo, profissionais, dias e slots), sem ação de gravação.
- ✅ Testes automatizados com fixtures fictícias e cliente HTTP injetado, sem rede real.
- ✅ Prévia interativa da futura área da cliente: Histórico, Cuidados e Documentos, apenas exemplos fictícios e sem arquivos reais.
- ✅ Prévia de contato e comunicação (rascunho em memória, sem envio).
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

A V0.5 utiliza logo e ícones da BC que já constam nos arquivos oficiais do site; precisam de aceite visual da Mel e do Fernando para distribuição. Ainda não há assinatura de produção para AAB/IPA nem configuração EAS de publicação. A paleta permanece provisória até homologação.

## Arquitetura pretendida (fases posteriores)

1. Verificar contrato de dados da BC Gestão (agendamento público, clientes, papéis, profissionais e consentimentos). A interface já consome o contrato de leitura da Agenda V2 **com fixtures**; o endpoint real não está configurado nem habilitado.
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
- Agenda navega por fixture isolada do contrato real; a confirmação informa que nenhuma reserva foi registrada.
- Minha BC apresenta somente registros e documentos explicitamente ilustrativos, sem acesso aos pacientes.
- Nenhuma mensagem é enviada ou armazenada fora da memória local da tela.
- TypeScript e testes da agenda devem passar no CI após cada alteração.
- O APK V0.3 foi gerado e recebeu avaliação inicial de Fernando em 30/10/2026. A V0.5 deve passar por build, instalação e aceite visual em celular físico.
- Nenhum aceite para publicação na Google Play ou Apple App Store foi concedido.
