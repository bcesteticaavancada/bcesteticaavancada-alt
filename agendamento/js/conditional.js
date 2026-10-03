const BASE_IDS = [
  'nome','nascimento','idade','whatsapp','email','sexo','procedimentos','outroProc',
  'objetivos','objetivoTexto','histEst','pele','solIntenso','condPele','manchasPos','quandoSol','protetor',
  'condSaude','saudeDesc','cardio','cardioDesc','acomp','medCont','medDesc','derm','dermDesc','alergia','alergiaDesc','reacaoEst','reacaoDesc',
  'alcool','nic','gest','amamenta','recente','expectativa','resultadoEsp','observacoes','consentimento1','consentimento2'
];

const FACIAL = new Set([
  'Skinbooster Facial','Papada Off','Cryo Lift','Limpeza de pele + Peeling','Peeling Coreano',
  'Microagulhamento','Radiofrequência Fracionada','Ultrassom Microfocado','Combo Colágeno'
]);
const BODY = new Set(['Sculpt Cryo','Programa Corporal Premium','Massagem Relaxante']);

export function getVisibleModuleKeys(state) {
  const procedures = Array.isArray(state?.values?.procedimentos) ? state.values.procedimentos : [];
  const keys = new Set();
  if (procedures.some((p) => FACIAL.has(p))) keys.add('facial');
  if (procedures.some((p) => BODY.has(p))) keys.add('corporal');
  if (procedures.includes('Microvasos')) keys.add('microvasos');
  if (procedures.some((p) => p.includes('Peeling'))) keys.add('peeling');
  if (procedures.includes('Microagulhamento')) keys.add('microagulhamento');
  if (procedures.some((p) => ['Radiofrequência Fracionada','Ultrassom Microfocado'].includes(p))) keys.add('tecnologias');
  if (procedures.includes('Ainda não sei / Quero orientação profissional')) keys.add('orientacao');
  if (procedures.includes('Outro')) keys.add('outro');
  return [...keys];
}

export function getVisibleQuestionIds(state) {
  const values = state?.values ?? {};
  const ids = new Set(BASE_IDS);
  if (values.histEst === 'Sim') ['histQual','histReacao','histExperiencia'].forEach((id) => ids.add(id));
  if (values.alcool === 'Sim') ['alcFreq','alcObs'].forEach((id) => ids.add(id));
  if (values.nic === 'Sim') ['nicFreq','nicTempo'].forEach((id) => ids.add(id));
  if (values.recente === 'Sim') ['recQual','recQuando','recRecuperacao','recOrientacao'].forEach((id) => ids.add(id));

  for (const key of getVisibleModuleKeys(state)) {
    const map = {
      facial: ['mFaceReg','mFaceObj'], corporal: ['mBodyReg','mBodyObj'],
      microvasos: ['mVascReg','mVascTempo','mVascAnt'], peeling: ['mPeelAnt','mPeelReac','mPeelProd'],
      microagulhamento: ['mMicroAnt','mMicroRec'], tecnologias: ['mTecAnt','mTecReac'],
      orientacao: ['mOrient'], outro: ['mOutro']
    };
    (map[key] || []).forEach((id) => ids.add(id));
  }
  return [...ids];
}
