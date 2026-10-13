# BC Gestão — Fase 6D — Fotos Clínicas, Produtos/Lotes, Equipamentos e Intercorrências

Data: 2026-10-13
Status: especificação formal para revisão final

## 1. Objetivo

A Fase 6D amplia o prontuário clínico formal criado na 6C com quatro subsistemas vinculados ao atendimento real de cada sessão:

1. fotos clínicas privadas;
2. produtos, insumos e lotes;
3. equipamentos e parâmetros utilizados;
4. intercorrências e suas evoluções.

A 6D não cria um prontuário paralelo. O centro continua sendo `clinical_treatments`; todos os novos registros pertencem a um atendimento clínico específico e participam do snapshot/versionamento final desse atendimento.

O resultado esperado é um fluxo mobile-first em que a profissional consiga documentar a sessão de forma completa e rastreável sem transformar a tela em um sistema de estoque, manutenção ou gestão financeira.

## 2. Escopo aprovado

### 2.1. Fotos clínicas

Modelo aprovado: `Antes + Depois + Adicional`.

- Um atendimento pode possuir várias fotos de cada tipo.
- `antes` e `depois` são obrigatórios quando a versão do procedimento possui `requires_photo=true`.
- `adicional` é opcional.
- Cada foto pode registrar região, vista/ângulo e legenda.
- Exemplos de vista: frontal, perfil direito, perfil esquerdo e detalhe.
- As imagens são privadas e nunca se tornam automaticamente material de marketing.

### 2.2. Produtos, insumos e lotes

Modelo aprovado: híbrido.

- Existe uma biblioteca reutilizável de produtos/insumos.
- Lotes são cadastrados separadamente e vinculados ao produto.
- No atendimento, a profissional seleciona produto/lote e registra quantidade e unidade realmente utilizadas.
- O atendimento preserva snapshot do nome, fabricante, lote, validade, quantidade e unidade para que alterações futuras na biblioteca não mudem o histórico.

### 2.3. Equipamentos e parâmetros

Modelo aprovado: biblioteca de equipamentos + parâmetros específicos por aparelho.

- O equipamento é cadastrado uma vez.
- Cada equipamento possui um schema de parâmetros próprio.
- O atendimento registra o aparelho realmente usado e os valores dos parâmetros daquela sessão.
- O uso guarda snapshot do equipamento, do schema e dos valores para preservar o significado histórico dos dados.

### 2.4. Intercorrências

Modelo aprovado: registro estruturado + acompanhamento.

- A intercorrência possui momento, gravidade, descrição, conduta registrada, status e autoria.
- Evoluções posteriores são registradas separadamente e formam uma linha do tempo.
- O sistema não sugere conduta clínica ou médica automaticamente.
- O histórico não é apagado ou reescrito silenciosamente.

## 3. Fora do escopo da 6D

A 6D não implementa:

- estoque completo, compras, fornecedores, custo, margem ou baixa financeira de insumos;
- manutenção preventiva/corretiva, calibração ou agenda técnica de equipamentos;
- publicação de fotos em site, redes sociais ou portfólio;
- consentimento comercial/marketing derivado do consentimento clínico;
- diagnóstico automático, recomendação terapêutica ou decisão clínica por IA;
- cobrança, pacotes, saldo de sessões ou integração financeira por paciente, que permanecem para a 6E;
- exportação completa de prontuário e pacote de entrega ao paciente, que permanece para fase posterior.

## 4. Princípios de arquitetura

### 4.1. `clinical_treatments` continua sendo a raiz

Todos os registros 6D possuem `treatment_id` e são acessados a partir da ficha formal da sessão.

Nenhum dos quatro subsistemas deve criar uma segunda noção de atendimento.

### 4.2. Histórico clínico não é destruído

Antes da finalização, a profissional pode corrigir o rascunho dentro das regras de autoria e auditoria.

Depois da finalização:

- fotos não são substituídas fisicamente;
- usos de produto/lote não são alterados;
- usos de equipamento e parâmetros não são alterados;
- descrição original de intercorrência não é reescrita;
- novas informações de intercorrência entram como evoluções;
- correções do atendimento utilizam o mecanismo de versão/correção já existente na 6C.

### 4.3. Snapshot histórico

O snapshot final de `clinical_treatment_versions` passa a incorporar os dados 6D existentes no momento da finalização:

- metadados das fotos válidas;
- produtos/lotes utilizados;
- equipamentos/parâmetros utilizados;
- intercorrências existentes e estado conhecido naquele momento.

Alterações futuras em catálogos não modificam snapshots antigos.

### 4.4. Backend é a autoridade

Regras de exigência, permissão, finalização e imutabilidade são validadas em RPC/functions/constraints. A interface apenas reflete o estado devolvido pelo backend.

## 5. Modelo de dados — fotos clínicas

### 5.1. `clinical_treatment_photos`

Campos principais:

- `id uuid`;
- `treatment_id uuid not null`;
- `cliente_id uuid not null`;
- `kind text not null check in ('antes','depois','adicional')`;
- `region text`;
- `view text`;
- `caption text`;
- `storage_path text not null unique`;
- `mime_type text not null check in ('image/jpeg','image/png','image/webp')`;
- `size_bytes bigint not null`;
- `captured_at timestamptz not null`;
- `created_by uuid not null`;
- `created_at timestamptz not null default now()`;
- `voided_at timestamptz`;
- `voided_by uuid`;
- `void_reason text`.

A anulação lógica existe para upload incorreto. O objeto físico continua preservado no Storage. Fotos anuladas não contam para os gates de finalização.

### 5.2. Caminho de Storage

As fotos ficam no bucket privado já utilizado pelo prontuário, em caminho próprio:

`fotos-clinicas/{cliente_id}/{treatment_id}/{uuid}.{ext}`

Regras:

- bucket nunca público;
- formatos: JPEG, PNG e WebP;
- limite de arquivo segue o limite vigente do bucket;
- leitura via URL assinada curta;
- sem `getPublicUrl`;
- sem policy de UPDATE/DELETE para objetos clínicos no fluxo comum;
- insert validado contra cliente, atendimento, profissional e extensão.

## 6. Modelo de dados — produtos e lotes

### 6.1. `clinical_products`

Campos principais:

- `id uuid`;
- `name text not null`;
- `manufacturer text`;
- `category text`;
- `default_unit text`;
- `tracks_lot boolean not null default true`;
- `active boolean not null default true`;
- `created_by uuid`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Produtos já usados em prontuário não são apagados; podem ser desativados.

### 6.2. `clinical_product_lots`

Campos principais:

- `id uuid`;
- `product_id uuid not null`;
- `lot_code text not null`;
- `expires_on date not null`;
- `notes text`;
- `active boolean not null default true`;
- `created_by uuid`;
- `created_at timestamptz`.

A combinação produto + lote deve ser única.

### 6.3. `clinical_treatment_product_usages`

Campos principais:

- `id uuid`;
- `treatment_id uuid not null`;
- `product_id uuid not null`;
- `lot_id uuid`;
- `quantity numeric not null check > 0`;
- `unit text not null`;
- `product_name_snapshot text not null`;
- `manufacturer_snapshot text`;
- `lot_code_snapshot text`;
- `expires_on_snapshot date`;
- `created_by uuid not null`;
- `created_at timestamptz not null`.

Quando o procedimento exige lote, `lot_id`, `lot_code_snapshot` e `expires_on_snapshot` são obrigatórios. Um produto sem rastreio de lote só pode ser usado sem lote quando o procedimento não possui `requires_product_lot=true`.

Não há baixa automática de estoque na 6D.

## 7. Modelo de dados — equipamentos

### 7.1. `clinical_equipment`

Campos principais:

- `id uuid`;
- `name text not null`;
- `manufacturer text`;
- `model text`;
- `internal_code text`;
- `serial_number text`;
- `parameter_schema jsonb not null default '{}'`;
- `active boolean not null default true`;
- `created_by uuid`;
- `created_at timestamptz`;
- `updated_at timestamptz`.

Equipamentos já usados não são apagados; podem ser desativados.

### 7.2. Schema de parâmetros

O schema aceita campos controlados, sem HTML ou script arbitrário. Tipos suportados inicialmente:

- `number`;
- `text`;
- `select`;
- `boolean`.

Cada definição pode conter:

- `key`;
- `label`;
- `type`;
- `required`;
- `unit`;
- `options` para `select`;
- `min`, `max` e `step` para números quando aplicável.

O backend valida os valores obrigatórios e os tipos antes de aceitar o uso do equipamento.

### 7.3. `clinical_treatment_equipment_usages`

Campos principais:

- `id uuid`;
- `treatment_id uuid not null`;
- `equipment_id uuid not null`;
- `equipment_name_snapshot text not null`;
- `manufacturer_snapshot text`;
- `model_snapshot text`;
- `internal_code_snapshot text`;
- `parameter_schema_snapshot jsonb not null`;
- `parameter_values jsonb not null`;
- `created_by uuid not null`;
- `created_at timestamptz not null`.

## 8. Modelo de dados — intercorrências

### 8.1. `clinical_intercurrences`

Campos principais:

- `id uuid`;
- `treatment_id uuid not null`;
- `cliente_id uuid not null`;
- `moment text not null check in ('antes','durante','apos')`;
- `severity text not null check in ('leve','moderada','grave','critica')`;
- `description text not null`;
- `action_taken text not null`;
- `status text not null check in ('aberta','acompanhamento','encerrada')`;
- `occurred_at timestamptz not null`;
- `created_by uuid not null`;
- `created_at timestamptz not null`;
- `closed_at timestamptz`.

Descrição e conduta original podem ser corrigidas somente enquanto o atendimento ainda é editável e sempre com auditoria. Após a finalização do atendimento, tornam-se imutáveis.

### 8.2. `clinical_intercurrence_updates`

Campos principais:

- `id uuid`;
- `intercurrence_id uuid not null`;
- `evolution text not null`;
- `status_after text not null check in ('aberta','acompanhamento','encerrada')`;
- `created_by uuid not null`;
- `created_at timestamptz not null`.

Cada atualização é append-only. Um RPC atômico insere a evolução e sincroniza o status corrente da intercorrência. A linha do tempo é a fonte de auditoria das mudanças de status.

Após a finalização da sessão, profissionais clínicas ativas podem adicionar evolução a uma intercorrência existente; não podem reescrever o evento original.

## 9. Permissões

### 9.1. Visualização

Equipe BC autenticada e ativa pode visualizar os registros clínicos conforme as regras já aplicadas ao prontuário compartilhado.

### 9.2. Dados da sessão

Enquanto o atendimento está editável, a profissional responsável pela sessão pode:

- anexar/anular fotos;
- registrar/remover/corrigir usos de produto e equipamento;
- abrir intercorrência;
- corrigir dados 6D do rascunho.

Administração clínica autorizada pode atuar nos fluxos de correção já previstos pela 6C.

### 9.3. Catálogos

A gestão da biblioteca de produtos/lotes e de equipamentos reutiliza a permissão de gestão de Biblioteca Clínica, evitando criar um novo papel administrativo apenas para a 6D.

### 9.4. Evolução de intercorrência

Qualquer profissional clínica ativa (`atende_clientes`) pode adicionar uma evolução posterior a uma intercorrência existente, sempre com autoria e horário registrados. Isso evita que o acompanhamento fique bloqueado quando a profissional original não estiver disponível.

## 10. Gates de finalização

A 6D estende os gates da 6C. O backend calcula e devolve motivos de pendência adicionais.

### 10.1. Fotos

Se `procedure_version.requires_photo=true`, o atendimento exige:

- pelo menos 1 foto válida `antes`;
- pelo menos 1 foto válida `depois`.

Fotos `adicional` não satisfazem esses dois requisitos.

Motivo de gate: `fotos_pendentes`.

### 10.2. Produto/lote

Se `procedure_version.requires_product_lot=true`, exige ao menos um uso contendo:

- produto;
- lote;
- validade;
- quantidade > 0;
- unidade.

Motivo de gate: `produto_lote_pendente`.

### 10.3. Equipamento

Se `procedure_version.requires_equipment=true`, exige ao menos um uso de equipamento com todos os parâmetros marcados como obrigatórios no schema preenchidos e validados.

Motivo de gate: `equipamento_pendente`.

### 10.4. Intercorrência aberta

A existência de intercorrência `aberta` ou `acompanhamento` não bloqueia automaticamente a finalização. Em vez disso, a profissional precisa registrar uma confirmação explícita de que está finalizando a sessão com acompanhamento pendente.

A confirmação gera evento de auditoria com os IDs das intercorrências abertas no momento.

Sem essa confirmação, o gate retornado é `intercorrencia_aberta_nao_confirmada`.

A confirmação não encerra a intercorrência e não substitui evolução posterior.

## 11. Fluxo mobile-first

Os recursos 6D entram na ficha de atendimento já existente como quatro cards recolhíveis, sem criar uma tela clínica paralela:

1. `Fotos clínicas`;
2. `Produtos e lotes`;
3. `Equipamentos`;
4. `Intercorrências`.

Cada card mostra:

- chip `Obrigatório` quando a versão do procedimento exige aquele bloco;
- estado `Pendente` ou `Completo`;
- resumo dos itens já registrados;
- ação principal adequada ao celular.

### 11.1. Fotos

Fluxo:

- escolher `Antes`, `Depois` ou `Adicional`;
- abrir câmera/galeria pelo input nativo;
- informar região/vista quando necessário;
- exibir miniaturas privadas obtidas por URL assinada;
- permitir anulação lógica antes da finalização com motivo.

### 11.2. Produtos/lotes

Fluxo:

- buscar/selecionar produto;
- selecionar lote ativo do produto;
- informar quantidade e unidade;
- mostrar validade do lote antes de confirmar;
- permitir cadastro de produto/lote a usuários com permissão de Biblioteca Clínica.

Lote vencido não pode ser registrado como novo uso clínico. Registros históricos permanecem visíveis mesmo depois do vencimento.

### 11.3. Equipamentos

Fluxo:

- selecionar equipamento ativo;
- renderizar dinamicamente apenas os parâmetros definidos para ele;
- validar obrigatórios antes de salvar;
- mostrar resumo dos parâmetros registrados.

### 11.4. Intercorrências

Fluxo:

- botão `Registrar intercorrência`;
- formulário curto de momento, gravidade, descrição e conduta registrada;
- status inicial `aberta`;
- timeline de evoluções;
- ações `Adicionar evolução` e, quando cabível, `Encerrar`.

## 12. APIs/RPCs esperados

A implementação deve manter interfaces pequenas e específicas. Nomes podem receber ajuste técnico durante o plano, mas as responsabilidades são fixas.

### Fotos

- registrar metadados de foto já enviada ao Storage;
- listar fotos por atendimento;
- anular foto com motivo;
- gerar URL assinada curta.

### Produtos/lotes

- listar/criar/atualizar/desativar produtos;
- listar/criar/desativar lotes;
- registrar/listar/remover uso enquanto atendimento está editável.

### Equipamentos

- listar/criar/atualizar/desativar equipamentos;
- registrar/listar/remover uso enquanto atendimento está editável;
- validar `parameter_values` contra `parameter_schema` no backend.

### Intercorrências

- abrir intercorrência;
- listar por atendimento/cliente;
- adicionar evolução;
- obter estado atual e timeline;
- registrar confirmação de finalização com acompanhamento pendente.

### Gate central

O RPC de estado/gates do atendimento deve incluir as quatro novas regras da 6D e continuar sendo a única fonte de verdade para habilitar finalização.

## 13. Auditoria

Eventos mínimos a registrar em `audit_log`:

- foto clínica registrada;
- foto clínica anulada;
- produto criado/alterado/desativado;
- lote criado/desativado;
- uso de produto registrado/corrigido/removido no rascunho;
- equipamento criado/alterado/desativado;
- uso de equipamento registrado/corrigido/removido no rascunho;
- intercorrência registrada;
- evolução de intercorrência registrada;
- mudança de status de intercorrência;
- confirmação de finalização com intercorrência pendente.

Logs não devem copiar conteúdo clínico sensível desnecessariamente. Preferir IDs, estado anterior/novo e metadados mínimos.

## 14. Integração com versionamento e PDF

Ao finalizar o atendimento, o snapshot da nova `clinical_treatment_version` incorpora os dados 6D válidos daquele momento.

O PDF da ficha de atendimento inclui:

- produtos/lotes utilizados;
- quantidade/unidade;
- equipamentos e parâmetros usados;
- intercorrências existentes e estado conhecido no momento da finalização;
- indicação de quantidade e classificação das fotos clínicas vinculadas.

As imagens clínicas completas não são embutidas no PDF da 6D. Elas permanecem no repositório clínico privado, vinculadas ao atendimento. Essa escolha mantém o PDF leve, reduz exposição desnecessária e evita duplicar arquivos sensíveis. Uma exportação que reúna documentos e fotos pode ser tratada pelo fluxo de entrega/exportação de fase posterior.

Evoluções de intercorrência adicionadas depois da finalização não alteram retroativamente o PDF já emitido nem o snapshot daquela versão.

## 15. Segurança e LGPD por desenho

- nenhuma foto clínica em bucket público;
- nenhuma URL permanente de foto;
- URLs assinadas curtas;
- Storage e tabelas protegidos por autenticação/RLS/RPC;
- sem `service_role` no navegador;
- sem conteúdo clínico detalhado em logs técnicos;
- nenhum dado clínico real em testes automatizados;
- foto clínica nunca implica autorização comercial;
- objetos de Storage clínico não são apagados pelo usuário final no fluxo normal;
- catálogos podem ser desativados, não destruídos quando já houver histórico.

## 16. Tratamento de erros

- upload falhou: nenhum metadado de foto é registrado;
- metadado falhou após upload: interface informa falha e permite nova tentativa sem declarar o item como concluído;
- URL assinada expirou: gerar outra sob demanda;
- lote vencido: impedir novo registro de uso e explicar o motivo;
- parâmetro obrigatório ausente: não salvar uso como válido para gate;
- atendimento já finalizado: rejeitar mutações 6D comuns no backend;
- intercorrência finalizada: nova evolução pode reabrir para `acompanhamento` somente se o RPC registrar explicitamente a mudança e autoria;
- erro parcial nunca deve liberar gate de finalização.

## 17. Estratégia de testes

A implementação segue RED → GREEN com dados fictícios.

Cobertura mínima:

- contratos de tabelas, constraints, índices e FKs;
- RLS/permissões e ausência de acesso anon;
- Storage privado e ausência de `getPublicUrl`;
- path de foto validado por cliente e atendimento;
- foto `antes/depois` obrigatória quando flag ativa;
- fotos anuladas não contam para gate;
- snapshot de produto/lote não muda após alteração de catálogo;
- lote vencido bloqueado para novo uso;
- quantidade/unidade obrigatórias;
- schema de equipamento validado no backend;
- parâmetros obrigatórios bloqueiam gate;
- snapshot de equipamento/schema preservado;
- intercorrência gera timeline append-only;
- evolução após atendimento finalizado é permitida sem reescrever evento original;
- finalização com intercorrência aberta exige confirmação auditada;
- dados 6D entram no snapshot final;
- PDF clínico contém os resumos 6D sem embutir fotos;
- interface mobile renderiza estados obrigatório/pendente/completo;
- regressão completa da 6A/6B/6C continua verde.

## 18. Migração e implantação

A 6D deve ser entregue em migrations incrementais, sem reescrever migrations históricas da 6A/6B/6C.

Ordem recomendada de implementação:

1. contratos de banco e permissões;
2. fotos clínicas e Storage;
3. produtos/lotes e usos;
4. equipamentos/schema/parâmetros e usos;
5. intercorrências/evoluções;
6. integração dos gates no tratamento;
7. integração do snapshot/PDF;
8. interface mobile;
9. testes de regressão, CI e deploy.

Nenhuma migration deve apagar ou converter destrutivamente dados clínicos existentes.

## 19. Critérios de aceite

A Fase 6D é considerada concluída quando:

1. uma sessão marcada `requires_photo` não finaliza sem ao menos uma foto Antes e uma Depois válidas;
2. fotos são privadas, visíveis por URL temporária e nunca públicas;
3. produto/lote/validade/quantidade/unidade ficam rastreáveis na sessão e preservados por snapshot;
4. lote vencido não pode ser usado em novo registro;
5. procedimentos que exigem equipamento não finalizam sem parâmetros obrigatórios válidos;
6. alterações futuras de produto/equipamento não mudam atendimentos antigos;
7. intercorrência possui registro estruturado e timeline de evolução;
8. uma intercorrência pendente exige confirmação explícita antes de finalizar a sessão, mas não força encerramento artificial;
9. atendimento finalizado rejeita alterações destrutivas dos dados 6D;
10. evolução posterior de intercorrência continua possível com autoria/auditoria;
11. snapshot e PDF da sessão refletem os dados 6D do momento da finalização;
12. a interface funciona de forma utilizável em celular;
13. toda a suíte de regressão das fases anteriores continua passando;
14. nenhuma funcionalidade da 6D implementa estoque/financeiro da 6E ou publicação comercial de fotos.

## 20. Limite entre 6D e 6E

A 6D responde à pergunta: **o que foi clinicamente usado, registrado e observado nesta sessão?**

A 6E responderá a perguntas comerciais/operacionais como: **qual pacote foi vendido, quantas sessões restam, quanto foi pago, qual retorno está pendente e como isso se integra ao financeiro por cliente?**

Manter essa fronteira é obrigatório para impedir que a 6D cresça para um ERP e comprometa a segurança do prontuário.
