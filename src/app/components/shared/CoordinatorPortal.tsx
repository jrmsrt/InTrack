import {createContext,useContext,useEffect} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import {Button} from '../ui/button';
import {Toaster} from '../ui/sonner';
import type {ProtectedIdentity} from '../../lib/protectedIdentity';
import {CoordinatorModuleDataProvider} from '../../context/CoordinatorModuleData';
import {OriginalCoordinatorLayout} from './OriginalCoordinatorLayout';
type ReadyIdentity=Extract<ProtectedIdentity,{profile:unknown}>;
const CoordinatorContext=createContext<ReadyIdentity|null>(null);
export function useCoordinatorIdentity(){const value=useContext(CoordinatorContext);if(!value)throw new Error('Protected coordinator access required.');return value;}
export function CoordinatorPortal({children}:{children:React.ReactNode}){
 const {result,refresh}=useProtectedIdentity(true);
 useEffect(()=>{const check=()=>void refresh({background:true});window.addEventListener('focus',check);const timer=window.setInterval(check,60000);return()=>{window.removeEventListener('focus',check);window.clearInterval(timer);};},[refresh]);
 if(result.state==='signed_out')return <Navigate to="/login" replace/>;
 if(result.state==='loading')return <main className="p-8" role="status">Checking coordinator access…</main>;
 if(result.state==='unavailable')return <main className="space-y-4 p-8"><p role="alert">Unable to check coordinator access.</p><Button onClick={()=>void refresh()}>Retry</Button><Link className="ml-4 underline" to="/account-access">Account access</Link></main>;
 const identity=result.identity;
 if(identity.state!=='ready'||!identity.usableRoles.includes('coordinator'))return <Navigate to="/account-access" replace/>;
 return <CoordinatorContext.Provider value={identity}><CoordinatorModuleDataProvider><OriginalCoordinatorLayout>{children}</OriginalCoordinatorLayout></CoordinatorModuleDataProvider><Toaster/></CoordinatorContext.Provider>;
}
