export type Procedure = {
  id: string;
  name: string;
  family: 'Facial' | 'Estética avançada' | 'Corporal';
  description: string;
  icon: string;
};

export const procedures: Procedure[] = [
  { id: 'limpeza-pele', name: 'Limpeza de pele', family: 'Facial', description: 'Cuidado facial personalizado, após avaliação profissional.', icon: '✦' },
  { id: 'peeling', name: 'Peeling', family: 'Facial', description: 'Conheça as possibilidades de renovação da pele.', icon: '✧' },
  { id: 'microagulhamento', name: 'Microagulhamento', family: 'Estética avançada', description: 'Informações e orientações para avaliação individual.', icon: '✺' },
  { id: 'botox', name: 'Toxina botulínica', family: 'Estética avançada', description: 'Avaliação e planejamento por profissional habilitada.', icon: '✦' },
  { id: 'bioestimulador', name: 'Bioestimulador', family: 'Estética avançada', description: 'Saiba mais sobre o tratamento e suas indicações.', icon: '✧' },
  { id: 'massagem', name: 'Massagens', family: 'Corporal', description: 'Conheça as opções de relaxamento e cuidado corporal.', icon: '❋' },
  { id: 'black-peel', name: 'Black peel', family: 'Facial', description: 'Conheça o protocolo e agende uma avaliação.', icon: '✺' },
  { id: 'despigmentacao', name: 'Despigmentação', family: 'Estética avançada', description: 'Informações sobre avaliação e sessões.', icon: '✧' },
];
