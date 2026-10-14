# Auto-revisão da spec 6E.1

Revisão de consistência executada em 2026-10-14 antes de solicitar aprovação formal.

Pontos conferidos:

- sem `TBD`/`TODO` ou placeholders;
- Biblioteca Clínica permanece canônica; pacote não vira procedimento clínico;
- combo pode ser simples ou misto;
- toda equipe autorizada pode criar combo;
- criação/uso não depende de aprovação prévia da Mel;
- Mel faz revisão posterior administrativa;
- desconto é aplicado no momento da venda e revisado depois;
- vendas antigas preservam snapshot mesmo se modelo mudar;
- saldo só é consumido na finalização do atendimento;
- retry/corrida de saldo precisam de idempotência e lock transacional;
- integração financeira profunda continua separada para 6E.3;
- `/admin/` legado continua fora do escopo.

Ajustes identificados para incorporar na spec antes da aprovação:

1. explicitar `review_status` também no modelo de pacote criado por colaboradora;
2. fixar faixa matemática de desconto em `0%..100%`, permitindo inclusive 100% quando a operação decidir conceder gratuidade, sem produzir valor negativo;
3. deixar claro que revisão administrativa posterior da Mel não bloqueia criação nem uso do combo, mas preserva sinalização para acompanhamento.
