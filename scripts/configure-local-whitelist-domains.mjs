// Owner-confirmed local test domains, October 18, 2026. Not a university policy publication.
import {createClient} from '@supabase/supabase-js';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';
const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Load .env first.');
const endpoint=new URL(url);
if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost'].includes(endpoint.hostname)||endpoint.port!=='54321')throw new Error('Only the local InTrack project is supported.');
const worker=createClient(url,key,{global:{fetch:createSupabaseApiFetch(key)},auth:{persistSession:false,autoRefreshToken:false}});
for(const program of ['BSIT','BSHM','BSCPE','BSOA']){
 const {error}=await worker.rpc('intrack_configure_email_domains',{program_code:program,student_domains:['iskolarngbayan.pup.edu.ph'],staff_domains:['pup.edu.ph','gmail.com'],approval_reference:'Owner-authorized Gmail adviser testing, October 18, 2026; local development only, not institutional policy approval'});
 if(error){console.error(`Could not configure local domains for ${program}; operator credentials were withheld.`);process.exitCode=1;break;}
 console.log(`${program}: local student/adviser domains configured.`);
}
