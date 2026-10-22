/** Limit bytes before allocating an unbounded request body. */
export async function boundedJson(request: Request, limit = 8192): Promise<unknown> {
 const reader=request.body?.getReader();if(!reader)throw new Error('BODY_REQUIRED');
 let raw='',length=0;const decoder=new TextDecoder('utf-8',{fatal:true});
 try {
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;
   if(length>limit){await reader.cancel();throw new Error('BODY_TOO_LARGE');}
   raw+=decoder.decode(part.value,{stream:true});}
  return JSON.parse(raw+decoder.decode());
 } finally {reader.releaseLock();}
}
