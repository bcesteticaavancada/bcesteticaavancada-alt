# Calendário mensal na inicial e em Agendamento

Pedido: repetir o calendário já disponível em `/agenda/` nas páginas públicas. Na inicial, o calendário fica como último bloco de `main`, imediatamente antes do rodapé. Em `/agendamento/`, fica no início da página e a pré-anamnese de oito etapas permanece logo abaixo.

As duas páginas reutilizam o HTML completo de `.agenda-workspace`, o mesmo `agenda/js/main.js` e o mesmo CSS da agenda mensal. Não há iframe, novo endpoint ou alteração em pacientes, profissionais, horários, banco de dados ou regras de disponibilidade. O calendário continua usando o fluxo público existente: selecionar dia, procedimento, profissional, horário e confirmar.

`agenda/embeds.css` ajusta apenas o espaço e os títulos dos blocos inseridos. A regra de bloqueio de rolagem durante o diálogo agora usa `body.agenda-dialog-open`, funcionando também quando `.agenda-page` é uma seção interna.

Validação: teste de integração nas duas páginas cobre calendário completo, ausência de IDs duplicados, navegação mensal, seleção de data, procedimento e horários, sem reservar dados reais. O teste também exige que o HTML do calendário continue igual nas três páginas para evitar divergência entre cópias. A pré-anamnese mantém suas oito etapas e seu módulo original.

A suíte de navegador existente foi ampliada para a inicial e Agendamento em telefone pequeno, tablet e desktop, nos motores Chromium e WebKit, com API e reservas inteiramente fictícias. A execução local não dispõe dos binários de navegador; a execução completa ocorre no Site CI antes da publicação.
