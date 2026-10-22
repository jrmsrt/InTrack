import { createClient } from '@supabase/supabase-js';
import { createSupabaseApiFetch } from '../src/app/lib/supabaseApiFetch.ts';

const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Set local operator connection variables.');
const target=new URL(url);
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='54321') {
  throw new Error('Cleanup script only supports local Supabase on port 54321.');
}
const worker=createClient(url,key,{global:{fetch:createSupabaseApiFetch(key)},auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await worker.rpc('intrack_expired_requirement_files');
if(error)throw new Error(`Cleanup reservation failed (${error.code}). Check the local operator key and migration.`);
let removed=0;
for(const file of data){
  const {error:removeError}=await worker.storage.from('ojt-documents').remove([file.path]);
  if(removeError)throw new Error('Storage cleanup failed. Metadata stays quarantined; retry this command.');
  const {error:receiptError}=await worker.rpc('intrack_complete_requirement_cleanup',{document_id:file.id});
  if(receiptError)throw new Error('Storage removal succeeded but cleanup acknowledgment is pending; retry this command.');
  removed++;
}
console.log(`Processed ${removed} expired unattached upload(s). Historical submitted evidence is retained.`);
