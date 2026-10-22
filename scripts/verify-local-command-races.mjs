// Real independent PostgreSQL connections, limited to a verified restore clone.
import {execFile,execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const {values}=parseArgs({options:{database:{type:'string'}}});
const database=values.database;
if(!/^intrack_restore_\d{8}_[a-f0-9]{8}$/.test(database||''))throw new Error('Use a verified isolated restoration database; the original database is forbidden.');
const folder=resolve('backups',database),report=JSON.parse(await readFile(join(folder,'verification.json'),'utf8'));
if(report.isolatedDatabase!==database)throw new Error('Restoration identity mismatch');
const docker=[process.env.INTRACK_DOCKER_EXECUTABLE,process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe')].find(p=>p&&existsSync(p))||'docker';
const args=['exec','-i','supabase_db_InTrack','psql','-w','-U','supabase_admin','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'];
const sql=text=>execFileSync(docker,args,{input:text,timeout:30000,maxBuffer:1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']}).toString().trim();
const query=text=>new Promise((resolve,reject)=>{const child=execFile(docker,args,{timeout:30000,maxBuffer:1024*1024,windowsHide:true},(error,stdout)=>error?reject(new Error('Isolated PostgreSQL command failed; private output withheld')):resolve(stdout.trim()));child.stdin.end(text);});
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const sub=randomUUID(),actor=randomUUID(),command=randomUUID(),code='RACE_'+randomUUID().slice(0,8).toUpperCase();
const jwt=literal(JSON.stringify({sub,aal:'aal2'}));
const payload={programCode:'BSIT',code,title:'Synthetic concurrent template',stage:'pre',name:'race.pdf',mimeType:'application/pdf',bytes:128};
const rpc=(id,action,p)=>`select public.intrack_template_command('${id}',${literal(action)},${literal(JSON.stringify(p))}::jsonb);`;
const caller=body=>`begin;set local request.jwt.claims=${jwt};set local role authenticated;${body}commit;`;
try{
 if(sql('select current_database();')!==database)throw new Error('Unexpected connection target');
 sql(`insert into auth.users(id,email,email_confirmed_at) values('${sub}',${literal(code.toLowerCase()+'@example.test')},now());
 insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values('${actor}','${sub}','Isolated race fixture','active',now());
 insert into intrack.memberships(profile_id,program_id,role) select '${actor}',id,'coordinator' from intrack.programs where code='BSIT';
 update intrack.identity_configuration set current_notice_version=coalesce(current_notice_version,'isolated-race-fixture');
 insert into intrack.privacy_acknowledgments(profile_id,notice_version) select '${actor}',current_notice_version from intrack.identity_configuration;`);
 const [first,second]=await Promise.all([
  query(caller(rpc(command,'reserve',payload)+'select pg_sleep(1.5);')),
  query(caller(rpc(command,'reserve',payload))),
 ]);
 const parse=result=>JSON.parse(result.split('\n').find(line=>line.startsWith('{')));
 const reservation=parse(first);if(JSON.stringify(reservation)!==JSON.stringify(parse(second)))throw new Error('Concurrent retries produced different results');
 if(sql(`select count(*) from intrack.template_uploads where reserved_by='${actor}';`)!=='1')throw new Error('Duplicate reservation');
 const other=parse(await query(caller(rpc(randomUUID(),'reserve',payload))));
 for(const upload of [reservation,other])sql(`insert into storage.objects(bucket_id,name) values('ojt-templates',${literal(upload.path)});
 select public.intrack_attest_template('${upload.uploadId}',128,'application/pdf','${'a'.repeat(64)}');`);
 const published=await Promise.all([reservation,other].map(u=>query(caller(rpc(randomUUID(),'publish',{programCode:'BSIT',uploadId:u.uploadId,approvalReference:'Isolated test only'})))));
 const versions=published.map(value=>parse(value).version).sort();if(JSON.stringify(versions)!=='[1,2]')throw new Error('Concurrent publications did not allocate distinct sequential versions');
 if(sql(`select count(distinct template_key) from intrack.template_versions where code=${literal(code)};`)!=='1')throw new Error('Version series identity diverged');
 const result={verifiedAt:new Date().toISOString(),isolatedDatabase:database,independentConnections:true,duplicateRetrySingleReservation:true,concurrentPublicationVersions:versions,
  limits:['SQL Auth claim fixtures, not real Auth JWT/browser acceptance.','Template races only; attendance/review/credit races need additional cases.','Synthetic Storage metadata, not uploaded private object bytes.']};
 await writeFile(join(folder,'command-races.json'),JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({verified:true,isolatedDatabase:database,duplicateRetrySingleReservation:true,concurrentPublicationVersions:versions}));
}catch(error){console.error(error instanceof Error&&error.message.startsWith('Isolated')?error.message:'Isolated race verification failed. Source database was not modified; private output withheld.');process.exitCode=1;}
