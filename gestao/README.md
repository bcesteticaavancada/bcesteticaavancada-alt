# BC Gestão 1.0

Fundação técnica isolada da área administrativa da BC Estética Avançada.

## Rotas previstas

- `/login/` — entrada única por e-mail e senha, ainda sem autenticação real na Fase 1.
- `/admin/` — painel da administradora, futuramente com visão geral, agenda, clientes, histórico e financeiro.
- `/colaborador/` — painel individual das colaboradoras, sem acesso financeiro.

## Limites da Fase 1

Esta etapa contém somente shell visual, navegação estática, contrato de roteamento e preparação de hospedagem. Não há clientes reais, agenda real, pagamentos, histórico clínico, autenticação ou banco conectados.

## Segurança

Nenhuma senha, token privado, chave privilegiada ou credencial de backend pode ser adicionada ao código cliente. A autorização futura será aplicada no backend e no banco, não apenas escondida na interface.

## Supabase

O projeto de pré-anamnese existente não é alterado nem consumido por esta fundação. A conexão de Auth e banco do BC Gestão exige uma decisão explícita em fase posterior.

## Hospedagem futura

Quando houver conexão à Vercel, a aplicação deverá usar `gestao` como `rootDirectory`. Nesta fase não existe projeto Vercel criado ou conectado.

## Separação do admin antigo

A rota `/admin/` já existente no site institucional pertence à pré-anamnese e permanece separada. O `/admin/` descrito neste documento é relativo ao futuro root isolado de `gestao`.
