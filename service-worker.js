// Bump V on every release so users receive updated files.
const V='khata-ui5';
const SHELL=['./','index.html','offline.html','manifest.webmanifest','css/styles.css','js/app.js','js/db.js','js/sync.js','js/api.js','js/admin.js','js/config.js','js/cfg.js','assets/logo/pranayan-logo.png','assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/favicon.ico'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// App shell only. Financial data lives in IndexedDB and is never cached here.
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(caches.match(r).then(h=>h||fetch(r).catch(()=>r.mode==='navigate'?caches.match('offline.html'):Response.error())));
});
