import {fault} from './store.mjs';
// Internal preflight only. There is deliberately no network-capable provider in this build.
export function reserveMaximum(store,{key,units,micros},limits={dayUnits:0,monthMicros:0},now=new Date()){
 if(!/^[a-f0-9]{64}$/.test(key)||![units,micros].every(n=>Number.isSafeInteger(n)&&n>0)||![limits.dayUnits,limits.monthMicros].every(n=>Number.isSafeInteger(n)&&n>=0))throw fault(400,'Reserva inválida.');
 const day=now.toISOString().slice(0,10),month=day.slice(0,7);
 return store.transaction(()=>{
  const prior=store.db.prepare('SELECT * FROM quota WHERE id=?').get(key);
  if(prior)throw fault(409,'Tentativa já reservada.');
  const daily=store.db.prepare('SELECT coalesce(sum(units),0) AS n FROM quota WHERE day=?').get(day).n;
  const monthly=store.db.prepare('SELECT coalesce(sum(micros),0) AS n FROM quota WHERE month=?').get(month).n;
  if(units>limits.dayUnits-daily||micros>limits.monthMicros-monthly)throw fault(429,'BUDGET_HARD_STOP');
  store.db.prepare('INSERT INTO quota VALUES(?,?,?,?,?)').run(key,day,month,micros,units);
  return {reserved:true,units,micros};
 });
}
