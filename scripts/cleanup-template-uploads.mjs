import {createClient} from '@supabase/supabase-js';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';
const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Load the ignored operator environment first.');
const target=new URL(url);
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='54321')throw new Error('Cleanup is restricted to local Supabase.');
try{
 const client=createClient(url,key,{global:{fetch:createSupabaseApiFetch(key)},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:items,error}=await client.rpc('intrack_claim_template_cleanup',{batch_size:50});if(error)throw error;
 let cleaned=0;
 for(const item of items){
  const {error:removeError}=await client.storage.from('ojt-templates').remove([item.path]);if(removeError)throw removeError;
  const {error:ackError}=await client.rpc('intrack_ack_template_cleanup',{upload_id:item.uploadId});if(ackError)throw ackError;cleaned++;
 }
 console.log(`Confirmed cleanup of ${cleaned} expired template uploads. Published templates were not selected.`);
}catch{console.error('Template cleanup incomplete. Retry the same operator command; claimed uploads remain recoverable. Private output withheld.');process.exitCode=1;}
