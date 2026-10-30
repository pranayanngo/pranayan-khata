import * as DB from './db.js';
import {call} from './api.js';
import {API_URL,SYNC_INTERVAL_MS} from './cfg.js';
const SH='khata-shared',PR='khata-private',MODE='khata-mode';
const AUTH=['unauthorized','revoked','expired'],TRANSIENT=['busy','quota','rate_limited'];
export const S={mode:'private',token:'',ws:'',wsId:'',perms:[],status:'idle',last:null,pending:0,err:'',cfg:null};
let tick=0;
let cb={},timer,running=false,delay=SYNC_INTERVAL_MS,cursor='';
export const canWrite=()=>S.mode==='private'||S.perms.includes('write');
export const label=()=>S.status==='auth'?'Key invalid':S.status==='offline'?(S.pending?`Offline · ${S.pending} pending`:'Offline'):S.status==='error'?'Sync error · retrying':S.pending?`${S.pending} pending`:S.status==='syncing'?'Syncing…':S.last?'Synced '+S.last.toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}):'Not synced';
export function init(c){cb=c;
  addEventListener('online',()=>{delay=SYNC_INTERVAL_MS;syncNow()});
  addEventListener('offline',()=>{if(S.mode==='shared'){S.status='offline';cb.onChange?.(false)}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNow()});
}
export async function restore(){
  if(localStorage.getItem(MODE)!=='shared')return;
  DB.use(SH);const a=await DB.getMeta('auth');
  if(!a){DB.use(PR);localStorage.setItem(MODE,'private');return}
  Object.assign(S,{mode:'shared',token:a.token,ws:a.ws,wsId:a.wsId,perms:a.perms});cursor=(await DB.getMeta('cursor'))||'';S.cfg=(await DB.getMeta('cfg'))||null;
}
// Validate the key on the server first; only then switch stores. Private records are never touched or uploaded.
export async function connect(token){
  let r;try{r=await call('auth.check',{token})}catch(e){throw new Error('Could not reach the server: '+e.message)}
  if(!r.ok)throw new Error(r.message||'Invalid key');
  const keep=S.mode==='shared'&&S.wsId===r.workspace.id; // replacing a rotated key keeps the pending queue
  DB.use(SH);if(!keep){await DB.wipe();cursor='';S.cfg=null}
  Object.assign(S,{mode:'shared',token,ws:r.workspace.name,wsId:r.workspace.id,perms:r.permissions,status:'idle',err:''});
  await DB.setMeta('auth',{token,ws:S.ws,wsId:S.wsId,perms:S.perms});
  localStorage.setItem(MODE,'shared');start();
}
export async function disconnect(){
  stop();DB.use(SH);await DB.wipe();DB.use(PR);localStorage.setItem(MODE,'private');
  Object.assign(S,{mode:'private',token:'',ws:'',wsId:'',perms:[],status:'idle',err:'',last:null,pending:0,cfg:null});cursor='';
}
export const start=()=>{stop();delay=SYNC_INTERVAL_MS;syncNow()};
const stop=()=>clearTimeout(timer);
const schedule=()=>{stop();if(S.mode==='shared'&&S.status!=='auth')timer=setTimeout(()=>document.hidden?schedule():syncNow(),delay)};
const strip=t=>({id:t.id,type:t.type,amount:t.amount,date:t.date,category:t.category,account:t.account,desc:t.desc,ref:t.ref,createdAt:t.createdAt});
const fail=r=>{if(AUTH.includes(r.code))throw Object.assign(new Error(r.message),{auth:true});if(TRANSIENT.includes(r.code))throw new Error(r.message||r.code)};

async function loadConfig(){
  const r=await call('config.get',{token:S.token,logoVersion:S.cfg?.logoVersion||''});if(!r.ok)return false;
  const prev=S.cfg||{},cfg={appName:r.appName,logoVersion:r.logoVersion,logo:r.logo||prev.logo||'',categories:r.categories,accounts:r.accounts};
  const ch=JSON.stringify(cfg)!==JSON.stringify(prev);S.cfg=cfg;if(ch)await DB.setMeta('cfg',cfg);return ch}
export async function syncNow(force){
  if(S.mode!=='shared'||running)return;
  if(!navigator.onLine){S.status='offline';cb.onChange?.(false);schedule();return}
  running=true;S.status='syncing';cb.onChange?.(false);let changed=false;
  try{
    // 1) push queued changes, one by one; success is only recorded after the server confirms
    for(const t of (await DB.all()).filter(x=>x.sync==='pending')){
      const r=await call('tx.'+t.op,{token:S.token,...(t.op==='delete'?{id:t.id}:{tx:strip(t),base:t.base})});
      changed=true;
      if(r.ok){if(t.op==='delete'||r.tx.status==='deleted')await DB.del(t.id);else await DB.put({...r.tx,sync:'synced'})}
      else if(r.code==='conflict'&&r.tx)await DB.put({...t,sync:'conflict',server:r.tx});
      else{fail(r);await DB.put({...t,sync:'failed',err:r.message||r.code})}
    }
    // 2) pull changes made elsewhere (local unsynced edits always win until pushed)
    const r=await call('tx.list',{token:S.token,since:cursor});
    if(!r.ok){fail(r);throw new Error(r.message||'Sync failed')}
    const local=new Map((await DB.all()).map(x=>[x.id,x]));
    for(const s of r.txs){const l=local.get(s.id);if(l&&l.sync&&l.sync!=='synced')continue;
      if(s.status==='deleted'){if(l){await DB.del(s.id);changed=true}}
      else if(!l||l.updatedAt!==s.updatedAt){await DB.put({...s,sync:'synced'});changed=true}}
    cursor=r.cursor||cursor;await DB.setMeta('cursor',cursor);
    try{if((!S.cfg||force||tick++%8===0)&&await loadConfig())changed=true}catch(e){} // branding/lists are non-critical
    S.last=new Date();S.err='';S.status='ok';delay=SYNC_INTERVAL_MS;
  }catch(e){
    S.err=e.message;
    if(e.auth)S.status='auth';else{S.status=navigator.onLine?'error':'offline';delay=Math.min(delay*2,300000)} // exponential backoff
  }finally{running=false;schedule();cb.onChange?.(changed)}
}
