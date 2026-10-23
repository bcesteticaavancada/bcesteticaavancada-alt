# Revisão e homologação controlada do backup Drive

Data: 23/10/2026. Base inicial: `788ab9c84e5eca39f8d86f1f27189e86ce20ba21`; atualizações concorrentes preservadas até `ea84ee6b206a2f67e733d716b0fd90b01ce90ce2`, branch `backup/drive-paralelo-v1`.

## Escopo autorizado

Continuar o worker existente, corrigir falhas verificadas e exercitar suas fronteiras com arquivos fictícios. Não publicar, implantar, agendar, mesclar em main, acessar corpos de documentos reais ou alterar permissões financeiras. Consultas de produção limitadas a agregados de metadados e configuração do bucket; Drive limitado a metadados das cinco pastas fornecidas.

## Decisões

- Reutilizar `core.ts` e a função `drive-backup`; separar transporte e handler para testar o código real sem rede ou credenciais.
- Confirmar pasta privada, proprietário permitido e vínculo de destino à raiz antes de qualquer upload.
- Verificar SHA-256 calculado pelo Drive; comparar conteúdo quando muda apenas a data; preservar versões por conteúdo.
- Salvar manifesto privado de restauração por versão. O manifesto contém caminho original, bucket e hash; não é entregue ao navegador ou aos logs.
- Concluir o objeto somente após manifesto íntegro; reparar execuções incompletas sem reenviar o mesmo conteúdo.
- Homologação de escrita limitada ao prefixo `homologacao/drive-backup/`. Cópias clínicas em produção continuam bloqueadas até autorização futura e controle distribuído de concorrência.
- Limite multipart do worker: 5 MB, abaixo dos 8 MiB permitidos pelo bucket. Até 12 itens, 3.000 nós e orçamento de execução menor que 150 s.

## Tarefas

1. Reproduzir falhas e testar classificação, exclusão financeira, seleção e manifesto. Implementar correções mínimas em `core.ts` e `restore.ts`.
2. Extrair `drive.ts` e `worker.ts` do índice existente. Testar autenticação, modo de inspeção, pastas, paginação, hash, repetição, nova versão, interrupção e restauração com transporte HTTP simulado. Deixar `index.ts` como ligação ao adaptador REST/ambiente do servidor.
3. Atualizar CI com versão Deno fixa e sem dependências externas no worker; executar testes do backup, tipagem e suíte existente do site. Revisão independente do conjunto e correções com regressão.
4. Documentar cobertura do bucket, lacunas PostgreSQL, preparação OAuth `drive.file`, limites, resultados e autorização necessária. Atualizar apenas esta branch.

## Foco da revisão

Permissões ausentes ou amplas devem bloquear; erro após upload não pode gerar cópias repetidas; restauração rejeita hash/caminho divergentes; erro de transporte nunca expõe caminhos/tokens; arquivos reais não entram na homologação mesmo com a flag de escrita habilitada.

## Revisão independente e conciliação

Revisão sem acesso à produção apontou referência de recuperação não autenticada e duplicação de manifesto em falha temporária de leitura. Ambas foram reproduzidas e corrigidas com regressões. As atualizações concorrentes de classificação, exclusão financeira e permissões foram incorporadas; fotos clínicas continuam no destino de arquivos de clientes definido pela branch. A reconferência mostrou acesso individual do proprietário e da Mel; a allowlist de servidor preserva essas duas contas.
