import type {EnrollmentProjection} from './backendGateway.ts';

/** Aggregates only scoped server projections; missing history stays unavailable. */
export function coordinatorDashboardModel(enrollments:EnrollmentProjection[],programs:{id:string;code:string}[],registeredStudents:number,notifications:{id:string;created_at:string;content:{kind:string}}[]){
 const summary=programs.map(p=>{const rows=enrollments.filter(e=>e.programId===p.id);const required=rows.reduce((n,e)=>n+e.requiredMinutes,0),credited=rows.reduce((n,e)=>n+e.creditedMinutes,0);return {name:p.code,department:p.code,students:new Set(rows.map(e=>e.studentId)).size,completion:required?Math.round(credited/required*100):0,hours:credited/60};});
 return {stats:{totalInterns:registeredStudents,activePrograms:programs.length,totalHoursLogged:enrollments.reduce((n,e)=>n+e.creditedMinutes,0)/60},programs:summary,hours:summary.map(p=>({department:p.department,hours:p.hours})),activities:notifications.map(n=>({id:n.id,action:n.content.kind.replaceAll('_',' '),name:'Notification',time:new Date(n.created_at).toLocaleString()}))};
}
