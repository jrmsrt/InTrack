// Apply supplied server credentials without printing or committing the SMTP key.
// Does not create a provider account, send email or restart the local stack.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const check=process.argv.includes('--check');
const fields=['INTRACK_AUTH_SMTP_USER','INTRACK_AUTH_SMTP_PASSWORD','INTRACK_AUTH_SMTP_SENDER'];
const missing=fields.filter(name=>!process.env[name]?.trim()||/your_|example\.com|placeholder|change.?me/i.test(process.env[name]));
if(missing.length){console.error('SMTP setup needs these private server fields: '+missing.join(', '));process.exitCode=1;}
else {
 const user=process.env.INTRACK_AUTH_SMTP_USER.trim(),sender=process.env.INTRACK_AUTH_SMTP_SENDER.trim();
 if(/[\r\n\0]/.test(user)||user.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)||sender.length>254||/[\r\n\0]/.test(process.env.INTRACK_AUTH_SMTP_PASSWORD))throw new Error('Invalid SMTP field format; credential values withheld.');
 const path=join(root,'supabase/config.toml'),original=await readFile(path,'utf8');
 if(!/^project_id\s*=\s*"InTrack"/m.test(original))throw new Error('Only the local InTrack project is supported.');
 if(check)console.log('SMTP field format is ready. Sender verification and inbox delivery still need provider acceptance.');
 else {
  const section=['[auth.email.smtp]','enabled = true','host = "smtp-relay.brevo.com"','port = 587',
   'user = '+JSON.stringify(user),'pass = "env(INTRACK_AUTH_SMTP_PASSWORD)"','admin_email = '+JSON.stringify(sender),'sender_name = "InTrack"',''].join('\n');
  // Replace only this exact TOML section, preserving every other Auth setting.
  const match=/^\[auth\.email\.smtp\][\s\S]*?(?=^\[|(?![\s\S]))/m.exec(original);
  const updated=match?original.slice(0,match.index)+section+'\n'+original.slice(match.index+match[0].length):original.replace(/^\[auth\.email\.template\.invite\]/m,section+'\n[auth.email.template.invite]');
  if(updated===original)throw new Error('SMTP insertion point unavailable; configuration was not changed.');
  const folder=join(root,'backups','smtp-config',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
  await mkdir(folder,{recursive:true});await writeFile(join(folder,'config.toml'),original,{flag:'wx'});
  await writeFile(path,updated);
  console.log('Brevo SMTP configuration saved. Password remains an environment reference. Existing configuration backed up privately.');
  console.log('Load .env when running restart-local-auth.mjs --smtp. No email was sent by this configuration step.');
 }
}
