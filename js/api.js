import {API_URL} from './cfg.js';
// POST with a text/plain JSON body = a "simple" CORS request (no preflight), which Apps Script supports.
// Secrets travel only in the HTTPS body, never in URLs. Rejects with {net:true} for network/timeout/invalid-response errors.
export async function call(action,body={},timeout=25000){
  if(!API_URL)throw Object.assign(new Error('Shared Mode is not configured (API_URL)'),{net:false});
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);
  try{
    const r=await fetch(API_URL,{method:'POST',redirect:'follow',signal:ctl.signal,body:JSON.stringify({action,requestId:crypto.randomUUID(),ts:Date.now(),...body})});
    if(!r.ok)throw new Error('Server returned '+r.status);
    const j=await r.json();
    if(!j||typeof j!=='object'||typeof j.ok!=='boolean')throw new Error('Invalid server response');
    return j;
  }catch(e){throw Object.assign(new Error(e.name==='AbortError'?'Request timed out':(e.message||'Network error')),{net:true})}
  finally{clearTimeout(t)}
}
