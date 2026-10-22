// Synchronize only this project's local connections. CLI credentials stay in
// memory and the ignored .env file; never print status output or key material.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function update(text,values){for(const [key,value] of Object.entries(values)){
  const expression=new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*$`,'gm');
  let replaced=false;
  text=text.replace(expression,()=>{if(replaced)return '';replaced=true;return `${key}=${value}`;});
  if(!replaced)text=text.trimEnd()+`\n${key}=${value}\n`;
}return text;}
async function load(name){try{return await readFile(new URL(`../${name}`,import.meta.url),'utf8');}catch(error){if(error.code==='ENOENT')return '';throw error;}}
try{
  const command=process.platform==='win32'?'cmd.exe':'npx';
  const args=process.platform==='win32'?['/d','/s','/c','npx supabase status -o json']:['supabase','status','-o','json'];
  const output=execFileSync(command,args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const status=JSON.parse(output);const url=new URL(status.API_URL);
  if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='54321')throw new Error('Local project required');
  if(typeof status.PUBLISHABLE_KEY!=='string'||!status.PUBLISHABLE_KEY.startsWith('sb_publishable_')||/\s/.test(status.PUBLISHABLE_KEY))throw new Error('Public key unavailable');
  const key=status.SERVICE_ROLE_KEY;
  if(typeof key!=='string'||key.split('.').length!==3||JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='service_role')throw new Error('Local operator API key unavailable');
  await writeFile(new URL('../.env',import.meta.url),update(await load('.env'),{
    VITE_BACKEND_MODE:'demo',VITE_SUPABASE_URL:url.origin,VITE_SUPABASE_PUBLISHABLE_KEY:status.PUBLISHABLE_KEY,
    INTRACK_OPERATOR_SUPABASE_URL:url.origin,INTRACK_OPERATOR_SECRET_KEY:key,
  }));
  console.log('Local browser and operator connections synchronized. Keys were not printed. Other environment settings were preserved; backend mode remains demo.');
}catch{
  console.error('Local connection synchronization failed. Check that this project’s Supabase stack is running and the CLI can read its status. No CLI credentials are included in this diagnostic.');
  process.exitCode=1;
}
