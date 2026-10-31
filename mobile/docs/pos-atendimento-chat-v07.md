# BC Mobile V0.7 — experiência da cliente e comunicação de pós-atendimento

**Status:** desenho de produto e interface de prévia, 31/10/2026. **Não integrado à produção.**
**Responsáveis pela decisão:** Fernando (produto/arquitetura), Mel (revisão clínica e regras de atendimento).

## Experiência desejada

O aplicativo deve ser elegante, rápido e simples. Quatro áreas principais: **Início, Cuidados, Agenda, Minha BC**. O chat fica em Minha BC, vinculado ao atendimento, não no menu público. A logo usada no cabeçalho é a arte local `app-icon.png` em alta resolução com proporções preservadas, sem borda, texto duplicado ou selo de testes em destaque.

### Minha BC (após autenticação futura)

1. **Pós-atendimento:** informações individualizadas, orientações aprovadas pela profissional, acompanhamento de evolução e agendamento de retorno.
2. **Conversas:** canal reservado com profissional responsável, categorias **Dúvida, Reação, Intercorrência**, anexo opcional somente após validação de formato, tamanho, conteúdo e consentimento.
3. **Arquivos:** anamneses, termos e consentimentos aprovados, PDFs de cuidados e documentos associados ao atendimento correto.

A V0.7 mostra essas três experiências com elementos locais e aviso de prévia. **Nenhum texto digitado, dado clínico, documento ou mensagem é salvo/enviado.** O botão é explicitamente `Simular envio da mensagem`.

## Regras de privacidade e acesso (bloqueantes antes da integração real)

- Autenticação Supabase Auth usando fluxo PKCE/URL de retorno validado, sem chaves de serviço no aplicativo. Revalidar sessão, revogar tokens e aplicar bloqueio em caso de conta suspensa.
- Associação cliente `auth.uid` ↔ paciente aprovada por verificação de identidade; **não** resolver identidade por nome/telefone fornecido em uma tela.
- `conversation` vinculada a `appointment_id`, `patient_id` e `assigned_staff_id` — a profissional só acessa casos formalmente atribuídos e ainda autorizados.
- RLS e permissões explícitas para leitura/escrita: cliente somente suas próprias conversas; profissional designada as suas; gestora clínica conforme papéis e necessidade. A área de desenvolvimento/arquitetura não concede leitura clínica ampla.
- Histórico auditável para criação, mudanças de atribuição, leituras especiais e anexos; arquivos privados, criptografia em trânsito, links de download com curta validade, sem logs com conteúdo sensível.
- Notificação push sem nome de cliente, sintomas, texto da conversa, arquivo ou procedimento; apenas aviso genérico de nova mensagem.
- Retenção e exclusão segundo a política da BC e obrigações documentais; não prometer apagar registros clínicos sujeitos a dever legal de conservação.
- Revisão de LGPD, autorização de tratamento de dados sensíveis, política pública HTTPS e processo de exercício de direitos.

## Segurança da comunicação

- **Não é canal de emergência.** Mensagem sobre possível reação grave ou intercorrência exibe aviso de procurar serviço de urgência quando apropriado; não recomendar esperar resposta no app.
- A categoria escolhida facilita **encaminhamento humano**; o sistema não deve atribuir diagnóstico, classificar gravidade ou decidir conduta automaticamente.
- Mel define horário de cobertura, tempo de resposta, substituição quando profissional está ausente, escalonamento clínico e texto de orientação.
- O fluxo deve tratar falha no envio, offline, duplicação, anexos, leitura não confirmada e notificações sem causar falsa sensação de atendimento concluído.
- Conteúdos de pós-procedimento e respostas clínicas são atribuídos e aprovados por profissionais habilitadas.

## Plano de implementação

| Fase | Ambiente | Entrega | Critério |
| --- | --- | --- | --- |
| 0.7 | Demo isolada | Marca maior, menu 4 abas, telas enxutas, chat categorizado simulado | TypeScript, CI, APK, revisão visual em Android |
| 0.8 | Staging com fixtures | Contratos de API, perfis de profissional, mensagens simuladas, anexos fictícios | Testes RLS cruzados, nenhum vazamento entre clientes |
| 0.9 | Staging privado | Auth real de teste, fluxo de atendimento e políticas/consentimentos | Mel valida categorias e operação; testes aparelhos reais |
| 1.0 candidata | Produção sob aprovação | Agendamento/área da cliente operacional e segura, Política/Data safety, AAB assinado | Aceite Fernando+Mel, teste fechado Play, auditoria de privacidade |

Não alterar nem mesclar PRs do TCLE (#66), migração (#69), Maya (#63/#70) ou central Drive (#73) como efeito colateral desta tela. A integração futura deve preservar os cadastros e backups existentes.

## Homologação de experiência

- [ ] Logo grande, nítida e sem corte em S23 Plus (retrato) e em fonte ampliada.
- [ ] Menu de quatro botões com área de toque suficiente e sem rótulos truncados.
- [ ] Home mostra proposta da BC, ações Agendar e Minha BC e fotos institucionais sem excesso de blocos.
- [ ] Conversa muda entre Dúvida/Reação/Intercorrência; nenhuma mensagem é enviada.
- [ ] Se categoria envolve reação/intercorrência, aviso de urgência fica visível.
- [ ] Pós e Arquivos não expõem conteúdo clínico sem Auth.
- [ ] Voltar físico Android, rolagem, contraste, TalkBack e teclado testados em aparelho.
