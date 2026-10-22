// Reload Auth templates/settings without resetting the existing local database.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve,join,delimiter} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),config=await readFile(join(root,'supabase/config.toml'),'utf8');
if(!/^project_id\s*=\s*"InTrack"/m.test(config))throw new Error('Only the local InTrack project is supported.');
const smtp=process.argv.includes('--smtp'),preview=process.argv.includes('--preview');
if(smtp===preview)throw new Error('Choose --smtp after configuring your sender, or --preview for Mailpit.');
const section=config.match(/^\[auth\.email\.smtp\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1]||'';
const enabled=/^enabled\s*=\s*true\s*$/m.test(section);
if(smtp&&(!enabled||!process.env.INTRACK_AUTH_SMTP_PASSWORD))throw new Error('Enable the SMTP section and load .env before requesting SMTP mode.');
if(preview&&enabled)throw new Error('Disable custom SMTP before choosing Mailpit preview.');
const environment={...process.env};const docker=process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Programs/DockerDesktop/resources/bin');
if(docker&&existsSync(docker)){const oldPath=process.env.PATH||'';delete environment.Path;environment.PATH=docker+delimiter+oldPath;}
const run=args=>execFileSync(process.execPath,args,{cwd:root,env:environment,timeout:240000,maxBuffer:16*1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']});
try{
 console.log('Reloading local Supabase Auth settings. Existing database volumes are preserved.');
 run(['node_modules/supabase/dist/supabase.js','stop']);
 run(['node_modules/supabase/dist/supabase.js','start']);
 run(['scripts/sync-local-supabase-env.mjs']);
 console.log(smtp?'Auth loaded the configured SMTP sender. Inbox delivery still requires a successful OTP test.':'Auth OTP templates loaded for Mailpit preview at http://127.0.0.1:54324.');
 console.log('Local browser/operator settings synchronized without printing keys. Restart Vite if it is running.');
}catch{console.error('Local Auth reload failed. Existing data was not reset. Check Docker Desktop and the local configuration; private CLI output was withheld.');process.exitCode=1;}
