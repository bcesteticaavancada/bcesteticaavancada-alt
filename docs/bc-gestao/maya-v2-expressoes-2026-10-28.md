# Maya V2 — expressões e movimentos

28/10/2026. Segunda das três versões solicitadas por Fernando. Implementação entregue para avaliação na branch `feature/maya-v2-expressoes`, [PR #70](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/pull/70), em rascunho. Sem merge ou publicação da V2.

## Resultado

- Respiração suave e piscadas espaçadas enquanto o movimento está permitido.
- Cabeça levemente atenta em repouso e inclinada durante a consulta.
- Boca neutra durante espera e falha; sorriso discreto e confirmação visual breve quando uma orientação fica disponível. Não representa execução de tarefa ou fala.
- Pausa manual, preferência por movimento reduzido e página oculta interrompem todas as animações. A expressão estática e o status textual continuam disponíveis.
- Mesmo desenho, tamanhos e identidade da V1, usando SVG/CSS locais. Sem novas dependências.

As 67 respostas da Mel, o manifesto de aprovação, os 16 guias, o código de autenticação, os perfis, o financeiro e o Drive não foram alterados. Nenhuma consulta a prontuários, acesso financeiro ou operação automática foi acrescentada.

## Validação

Código validado no commit `49e6c0e22b4f5c7a4e6916cd48bd4de0d424393e`, árvore `19739d7625d2cc38addb00116c36ac1d6daee513`. A documentação posterior não altera o código executável.

| Verificação | Resultado e evidência |
| --- | --- |
| Teste antes da implementação | [Site CI 40657314397](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40657314397) falhou como esperado: a V1 não possuía `maya-breathe`. Falha do ensaio de nova funcionalidade, não falha da produção. |
| Node | 929 aprovados, zero falhas: 69 anamnese, 133 site e 727 gestão. Suíte local e CI aprovados. |
| Navegadores | [Site CI 40659204467](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40659204467): 26 cenários em Chromium/WebKit. Mede estilos computados, expressões e cancelamento de animações, com perfis fictícios e largura de 320 px. |
| Auth/RLS real isolado | [BC Auth Audit CI 40659204475](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40659204475): dez verificações; contas temporárias autenticadas e removidas em Supabase local descartável. |
| Banco/concorrência | Mesmo CI: 554 verificações em 17 arquivos e três rotinas de concorrência aprovadas, somente com registros fictícios. |
| Pré-anamnese | [CI 40659204439](https://github.com/bcesteticaavancada/bcesteticaavancada-alt/actions/runs/40659204439) aprovado. |
| Prévia independente | HTML sem login, importações ou APIs. Controlador exercitado em DOM/VM: consulta simulada, resposta, falha, descarte de temporizador antigo, pausa, redução de movimento e visibilidade. CSP bloqueia conexões externas. |

Imagens de teste da interface inspecionadas em celular e desktop: sem sobreposição nova ou alteração de layout observada. A revisão independente do diff e da prévia não identificou falha concreta.

O instalador local do Chromium falhou ao baixar o executável. A execução renderizada foi realizada no GitHub CI, não declarada como execução local. A prévia contém o mesmo SVG e CSS da implementação, com uma apresentação independente; seu controlador foi validado em DOM/VM. Não foi executada autenticação hospedada nem teste com dados reais.

## Acesso de Fernando e avaliação

O painel de criação de Fernando não mostra a Maya porque a primeira liberação foi explicitamente restrita a colaboradoras ativas. Essa regra foi preservada. O endereço da gestão inclui `/bcesteticaavancada-alt/`; rotas `/gestao/...` diretamente na raiz do domínio retornam 404 na conferência de 28/10.

Para avaliação visual, Fernando recebeu uma prévia independente que funciona sem login e apenas simula estados. Ela não concede acesso administrativo ou financeiro e não substitui a Maya do aplicativo.

## Pendências e próxima versão

Avaliar aparência e conforto em Android/iPhone físicos, leitor de tela e comportamento real ao alternar aplicativos/abas. O teste de visibilidade automatizado simula a propriedade do documento; não comprova suspensão real pelo sistema operacional. Os testes de estilos não avaliam todos os instantes de cada movimento nem versões antigas de Safari/Firefox.

Após a avaliação visual, decidir a publicação da V2, mantendo a entrada restrita à equipe. A V3 — assistente interativa avançada — permanece futura e separada, assim como voz, ações que alterem registros e abertura a clientes.
