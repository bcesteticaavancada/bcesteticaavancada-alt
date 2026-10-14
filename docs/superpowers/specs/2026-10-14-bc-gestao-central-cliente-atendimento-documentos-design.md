# BC Gestão — Central da Cliente, Atendimento Rápido, Documentos Externos e TCLE de Bioestimulador

**Data:** 2026-10-14  
**Status:** Design aprovado em conversa; aguardando revisão formal da spec antes do plano de implementação.  
**Repositório:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Supabase correto:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)  
**Supabase proibido/legado:** `bc-estetica-pre-anamnese` (`vniyooppvxpdykausdvc`)  

## 1. Objetivo

Transformar a área existente de **Clientes** do BC Gestão na porta de entrada principal do prontuário clínico, sem criar um CRM paralelo e sem duplicar as regras já entregues nas Fases 6A–6D.

A profissional deve conseguir pesquisar uma cliente, abrir sua **Central da Cliente**, visualizar o histórico clínico completo, baixar documentos individualmente, anexar documentos externos e iniciar rapidamente um novo atendimento — inclusive como encaixe quando houver disponibilidade — preservando agenda, consentimentos, assinatura, rastreabilidade clínica, fotos, lotes, equipamentos, intercorrências e PDF final.

A mesma entrega inclui um **TCLE específico e versionado para Bioestimuladores**, seguindo o padrão já aplicado a Toxina Botulínica e Harmonização Facial / Preenchimento.

## 2. Princípios de arquitetura

1. **Evoluir o que existe.** A Central da Cliente será uma camada de orquestração sobre `clientes`, agenda, anamnese, documentos, tratamentos e módulos 6D. Não haverá um segundo prontuário.
2. **Um único banco, pastas lógicas por cliente.** Não criar banco separado por pessoa. Todo conteúdo continua vinculado por `cliente_id`, com isolamento lógico e autorização no backend.
3. **Nenhum atendimento solto.** Atendimento presencial sem agendamento prévio deve gerar um encaixe na agenda antes de seguir para a ficha clínica.
4. **Assinatura em tela permanece padrão integrado.** O sistema continua suportando assinatura touch/canvas e geração de PDF.
5. **Documentos externos são arquivo clínico, não substituição automática de consentimento.** PDF assinado pelo GOV.BR, documento digitalizado ou arquivo externo pode ser anexado à pasta; quando usado como TCLE daquele atendimento, exige vínculo explícito e revisão profissional.
6. **Storage sempre privado.** Downloads e visualizações usam URL assinada temporária; nenhuma URL pública.
7. **Histórico clínico não é apagado silenciosamente.** Arquivo anexado incorretamente deve ser anulado logicamente, com motivo e auditoria.
8. **Relatório/Parecer, não “laudo” por padrão.** O encerramento clínico da sessão gera `Relatório / Parecer do Atendimento`; a palavra “laudo” só deverá existir futuramente em fluxo específico juridicamente/profissionalmente adequado.
9. **Não quebrar 6A–6D.** Busca, cadastro, agenda, anamnese, consentimentos, tratamento, fotos, lotes, equipamentos e intercorrências permanecem fontes canônicas de verdade.

## 3. Experiência principal — Central da Cliente

### 3.1 Entrada

A área **Clientes** continua com pesquisa por nome, CPF e telefone, mas passa a priorizar busca rápida e abertura imediata da pasta clínica.

Ao tocar em uma cliente, a aplicação abre a Central da Cliente com cabeçalho persistente contendo:

- foto de identificação privada quando disponível;
- nome da cliente;
- telefone;
- idade derivada da data de nascimento;
- alertas clínicos ativos resumidos;
- ações principais.

### 3.2 Ações do cabeçalho

Ações canônicas:

- `+ Novo atendimento`
- `Agendar`
- `Anexar documento`
- `Editar cadastro`

A visibilidade/execução de cada ação respeita permissões existentes e novas regras desta spec.

### 3.3 Abas

A Central terá cinco áreas principais:

1. **Resumo** — checklist clínico, alertas ativos, anamnese atual, últimos atendimentos e pendências.
2. **Atendimentos** — tratamentos/sessões em ordem cronológica, com status e acesso à ficha.
3. **Anamnese e Alertas** — reutiliza 6B.
4. **Fotos** — identificação + fotos clínicas autorizadas pela estrutura já existente.
5. **Documentos** — feed unificado de documentos gerados pelo BC e arquivos externos.

As abas devem carregar conteúdo sob demanda para evitar uma página pesada. A Central é um orquestrador; não deve copiar dados clínicos para uma tabela “resumo” redundante.

## 4. Fluxo de Atendimento Rápido / Encaixe

### 4.1 Caso de uso

Exemplo aprovado: cliente chega sem horário e quer realizar Drenagem Linfática.

Fluxo esperado:

`Clientes → localizar cliente → Novo atendimento → escolher procedimento → escolher profissional/horário disponível → Criar encaixe → gates clínicos → TCLE/assinaturas → Iniciar → registrar sessão → Finalizar → Relatório/Parecer + PDF na pasta.`

### 4.2 Escolha do procedimento

A lista deve usar a Biblioteca Clínica atual e respeitar `can_execute`/restrições já existentes. A UI não pode oferecer como executável para a profissional um procedimento que o backend considera restrito.

### 4.3 Disponibilidade e encaixe

O encaixe deve reutilizar a agenda canônica (`agendamentos`) e as mesmas regras de autorização e conflito do fluxo normal.

A implementação deve preferir um **RPC transacional de orquestração**, por exemplo `public.bc_quick_visit_create(...)`, que:

- valida cliente ativo;
- valida profissional ativa e `atende_clientes`;
- valida que a profissional pode executar o procedimento;
- valida horário/disponibilidade com as mesmas regras da agenda;
- cria o agendamento como origem `encaixe`/`walk_in` sem confiar em autoria enviada pelo browser;
- prepara ou retorna o contexto necessário para abrir a ficha clínica vinculada ao agendamento;
- grava auditoria mínima de IDs/estado.

Esse RPC deve **reutilizar os validadores privados existentes** da agenda e tratamento quando possível; não duplicar regras em SQL novo se já houver helper canônico.

Se qualquer etapa obrigatória falhar, a criação deve ser atômica sempre que tecnicamente possível, evitando deixar atendimento clínico sem vínculo ou agendamento inconsistente.

### 4.4 Gates antes de iniciar

A abertura do atendimento não ignora nenhuma regra clínica existente. O sistema verifica, conforme o procedimento:

- anamnese geral válida;
- alertas clínicos relevantes;
- consentimento base aplicável;
- complemento específico do procedimento;
- assinaturas obrigatórias;
- requisitos adicionais definidos pela versão publicada do procedimento.

Os gates de início e de finalização continuam separados. Requisitos como foto “Depois” não podem impedir o início.

### 4.5 Assinatura

O fluxo integrado permanece:

- maior de idade: paciente + profissional responsável;
- menor, quando permitido pelo procedimento/regra aplicável: responsável legal + profissional;
- assinatura em tela via touch/canvas;
- hash, autoria, data/hora e Storage privado;
- geração de PDF após assinaturas obrigatórias.

A assinatura externa é alternativa documental, não substitui silenciosamente o fluxo integrado.

## 5. Registro durante a sessão

O atendimento rápido monta o mesmo `treatment-panel` já usado no fluxo comum.

Conforme o procedimento, permanecem disponíveis:

- campos clínicos/protocolo;
- fotos Antes / Depois / Adicional;
- produtos e lotes;
- equipamentos e parâmetros;
- intercorrências e evoluções;
- observações permitidas pela ficha.

A Central da Cliente não implementa versões paralelas desses módulos.

## 6. Relatório / Parecer do Atendimento

### 6.1 Finalidade

Todo tratamento finalizado deve possuir fechamento clínico estruturado. O nome padrão será **Relatório / Parecer do Atendimento**.

### 6.2 Campos mínimos

- procedimento realizado;
- região/área tratada;
- descrição da sessão;
- resposta observada / evolução imediata;
- intercorrências — preferencialmente referenciando o módulo estruturado 6D, sem duplicar narrativa desnecessária;
- orientações fornecidas;
- necessidade de retorno (`sim/não`);
- data sugerida de retorno, quando aplicável;
- observações complementares.

### 6.3 Persistência

Criar uma unidade explícita de fechamento, preferencialmente `clinical_treatment_reports` ou equivalente, vinculada 1:1 à versão finalizada do tratamento. O relatório deve entrar no snapshot/versionamento clínico do tratamento e ficar imutável após finalização, exceto pelo mecanismo já existente de correção/reabertura/versionamento.

### 6.4 PDF

Ao final, gerar documento clínico próprio ou seção documental rastreável no mecanismo `clinical_documents`, com:

- código do documento;
- cliente;
- procedimento;
- profissional e identificação profissional;
- data/hora;
- conteúdo do parecer;
- referência às assinaturas/documentos pertinentes;
- hash e Storage privado.

Esse PDF aparece automaticamente na aba **Documentos**.

## 7. Documentos da cliente — feed unificado

### 7.1 Separação de domínio

`clinical_documents` continua representando documentos gerados/controlados pelo BC Gestão.

Arquivos externos terão armazenamento lógico próprio, por exemplo:

### `client_files`

- `id uuid pk`
- `cliente_id uuid not null`
- `title text not null`
- `category text not null`
- `origin text not null`
- `document_date date null`
- `storage_path text not null unique`
- `mime_type text not null`
- `size_bytes bigint not null`
- `sha256 text not null`
- `uploaded_by uuid not null`
- `created_at timestamptz not null`
- `voided_at timestamptz null`
- `voided_by uuid null`
- `void_reason text null`

Categorias iniciais:

- `tcle_externo`
- `exame_documento_apresentado`
- `documento_digitalizado`
- `relatorio_externo`
- `outro_clinico`

Origens iniciais:

- `gov_br`
- `digitalizado`
- `upload_manual`
- `outro`

### 7.2 Tipos de arquivo

Aceitar inicialmente:

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`

Respeitar o limite privado atual do bucket, salvo decisão explícita futura. Não aumentar limites globais apenas para acomodar arquivos excessivos sem revisão de impacto.

### 7.3 Storage

Caminho proposto:

`arquivos-clientes/{cliente_id}/{uuid}.{ext}`

Regras:

- bucket `bc-prontuario-private`;
- sem `getPublicUrl`;
- upload apenas para equipe autorizada;
- metadata registrada por RPC após validar o objeto real no Storage;
- download/preview via URL assinada curta;
- nenhum `UPDATE`/`DELETE` comum em arquivo já registrado;
- anulação lógica preserva o objeto e registra auditoria.

### 7.4 Integridade

O browser calcula SHA-256 antes/depois do upload conforme fluxo seguro adotado; o backend registra hash, MIME, tamanho e autoria sem aceitar campos de autorização do cliente.

### 7.5 Feed documental

Criar API/RPC normalizada, por exemplo `bc_client_document_feed(p_cliente_id uuid)`, que una:

- `clinical_documents` gerados pelo BC;
- `client_files` externos não anulados;

retornando um modelo comum para a UI:

- `source_kind`
- `source_id`
- `title`
- `category/document_type`
- `origin`
- `status`
- `document_date`
- `created_at`
- `downloadable`

Cada item terá **seu próprio botão** `Baixar`; não haverá ZIP nesta fase.

## 8. TCLE externo vinculado ao atendimento

Guardar um arquivo externo na pasta **não** satisfaz automaticamente o gate de consentimento.

Quando a equipe quiser usar um PDF assinado externamente como consentimento de um atendimento, haverá ação explícita:

`Vincular como TCLE externo → selecionar atendimento/procedimento → revisão profissional → confirmar.`

Criar relação explícita, por exemplo `treatment_external_consents`:

- `id`
- `treatment_id`
- `client_file_id`
- `procedure_version_id`
- `consent_template_version_id` quando aplicável
- `reviewed_by`
- `reviewed_at`
- `created_at`

Regras:

- arquivo precisa pertencer ao mesmo `cliente_id` do tratamento;
- categoria deve ser compatível com TCLE;
- apenas profissional clínica ativa autorizada pode confirmar revisão;
- confirmar não altera o arquivo original;
- documento externo não é marcado como “verificado GOV.BR” automaticamente; origem é declaratória/documental, não validação criptográfica do GOV.BR;
- gate clínico aceita essa relação somente se o procedimento/versionamento esperado for compatível.

## 9. Permissões

### 9.1 Leitura da Central

Preservar o modelo atual de leitura clínica compartilhada por equipe ativa, salvo restrições específicas já existentes de procedimentos.

### 9.2 Agenda/encaixe

- perfil autorizado a operar agenda pode criar encaixe;
- colaboradora não ganha poder de agendar outra profissional se o modelo atual não permite;
- admin pode selecionar profissional conforme regra atual;
- backend é autoridade.

### 9.3 Execução clínica

Somente profissional ativa com `atende_clientes` e `can_execute=true` para o procedimento pode:

- assumir/iniciar tratamento;
- assinar como profissional;
- preencher/confirmar parecer final;
- finalizar tratamento.

### 9.4 Upload documental

Equipe autenticada autorizada pode anexar documento à pasta conforme política definida. A autoria vem de `auth.uid()`.

Anulação deve exigir motivo. Se a clínica desejar futuramente restringir anulação a admin, isso pode ser adicionado sem alterar o modelo de dados.

## 10. TCLE específico — Bioestimulador

### 10.1 Versionamento

Criar **nova versão publicada** do procedimento `Bioestimulador`, preservando integralmente a versão anterior como `superseded`.

Manter:

- classe documental injetável/invasiva;
- anamnese geral obrigatória;
- fotos obrigatórias, quando já configuradas;
- produto/lote obrigatório;
- demais flags da versão atual, salvo inconsistência detectada e aprovada separadamente.

### 10.2 Conteúdo do complemento específico

O complemento deve explicar que “bioestimulador” pode envolver produtos/substâncias diferentes e que indicação, região, quantidade, técnica, permanência e perfil de risco dependem do produto efetivamente utilizado.

Deve contemplar, sem prescrever conduta automática:

- resposta gradual e individual;
- possibilidade de necessidade de sessões/reavaliações;
- ausência de garantia de resultado;
- dor, edema, eritema, hematoma, sensibilidade;
- assimetria, irregularidade, inflamação, infecção;
- pápulas, nódulos e granulomas;
- reações/eventos tardios;
- riscos específicos conforme bula/IFU do produto efetivamente utilizado;
- rastreabilidade de marca, fabricante, substância/material, lote, validade, quantidade e região tratada;
- ausência de “reversão universal”;
- orientação para procurar a clínica/atendimento médico diante de sinais relevantes;
- declaração de que o consentimento não representa renúncia a direitos nem exoneração de responsabilidade.

O texto não deve presumir que todos os bioestimuladores são equivalentes nem transformar PMMA em bioestimulador estético genérico. Produtos com indicações específicas permanecem condicionados ao registro e à avaliação profissional.

## 11. Finalização do tratamento

O botão `Finalizar atendimento` só é liberado quando:

- atendimento está vinculado a agendamento/encaixe válido;
- anamnese/gates de início foram cumpridos;
- consentimento obrigatório está resolvido por assinatura integrada ou TCLE externo explicitamente revisado e vinculado;
- requisitos 6D da versão do procedimento estão cumpridos;
- Relatório/Parecer está preenchido;
- confirmação de intercorrência aberta segue a regra já existente;
- não há documento crítico pendente necessário à finalização.

A finalização deve congelar snapshot/versionamento incluindo referência ao parecer e aos documentos relevantes, sem incorporar bytes de arquivos externos ao JSON de snapshot.

## 12. Auditoria e privacidade

Registrar eventos mínimos, evitando duplicação de conteúdo clínico sensível no `audit_log`:

- abertura da Central pode não exigir log específico se a política atual não audita leitura;
- encaixe criado: IDs e horário;
- documento externo anexado: `client_file_id`, categoria/origem, sem narrativa clínica;
- documento anulado: ID + motivo curto controlado/texto mínimo;
- TCLE externo vinculado/revisado: IDs + versão;
- parecer final criado/finalizado: IDs/estado, não copiar texto clínico completo para auditoria.

Nenhum log deve armazenar bytes, URLs assinadas, assinatura PNG, CPF completo ou texto integral de parecer/TCLE sem necessidade.

## 13. UI mobile-first

A Central deve funcionar primeiro em telefone e depois ampliar para desktop.

Requisitos:

- campo de busca destacado no topo da área Clientes;
- cards de cliente fáceis de tocar;
- cabeçalho da cliente compacto;
- botões principais com alvo de toque adequado;
- abas roláveis no mobile, sem tabelas largas;
- documentos em cards com botão `Baixar` abaixo de cada item;
- `Novo atendimento` deve exigir poucos passos e mostrar apenas decisões necessárias;
- gates clínicos devem ser legíveis como `OK`, `Pendente`, `Bloqueado` com texto explicativo;
- sem esconder alertas clínicos importantes atrás de múltiplos níveis de navegação.

## 14. Tratamento de erros

- conflito de agenda: não criar encaixe e mostrar horário indisponível;
- cliente arquivada/inativa: bloquear novo atendimento;
- profissional sem permissão: bloquear antes de criar contexto clínico;
- upload inválido/MIME/tamanho: rejeitar antes do registro;
- upload no Storage sem metadata registrada: tentar limpeza segura apenas se não comprometer histórico; nunca expor arquivo órfão publicamente;
- TCLE externo de outra cliente: rejeição backend;
- documento anulado: não pode satisfazer gate;
- falha de PDF: manter estado recuperável/retry conforme padrão existente;
- finalização incompleta: retornar lista de razões/gates pendentes, não erro genérico.

## 15. Testes obrigatórios

Implementação será TDD.

Cobertura mínima:

1. busca/abertura da Central sem quebrar IDs e integrações atuais;
2. tabs e lazy loading;
3. novo atendimento via encaixe para cliente ativa;
4. conflito de agenda e profissional sem autorização;
5. procedimento restrito respeitando `can_execute`;
6. assinatura integrada existente continua funcional;
7. upload PDF/JPEG/PNG/WebP privado;
8. rejeição de MIME/tamanho/caminho falsificado;
9. URL assinada sem `getPublicUrl`;
10. feed unificado de documentos;
11. botão individual de download;
12. anulação lógica de arquivo;
13. TCLE externo não satisfaz gate sem revisão/vínculo;
14. TCLE externo de cliente diferente rejeitado;
15. parecer obrigatório antes da finalização;
16. snapshot final referencia parecer/documentos sem armazenar bytes/URLs;
17. Bioestimulador v1 preservado e nova versão publicada;
18. suplemento de Bioestimulador contém riscos/rastreabilidade e não promete reversão universal;
19. regressão completa de BC Gestão, pré-anamnese e geradores de PDF.

## 16. Fora de escopo

Nesta fase, não implementar:

- integração direta com API do GOV.BR;
- validação criptográfica automática de assinatura GOV.BR;
- portal público para cliente fazer upload;
- download ZIP da pasta completa;
- novo CRM separado;
- novo estoque completo de produtos;
- prontuário em banco separado por cliente;
- pagamento automático no momento do encaixe;
- envio automático por WhatsApp/e-mail;
- reconhecimento/OCR de documentos digitalizados;
- exclusão física comum de documentos clínicos já registrados;
- “laudo” genérico para qualquer sessão.

## 17. Critérios de aceitação

A fase estará concluída quando, em ambiente validado com dados fictícios:

1. equipe consegue pesquisar cliente e abrir a Central;
2. Central reúne resumo, atendimentos, anamnese/alertas, fotos e documentos;
3. cliente sem agendamento pode receber encaixe válido a partir de `Novo atendimento`;
4. o encaixe aparece na agenda e abre o fluxo clínico existente;
5. gates, TCLE e assinatura em tela permanecem funcionais;
6. sessão pode ser iniciada, documentada e finalizada apenas por profissional autorizada;
7. finalização exige Relatório/Parecer e gera PDF rastreável;
8. PDF do parecer aparece automaticamente em Documentos;
9. equipe consegue anexar PDF/imagem externa à pasta privada;
10. cada arquivo possui download individual por URL assinada;
11. documento externo pode ser anulado sem apagar o histórico;
12. TCLE externo só vale para um atendimento após vínculo e revisão profissional explícitos;
13. Bioestimulador passa a usar nova versão com suplemento específico e versão anterior preservada;
14. nenhuma migration ou código toca o Supabase legado de pré-anamnese;
15. testes e CI completos permanecem verdes antes de merge/publicação.

## 18. Estratégia de entrega recomendada

Implementar em fatias pequenas dentro de uma mesma iniciativa:

- **Fatia A — TCLE Bioestimulador**: mudança clínica versionada e independente.
- **Fatia B — Central da Cliente**: nova interface/orquestração sobre APIs existentes.
- **Fatia C — Documentos externos**: `client_files`, Storage privado, feed e download.
- **Fatia D — Atendimento rápido/encaixe**: orquestração agenda → tratamento.
- **Fatia E — Relatório/Parecer**: persistência, gate, PDF e integração documental.
- **Fatia F — TCLE externo vinculado**: revisão profissional e gate alternativo.
- **Fatia G — hardening/regressão final**: RLS, grants, auditoria, CI e smoke tests.

A ordem pode ser refinada no plano de implementação, mas nenhum frontend deve ser publicado antes de sua dependência de backend estar aplicada e validada.
