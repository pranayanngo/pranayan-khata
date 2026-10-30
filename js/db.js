// IndexedDB storage (Private Mode) + decimal-safe money helpers (integer paise).
let NAME='khata-private',_db;
export const use=n=>{if(n===NAME)return;_db?.close();_db=null;NAME=n};
export const open=()=>_db?Promise.resolve(_db):new Promise((res,rej)=>{
  if(!window.indexedDB)return rej(new Error('IndexedDB is not available in this browser mode'));
  const r=indexedDB.open(NAME,1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('tx',{keyPath:'id'});r.result.createObjectStore('meta',{keyPath:'k'})};
  r.onsuccess=()=>{_db=r.result;res(_db)};r.onerror=()=>rej(r.error);
});
const run=async(store,mode,fn)=>{const d=await open();return new Promise((res,rej)=>{
  const t=d.transaction(store,mode);const q=fn(t.objectStore(store));
  t.oncomplete=()=>res(q&&q.result);t.onerror=t.onabort=()=>rej(t.error||new Error('Database error'));
})};
export const all=()=>run('tx','readonly',s=>s.getAll());
export const put=x=>run('tx','readwrite',s=>s.put(x));
export const del=id=>run('tx','readwrite',s=>s.delete(id));
export const replaceAll=a=>run('tx','readwrite',s=>{s.clear();a.forEach(x=>s.put(x))}); // atomic
export const getMeta=async k=>(await run('meta','readonly',s=>s.get(k)))?.v;
export const setMeta=(k,v)=>run('meta','readwrite',s=>s.put({k,v}));
export const wipe=async()=>{await run('tx','readwrite',s=>s.clear());await run('meta','readwrite',s=>s.clear())};

// "1234.5" -> 123450 (paise). Returns null if invalid.
export const toPaise=v=>{
  const m=/^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(String(v).trim().replace(/,/g,''));
  return m?Number(m[1])*100+Number(((m[2]||'')+'00').slice(0,2)):null;
};
// 12345678 -> ₹1,23,456.78 (Indian grouping)
export const fmt=p=>{
  const neg=p<0;p=Math.abs(p);let s=String(Math.floor(p/100));
  if(s.length>3)s=s.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,',')+','+s.slice(-3);
  return (neg?'-':'')+'₹'+s+'.'+String(p%100).padStart(2,'0');
};
