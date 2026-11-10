# BC Mobile — portas de aprovação da Google Play (V0.6)

**Data:** 31/10/2026 · **Proprietários de aceite:** Fernando Victor e Maria Luísa (Mel) · **Situação:** rascunho, NÃO PUBLICAR.

Esta preparação não habilita conexão com Supabase, prontuários, Google Drive, fotografias clínicas, mensagens reais, checkout ou autenticação. O APK e seus dados são **demonstrativos**, com **dados fictícios**. O app deve oferecer funcionalidades concretas e políticas completas antes de ser encaminhado à revisão pública da Google Play.

## I. Experiência essencial / desempenho (bloqueante)

- [x] Navegação nativa entre cinco abas; marca, ambientes e fotos institucionais locais.
- [x] Fluxo Android Voltar, rolagem reiniciada ao trocar de aba, catálogo, pesquisa e filtros.
- [x] Interesses salvos somente em memória (sem persistência, identificadores ou analytics).
- [x] Tela de transparência da demonstração e mensagens sem envio.
- [ ] Testar instalação física Android 13–16, diferentes fontes/tamanhos de tela e acessibilidade (TalkBack, toque, contraste e fonte 200%).
- [ ] Medir tempo de abertura, consumo de memória, travamentos e tamanho final no telefone real; não introduzir rastreadores sem consentimento.
- [ ] Implementar pelo menos **um fluxo útil realmente operacional** antes de submeter à loja (por exemplo, consulta de contato/WhatsApp oficial com consentimento, ou agendamento real em endpoint homologado). **A prévia simulada não é release candidata.**
- [ ] Proteger endpoints reais com RLS, controle de sessão, tratamento de erros e testes com contas fictícias. Não reusar ambiente clínico para QA.
- [ ] Revisão clínica da Mel dos textos de cuidados, permissões de profissionais e apresentação de resultados.

## II. Preparação Android e integridade

- [x] `expo.version=0.6.0`, `android.versionCode=6`, pacote `br.com.bcesteticaavancada.app`.
- [x] Expo SDK 57 (compilação Android API 36 verificada em documentação do SDK); revisar novamente no momento do envio.
- [x] Perfis EAS `preview` (APK) e `production` (AAB) declarados em `eas.json`.
- [ ] Confirmar titularidade definitiva do nome do pacote no Play Console antes de registrar/assinar.
- [ ] Vincular EAS ao **projeto Expo correto do proprietário**, guardar upload keystore sob controle da BC e ativar Play App Signing.
- [ ] Gerar **AAB assinado**, instalar/testar via faixa de testes da Play, validar permissões, `versionCode` exclusivo, ícone adaptativo, imagem de capa e screenshots reais da versão final.
- [ ] Preencher categoria, classificação indicativa, conteúdo do aplicativo, contatos oficiais, país(es), dados do desenvolvedor e descrição honesta.
- [ ] Verificar Google Play SDK Index, Target API vigente, compatibilidade e política de fotografias de terceiros antes de enviar.

## III. Privacidade, segurança e confiança (bloqueante)

- [ ] Publicar política de privacidade verdadeira e específica em HTTPS público, acessível **no app e na ficha da Play**, descrevendo controlador BC, coleta, finalidade, compartilhamento, retenção, exclusão, direitos LGPD e contato verificado. A tela da demonstração **não** supre essa exigência.
- [ ] Preencher formulário **Segurança dos dados (Data safety)** com base em auditoria das bibliotecas, endpoints, backups e eventuais terceiros, sem prometer “zero coleta” depois que houver Auth/API.
- [ ] Se oferecer criação de contas: disponibilizar **exclusão de conta dentro do aplicativo e fora dele via link web**; considerar retenções legais de dados clínicos com transparência.
- [ ] Se houver conteúdo sobre saúde/procedimentos: revisar a declaração de **Health Apps** aplicável, descrições e avisos de não diagnóstico, conforme Play Console.
- [ ] Se houver login/área restrita: fornecer ao revisor da Play **conta de testes fictícia funcional**, instruções de acesso e nenhum dado pessoal real.
- [ ] Confirmar consentimento de uso de retratos da Mel, Alice, Aline, Kátia, Vânia e ambientes institucionais também para distribuição em loja.
- [ ] Não colocar `service_role`, token de backend, chave OAuth, segredo de assinatura, documentos pessoais ou dados de pacientes no pacote/mobile CI/artifacts.
- [ ] Validar acessos RLS específicos de cliente e colaboradora, proteção de PDFs, exclusão e revogação de sessão antes da área Minha BC real.

## IV. Testes fechados e autorização

- [ ] Identificar se a conta Play é pessoa física ou organização. Para conta pessoal criada após **13/11/2023**, confirmar o requisito de **mínimo 12 testadores por 14 dias consecutivos**, seguido de pedido de acesso à produção.
- [ ] Abrir teste interno/fechado primeiro com APK/AAB sem dados clínicos; documentar bugs críticos, crashes e aceite visual da Mel.
- [ ] Validar publicação de domínio próprio, Auth, agenda e políticas separadamente; não fazer merge automático dos PRs #63, #66, #69, #70, #73.
- [ ] Reunir aceite final por escrito de Fernando e Mel para **AAB específico**, versão, funcionalidades, privacidade e lançamento; então publicar na faixa apropriada.

## Comandos previstos (somente após autenticação legítima no EAS da BC)

```bash
cd mobile
npm ci
npm run check
npm run test:agenda
npm run test:play
npx eas-cli build --platform android --profile preview
# Após todos os itens bloqueantes e autorização expressa:
npx eas-cli build --platform android --profile production
```

O último comando **somente compila** um AAB; não o submete automaticamente. A distribuição pela Play Console exige preparação e permissões adicionais, sob a conta de desenvolvedor responsável.

## Referências oficiais

- [Google Play: requisitos de nível de API](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play: política de privacidade e dados do usuário](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google Play: exclusão de conta e dados](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play: testes para novas contas pessoais](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google Play: funcionalidade mínima](https://support.google.com/googleplay/android-developer/answer/9899034)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
