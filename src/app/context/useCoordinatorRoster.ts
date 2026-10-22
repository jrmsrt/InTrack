import {useCallback,useEffect,useRef,useState} from 'react';
import {getCoordinatorRoster,type CoordinatorRoster} from '../lib/coordinatorGateway';
import {useCoordinatorIdentity} from '../components/shared/CoordinatorPortal';
export function useCoordinatorRoster(role:'student'|'adviser',filters:Record<string,unknown>={}){
 const identity=useCoordinatorIdentity();const [data,setData]=useState<CoordinatorRoster|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),lock=useRef(false);const query=JSON.stringify(filters);
 const reload=useCallback(async()=>{const request=++generation.current;setLoading(true);setError('');
  try{const rows=await getCoordinatorRoster(role,JSON.parse(query));if(request===generation.current)setData(rows);}
  catch(cause){if(request===generation.current){setData(null);setError(cause instanceof Error?cause.message:'Unable to load saved records.');}}
  finally{if(request===generation.current)setLoading(false);}
 },[role,query,identity.profile.id]);
 useEffect(()=>{setData(null);const timer=window.setTimeout(()=>void reload(),250);return()=>{window.clearTimeout(timer);++generation.current;};},[reload]);
 const run=async<T,>(action:()=>Promise<T>):Promise<T>=>{if(lock.current)throw new Error('Wait for the current operation to finish.');lock.current=true;setBusy(true);try{return await action();}finally{lock.current=false;setBusy(false);await reload();}};
 return {identity,data,loading,error,busy,reload,run};
}
