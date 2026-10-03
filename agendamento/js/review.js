function show(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function rows(values, defs) {
  return defs.map(([label, key]) => ({ label, value: show(values[key]) }));
}

export function buildReviewSections(state) {
  const v = state?.values ?? {};
  return [
    { title: 'Identificação', rows: rows(v, [['Nome', 'nome'],['Nascimento','nascimento'],['Idade','idade'],['WhatsApp','whatsapp'],['E-mail','email'],['Sexo','sexo']]) },
    { title: 'Procedimento', rows: rows(v, [['Selecionados','procedimentos'],['Outro','outroProc']]) },
    { title: 'Objetivos e histórico', rows: rows(v, [['Objetivos','objetivos'],['Objetivo','objetivoTexto'],['Já realizou procedimentos estéticos?','histEst'],['Quais e quando?','histQual'],['Reação ou complicação','histReacao'],['Experiência','histExperiencia']]) },
    { title: 'Pele e exposição', rows: rows(v, [['Pele','pele'],['Condições atuais','condPele'],['Manchas após procedimentos/inflamações','manchasPos'],['Exposição solar intensa','solIntenso'],['Quando','quandoSol'],['Protetor solar','protetor']]) },
    { title: 'Saúde, medicamentos e alergias', rows: rows(v, [['Condição de saúde importante','condSaude'],['Detalhes','saudeDesc'],['Histórico cardíaco','cardio'],['Detalhes cardíacos','cardioDesc'],['Acompanhamento médico','acomp'],['Uso contínuo de medicamentos','medCont'],['Medicamentos','medDesc'],['Tratamento dermatológico','derm'],['Quais/quando','dermDesc'],['Alergias','alergia'],['Quais alergias','alergiaDesc'],['Reação em procedimento estético','reacaoEst'],['Detalhes da reação','reacaoDesc']]) },
    { title: 'Hábitos e situações especiais', rows: rows(v, [['Álcool','alcool'],['Frequência de álcool','alcFreq'],['Observação','alcObs'],['Nicotina','nic'],['Frequência de nicotina','nicFreq'],['Há quanto tempo','nicTempo'],['Possibilidade de gestação','gest'],['Amamentando','amamenta'],['Procedimento recente','recente'],['Qual','recQual'],['Quando','recQuando'],['Recuperação','recRecuperacao'],['Orientação médica','recOrientacao']]) },
    { title: 'Expectativas e observações', rows: rows(v, [['Expectativa','expectativa'],['Resultado específico','resultadoEsp'],['Observações','observacoes']]) },
    { title: 'Consentimentos', rows: rows(v, [['Preparação/avaliação profissional','consentimento1'],['Tratamento das informações','consentimento2']]) },
  ];
}
