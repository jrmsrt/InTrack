// Separate verified-asset backup/restore. Database backups must be taken and
// restored separately; this never resets a database or overwrites an object.
import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';

const {values}=parseArgs({options:{mode:{type:'string'},folder:{type:'string'},'confirm-isolated-target':{type:'boolean'}}});
const mode=values.mode;if(!['backup','restore'].includes(mode))throw new Error('Use --mode backup or --mode restore.');
const root=resolve(fileURLToPath(new URL('../backups',import.meta.url)));
const folder=resolve(root,values.folder||new Date().toISOString().replace(/[:.]/g,'-'));
const within=relative(root,folder);if(within.startsWith('..')||resolve(root,within)!==folder)throw new Error('Backup folder must stay inside the project backups directory.');
const url=mode==='backup'?process.env.INTRACK_OPERATOR_SUPABASE_URL:process.env.INTRACK_RESTORE_SUPABASE_URL;
const key=mode==='backup'?process.env.INTRACK_OPERATOR_SECRET_KEY:process.env.INTRACK_RESTORE_SECRET_KEY;
if(!url||!key)throw new Error('Set the operator connection or the separate restore-target connection in the ignored operator environment.');
const target=new URL(url);
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/')throw new Error('This recovery tool supports local Supabase only.');
if(mode==='backup'&&target.port!=='54321')throw new Error('Backup source must be the local project on port 54321.');
if(mode==='restore'&&(target.port==='54321'||!values['confirm-isolated-target']))throw new Error('Restore requires a separate local API port and --confirm-isolated-target. The original project is never a restore target.');
const worker=createClient(url,key,{global:{fetch:createSupabaseApiFetch(key)},auth:{persistSession:false,autoRefreshToken:false}});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=entry=>JSON.stringify([entry.id,entry.kind,entry.bucket,entry.path,entry.mime,entry.bytes,entry.sha256]);
const {data:inventory,error}=await worker.rpc('intrack_asset_recovery_inventory');if(error)throw new Error('Recovery inventory unavailable. Check the migration and the operator API key.');
const manifestPath=join(folder,'manifest.json');
if(mode==='backup'){
  await mkdir(join(folder,'objects'),{recursive:true});
  for(const entry of inventory){
    if(!/^[0-9a-f-]{36}$/i.test(entry.id)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw new Error('Invalid recovery inventory entry.');
    const saved=join(folder,'objects',entry.id);
    let existing;try{existing=await readFile(saved);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(existing){if(existing.length!==entry.bytes||hash(existing)!==entry.sha256)throw new Error('Existing backup bytes do not match the inventory. Use a fresh backup folder.');continue;}
    const {data:blob,error:downloadError}=await worker.storage.from(entry.bucket).download(entry.path);
    if(downloadError||!blob)throw new Error('A recorded asset is unavailable; backup is incomplete.');
    const bytes=Buffer.from(await blob.arrayBuffer());if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error('Asset bytes differ from the immutable recorded identity; backup stopped.');
    await writeFile(saved,bytes,{flag:'wx'});
  }
  await writeFile(manifestPath,JSON.stringify({formatVersion:1,createdAt:new Date().toISOString(),assets:inventory},null,2),{flag:'wx'});
  console.log(`Verified ${inventory.length} recorded assets. Manifest saved under backups/${within}/manifest.json. Database backup and restoration tests remain separate.`);
}else{
  if(!values.folder)throw new Error('Restore requires --folder with an existing verified backup.');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  if(manifest.formatVersion!==1||!Array.isArray(manifest.assets))throw new Error('Unsupported recovery manifest.');
  if(JSON.stringify(manifest.assets.map(identity).sort())!==JSON.stringify(inventory.map(identity).sort()))throw new Error('Restored database inventory and asset backup do not correspond. No bytes were written.');
  for(const entry of manifest.assets){
    if(!/^[0-9a-f-]{36}$/i.test(entry.id))throw new Error('Invalid asset identifier.');
    const bytes=await readFile(join(folder,'objects',entry.id));if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw new Error('Backup asset hash/size verification failed.');
    const {data:existing,error:existingError}=await worker.storage.from(entry.bucket).download(entry.path);
    if(!existingError&&existing){const current=Buffer.from(await existing.arrayBuffer());if(current.length!==entry.bytes||hash(current)!==entry.sha256)throw new Error('Target object already contains different bytes; it will not be overwritten.');continue;}
    const {error:uploadError}=await worker.storage.from(entry.bucket).upload(entry.path,bytes,{contentType:entry.mime,upsert:false});
    if(uploadError)throw new Error('Asset restore failed. Preserve the target and retry; no object was overwritten.');
    const verified=await worker.storage.from(entry.bucket).download(entry.path);
    if(verified.error||!verified.data||hash(Buffer.from(await verified.data.arrayBuffer()))!==entry.sha256)throw new Error('Post-restore asset verification failed.');
  }
  console.log(`Verified restoration of ${manifest.assets.length} assets into the separate local target. Run database/auth/permission acceptance checks before declaring recovery complete.`);
}
