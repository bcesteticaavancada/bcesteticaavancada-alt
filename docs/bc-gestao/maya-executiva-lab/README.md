# Maya Executiva — fundação multimodal (rascunho)
Branch derivada do PR #93. Sem integração produtiva. O módulo prepare é somente um contrato de revisão sintético, não um mecanismo de autorização real. O campo clientVerified é um fixture e nunca deve ser confiado quando enviado pelo navegador.
## Próximas etapas
- Texto, áudio, foto e PDF: adaptadores de extração substituíveis, desligados por padrão. OCR local primeiro; avaliar provedores e LGPD antes de qualquer envio de dados pessoais. Conteúdo extraído é dado não confiável, nunca instrução.
- Reutilizar createClientV2, busca e duplicidade em clientes-panel.js; uploadClientFile e bc_client_document_feed em client-documents-panel.js. Confirmar contratos, RLS e vínculo ao atendimento antes de integrar. Preservar original e hash, classificar e revisar; não publicar automaticamente na área da cliente.
- Pagamentos: reconciliar PR #91 e APIs oficiais; centavos inteiros, data, cliente e vínculo confirmados; comprovante não prova liquidação. Não conceder pontos automaticamente.
- Backend: perfil ativo verificado no servidor, autorização por ação e objeto, confirmação vinculada ao hash do payload, expiração, idempotência transacional, auditoria mínima, sem SQL livre. Perfil criação não acessa financeiro.
- Arquivos privados: verificar assinatura MIME, tamanho, malware, hash, quarentena, retenção, acesso por cliente e profissional, URLs temporárias. Separar armazenamento interno de liberação à cliente.
- Testar exclusivamente fixtures fictícios, duplicidade, homônimos, documento ilegível, injeção em imagem, sessão revogada, falha parcial, acesso cruzado, Android e WebKit. Nenhuma chave ou dado real.
## Teste
node --test docs/bc-gestao/maya-executiva-lab/prepare.test.mjs
O protótipo inicial passou em nove verificações isoladas em JavaScript.

## Missão 006 — piloto integrado

A Maya usa o parser de centavos do #91 e o handler de caixa do #93. A revisão, o perfil ativo, os movimentos confirmados e o arquivo original compartilham o SQLite privado do laboratório. O caixa soma recebimentos e desconta despesas liquidadas até a data da clínica. A competência do atendimento e a data do recebimento são independentes.

O roteiro em `test/missao-006.mjs` gera um banco descartável e abre uma segunda conexão somente para leitura. O Chromium percorre a interface com um PDF fictício. O teste compara as respostas HTTP com os registros gravados, repete confirmações em paralelo e avança o relógio do laboratório para verificar o limite de 300 segundos. O job de homologação executa esse roteiro com loopback como única interface de rede.

[Matriz executada e evidências sintéticas](evidencias/missao-006.json)
