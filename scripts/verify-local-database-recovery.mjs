// Local database dump/restore verification. Never resets the source database.
// Storage object bytes require the separate asset recovery tool.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {existsSync} from 'node:fs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const config=await readFile(join(root,'supabase/config.toml'),'utf8');
if(!/^project_id\s*=\s*"InTrack"/m.test(config))throw new Error('This verification is scoped to the local InTrack project.');
const candidates=[process.env.INTRACK_DOCKER_EXECUTABLE,process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin/docker.exe'),'C:/Program Files/Docker/Docker/resources/bin/docker.exe'];
const docker=candidates.find(path=>path&&existsSync(path))||'docker';
const container='supabase_db_InTrack';
const run=(args,input)=>execFileSync(docker,args,{input,timeout:60000,maxBuffer:256*1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']});
const sql=(database,text)=>run(['exec','-i',container,'psql','-w','-U','supabase_admin','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],text).toString().trim();
const target='intrack_restore_'+new Date().toISOString().slice(0,10).replaceAll('-','')+'_'+randomUUID().slice(0,8);
const folder=join(root,'backups',target);
const inventory=`set timezone='UTC';
 create temporary table recovery_inventory(relation text primary key,rows bigint,sha256 text);
 do $$declare relation record;rows_count bigint;fingerprint text;begin
 for relation in select schemaname,tablename from pg_tables where schemaname in ('intrack','public','auth','storage') order by schemaname,tablename loop
  execute format('select count(*)::bigint,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(source) order by to_jsonb(source)::text),''[]''::jsonb)::text,''UTF8'')),''hex'') from %I.%I source',relation.schemaname,relation.tablename) into rows_count,fingerprint;
  insert into recovery_inventory values(relation.schemaname||'.'||relation.tablename,rows_count,fingerprint);
 end loop;end$$;
 select coalesce(jsonb_object_agg(relation,jsonb_build_object('rows',rows,'sha256',sha256) order by relation),'{}') from recovery_inventory;`;
let step='check local source';
try{
 const size=Number(sql('postgres','select pg_database_size(current_database());'));
 if(!Number.isSafeInteger(size)||size>128*1024*1024)throw new Error('This local verification supports source databases up to 128 MiB.');
 step='snapshot source inventory';const before=JSON.parse(sql('postgres',inventory));
 step='dump source application/identity/storage schemas';const dump=run(['exec',container,'pg_dump','-w','-U','supabase_admin','-d','postgres','--format=custom','--schema=intrack','--schema=public','--schema=auth','--schema=storage']);
 const after=JSON.parse(sql('postgres',inventory));
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Source rows changed during the dump; repeat verification while development writes are paused.');
 await mkdir(folder,{recursive:true});await writeFile(join(folder,'database.dump'),dump,{flag:'wx'});
 step='create isolated restore database';sql('postgres',`create database "${target}" template template0;`);
 // template0 has an empty public schema. The archive owns its exact recreation.
 if(sql(target,'select current_database();')!==target||sql(target,"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';")!=='0')throw new Error('Fresh isolated target must have an empty public schema.');
 sql(target,'drop schema public;');
 step='prepare isolated schema dependencies';sql(target,'create schema extensions;create extension if not exists pgcrypto with schema extensions;create extension if not exists "uuid-ossp" with schema extensions;');
 step='restore isolated database';run(['exec','-i',container,'pg_restore','-w','-U','supabase_admin','-d',target,'--exit-on-error'],dump);
 step='compare restored application/identity/storage rows';const restored=JSON.parse(sql(target,inventory));
 if(JSON.stringify(restored)!==JSON.stringify(before))throw new Error('Restored row identities do not match the source.');
 const report={verifiedAt:new Date().toISOString(),sourceContainer:container,sourceDatabase:'postgres',isolatedDatabase:target,dumpSha256:createHash('sha256').update(dump).digest('hex'),tableCount:Object.keys(before).length,totalRows:Object.values(before).reduce((sum,t)=>sum+Number(t.rows),0),rowInventory:before,
  limits:['Application/public/Auth/Storage schemas only; Supabase platform services and extension configuration need separate provisioning.','Same local PostgreSQL instance; cloud/host loss recovery is untested.','Storage metadata only; private file bytes use separate asset backup and isolated API restoration.','No automated Auth/Storage service reconnection or JWT acceptance against the restored database.']};
 await writeFile(join(folder,'verification.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({verified:true,isolatedDatabase:target,tableCount:report.tableCount,totalRows:report.totalRows,backupDirectory:folder,fileObjectRecoveryVerified:false}));
}catch(error){
 console.error(`Local database recovery failed at: ${step}. Source database was not reset or replaced. Isolated artifacts, if created, are preserved for inspection.`);
 if(error instanceof Error&&!('status' in error))console.error(error.message);
 if(error&&typeof error==='object'&&'stderr' in error){const detail=String(error.stderr);const categories=['permission denied','must be owner','must be a member','already exists','does not exist','not available','could not connect','failed to connect'];const category=categories.find(text=>detail.includes(text));console.error(`Failure category: ${category||'database command failed'}. Private command output was withheld.`);}
 process.exitCode=1;
}
