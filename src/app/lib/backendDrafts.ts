/** Retain recoverable operations while signed in; purge them on account loss. */
export function clearBackendDrafts(storage?:Storage):void {
  for(const target of storage?[storage]:[globalThis.localStorage,globalThis.sessionStorage]){
    if(!target)continue;const remove:string[]=[];
    for(let i=0;i<target.length;i++){const key=target.key(i);if(key?.startsWith('intrack-local-upload:')||key?.startsWith('intrack-local-invitation:')||key?.startsWith('intrack-template:')||key?.startsWith('intrack-coordinator-command:')||key?.startsWith('intrack-enrollment-command:')||key?.startsWith('intrack-class-join-command:'))remove.push(key);}
    for(const key of remove)target.removeItem(key);
  }
}
