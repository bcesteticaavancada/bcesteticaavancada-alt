# BC Gestão — Fase 6: Pasta da Cliente, prontuário clínico e biblioteca de procedimentos

**Data:** 2026-10-11  
**Status:** design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação  
**Repositório:** `bcesteticaavancada/bcesteticaavancada-alt`  
**Projeto Supabase:** `bc-estetica-gestao` (`tpqsmerlxquyrzrjbogj`)  
**Fuso clínico:** `America/Sao_Paulo`

## 1. Objetivo

Evoluir a área **Clientes** do BC Gestão para uma **Pasta da Cliente / prontuário estético eletrônico completo**, preservando o cadastro único da BC, o histórico clínico compartilhado entre profissionais autorizadas e a segregação do financeiro por profissional.

A nova pasta deve concentrar, de forma cronológica e auditável:

- cadastro e identificação;
- foto de identificação;
- anamnese geral versionada;
- módulos de anamnese específicos por procedimento;
- alertas clínicos;
- consentimentos e termos;
- procedimentos e fichas de atendimento;
- produtos, lotes e equipamentos utilizados;
- fotos clínicas;
- intercorrências e evoluções pós-procedimento;
- planos de tratamento/pacotes;
- documentos e PDFs assinados;
- retornos e agenda;
- financeiro conforme permissão;
- auditoria de criação, alteração, assinatura, reabertura e exportação.

O objetivo é que cada cliente seja uma **cliente da BC Estética**, e não de uma profissional específica. Toda profissional ativa autorizada poderá consultar o histórico clínico necessário para continuidade e segurança do atendimento. O financeiro continuará isolado conforme as regras já implementadas na Fase 5.

## 2. Princípios aprovados

1. O cadastro da cliente é único para toda a BC.
2. O CPF deve ser único quando informado e válido para o cadastro.
3. A equipe ativa pode visualizar o prontuário clínico compartilhado da cliente.
4. Uma profissional pode ver procedimentos e fichas realizados por outra profissional.
5. A profissional só pode criar/editar o próprio registro clínico durante o dia do atendimento.
6. Após o fim do dia, o registro clínico fica bloqueado para a autora.
7. Se for necessária correção posterior, a profissional solicita reabertura; a Mel/ADM autoriza; a própria autora faz a correção; tudo fica auditado.
8. Não há exclusão destrutiva de histórico clínico.
9. Cada procedimento realizado gera uma ficha de atendimento própria, mesmo que a cliente faça vários procedimentos no mesmo dia.
10. O prontuário clínico é compartilhado; o financeiro não é.
11. A Mel/ADM vê o financeiro completo da cliente e o consolidado administrativo.
12. Cada colaboradora vê apenas o financeiro vinculado aos próprios atendimentos/produção.
13. Anamnese geral é única por versão e compartilhada por toda a equipe clínica.
14. Cada procedimento pode exigir módulo específico de anamnese e termo de consentimento próprio.
15. A anamnese geral deve ser revisada completamente a cada 12 meses ou antes, se houver mudança clínica relevante.
16. Antes de cada atendimento, deve haver confirmação de mudanças clínicas desde a última anamnese.
17. Fotos clínicas são privadas por padrão; uso em marketing depende de autorização separada e explícita.
18. Documentos assinados geram PDF próprio, versionado e preservado.
19. Assinaturas são feitas na tela de celular/tablet, por paciente/responsável e profissional responsável.
20. A Biblioteca Clínica define os requisitos de cada procedimento.
21. Procedimentos gerais podem ser iniciados por qualquer profissional ativa.
22. Procedimentos restritos têm uma lista explícita de profissionais autorizadas.
23. Na BC, **Toxina Botulínica/Botox** será procedimento restrito às profissionais cadastradas Mel e Alice, conforme regra interna definida pela clínica.
24. Restrições de procedimento devem ser garantidas no banco/RPC, não apenas escondidas na interface.
25. Cortesia, permuta, isenção e ajustes financeiros excepcionais podem ser solicitados pela profissional, mas só produzem efeito após aprovação da Mel.

## 3. Escopo funcional

A Fase 6 cobre os seguintes blocos:

1. ampliação do cadastro da cliente;
2. Pasta da Cliente com abas e linha do tempo;
3. anamnese geral versionada;
4. módulos específicos por procedimento;
5. alertas clínicos;
6. consentimentos e assinaturas;
7. Biblioteca Clínica de procedimentos;
8. fichas de atendimento por sessão/procedimento;
9. fotos clínicas;
10. produtos, lotes e equipamentos;
11. intercorrências e evoluções;
12. planos de tratamento/pacotes;
13. retornos integrados à agenda;
14. PDFs clínicos e exportação;
15. preenchimento remoto seguro;
16. integração com o financeiro existente;
17. auditoria e regras de segurança.

## 4. Cadastro da cliente

### 4.1 Campos básicos

Campos da cliente:

- `foto_identificacao`;
- `nome_completo`;
- `cpf`;
- `data_nascimento`;
- idade calculada dinamicamente;
- `telefone`;
- `email`;
- endereço estruturado;
- status ativa/arquivada;
- timestamps e autoria de criação/alteração.

### 4.2 Campos obrigatórios no cadastro rápido

Obrigatórios para criar a cliente:

- nome completo;
- CPF;
- data de nascimento;
- telefone.

O cadastro pode ser criado rapidamente e completado depois.

E-mail é opcional. Complemento de endereço é opcional.

### 4.3 Idade

A idade não deve ser persistida como valor fixo. Deve ser calculada a partir de `data_nascimento`, considerando a data atual no fuso da clínica.

### 4.4 Endereço estruturado

Campos previstos:

- CEP;
- logradouro;
- número;
- complemento;
- bairro;
- cidade;
- UF.

O sistema pode usar busca por CEP para pré-preenchimento, mantendo edição manual.

### 4.5 Foto de identificação

A foto pode ser adicionada por:

- câmera do celular/tablet;
- galeria do dispositivo.

Quando a foto principal for atualizada, a versão anterior deve permanecer no histórico, sem exclusão destrutiva.

### 4.6 Duplicidade

CPF deve ter unicidade lógica no cadastro da BC.

Ao tentar cadastrar CPF existente:

- bloquear duplicidade;
- informar que a cliente já existe;
- oferecer ação **Abrir prontuário**.

Quando CPF não estiver disponível, o sistema deve alertar possível duplicidade por combinação de:

- nome completo;
- data de nascimento;
- telefone.

Essa segunda verificação é alerta, não identificação definitiva.

### 4.7 Menores de idade

Quando a data de nascimento indicar idade inferior a 18 anos, ativar seção de responsável legal com, no mínimo:

- nome completo;
- CPF;
- vínculo/parentesco;
- telefone;
- assinatura quando aplicável.

O prontuário continua pertencendo ao paciente. Ao atingir 18 anos, novos documentos passam a seguir as regras de assinatura do paciente adulto sem apagar documentos anteriores.

## 5. Pasta da Cliente

Após criar ou abrir uma cliente, o sistema deve exibir uma Pasta da Cliente própria.

### 5.1 Cabeçalho

Resumo no topo:

- foto;
- nome;
- idade;
- telefone;
- alertas clínicos ativos;
- data da última anamnese;
- último atendimento;
- próximo agendamento;
- plano de tratamento ativo, quando houver.

### 5.2 Abas

Estrutura aprovada:

- **Cadastro**;
- **Anamnese**;
- **Procedimentos**;
- **Atendimentos**;
- **Fotos**;
- **Documentos**;
- **Financeiro**.

### 5.3 Checklist de pendências

Exibir pendências como:

- cadastro básico concluído;
- endereço pendente/completo;
- foto pendente/completa;
- anamnese geral pendente/vigente/vencida;
- consentimentos exigidos;
- retorno pendente;
- sessão de plano pendente.

O checklist orienta a equipe sem obrigar que tudo seja preenchido no cadastro inicial.

## 6. Linha do tempo unificada

A tela principal da Pasta da Cliente deve apresentar uma linha do tempo clínica cronológica.

Filtros:

- Todos;
- Procedimentos;
- Fichas de atendimento;
- Anamneses;
- Termos/consentimentos;
- Fotos;
- Intercorrências;
- Retornos;
- Planos de tratamento;
- Documentos.

Cada item abre o registro correspondente.

O financeiro não deve ser misturado na linha do tempo clínica.

## 7. Anamnese Geral

### 7.1 Modelo

A cliente possui uma Anamnese Geral da BC, compartilhada por toda a equipe clínica ativa.

A anamnese é versionada. Uma nova versão não apaga a anterior.

Cada ficha de atendimento deve manter referência à versão da anamnese que estava vigente na data do procedimento.

### 7.2 Seções mínimas

A Anamnese Geral deve conter, de forma condicional e progressiva:

- identificação derivada do cadastro;
- queixa principal;
- objetivo estético;
- histórico de saúde atual e pregresso;
- doenças e condições relevantes;
- acompanhamento médico quando aplicável;
- medicamentos e suplementos;
- alergias e reações anteriores;
- cirurgias e procedimentos prévios;
- histórico dermatológico;
- histórico de cicatrização/queloide quando aplicável;
- hábitos e estilo de vida;
- uso de nicotina/tabagismo;
- consumo de álcool;
- exposição solar/fotoproteção;
- gestação/amamentação quando aplicável;
- histórico estético;
- procedimentos anteriores e complicações;
- observações livres;
- declaração de veracidade/atualidade das informações;
- assinatura do paciente/responsável;
- assinatura da profissional responsável.

O formulário deve usar lógica condicional: respostas negativas seguem o fluxo; respostas positivas abrem detalhamento pertinente.

### 7.3 Confirmação antes de cada atendimento

Antes de um novo procedimento, apresentar pergunta equivalente a:

> Houve alguma mudança na sua saúde, medicamentos, alergias, cirurgias ou condição clínica desde a última anamnese?

Se `não`:

- registrar confirmação;
- registrar data/hora e profissional responsável;
- manter a versão vigente.

Se `sim`:

- exigir atualização;
- gerar nova versão;
- exigir nova assinatura conforme fluxo.

### 7.4 Renovação anual

A anamnese geral finalizada vence após 12 meses.

Ao vencer:

- status muda para `Vencida`;
- nova revisão completa é exigida antes dos procedimentos configurados como dependentes de anamnese vigente.

### 7.5 Estados da anamnese

Estados aprovados:

- `nao_iniciada`;
- `em_preenchimento`;
- `aguardando_revisao_profissional`;
- `aguardando_assinaturas`;
- `finalizada`;
- `vencida`;
- `substituida`.

## 8. Preenchimento remoto

A Anamnese Geral pode ser iniciada:

1. presencialmente em celular/tablet da BC;
2. remotamente pela cliente antes da consulta.

### 8.1 Link seguro

O link remoto deve:

- ser individual;
- usar token aleatório e não enumerável;
- expirar em 72 horas;
- acessar somente a ficha em preenchimento;
- não conceder acesso à Pasta da Cliente, fotos, histórico ou financeiro;
- deixar de funcionar após finalização ou invalidação;
- poder ser regenerado pela equipe quando expirar.

### 8.2 Pré-preenchimento não é finalização

A cliente pode preencher respostas remotamente, porém a ficha deve permanecer em `aguardando_revisao_profissional`.

Na clínica:

1. profissional revisa com a cliente;
2. completa/corrige se necessário;
3. passa para `aguardando_assinaturas`;
4. paciente/responsável assina;
5. profissional assina;
6. ficha vira `finalizada`.

## 9. Alertas clínicos

### 9.1 Objetivo

Alertas destacam informações relevantes, mas não substituem avaliação profissional e não devem emitir diagnóstico nem autorização automática para executar procedimento.

### 9.2 Tipos

- automáticos, derivados da anamnese;
- manuais, criados pela profissional a partir do atendimento/evolução.

### 9.3 Níveis visuais

Níveis sugeridos:

- crítico;
- atenção;
- informativo.

### 9.4 Exemplos de origem

Podem ser criados a partir de dados como:

- alergia informada;
- uso de medicamento relevante;
- histórico de reação importante;
- histórico de herpes;
- cicatrização alterada;
- condição clínica informada;
- intercorrência ainda aberta.

### 9.5 Regras

Cada alerta deve registrar:

- origem;
- texto/descrição;
- categoria/nível;
- autor quando manual;
- data/hora;
- status ativo/inativo;
- motivo de inativação quando aplicável.

Colaboradoras não excluem alertas antigos. Podem solicitar revisão. A Mel pode inativar, preservando histórico.

### 9.6 Confirmação de leitura

Antes de iniciar um procedimento, a profissional deve confirmar que revisou os alertas ativos.

Registrar:

- profissional;
- atendimento/procedimento;
- data/hora;
- conjunto de alertas apresentado ou referência ao estado naquele momento.

Essa confirmação registra leitura, não aprovação clínica automática.

## 10. Biblioteca Clínica de procedimentos

### 10.1 Conceito

Cada procedimento possui uma **ficha-mãe configurável**, administrada pela Mel/ADM.

Ela define como Agenda, Prontuário, Atendimentos, Documentos e Financeiro devem se comportar para aquele procedimento.

### 10.2 Famílias iniciais

Biblioteca deve ser preparada com catálogo amplo, mantendo procedimentos não utilizados como inativos.

Famílias iniciais:

- injetáveis faciais;
- toxina botulínica;
- preenchimentos;
- bioestimuladores;
- skinboosters e correlatos;
- faciais não injetáveis;
- limpeza de pele;
- peelings;
- microagulhamento;
- dermaplaning;
- tecnologias/laser/IPL/LED;
- radiofrequência;
- ultrassom/HIFU e similares;
- corporais;
- criolipólise e tecnologias corporais;
- intradermoterapia/enzimas quando aplicável à operação da BC;
- terapias manuais;
- drenagem;
- massagem modeladora;
- massagem;
- pós-operatório;
- capilar/tricologia estética;
- outros procedimentos cadastráveis futuramente.

A existência de um item na biblioteca não significa que a BC o ofereça ou que qualquer profissional esteja habilitada a executá-lo. Procedimentos podem permanecer `inativos`.

### 10.3 Configuração da ficha-mãe

Cada procedimento pode configurar:

- nome;
- família;
- status ativo/inativo;
- descrição administrativa;
- valor padrão;
- duração sugerida;
- necessidade de anamnese geral vigente;
- módulo de anamnese específico;
- termo de consentimento específico;
- campos obrigatórios da ficha de atendimento;
- fotos obrigatórias/opcionais;
- produtos/lotes exigidos;
- equipamento/parâmetros aplicáveis;
- orientações pré-procedimento;
- orientações pós-procedimento;
- sinais de alerta/orientações de contato;
- retorno obrigatório/recomendado/não necessário;
- prazo padrão de retorno;
- acesso geral ou restrito;
- profissionais autorizadas quando restrito.

### 10.4 Procedimentos gerais e restritos

Procedimento `geral`:

- qualquer profissional ativa pode iniciar e registrar, respeitando demais regras do sistema.

Procedimento `restrito`:

- somente profissionais explicitamente autorizadas podem iniciar/assinar.

Regra interna inicial da BC:

- **Toxina Botulínica/Botox:** acesso restrito a Mel e Alice.

Essa permissão deve ser validada no backend/RPC.

## 11. Módulos específicos de anamnese

Além da Anamnese Geral, cada procedimento pode exigir perguntas adicionais próprias.

Exemplos conceituais:

- toxina botulínica;
- preenchimento;
- bioestimulador;
- peeling;
- microagulhamento;
- laser/tecnologias;
- corporal;
- massagem/terapias manuais;
- pós-operatório;
- capilar.

O módulo específico deve ser versionado junto com sua definição para que um atendimento antigo continue ligado às perguntas e respostas válidas naquela data.

## 12. Consentimentos e termos

### 12.1 Separação documental

A Anamnese Geral não substitui o termo de consentimento do procedimento.

Cada procedimento que exigir consentimento específico deve gerar seu próprio termo.

Exemplo:

- anamnese geral vigente;
- módulo específico de toxina;
- termo de consentimento de toxina;
- ficha de atendimento de toxina.

### 12.2 Assinaturas

Assinatura na tela do celular/tablet, no padrão já utilizado pela pré-anamnese, com acréscimo obrigatório da assinatura da profissional.

Documento deve conter:

- assinatura do paciente ou responsável legal;
- assinatura da profissional responsável;
- nome completo da profissional;
- profissão;
- conselho profissional;
- número de registro;
- data/hora;
- versão do documento;
- identificador único.

Os dados profissionais vêm do perfil administrativo e não devem ser alteráveis dentro do documento já emitido.

## 13. PDFs e versionamento documental

### 13.1 Geração

Gerar PDF individual para:

- Anamnese Geral finalizada;
- termo/consentimento finalizado;
- ficha de atendimento finalizada;
- documentos clínicos adicionais definidos futuramente.

### 13.2 Conteúdo da ficha de atendimento em PDF

Quando aplicável:

- identificação e foto da cliente;
- procedimento;
- data/hora;
- profissional responsável;
- profissão/conselho/registro;
- queixa/objetivo;
- avaliação;
- técnica/produtos/equipamentos;
- lote/validade/quantidade quando aplicável;
- região tratada;
- parâmetros técnicos;
- resposta imediata;
- intercorrências registradas no atendimento;
- orientações;
- retorno recomendado;
- assinatura profissional;
- referência à anamnese vigente;
- referência aos termos assinados;
- código único do documento.

### 13.3 Imutabilidade e retificação

PDF finalizado é histórico imutável.

Se a ficha for reaberta, corrigida e finalizada novamente:

- o PDF anterior permanece;
- nova versão é gerada;
- registrar vínculo `versao_anterior`/`retificacao`;
- registrar motivo;
- registrar quem autorizou a reabertura;
- registrar autora da alteração;
- registrar data/hora.

## 14. Entrega de documentos à cliente

Equipe autorizada pode entregar um documento individual por:

- download no dispositivo;
- e-mail;
- compartilhamento via WhatsApp do próprio aparelho.

Não criar link público permanente para prontuário.

Registrar auditoria de entrega/geração quando possível:

- documento;
- profissional;
- data/hora;
- finalidade/canal.

## 15. Fotos clínicas

### 15.1 Tipos

Separar:

1. foto de identificação;
2. fotos clínicas do procedimento.

Fotos clínicas podem ser classificadas como:

- antes;
- durante;
- depois;
- evolução.

### 15.2 Metadados

Cada foto clínica deve se ligar a:

- cliente;
- procedimento/atendimento;
- profissional;
- data/hora;
- região corporal/facial;
- etapa;
- observação clínica.

### 15.3 Origem

Permitir:

- câmera;
- galeria.

### 15.4 Privacidade e marketing

Foto clínica é privada no prontuário.

Autorização para prontuário não autoriza marketing.

Uso em redes sociais, site, publicidade ou material promocional exige autorização específica e explícita, separada do consentimento clínico.

Arquivos clínicos não devem ser armazenados em área pública do GitHub/site.

## 16. Ficha de atendimento

### 16.1 Uma ficha por procedimento/sessão

Cada procedimento realizado gera uma ficha própria.

Exemplo no mesmo dia:

- massagem com Kátia → ficha de Kátia;
- toxina com Mel → ficha de Mel;
- limpeza de pele com Alice → ficha de Alice.

Todas ficam na mesma linha do tempo da cliente.

### 16.2 Origem do atendimento

Duas origens válidas:

1. agendamento existente;
2. criação direta pela Pasta da Cliente quando não houve agendamento prévio.

Ambos geram o mesmo tipo de registro formal.

### 16.3 Campos-base

A ficha-base suporta:

- queixa principal do dia;
- objetivo do atendimento;
- avaliação da profissional;
- procedimento executado;
- região tratada;
- produtos/equipamentos utilizados;
- parâmetros técnicos;
- resposta imediata;
- intercorrências durante o procedimento;
- orientações pós-procedimento;
- retorno recomendado;
- evolução;
- reclamação/elogio/feedback;
- observações adicionais;
- fotos anexadas;
- assinatura da profissional.

A ficha-mãe decide quais campos:

- aparecem;
- são obrigatórios;
- são opcionais;
- não se aplicam.

### 16.4 Estados

Estados aprovados:

- `rascunho`;
- `em_atendimento`;
- `finalizada`.

### 16.5 Finalização

Não permitir finalização se faltar requisito obrigatório da ficha-mãe, incluindo quando aplicável:

- alerta clínico não revisado;
- anamnese vencida;
- módulo específico pendente;
- termo pendente;
- assinatura;
- produto/lote;
- foto obrigatória;
- campo técnico obrigatório.

### 16.6 Janela de edição

A autora pode criar/editar sua ficha durante o dia do atendimento.

Após a mudança de dia no fuso `America/Sao_Paulo`:

- ficha fica bloqueada para alteração pela colaboradora;
- leitura continua disponível.

### 16.7 Reabertura posterior — Opção A aprovada

Fluxo:

1. autora solicita correção;
2. Mel/ADM autoriza reabertura temporária;
3. a própria autora faz a correção;
4. ficha é finalizada novamente;
5. nova versão documental é gerada;
6. auditoria registra todo o fluxo.

A Mel não substitui silenciosamente a autoria clínica da ficha.

## 17. Biblioteca de produtos e equipamentos

A Mel/ADM pode administrar uma biblioteca de produtos e equipamentos.

### 17.1 Produto

Campos conceituais:

- nome comercial;
- fabricante/marca;
- categoria;
- status ativo/inativo;
- observações administrativas.

No atendimento, quando aplicável:

- lote;
- validade;
- quantidade;
- unidade de medida;
- região de aplicação;
- observações.

### 17.2 Equipamento

Campos conceituais:

- nome;
- fabricante/modelo;
- categoria;
- status ativo/inativo;
- identificação interna;
- observações.

No atendimento, permitir registrar parâmetros técnicos definidos pela ficha-mãe.

### 17.3 Rastreabilidade

Deve ser possível consultar quais clientes/atendimentos usaram determinado lote/produto quando houver necessidade de rastreabilidade.

## 18. Intercorrências e evoluções pós-procedimento

### 18.1 Registro separado

Intercorrência posterior não altera a ficha original.

Criar um registro separado vinculado ao atendimento original.

Campos mínimos:

- atendimento original;
- data/hora do relato;
- quem recebeu a informação;
- sintomas/queixa;
- fotos/anexos;
- avaliação registrada pela profissional;
- conduta/orientações;
- retorno associado;
- evolução;
- desfecho.

Podem existir vários registros sucessivos para o mesmo caso.

### 18.2 Estados

Estados aprovados:

- `aberta`;
- `em_acompanhamento`;
- `resolvida`;
- `encaminhada`.

Para `resolvida` ou `encaminhada`, exigir desfecho final.

Enquanto estiver `aberta` ou `em_acompanhamento`, gerar alerta clínico ativo na Pasta da Cliente.

## 19. Orientações pré e pós-procedimento

Cada ficha-mãe pode armazenar versões de:

- preparo pré-procedimento;
- cuidados pós-procedimento;
- sinais de alerta;
- quando retornar;
- quando entrar em contato com a clínica;
- quando buscar atendimento médico, quando aplicável ao texto aprovado pela clínica.

Podem ser:

- exibidas para a profissional;
- incluídas no PDF;
- entregues por WhatsApp/e-mail.

A ficha do atendimento deve manter referência à versão das orientações válida na data.

## 20. Retornos e Agenda

A ficha-mãe define retorno como:

- obrigatório;
- recomendado;
- não necessário.

Quando aplicável, define prazo sugerido.

Ao finalizar atendimento:

- oferecer ação **Agendar retorno**;
- abrir Agenda já vinculada à cliente e procedimento;
- permitir `Agendar depois`.

Não criar agendamento automaticamente.

## 21. Planos de Tratamento / Pacotes

### 21.1 Conceito

Permitir agrupar várias sessões/procedimentos em um plano.

Exemplo:

- 4 drenagens;
- 4 massagens modeladoras;
- 2 radiofrequências.

Cada sessão continua gerando sua própria ficha de atendimento.

### 21.2 Estados

Estados aprovados:

- `ativo`;
- `concluido`;
- `pausado`;
- `cancelado`.

Pausa/cancelamento exige motivo e preserva sessões realizadas.

### 21.3 Sessões

Mostrar:

- total previsto;
- concluídas;
- restantes;
- próxima sessão;
- sessão ainda não agendada.

Se a próxima sessão não for marcada na hora, deve ser possível reagendar/agendar depois pela Pasta da Cliente ou Agenda.

### 21.4 Lembrete operacional

Quando ultrapassar o intervalo recomendado, mostrar aviso interno como:

> Sessão pendente há X dias.

O aviso não agenda sozinho e não dispara mensagem automaticamente.

## 22. Integração financeira

### 22.1 Separação clínica × financeira

Ficha clínica e valor financeiro são conceitos distintos, embora vinculados ao mesmo atendimento.

A linha do tempo clínica não exibe valores financeiros.

### 22.2 Visão da Mel

Mel/ADM pode ver:

- valor total do procedimento/pacote;
- pagamentos;
- saldo;
- créditos;
- permutas;
- cortesias/isenções aprovadas;
- movimentos;
- consolidado total gasto pela cliente;
- financeiro por profissional e por procedimento;
- demais recursos da Fase 5.

### 22.3 Visão da colaboradora

Cada profissional vê apenas:

- valores ligados aos próprios atendimentos;
- produção própria;
- recebimentos próprios autorizados;
- valores a receber/pagos conforme Fase 5.

Não vê:

- total gasto pela cliente na BC;
- valores de procedimentos feitos por outras profissionais;
- percentual de comissão;
- financeiro geral;
- consolidado da clínica.

### 22.4 Exceções financeiras

Situações:

- cobrança normal;
- pacote/crédito existente;
- retorno sem cobrança;
- cortesia;
- permuta;
- isenção;
- ajuste comercial/administrativo.

Profissional pode solicitar exceção, informando motivo.

Cortesia, permuta, isenção e ajuste excepcional só produzem efeito após aprovação da Mel.

Registrar auditoria de solicitação e decisão.

### 22.5 Pacotes

Pacote possui valor administrativo total visível à Mel.

Cada sessão/procedimento pode ter valor de referência interno para atribuição correta da produção às profissionais.

Cada profissional vê somente a parcela financeira relacionada ao que executou.

## 23. Tela geral de Clientes

Busca instantânea por:

- nome;
- CPF;
- telefone.

Filtros operacionais:

- ativa/arquivada;
- anamnese vencida;
- alerta clínico ativo;
- intercorrência em acompanhamento;
- plano de tratamento ativo;
- retorno pendente;
- próxima sessão não agendada.

Card da cliente pode mostrar:

- foto;
- nome;
- idade;
- telefone;
- último atendimento;
- próximo agendamento;
- indicadores de alerta/pendência.

## 24. Exportação do prontuário

### 24.1 Exportação integral

Somente Mel/ADM pode gerar exportação integral do prontuário.

Pacote clínico pode incluir:

- cadastro;
- anamnese vigente;
- versões anteriores;
- módulos específicos;
- consentimentos;
- fichas de atendimento;
- intercorrências/evoluções;
- fotos clínicas do prontuário;
- PDFs assinados;
- histórico documental.

### 24.2 Financeiro

Financeiro fica fora da exportação clínica por padrão.

A Mel pode optar por gerar demonstrativo financeiro separado quando necessário.

### 24.3 Colaboradoras

Colaboradoras podem baixar documentos individuais autorizados, mas não exportar a pasta clínica integral.

## 25. Papéis e permissões

### 25.1 Profissional ativa

Pode:

- pesquisar e abrir clientes ativas;
- consultar o prontuário clínico compartilhado;
- visualizar anamneses, termos, fichas, fotos clínicas, intercorrências e histórico;
- criar cliente;
- editar dados operacionais permitidos do cadastro;
- criar anamnese/revisão conforme fluxo;
- criar registros de atendimento próprios;
- editar registros próprios somente na janela permitida;
- iniciar procedimentos gerais;
- iniciar procedimentos restritos somente se autorizada;
- criar alerta manual;
- criar evolução/intercorrência ligada ao atendimento;
- baixar/entregar documentos individuais permitidos;
- solicitar exceção financeira;
- consultar apenas o próprio financeiro.

Não pode:

- arquivar/reativar cliente;
- editar silenciosamente ficha de outra profissional;
- editar sua ficha após bloqueio sem reabertura autorizada;
- excluir histórico;
- inativar definitivamente alerta sem fluxo administrativo;
- configurar Biblioteca Clínica;
- alterar dados profissionais de cadastro administrativo;
- aprovar própria cortesia/permuta/isenção excepcional;
- acessar financeiro de outras profissionais;
- exportar prontuário integral.

### 25.2 Mel — administradora e profissional

Além das permissões clínicas próprias, pode:

- arquivar/reativar cliente;
- administrar Biblioteca Clínica;
- ativar/inativar procedimentos;
- configurar procedimento geral/restrito;
- administrar profissionais autorizadas em procedimentos restritos;
- administrar produtos/equipamentos;
- autorizar reabertura de ficha bloqueada;
- inativar alertas preservando histórico;
- aprovar/recusar exceções financeiras;
- consultar financeiro completo;
- exportar prontuário integral;
- consultar auditoria global.

A autorização de reabertura não muda a autoria clínica: a correção continua sendo feita pela profissional autora.

## 26. Auditoria

Registrar, no mínimo:

- cliente criado/atualizado/arquivado/reativado;
- possível duplicidade e decisão quando relevante;
- foto de identificação atualizada;
- anamnese iniciada/revisada/finalizada/substituída/vencida;
- link remoto criado/revogado/expirado;
- alerta criado/inativado;
- confirmação de leitura de alertas;
- termo assinado;
- ficha criada/finalizada;
- solicitação de reabertura;
- autorização de reabertura;
- retificação;
- PDF gerado/versionado;
- documento entregue/exportado;
- foto clínica adicionada;
- intercorrência criada/alterada/encerrada;
- plano criado/pausado/cancelado/concluído;
- solicitação/aprovação/recusa financeira excepcional;
- alteração de Biblioteca Clínica;
- alteração de autorização de procedimento restrito.

Autor deve derivar de `auth.uid()` quando a ação for autenticada.

## 27. Storage e privacidade

Fotos clínicas, assinaturas e documentos devem ficar em storage privado.

Requisitos:

- sem URLs públicas permanentes;
- acesso autenticado e autorizado;
- caminhos/objetos vinculados ao cliente e documento;
- políticas coerentes com RLS/RPC;
- geração de acesso temporário quando necessário;
- nenhuma chave `service_role` no frontend ou repositório.

Dados de saúde e documentos clínicos exigem tratamento como informação sensível da operação da clínica.

## 28. Estrutura de dados conceitual

Os nomes finais serão definidos no plano técnico/migrations. Conceitos previstos:

- ampliação de `clientes`;
- `cliente_enderecos` ou campos estruturados equivalentes;
- `cliente_fotos_identificacao`;
- `responsaveis_legais`;
- `anamneses`;
- `anamnese_respostas` ou payload versionado validado;
- `anamnese_confirmacoes`;
- `anamnese_links_remotos`;
- `alertas_clinicos`;
- `alerta_leituras`;
- `procedimentos` ampliado;
- `procedimento_config` / ficha-mãe;
- `procedimento_profissionais_restritos`;
- `procedimento_modulos_anamnese`;
- `termo_templates` / versões;
- `documentos_clinicos`;
- `documento_assinaturas`;
- `fotos_clinicas`;
- `produtos_clinicos`;
- `equipamentos_clinicos`;
- `atendimento_produtos`;
- `atendimento_equipamentos`;
- `intercorrencias`;
- `intercorrencia_evolucoes`;
- `planos_tratamento`;
- `plano_sessoes`;
- `excecoes_financeiras` ou entidade equivalente;
- integrações com `atendimentos`, `agendamentos`, `pagamentos`, `pagamento_movimentos`, `audit_log`.

Evitar uma única tabela gigante de prontuário. Preferir entidades pequenas e auditáveis, com referências explícitas entre versões.

## 29. Segurança no banco

Princípios:

1. RLS/RPC são autoridade de acesso.
2. Frontend não é barreira de segurança.
3. Profissional autenticada pode ler prontuário clínico compartilhado conforme política da BC.
4. Escrita clínica deve respeitar autoria e janela de edição.
5. Reabertura exige autorização administrativa persistida.
6. Procedimento restrito deve validar permissão no backend.
7. Financeiro continua segmentado no backend.
8. Percentual de comissão continua privado.
9. Storage privado respeita as mesmas fronteiras.
10. Funções `SECURITY DEFINER` devem ter `search_path` fixo e grants mínimos, seguindo o padrão já adotado no projeto.

## 30. Fluxos canônicos

### 30.1 Nova cliente

`Clientes → Cadastrar → valida CPF/duplicidade → cria cadastro rápido → abre Pasta da Cliente → checklist de pendências`

### 30.2 Primeira anamnese presencial

`Pasta → Anamnese → preencher → revisar → paciente/responsável assina → profissional assina → PDF → Finalizada`

### 30.3 Anamnese remota

`Equipe gera link 72h → cliente pré-preenche → Aguardando revisão → revisão presencial → assinaturas → PDF → Finalizada`

### 30.4 Atendimento via Agenda

`Agendamento → abrir cliente → revisar alertas → confirmar mudanças clínicas → validar anamnese/termos → Em atendimento → preencher ficha → assinar → Finalizada → PDF → financeiro → retorno opcional`

### 30.5 Atendimento sem agendamento

`Pasta da Cliente → Adicionar procedimento → mesmas validações clínicas → ficha → PDF → financeiro → retorno opcional`

### 30.6 Dois procedimentos no mesmo dia

`Procedimento A → ficha A / autora A`  
`Procedimento B → ficha B / autora B`

Ambos aparecem separadamente na mesma linha do tempo.

### 30.7 Correção posterior

`Ficha bloqueada → autora solicita → Mel autoriza → autora corrige → nova versão/PDF → auditoria`

### 30.8 Intercorrência posterior

`Atendimento original → Nova intercorrência → alerta ativo → evoluções sucessivas → Resolvida/Encaminhada → desfecho`

### 30.9 Plano de tratamento

`Criar plano → sessões previstas → cada sessão gera ficha própria → agendar agora ou depois → lembrete de pendência → concluir/pausar/cancelar`

## 31. Compatibilidade com fases anteriores

A Fase 6 deve preservar:

- login e papéis atuais;
- menu por áreas aprovado na navegação atual;
- clientes pertencendo à BC;
- histórico compartilhado;
- agenda individual;
- Mel com visão global;
- colaboradora com agenda própria;
- auditoria existente;
- regras financeiras da Fase 5;
- segregação de comissão/financeiro;
- diretório `/admin/` legado de pré-anamnese intacto;
- novo BC Gestão em `/gestao/...`.

A pré-anamnese antiga pode servir como referência de experiência de assinatura/preenchimento, mas não deve ser confundida com o novo prontuário definitivo do BC Gestão.

## 32. Testes críticos — TDD

Antes da implementação, criar testes RED para os casos críticos.

### Cadastro

1. cadastro exige nome, CPF, nascimento e telefone;
2. idade é calculada pela data de nascimento;
3. CPF duplicado é bloqueado;
4. possível duplicidade sem CPF gera alerta;
5. colaboradora cria cliente;
6. apenas Mel arquiva/reativa.

### Prontuário e permissões

7. Alice consegue ler ficha clínica criada por Kátia;
8. Kátia consegue ler ficha clínica criada por Alice;
9. colaboradora não edita ficha de outra profissional;
10. autora edita própria ficha no mesmo dia;
11. autora não edita própria ficha após bloqueio;
12. reabertura exige autorização da Mel;
13. após autorização, somente a autora retifica;
14. retificação preserva versão anterior.

### Anamnese

15. versão antiga permanece preservada;
16. atualização clínica cria nova versão;
17. confirmação `sem mudanças` registra data/profissional;
18. anamnese vence em 12 meses;
19. link remoto expira em 72h;
20. link remoto não abre prontuário;
21. pré-preenchimento remoto não finaliza ficha;
22. finalização exige assinaturas aplicáveis.

### Alertas

23. resposta configurada gera alerta automático;
24. profissional cria alerta manual;
25. colaboradora não apaga alerta histórico;
26. procedimento exige confirmação de leitura de alertas;
27. intercorrência aberta gera alerta ativo.

### Procedimentos

28. procedimento geral pode ser iniciado por profissional ativa;
29. procedimento restrito bloqueia profissional não autorizada no backend;
30. toxina permite Mel/Alice conforme configuração inicial e bloqueia profissional não autorizada;
31. cada procedimento no mesmo dia gera ficha independente;
32. atendimento pode nascer de agenda;
33. atendimento pode nascer direto da pasta.

### Ficha e documentos

34. ficha não finaliza com requisito obrigatório pendente;
35. ficha finalizada gera PDF;
36. retificação gera nova versão do PDF;
37. PDF anterior permanece preservado;
38. assinatura inclui identidade profissional cadastrada;
39. foto clínica não vira pública;
40. autorização clínica de imagem não equivale a autorização de marketing.

### Intercorrências

41. intercorrência posterior não altera ficha original;
42. várias evoluções podem pertencer à mesma intercorrência;
43. resolvida/encaminhada exige desfecho;
44. alerta sai de ativo conforme encerramento/regra aprovada.

### Planos

45. plano possui sessões próprias;
46. cada sessão gera ficha individual;
47. próxima sessão pode ficar sem agendamento;
48. pode ser agendada depois;
49. pausa/cancelamento exige motivo;
50. sessão pendente gera aviso sem autoagendar.

### Financeiro

51. Mel vê total financeiro da cliente;
52. colaboradora não vê total financeiro da cliente;
53. colaboradora vê somente atendimentos financeiros próprios;
54. cortesia/permuta/isenção solicitada não produz efeito sem aprovação da Mel;
55. pacote distribui produção por sessão sem expor valor total às outras profissionais;
56. regras da Fase 5 continuam verdes.

### Exportação e auditoria

57. somente Mel exporta prontuário integral;
58. financeiro não entra na exportação clínica por padrão;
59. colaboradora baixa documento individual permitido;
60. ações sensíveis geram `audit_log`.

## 33. Implementação por etapas sugeridas

A implementação deve ser quebrada no plano técnico para reduzir risco. Ordem sugerida:

1. fundação de dados da Pasta da Cliente e cadastro ampliado;
2. UI da Pasta + busca/filtros + linha do tempo;
3. anamnese geral versionada + alertas;
4. assinatura + documentos/PDF + storage privado;
5. Biblioteca Clínica + módulos específicos;
6. ficha de atendimento e janela de bloqueio/reabertura;
7. fotos clínicas + produtos/equipamentos;
8. intercorrências/evoluções;
9. planos de tratamento + retornos;
10. integração financeira/exceções/pacotes;
11. link remoto 72h;
12. exportação integral;
13. hardening RLS/RPC/storage + auditoria completa;
14. catálogo inicial de procedimentos e templates;
15. homologação somente com dados fictícios.

O plano técnico pode subdividir ainda mais, desde que não altere as decisões de produto desta spec.

## 34. Fora de escopo desta fase

Não inclui, salvo nova aprovação:

- portal completo da cliente com login próprio;
- diagnóstico automático por IA;
- recomendação automática de procedimento por IA;
- decisão automática de contraindicação;
- envio automático de marketing;
- mensagens automáticas sem ação/configuração específica futura;
- alteração do diretório legado `/admin/`;
- uso de dados/pacientes reais em homologação técnica;
- armazenamento público de prontuário/fotos.

## 35. Critérios de sucesso

A Fase 6 será considerada funcionalmente concluída quando:

- cliente puder ser cadastrada com os novos dados;
- pasta única puder ser aberta por toda a equipe ativa autorizada;
- histórico clínico compartilhado funcionar sem vazamento financeiro;
- anamnese versionada e alertas funcionarem;
- procedimentos gerarem fichas independentes;
- assinaturas e PDFs forem preservados/versionados;
- fotos e documentos estiverem privados;
- regras de bloqueio/reabertura forem aplicadas;
- procedimentos restritos forem protegidos no backend;
- intercorrências/evoluções funcionarem;
- planos e retornos funcionarem;
- financeiro respeitar as regras da Fase 5;
- exportação integral ficar restrita à Mel;
- auditoria registrar ações sensíveis;
- testes críticos estiverem verdes;
- homologação fictícia não deixar resíduos indevidos;
- CI e deploy estiverem verdes.

## 36. Observações finais

Esta spec consolida as decisões aprovadas em conversa para transformar a área Clientes em um prontuário estético eletrônico robusto e modular.

Ela deliberadamente separa:

- **identidade da cliente**;
- **histórico clínico compartilhado**;
- **autoria e imutabilidade das fichas**;
- **documentos assinados/versionados**;
- **configuração clínica por procedimento**;
- **intercorrências/evoluções**;
- **financeiro segmentado**.

Nenhuma implementação deve alterar a semântica acima sem nova aprovação explícita do usuário.
