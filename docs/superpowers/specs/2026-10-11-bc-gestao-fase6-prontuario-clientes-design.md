# BC Gestão — Fase 6: Pasta da Cliente, prontuário clínico e biblioteca de procedimentos

**Data:** 2026-10-11  
**Status:** design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação  
**Repositório:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)  
**Fuso clínico:** `America/Sao_Paulo`

## 1. Objetivo

Evoluir a área **Clientes** do BC Gestão para uma **Pasta da Cliente / prontuário estético eletrônico completo**, preservando o cadastro único da BC, o histórico clínico compartilhado entre profissionais autorizadas e a segregação do financeiro por profissional.

A Pasta da Cliente deve concentrar, de forma cronológica, versionada e auditável:

- cadastro e identificação;
- foto de identificação;
- anamnese geral versionada;
- módulos específicos por procedimento;
- alertas clínicos;
- consentimentos/termos;
- procedimentos e fichas de atendimento;
- produtos, lotes e equipamentos;
- fotos clínicas;
- intercorrências e evoluções;
- planos de tratamento/pacotes;
- documentos e PDFs assinados;
- retornos/agenda;
- financeiro conforme permissão;
- auditoria de ações sensíveis.

A cliente pertence à **BC Estética**, não a uma profissional específica. Toda profissional ativa autorizada pode consultar o histórico clínico compartilhado necessário à continuidade do atendimento. O financeiro permanece isolado segundo as regras da Fase 5.

## 2. Decisões de produto aprovadas

1. O cadastro da cliente é único para toda a BC.
2. CPF é único no cadastro quando informado como identificador obrigatório.
3. Toda profissional ativa pode visualizar o prontuário clínico compartilhado da cliente.
4. Alice, Kátia, Mel e futuras profissionais ativas podem visualizar procedimentos/fichas feitos por outras profissionais.
5. A profissional só cria e altera registros clínicos de sua própria autoria.
6. A autora pode corrigir a própria ficha durante o **mesmo dia clínico** do atendimento.
7. Depois da virada do dia em `America/Sao_Paulo`, a ficha fica bloqueada para alteração pela autora.
8. Após o bloqueio, a autora solicita reabertura; a Mel/ADM autoriza; a própria autora corrige; tudo é auditado.
9. Não há exclusão destrutiva de histórico clínico.
10. Cada procedimento realizado gera uma ficha própria, mesmo que existam vários procedimentos no mesmo dia.
11. O prontuário clínico é compartilhado; o financeiro não é.
12. Mel/ADM vê o financeiro completo da cliente e o consolidado administrativo.
13. Cada colaboradora vê apenas o financeiro ligado aos próprios atendimentos/produção.
14. Existe uma **Anamnese Geral** versionada, compartilhada pela equipe clínica.
15. Cada procedimento pode exigir módulo específico de anamnese e termo próprio.
16. A Anamnese Geral deve ser revisada completamente a cada 12 meses ou antes se houver mudança clínica relevante.
17. Antes de cada atendimento há confirmação sobre mudanças clínicas desde a última anamnese.
18. Fotos clínicas são privadas por padrão; uso em marketing exige autorização separada e explícita.
19. Anamneses, termos e documentos clínicos assinados geram PDFs próprios e versionados.
20. Paciente/responsável e profissional assinam na tela de celular/tablet.
21. Dados profissionais no PDF incluem nome, profissão, conselho e registro, derivados do perfil administrativo.
22. A Biblioteca Clínica define requisitos de cada procedimento.
23. Procedimentos gerais podem ser iniciados por qualquer profissional ativa.
24. Procedimentos restritos têm lista explícita de profissionais autorizadas.
25. Regra interna inicial: **Toxina Botulínica/Botox** fica restrita a Mel e Alice.
26. Restrição de procedimento é validada no backend/RPC, não só na interface.
27. Cortesia, permuta, isenção e ajuste financeiro excepcional podem ser solicitados pela profissional, mas só produzem efeito após aprovação da Mel.
28. O diretório legado `/admin/` permanece intocado; esta fase pertence ao BC Gestão em `/gestao/...`.

## 3. Cadastro da cliente

### 3.1 Campos

- foto de identificação;
- nome completo;
- CPF;
- data de nascimento;
- idade calculada dinamicamente;
- telefone;
- e-mail;
- endereço estruturado;
- responsável legal quando aplicável;
- status ativa/arquivada;
- autoria/timestamps.

### 3.2 Cadastro rápido

Obrigatórios para criar:

- nome completo;
- CPF;
- data de nascimento;
- telefone.

E-mail é opcional. Endereço pode ser completado depois. Complemento do endereço é opcional.

A idade não deve ser salva como número fixo; deve ser calculada a partir da data de nascimento.

### 3.3 Endereço

Campos:

- CEP;
- logradouro;
- número;
- complemento;
- bairro;
- cidade;
- UF.

Busca por CEP pode pré-preencher, mantendo edição manual.

### 3.4 Foto de identificação

Permitir:

- câmera do celular/tablet;
- galeria.

Ao trocar a foto principal, preservar a anterior no histórico.

### 3.5 Duplicidade

CPF repetido bloqueia novo cadastro e oferece **Abrir prontuário**.

Na ausência de condição confiável pelo CPF, alertar possível duplicidade por:

- nome completo;
- nascimento;
- telefone.

Esse segundo mecanismo é alerta, não confirmação automática de identidade.

### 3.6 Menores de idade

Se idade < 18 anos, abrir dados do responsável legal:

- nome;
- CPF;
- vínculo/parentesco;
- telefone;
- assinatura quando aplicável.

Ao completar 18 anos, novos documentos seguem assinatura do paciente adulto, sem apagar o histórico anterior.

## 4. Pasta da Cliente

Ao criar/abrir uma cliente, exibir pasta própria.

### 4.1 Cabeçalho

- foto;
- nome;
- idade;
- telefone;
- alertas clínicos ativos;
- última anamnese;
- último atendimento;
- próximo agendamento;
- plano de tratamento ativo.

### 4.2 Abas

- **Cadastro**;
- **Anamnese**;
- **Procedimentos**;
- **Atendimentos**;
- **Fotos**;
- **Documentos**;
- **Financeiro**.

### 4.3 Checklist

Mostrar pendências como:

- cadastro básico;
- endereço;
- foto;
- anamnese geral;
- consentimentos;
- retorno;
- sessão de plano pendente.

## 5. Linha do tempo unificada

Tela principal da pasta com filtros:

- Todos;
- Procedimentos;
- Fichas de atendimento;
- Anamneses;
- Termos/consentimentos;
- Fotos;
- Intercorrências;
- Retornos;
- Planos;
- Documentos.

Cada item abre o registro correspondente. Valores financeiros não aparecem na linha clínica.

## 6. Anamnese Geral

### 6.1 Modelo

A cliente possui uma Anamnese Geral da BC, compartilhada pela equipe clínica ativa.

A anamnese é versionada. Nova versão nunca apaga a anterior.

Cada atendimento mantém referência à versão válida na data do procedimento.

### 6.2 Seções mínimas

- identificação derivada do cadastro;
- queixa principal;
- objetivo estético;
- histórico de saúde atual/pregresso;
- condições/doenças relevantes;
- acompanhamento médico quando aplicável;
- medicamentos e suplementos;
- alergias e reações anteriores;
- cirurgias e procedimentos prévios;
- histórico dermatológico;
- cicatrização/queloide quando aplicável;
- hábitos/estilo de vida;
- nicotina/tabagismo;
- álcool;
- exposição solar/fotoproteção;
- gestação/amamentação quando aplicável;
- histórico estético;
- procedimentos prévios e complicações;
- observações livres;
- declaração de veracidade/atualidade;
- assinatura paciente/responsável;
- assinatura da profissional.

Usar lógica condicional: respostas negativas seguem; respostas positivas abrem detalhes.

### 6.3 Confirmação antes de cada atendimento

Perguntar se houve mudança em saúde, medicamentos, alergias, cirurgias ou condição clínica.

Se `não`:

- registrar confirmação;
- data/hora;
- profissional;
- manter versão vigente.

Se `sim`:

- exigir atualização;
- criar nova versão;
- colher novas assinaturas conforme fluxo.

### 6.4 Renovação anual

Após 12 meses, a anamnese passa a `vencida` e exige revisão completa antes dos procedimentos configurados como dependentes de anamnese vigente.

### 6.5 Estados

- `nao_iniciada`;
- `em_preenchimento`;
- `aguardando_revisao_profissional`;
- `aguardando_assinaturas`;
- `finalizada`;
- `vencida`;
- `substituida`.

## 7. Preenchimento remoto

Pode ocorrer:

1. presencialmente em aparelho da BC;
2. remotamente antes da consulta.

### 7.1 Link seguro

- individual;
- token aleatório não enumerável;
- validade de 72 horas;
- abre somente a ficha em preenchimento;
- não abre pasta, fotos, histórico ou financeiro;
- deixa de funcionar ao finalizar/revogar;
- pode ser regenerado se expirar.

### 7.2 Pré-preenchimento não finaliza

Fluxo remoto:

`cliente pré-preenche → aguardando revisão profissional → revisão presencial → aguardando assinaturas → assinatura paciente/responsável + assinatura profissional → finalizada`

## 8. Alertas clínicos

### 8.1 Origem

- automáticos, derivados da anamnese;
- manuais, registrados pela profissional.

### 8.2 Níveis visuais

- crítico;
- atenção;
- informativo.

### 8.3 Conteúdo

Cada alerta registra:

- origem;
- descrição;
- nível;
- autor quando manual;
- data/hora;
- ativo/inativo;
- motivo de inativação.

Exemplos de origem: alergia, medicamento relevante, reação prévia, herpes, cicatrização alterada, condição clínica informada ou intercorrência aberta.

O sistema **não diagnostica** e não decide automaticamente se um procedimento pode ou não ser realizado.

### 8.4 Histórico

Colaboradora não exclui alerta antigo. Pode solicitar revisão. Mel pode inativar preservando histórico.

### 8.5 Confirmação de leitura

Antes de iniciar procedimento, a profissional confirma que revisou alertas ativos.

Registrar profissional, atendimento, data/hora e referência ao estado dos alertas apresentados.

## 9. Biblioteca Clínica de procedimentos

### 9.1 Ficha-mãe

Cada procedimento tem ficha-mãe configurável pela Mel/ADM.

Ela pode definir:

- nome/família;
- ativo/inativo;
- descrição administrativa;
- valor padrão;
- duração sugerida;
- necessidade de Anamnese Geral vigente;
- módulo específico;
- termo próprio;
- campos obrigatórios/opcionais da ficha;
- fotos obrigatórias/opcionais;
- produto/lote exigido;
- equipamento/parâmetros;
- orientação pré;
- orientação pós;
- sinais de alerta/orientações de contato;
- retorno obrigatório/recomendado/não necessário;
- prazo de retorno;
- acesso geral/restrito;
- profissionais autorizadas quando restrito.

### 9.2 Catálogo inicial

Preparar catálogo amplo, com itens não utilizados como inativos. Famílias iniciais:

- toxina botulínica;
- preenchimentos;
- bioestimuladores;
- skinboosters/correlatos;
- outros injetáveis estéticos aplicáveis à operação;
- limpeza de pele;
- peelings;
- microagulhamento;
- dermaplaning;
- protocolos faciais não injetáveis;
- laser/IPL/LED;
- radiofrequência;
- ultrassom/HIFU e tecnologias correlatas;
- procedimentos corporais;
- criolipólise e tecnologias corporais;
- intradermoterapia/enzimas quando aplicável à operação;
- drenagem;
- massagem modeladora;
- massagem;
- pós-operatório;
- capilar/tricologia estética;
- outros procedimentos cadastráveis futuramente.

A presença no catálogo não significa oferta ativa da BC nem autorização profissional automática.

O conteúdo clínico dos templates deve ser construído/validado a partir de referências técnicas e regulatórias adequadas para cada procedimento; a aplicação não deve inventar contraindicações ou condutas.

### 9.3 Geral × restrito

`geral`: qualquer profissional ativa pode iniciar/registrar.

`restrito`: somente profissionais explicitamente autorizadas podem iniciar/assinar.

Regra interna inicial:

- **Toxina Botulínica/Botox:** restrito a Mel e Alice.

Permissão validada no backend/RPC.

## 10. Módulos específicos e termos

Além da Anamnese Geral, um procedimento pode exigir perguntas adicionais próprias e termo de consentimento/responsabilidade próprio.

Exemplo:

`Anamnese Geral vigente → módulo de toxina → termo de toxina → ficha de atendimento de toxina`

Templates/perguntas devem ser versionados para que atendimento antigo permaneça ligado à versão válida naquele dia.

A Anamnese Geral não substitui o consentimento específico do procedimento.

## 11. Assinaturas

Assinar na tela de celular/tablet, seguindo a experiência já adotada na pré-anamnese, com assinatura adicional da profissional.

Documento deve guardar:

- assinatura do paciente ou responsável;
- assinatura da profissional;
- nome da profissional;
- profissão;
- conselho;
- número de registro;
- data/hora;
- versão;
- identificador único.

Dados profissionais vêm do cadastro administrativo e não podem ser alterados dentro de documento emitido.

## 12. PDFs e versionamento

### 12.1 PDFs próprios

Gerar PDF para:

- Anamnese Geral finalizada;
- termo/consentimento finalizado;
- ficha de atendimento finalizada;
- outros documentos clínicos futuros.

A foto de identificação da cliente deve poder constar nos PDFs clínicos, inclusive Anamnese Geral e ficha de atendimento, quando disponível e pertinente ao template.

### 12.2 Ficha de atendimento em PDF

Quando aplicável, incluir:

- identificação/foto;
- procedimento;
- data/hora;
- profissional;
- profissão/conselho/registro;
- queixa/objetivo;
- avaliação;
- técnica/produtos/equipamentos;
- lote/validade/quantidade;
- região;
- parâmetros;
- resposta imediata;
- intercorrências do atendimento;
- orientações;
- retorno;
- assinatura profissional;
- referência à anamnese vigente;
- referência aos termos;
- código único.

### 12.3 Documento finalizado é histórico

PDF já emitido não é sobrescrito.

Se houver correção que altere conteúdo de documento já finalizado, gerar nova versão e preservar a anterior.

#### Correção no mesmo dia

A autora pode corrigir a própria ficha no mesmo dia sem autorização da Mel.

Se a ficha já tinha sido finalizada/assinada:

- a correção gera nova versão do documento;
- a versão anterior permanece preservada;
- assinaturas afetadas devem ser coletadas novamente quando o conteúdo assinado tiver sido alterado;
- auditoria registra a retificação.

#### Correção depois da virada do dia

Exige:

1. solicitação da autora;
2. autorização da Mel;
3. edição pela própria autora;
4. nova finalização/assinaturas aplicáveis;
5. nova versão do PDF;
6. auditoria completa.

## 13. Entrega de documentos

Equipe autorizada pode entregar PDF individual por:

- download;
- e-mail;
- compartilhamento via WhatsApp do dispositivo.

Não criar link público permanente para prontuário.

Registrar quando possível: documento, profissional, data/hora e canal/finalidade.

## 14. Fotos clínicas

### 14.1 Categorias

- foto de identificação;
- foto clínica `antes`;
- `durante`;
- `depois`;
- `evolucao`.

### 14.2 Metadados

Ligar a:

- cliente;
- atendimento/procedimento;
- profissional;
- data/hora;
- região corporal/facial;
- etapa;
- observação.

Permitir câmera + galeria.

### 14.3 Privacidade

Foto clínica é privada no prontuário.

Autorização clínica não equivale a autorização de marketing.

Uso em site/redes/publicidade depende de autorização específica e explícita, registrada separadamente.

## 15. Ficha de atendimento

### 15.1 Uma ficha por procedimento/sessão

Mesmo dia pode conter várias fichas independentes.

Exemplo:

- massagem/Kátia;
- toxina/Mel;
- limpeza/Alice.

### 15.2 Origem

- agendamento existente;
- criação direta na Pasta da Cliente.

Ambos geram o mesmo registro formal.

### 15.3 Campos-base

- queixa do dia;
- objetivo;
- avaliação profissional;
- procedimento;
- região;
- produtos/equipamentos;
- parâmetros;
- resposta imediata;
- intercorrências do ato;
- orientações;
- retorno;
- evolução;
- reclamação/elogio/feedback;
- observações;
- fotos;
- assinatura profissional.

A ficha-mãe decide quais aparecem e quais são obrigatórios.

### 15.4 Estados

- `rascunho`;
- `em_atendimento`;
- `finalizada`.

### 15.5 Validação antes de finalizar

Não finalizar se faltar requisito aplicável:

- leitura de alertas;
- anamnese vigente;
- módulo específico;
- termo;
- assinatura;
- produto/lote;
- foto obrigatória;
- campo técnico obrigatório.

### 15.6 Janela de edição

A autora pode criar/alterar a ficha durante o dia do atendimento.

Uma ficha `finalizada` pode ser retificada pela autora no mesmo dia, preservando versão anterior e renovando assinaturas aplicáveis conforme a seção 12.

Após a virada do dia em `America/Sao_Paulo`, qualquer nova alteração exige o fluxo de reabertura autorizado pela Mel.

## 16. Produtos e equipamentos

Biblioteca administrada pela Mel.

### 16.1 Produtos

Cadastro conceitual:

- nome comercial;
- fabricante/marca;
- categoria;
- ativo/inativo;
- observações.

No atendimento, conforme ficha-mãe:

- lote;
- validade;
- quantidade;
- unidade;
- região;
- observações.

### 16.2 Equipamentos

Cadastro conceitual:

- nome;
- fabricante/modelo;
- categoria;
- ativo/inativo;
- identificação interna;
- observações.

Registrar parâmetros técnicos quando definidos pela ficha-mãe.

### 16.3 Rastreabilidade

Deve ser possível localizar clientes/atendimentos que utilizaram um lote/produto específico.

## 17. Intercorrências e evoluções pós-procedimento

Intercorrência posterior é registro separado; não reescreve ficha original.

Campos mínimos:

- atendimento original;
- data/hora do relato;
- quem recebeu;
- sintomas/queixa;
- fotos/anexos;
- avaliação registrada;
- conduta/orientações;
- retorno;
- evolução;
- desfecho.

Pode haver várias evoluções para o mesmo caso.

Estados:

- `aberta`;
- `em_acompanhamento`;
- `resolvida`;
- `encaminhada`.

`resolvida`/`encaminhada` exigem desfecho.

Enquanto aberta/em acompanhamento, gerar alerta clínico ativo.

## 18. Orientações pré e pós-procedimento

Cada ficha-mãe pode guardar versões de:

- preparo pré;
- cuidados pós;
- sinais de alerta;
- quando retornar;
- quando contatar a clínica;
- quando buscar atendimento médico, quando aplicável ao conteúdo validado pela clínica.

Podem aparecer na tela, PDF e entrega por WhatsApp/e-mail.

Atendimento preserva referência à versão da orientação usada naquele dia.

## 19. Retornos e Agenda

Ficha-mãe define:

- retorno obrigatório;
- recomendado;
- não necessário;
- prazo sugerido.

Ao finalizar, oferecer **Agendar retorno** ou **Agendar depois**.

Não autoagendar.

## 20. Planos de Tratamento / Pacotes

Plano agrupa várias sessões/procedimentos, mas cada sessão tem ficha própria.

Estados:

- `ativo`;
- `concluido`;
- `pausado`;
- `cancelado`.

Pausa/cancelamento exige motivo e preserva sessões realizadas.

Mostrar:

- total previsto;
- concluídas;
- restantes;
- próxima sessão;
- sessão não agendada.

Sessão pode ser agendada na hora ou depois pela Pasta/Agenda.

Se ultrapassar intervalo recomendado, mostrar aviso interno **Sessão pendente há X dias**, sem autoagendamento e sem disparo automático.

## 21. Integração financeira

### 21.1 Separação clínica × financeira

Ficha clínica e financeiro são conceitos ligados, mas distintos.

A linha clínica não exibe valores.

### 21.2 Mel/ADM

Pode ver:

- valor total de procedimento/pacote;
- pagamentos/saldo;
- créditos;
- permutas;
- cortesias/isenções aprovadas;
- movimentos;
- total gasto pela cliente;
- visão por profissional/procedimento;
- demais recursos da Fase 5.

### 21.3 Colaboradora

Vê somente:

- valores de próprios atendimentos;
- própria produção;
- próprios recebimentos autorizados;
- valores a receber/pagos conforme Fase 5.

Não vê:

- total gasto pela cliente na BC;
- valores de outras profissionais;
- percentuais de comissão;
- financeiro geral/consolidado.

### 21.4 Exceções

Tipos:

- cobrança normal;
- pacote/crédito existente;
- retorno sem cobrança;
- cortesia;
- permuta;
- isenção;
- ajuste administrativo/comercial.

Profissional pode solicitar exceção com motivo.

Cortesia, permuta, isenção e ajuste excepcional só produzem efeito após aprovação da Mel.

### 21.5 Pacotes

Mel vê valor total do pacote.

Sessões podem ter valor de referência interno para atribuir corretamente a produção de cada profissional.

Cada profissional vê apenas a parcela ligada ao que executou.

## 22. Tela geral de Clientes

Busca por:

- nome;
- CPF;
- telefone.

Filtros:

- ativa/arquivada;
- anamnese vencida;
- alerta ativo;
- intercorrência em acompanhamento;
- plano ativo;
- retorno pendente;
- sessão ainda não agendada.

Card pode mostrar foto, nome, idade, telefone, último atendimento, próximo agendamento e indicadores de alerta/pendência.

## 23. Exportação

### 23.1 Prontuário integral

Somente Mel/ADM pode exportar o prontuário integral.

Pode incluir:

- cadastro;
- anamnese vigente e versões;
- módulos específicos;
- consentimentos;
- fichas;
- intercorrências/evoluções;
- fotos clínicas do prontuário;
- PDFs;
- histórico documental.

### 23.2 Financeiro

Fica fora da exportação clínica por padrão.

Mel pode gerar demonstrativo financeiro separado quando necessário.

### 23.3 Colaboradoras

Podem baixar/entregar documentos individuais permitidos, mas não exportar a pasta integral.

## 24. Papéis e permissões

### 24.1 Profissional ativa

Pode:

- pesquisar/abrir clientes;
- ler prontuário clínico compartilhado;
- ler anamneses, termos, fichas, fotos e intercorrências;
- criar cliente;
- editar dados permitidos do cadastro;
- criar/revisar anamnese conforme fluxo;
- criar fichas próprias;
- editar ficha própria no mesmo dia;
- iniciar procedimento geral;
- iniciar restrito apenas se autorizada;
- criar alerta manual;
- registrar intercorrência/evolução;
- baixar/entregar documento individual;
- solicitar exceção financeira;
- consultar próprio financeiro.

Não pode:

- arquivar/reativar cliente;
- editar ficha de outra profissional;
- editar após bloqueio sem reabertura;
- excluir histórico;
- configurar Biblioteca Clínica;
- alterar cadastro profissional administrativo;
- aprovar própria exceção financeira;
- ver financeiro de outras;
- exportar prontuário integral.

### 24.2 Mel/ADM

Além das permissões clínicas próprias:

- arquiva/reativa cliente;
- administra Biblioteca Clínica;
- ativa/inativa procedimentos;
- configura geral/restrito;
- administra lista de profissionais autorizadas em restritos;
- administra produtos/equipamentos;
- autoriza reabertura após bloqueio;
- inativa alertas preservando histórico;
- aprova/recusa exceções financeiras;
- vê financeiro completo;
- exporta prontuário integral;
- vê auditoria global.

Autorizar reabertura não muda autoria clínica: a autora original faz a correção.

## 25. Auditoria

Registrar ao menos:

- cliente criado/atualizado/arquivado/reativado;
- foto atualizada;
- anamnese iniciada/revisada/finalizada/substituída/vencida;
- link remoto criado/revogado/expirado;
- alerta criado/inativado;
- leitura de alertas;
- termo assinado;
- ficha criada/finalizada/retificada;
- solicitação/autorização de reabertura;
- PDF gerado/versionado;
- documento entregue/exportado;
- foto clínica adicionada;
- intercorrência criada/alterada/encerrada;
- plano criado/pausado/cancelado/concluído;
- solicitação/aprovação/recusa financeira excepcional;
- alteração de Biblioteca Clínica;
- alteração de autorização de procedimento restrito.

Ações autenticadas derivam autor de `auth.uid()`.

## 26. Storage e privacidade

Fotos, assinaturas e documentos clínicos devem ficar em storage privado.

Requisitos:

- sem URL pública permanente;
- acesso autenticado/autorizado;
- objetos ligados a cliente/documento;
- políticas coerentes com RLS/RPC;
- acesso temporário quando necessário;
- `service_role` nunca no frontend/GitHub.

## 27. Estrutura de dados conceitual

Nomes finais serão definidos no plano/migrations. Conceitos previstos:

- ampliação de `clientes`;
- endereço estruturado;
- fotos de identificação;
- responsáveis legais;
- anamneses/versionamento/respostas;
- confirmações de atualização clínica;
- links remotos;
- alertas/leitura de alertas;
- ampliação de procedimentos;
- configuração/ficha-mãe;
- permissões de procedimentos restritos;
- módulos específicos;
- templates/versionamento de termos;
- documentos clínicos;
- assinaturas;
- fotos clínicas;
- produtos/equipamentos;
- relações atendimento-produto/equipamento;
- intercorrências/evoluções;
- planos/sessões;
- exceções financeiras;
- integrações com `atendimentos`, `agendamentos`, `pagamentos`, `pagamento_movimentos`, `audit_log`.

Evitar tabela única gigante de prontuário. Preferir entidades menores, versionáveis e auditáveis.

## 28. Segurança no banco

1. RLS/RPC são autoridade.
2. Frontend não substitui segurança.
3. Equipe ativa pode ler prontuário clínico conforme política da BC.
4. Escrita clínica respeita autoria e janela de edição.
5. Reabertura pós-dia exige autorização persistida.
6. Procedimento restrito valida permissão no backend.
7. Financeiro permanece segmentado no backend.
8. Percentual de comissão permanece privado.
9. Storage privado respeita as mesmas fronteiras.
10. `SECURITY DEFINER` com `search_path` fixo e grants mínimos, seguindo padrão existente.

## 29. Fluxos canônicos

### 29.1 Nova cliente

`Clientes → Cadastrar → validar CPF/duplicidade → criar cadastro rápido → abrir Pasta → checklist`

### 29.2 Anamnese presencial

`Pasta → Anamnese → preencher → revisar → paciente/responsável assina → profissional assina → PDF → Finalizada`

### 29.3 Anamnese remota

`Gerar link 72h → pré-preencher → Aguardando revisão → revisão presencial → assinaturas → PDF → Finalizada`

### 29.4 Atendimento pela Agenda

`Agendamento → cliente → alertas → confirmação clínica → validar anamnese/termos → Em atendimento → ficha → assinatura → Finalizada → PDF → financeiro → retorno opcional`

### 29.5 Atendimento direto

`Pasta → Adicionar procedimento → mesmas validações → ficha → PDF → financeiro → retorno opcional`

### 29.6 Vários procedimentos no mesmo dia

Cada procedimento gera registro e autoria próprios na mesma linha do tempo.

### 29.7 Correção no mesmo dia

`Autora corrige → se documento já assinado, nova versão/assinaturas aplicáveis → auditoria`

### 29.8 Correção depois do dia

`Ficha bloqueada → autora solicita → Mel autoriza → autora corrige → nova versão/assinaturas → auditoria`

### 29.9 Intercorrência

`Atendimento original → nova intercorrência → alerta ativo → evoluções → Resolvida/Encaminhada → desfecho`

### 29.10 Plano

`Criar plano → sessões → cada sessão com ficha própria → agendar agora/depois → lembrete de pendência → concluir/pausar/cancelar`

## 30. Compatibilidade

Preservar:

- login/papéis atuais;
- menu por áreas atual;
- cliente pertencendo à BC;
- histórico compartilhado;
- agenda individual;
- Mel com visão global;
- colaboradora com agenda própria;
- auditoria;
- regras financeiras da Fase 5;
- segregação de comissão/financeiro;
- `/admin/` legado intacto;
- BC Gestão em `/gestao/...`.

A pré-anamnese antiga é referência de UX de preenchimento/assinatura, não o novo prontuário definitivo.

## 31. Testes críticos — TDD

Criar testes RED antes da implementação.

### Cadastro

1. exige nome, CPF, nascimento e telefone;
2. idade calculada por nascimento;
3. CPF duplicado bloqueado;
4. possível duplicidade gera alerta;
5. colaboradora cria cliente;
6. somente Mel arquiva/reativa.

### Prontuário/permissões

7. Alice lê ficha da Kátia;
8. Kátia lê ficha da Alice;
9. colaboradora não edita ficha alheia;
10. autora edita própria ficha no mesmo dia;
11. autora retifica ficha finalizada no mesmo dia com nova versão quando necessário;
12. autora não edita após virada do dia sem autorização;
13. reabertura pós-dia exige Mel;
14. após autorização, somente autora retifica;
15. versão anterior permanece.

### Anamnese

16. versão anterior preservada;
17. mudança clínica cria versão nova;
18. confirmação sem mudanças registra data/profissional;
19. vence em 12 meses;
20. link expira em 72h;
21. link não abre prontuário;
22. preenchimento remoto não finaliza;
23. finalização exige assinaturas.

### Alertas

24. regra configurada gera alerta automático;
25. profissional cria alerta manual;
26. colaboradora não apaga histórico;
27. procedimento exige confirmação de leitura;
28. intercorrência aberta gera alerta.

### Procedimentos

29. geral pode ser iniciado por profissional ativa;
30. restrito bloqueia não autorizada no backend;
31. toxina permite Mel/Alice e bloqueia não autorizada;
32. dois procedimentos no mesmo dia geram fichas independentes;
33. atendimento nasce da agenda;
34. atendimento nasce direto da pasta.

### Documentos

35. ficha não finaliza com requisito obrigatório faltando;
36. ficha finalizada gera PDF;
37. retificação gera nova versão;
38. PDF anterior permanece;
39. assinatura inclui identificação profissional;
40. foto clínica não é pública;
41. autorização clínica de imagem não equivale a marketing.

### Intercorrências

42. intercorrência posterior não altera ficha original;
43. várias evoluções pertencem ao mesmo caso;
44. resolvida/encaminhada exige desfecho;
45. alerta acompanha status aplicável.

### Planos

46. plano tem sessões;
47. cada sessão tem ficha;
48. sessão pode ficar sem agendamento;
49. pode ser agendada depois;
50. pausa/cancelamento exige motivo;
51. pendência gera aviso sem autoagendar.

### Financeiro

52. Mel vê total da cliente;
53. colaboradora não vê total da cliente;
54. colaboradora vê apenas financeiro próprio;
55. cortesia/permuta/isenção não produz efeito antes da aprovação da Mel;
56. pacote distribui produção sem expor total às colaboradoras;
57. testes da Fase 5 continuam verdes.

### Exportação/auditoria

58. somente Mel exporta prontuário integral;
59. financeiro fica fora por padrão;
60. colaboradora baixa documento individual permitido;
61. ações sensíveis geram auditoria.

## 32. Implementação por etapas sugeridas

O plano técnico deve decompor a entrega, sugerindo inicialmente:

1. cadastro ampliado + fundação de dados;
2. Pasta da Cliente + busca/filtros + linha do tempo;
3. anamnese geral versionada + alertas;
4. assinatura + PDFs + storage privado;
5. Biblioteca Clínica + módulos específicos/termos;
6. ficha de atendimento + bloqueio/reabertura;
7. fotos clínicas + produtos/equipamentos;
8. intercorrências/evoluções;
9. planos + retornos;
10. integração financeira/exceções/pacotes;
11. link remoto 72h;
12. exportação integral;
13. hardening RLS/RPC/storage/auditoria;
14. pesquisa e montagem do catálogo inicial/templates clínicos por família com fontes adequadas;
15. homologação exclusivamente com dados fictícios.

O plano pode subdividir sem alterar as decisões desta spec.

## 33. Fora de escopo

Sem nova aprovação, não inclui:

- portal completo da cliente com login;
- diagnóstico automático por IA;
- recomendação automática de procedimento por IA;
- decisão automática de contraindicação;
- marketing automático;
- mensagens automáticas não configuradas;
- alteração do `/admin/` legado;
- paciente real em homologação técnica;
- armazenamento público de prontuário/fotos.

## 34. Critérios de sucesso

Concluir quando:

- novo cadastro funcionar;
- pasta única estiver acessível à equipe clínica autorizada;
- histórico compartilhado não vazar financeiro;
- anamnese versionada/alertas funcionarem;
- cada procedimento gerar ficha independente;
- assinaturas/PDFs forem preservados e versionados;
- fotos/documentos forem privados;
- edição no mesmo dia e bloqueio pós-dia funcionarem;
- reabertura pós-dia exigir Mel e preservar autoria;
- procedimentos restritos estiverem protegidos no backend;
- intercorrências/evoluções funcionarem;
- planos/retornos funcionarem;
- financeiro continuar coerente com a Fase 5;
- exportação integral for só da Mel;
- auditoria estiver completa;
- testes críticos estiverem verdes;
- homologação fictícia não deixar resíduos;
- CI/deploy estiverem verdes.

## 35. Observação final

Esta spec consolida as decisões aprovadas para transformar Clientes em um prontuário estético eletrônico modular, preservando quatro fronteiras centrais:

- **cliente única da BC e histórico clínico compartilhado**;
- **autoria e versionamento dos registros**;
- **documentos/fotos protegidos**;
- **financeiro segregado por permissão**.

Nenhuma implementação deve alterar essa semântica sem nova aprovação explícita.
