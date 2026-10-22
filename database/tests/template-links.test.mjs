import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const people=Object.fromEntries(['coordinator','student','adviser','outsider'].map(k=>[k,{id:randomUUID(),subject:randomUUID()}]));
let program,otherProgram;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
 for(const path of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610180048_template_link_catalog.sql'])await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
 program=(await db.query("select id from intrack.programs where code='BSIT'")).rows[0].id;
 otherProgram=(await db.query("select id from intrack.programs where code='BSOA'")).rows[0].id;
 await db.exec("update intrack.identity_configuration set current_notice_version='test'");
 for(const [name,p] of Object.entries(people)){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[p.subject,`${name}@example.test`]);
  await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,$3,'active',now())",[p.id,p.subject,name]);
  await db.query('insert into intrack.memberships(profile_id,program_id,role) values($1,$2,$3)',[p.id,name==='outsider'?otherProgram:program,name==='outsider'?'coordinator':name]);
  await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'test')",[p.id]);
 }
});
after(async()=>db.close());
async function call(who,name,args=[],aal='aal2',role='authenticated'){
 await db.exec('begin');try{
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:people[who].subject,aal})]);await db.exec(`set local role ${role}`);
  const result=(await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
  await db.exec('commit');return result;
 }catch(e){await db.exec('rollback');throw e;}
}
const list=(who='coordinator',role=who)=>call(who,'intrack_list_template_links',[role]);
const save=(payload,who='coordinator',id=randomUUID(),aal='aal2')=>call(who,'intrack_save_template_link',[id,payload],aal);
test('all 15 original names, descriptions and URLs are restored for each program',async()=>{
 const source=await readFile(new URL('../../src/app/context/OJTContext.tsx',import.meta.url),'utf8');
 const originals=[...source.matchAll(/\{ id: '(t\d+)', name: '([^']+)', category: '([^']+)', description: '([^']+)', linkUrl: '([^']+)', status: 'Published'/g)];
 assert.equal(originals.length,15);
 const rows=await list();assert.equal(rows.length,15);
 for(const [,key,name,category,description,url] of originals){const row=rows.find(r=>r.name===name);assert.ok(row,key);assert.equal(row.category,category);assert.equal(row.description,description);assert.equal(row.linkUrl,url);assert.equal(row.programId,program);}
});
test('coordinators persist edits with replay safety, stale edit rejection and program isolation',async()=>{
 const row=(await list())[0],payload={...row,expectedRevision:row.revision,description:'Updated reference description'},id=randomUUID();
 const result=await save(payload,'coordinator',id);assert.deepEqual(await save(payload,'coordinator',id),result);
 assert.equal((await list()).find(r=>r.id===row.id).description,payload.description);
 await assert.rejects(save(payload),e=>e.code==='40001');
 await assert.rejects(save({...payload,programId:otherProgram}),e=>e.code==='42501');
 await assert.rejects(save({...payload,expectedRevision:2},'outsider'),e=>e.code==='42501');
 assert.equal((await list('outsider','coordinator')).length,15);
});
test('disabled links disappear from student/adviser reads and can be republished',async()=>{
 const row=(await list())[1];
 await save({...row,expectedRevision:row.revision,status:'Disabled'});
 assert.equal((await list('student')).some(r=>r.id===row.id),false);
 assert.equal((await list('adviser')).some(r=>r.id===row.id),false);
 const updated=(await list()).find(r=>r.id===row.id);
 await save({...updated,expectedRevision:updated.revision,status:'Published'});
 assert.equal((await list('student')).some(r=>r.id===row.id),true);
});
test('new links require coordinator MFA and safe URLs; direct table access is denied',async()=>{
 const payload={programId:program,name:'New template',category:'Pre-OJT',description:'Test',linkUrl:'https://docs.google.com/document/d/test/edit',status:'Published'};
 for(const who of ['student','adviser'])await assert.rejects(save(payload,who),e=>e.code==='42501');
 await assert.rejects(save(payload,'coordinator',randomUUID(),'aal1'),e=>e.code==='42501');
 for(const linkUrl of ['javascript:alert(1)','http://example.test','https://user:password@example.test'])await assert.rejects(save({...payload,linkUrl}),e=>e.code==='22023');
 const result=await save(payload);assert.ok((await list()).some(r=>r.id===result.id));
 await db.exec('begin;set local role authenticated');
 await assert.rejects(db.query('select * from intrack.template_links'),e=>e.code==='42501');await db.exec('rollback');
});
