import {createClient} from '@supabase/supabase-js';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';
const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Load the ignored operator environment first.');
const target=new URL(url);
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='54321'||target.pathname!=='/')throw new Error('This operator health check is limited to local Supabase.');
try{
 const worker=createClient(url,key,{global:{fetch:createSupabaseApiFetch(key)},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await worker.rpc('intrack_operator_health');
 if(error)throw new Error('Health projection unavailable');
 console.log(JSON.stringify(data,null,2));
 console.log('This checks database counters. Auth, file-byte integrity, Edge services, recovery and deployment acceptance are separate checks.');
}catch{console.error('Local backend health unavailable. Check the local stack, migrations and operator environment. Credentials were not printed.');process.exitCode=1;}
