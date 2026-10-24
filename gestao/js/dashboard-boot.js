import {startDashboard} from './dashboard-runtime.js';
import {startLiveRefresh} from './live-refresh.js';
import {initAdminAgenda} from './admin-agenda.js';
import {initCollaboratorAgenda,isAgendaManager} from './colaborador-agenda.js';
import {initClientesPanel} from './clientes-panel.js?v=20261018-basic';
import {initAdminFinance} from './admin-finance.js';
import {initCollaboratorFinance} from './colaborador-finance.js';
import {initAdminAudit} from './admin-audit.js';
import {initAdminStaffClinicalIdentity} from './admin-staff-profile.js';
import {initPreAnamneseInbox} from './pre-anamnese-inbox.js';
import {initProcedurePanel,canManageProcedureLibrary} from './procedure-panel.js';
import {initAdminSchedule} from './admin-schedule.js';
import {initCollaboratorSchedule} from './colaborador-schedule.js';
import {listStaffDirectory} from './agenda-api.js';
export function startStaffDashboard({client,profile,root=document,authorize}){
 const admin=profile.role==='admin',manager=admin||isAgendaManager(profile);let dashboard;
 const procedureNav=root.getElementById('procedureLibraryNav');if(procedureNav)procedureNav.hidden=!canManageProcedureLibrary(profile);
 const areas={
  agenda:{init:async()=>{const p=await (admin?initAdminAgenda:initCollaboratorAgenda)({client,profile,root});return {...p,refresh:admin?p.refreshAgenda:p.refresh};}},
  clientes:{init:async()=>{const p=await initClientesPanel({client,profile,root,canArchive:admin,onClientsChanged:()=>dashboard.get('agenda')?.refreshClients?.()});return {...p,refresh:p.refreshClients};}},
  financeiro:{init:()=> (admin?initAdminFinance:initCollaboratorFinance)({client,profile,root})},
  disponibilidade:{init:()=>manager?initAdminSchedule({client,profile,root,areaId:'disponibilidade',staffProvider:()=>listStaffDirectory({client})}):initCollaboratorSchedule({client,profile,root,areaId:'disponibilidade'})},
 };
 if(canManageProcedureLibrary(profile))areas.procedimentos={init:()=>initProcedurePanel({client,profile,root})};
 if(admin){areas.auditoria={init:()=>initAdminAudit({client,root})};areas['pre-anamneses']={init:()=>initPreAnamneseInbox({client,root})};areas.equipe={init:()=>initAdminStaffClinicalIdentity({client,root})};}
 dashboard=startDashboard({root,areas,authorize});
 const openIntakes=async event=>{const button=event.target.closest?.('[data-client-intakes]');if(!admin||!button)return;button.disabled=true;try{await dashboard.open('pre-anamneses');dashboard.get('pre-anamneses')?.setClientContext?.({id:button.dataset.clientIntakes,nome:button.dataset.intakeClientName,telefone:button.dataset.intakeClientPhone});root.defaultView?.history?.replaceState(null,'','#pre-anamneses');}finally{button.disabled=false;}};
 root.addEventListener('click',openIntakes);
 const live=startLiveRefresh({root,authorize,tasks:Object.keys(areas).map(name=>({scope:()=>root.getElementById(name),refresh:options=>dashboard.refresh(name,options)}))});
 return {...dashboard,destroy(){root.removeEventListener('click',openIntakes);live.stop();dashboard.destroy();}};
}
