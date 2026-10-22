// Explicitly owner-authorized recovery of the existing synthetic local bootstrap.
// Never a public endpoint or a general coordinator-creation/password-reset tool.
import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {randomBytes,randomUUID} from 'node:crypto';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';
const {values}=parseArgs({options:{email:{type:'string'},reason:{type:'string'},'reset-test-mfa':{type:'boolean'}}});
const email=values.email?.trim().toLowerCase(),reason=values.reason?.trim();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!reason)throw new Error('Exact controlled email and recovery reason required.');
const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Load the ignored local operator environment.');
const endpoint=new URL(url);if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.port!=='54321')throw new Error('Local project only.');
const docker=join(process.env.LOCALAPPDATA||'','Programs','DockerDesktop','resources','bin','docker.exe');
const sql=value=>"'"+String(value).replaceAll("'","''")+"'";
const query=input=>execFileSync(docker,['exec','-i','supabase_db_InTrack','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
const directory='backups/coordinator-recovery',path=join(directory,'operation.json');
await mkdir(directory,{recursive:true});
let operation;try{operation=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const save=()=>writeFile(path,JSON.stringify(operation,null,2)+'\n');
let stage='bootstrap identity';
try{
 const rows=JSON.parse(query("select coalesce(jsonb_agg(jsonb_build_object('profileId',p.id,'subject',p.auth_user_id,'email',u.email)),'[]') from intrack.bootstrap_requests b join intrack.profiles p on p.id=b.profile_id join auth.users u on u.id=p.auth_user_id where p.status='active' and exists(select 1 from intrack.memberships m where m.profile_id=p.id and m.role='coordinator' and m.active);"));
 if(rows.length!==1)throw new Error('Exactly one active linked bootstrap is required.');
 const original=rows[0];
 if(operation&&(operation.subject!==original.subject||operation.email!==email))throw new Error('Existing recovery operation differs; reconcile it explicitly.');
 if(!operation){if(!original.email.endsWith('@example.test'))throw new Error('This recovery is limited to the existing synthetic test identity.');operation={id:randomUUID(),subject:original.subject,profileId:original.profileId,email,reason,resetMfa:values['reset-test-mfa']===true};await save();}
 if(operation.sent){console.log('Recovery was already requested; no duplicate email or authenticator reset was performed.');process.exit(0);}
 const worker=createClient(url,key,{global:{fetch:createSupabaseApiFetch(key)},auth:{persistSession:false,autoRefreshToken:false}});
 stage='session invalidation';
 if(!operation.sessionsInvalidated){const {error}=await worker.rpc('intrack_invalidate_coordinator_sessions',{subject:operation.subject,reason:operation.reason});if(error)throw error;operation.sessionsInvalidated=true;await save();}
 stage='controlled email and unusable old password';
 if(!operation.credentialsPrepared){const result=await worker.auth.admin.updateUserById(operation.subject,{email,password:'Aa9!'+randomBytes(32).toString('base64url'),email_confirm:true});if(result.error)throw result.error;operation.credentialsPrepared=true;await save();}
 stage='test authenticator recovery';
 if(operation.resetMfa&&!operation.mfaReset){const factors=await worker.auth.admin.mfa.listFactors({userId:operation.subject});if(factors.error)throw factors.error;for(const factor of factors.data.factors){const removed=await worker.auth.admin.mfa.deleteFactor({userId:operation.subject,id:factor.id});if(removed.error)throw removed.error;}operation.mfaReset=true;await save();}
 stage='bootstrap association';
 if(!operation.linked){query(`begin;update intrack.bootstrap_requests set email=${sql(email)} where profile_id=${sql(operation.profileId)}::uuid;update intrack.account_invitations set email=${sql(email)},revision=revision+1 where profile_id=${sql(operation.profileId)}::uuid;insert into intrack.audit_events(entity_type,entity_id,action,command_id,details) values('profile',${sql(operation.profileId)}::uuid,'local_coordinator_recovery_prepared',${sql(operation.id)}::uuid,jsonb_build_object('reason',${sql(operation.reason)},'testMfaReset',${operation.resetMfa?'true':'false'}));commit;`);operation.linked=true;await save();}
 stage='recovery email';
 const delivered=await worker.auth.resetPasswordForEmail(email,{redirectTo:'http://localhost:5173/?authSetup=1'});if(delivered.error)throw delivered.error;
 operation.sent=true;await save();
 console.log('Local coordinator recovery requested for the owner-approved inbox. Existing program scope was preserved. Old sessions were invalidated; MFA enrollment remains required. No password, token, API key or recovery URL was printed.');
}catch{console.error(`Local coordinator recovery stopped at ${stage}. The private operation record is preserved; no credentials were printed.`);process.exitCode=1;}
