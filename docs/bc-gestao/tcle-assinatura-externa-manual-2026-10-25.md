# BC Gestão — TCLE com assinatura externa manual

**Revisão:** 25/10/2026. **Estado:** proposta não publicada; homologação pendente.

## Escopo

Este fluxo é para o **Termo de Consentimento Livre e Esclarecido (TCLE) e Ciência dos Riscos do Procedimento**. Não é laudo, avaliação pré-operatória ou formulário de risco cirúrgico. Os textos clínicos por procedimento são os modelos versionados existentes na BC e precisam de aprovação da responsável técnica.

**Não há integração OAuth, API, autenticação ou consulta automática ao gov.br.** O cliente faz a assinatura fora da BC; a clínica apenas recebe o PDF devolvido.

## Etapas operacionais

1. Abrir a pasta da cliente e o atendimento correto. Preparar o consentimento conforme procedimento e componentes da sessão.
2. A profissional responsável lê o termo e registra a própria assinatura gráfica no aplicativo.
3. Clicar em **Baixar PDF para assinatura da cliente**. Esta é uma **via intermediária**, identificada como pendente da assinatura da cliente. O aplicativo não marca o TCLE como finalizado nem emite documento clínico definitivo nesse momento.
4. A profissional envia o PDF ao cliente pelo canal de comunicação habitual, utilizando cuidados de privacidade adequados a dados de saúde.
5. O cliente, se optar pelo gov.br, assina o PDF externamente, **baixa o arquivo assinado no serviço** e o devolve. Não imprimir como PDF: essa operação pode remover a assinatura digital.
6. Na aba **Documentos**, escolher **Receber TCLE assinado pela cliente (PDF)** e anexar o PDF devolvido (máximo 8 MiB).
7. Conferir identidade, documento correto, integridade/assinatura e compatibilidade com o procedimento. A verificação da assinatura gov.br deve ser feita **manualmente** no VALIDAR (https://validar.iti.gov.br/), quando aplicável. A origem `gov_br` registra informação declarada no upload; o BC Gestão **não afirma tê-la validado**.
8. Clicar em **Vincular como TCLE externo** no arquivo, acessar a etapa do atendimento, e a profissional responsável revisar e vincular. Um mero upload não desbloqueia o procedimento.

## Controles mantidos

- Arquivos no bucket privado `bc-prontuario-private`; downloads por URL assinada temporária, não por URL pública.
- Hash SHA-256 dos arquivos recebidos, registro da autoria do upload e anulação lógica em caso de erro.
- Restrição a PDF na categoria de TCLE externo, já exigida na vinculação clínica.
- O vínculo clínico exige mesma cliente, PDF não anulado, profissional autorizada e compatibilidade com a classe/procedimento da sessão. A ficha final congela a referência de integridade.
- O envio ao cliente e a validação externa não são automatizados. Nunca requisitar senha, token, código ou acesso à conta gov.br do paciente.
- Preservar o PDF devolvido sem reimprimir, sobrescrever ou editar seus bytes.

## Homologação antes da publicação

- Executar testes Node, Deno, CI e uso real em celular **somente com dados fictícios**.
- Confirmar deploy da Edge Function `generate-clinical-pdf` no ambiente de homologação antes de exibir o botão em produção; a interface e a função precisam ser publicadas juntas.
- Testar falhas: profissional não assinou; documento já finalizado; cliente diferente; arquivo não PDF; falta de autorização; arquivo anulado; assinatura externa inválida ou ausente.
- Mel, como responsável técnica, deve conferir texto, riscos/benefícios, contraindicações, informações sobre alternativas, liberdade de recusa e identificação da profissional.
- Não tratar a presença de um PDF nem o registro de origem como prova automática de assinatura ou de consentimento válido.
