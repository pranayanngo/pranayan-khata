import {call} from './api.js';
let secret='',fresh=null; // admin secret lives in memory only; it is gone on reload
const A=(a,x={})=>call(a,{adminSecret:secret,...x});
export async function adminPanel(el,{esc,toast}){
  const lock=()=>{secret='';fresh=null;adminPanel(el,{esc,toast})};
  if(!secret){
    el.innerHTML=`<p class="mut">Administrator access is separate from shared keys.</p><label>Administrator secret<input type="password" id="as" autocomplete="off"></label><button id="au">Unlock</button><p class="err" id="ae" role="alert"></p>`;
    el.querySelector('#au').onclick=async()=>{secret=el.querySelector('#as').value;
      try{await load()}catch(x){secret='';el.querySelector('#ae').textContent=x.message}};return;
  }
  try{await load()}catch(x){secret='';return adminPanel(el,{esc,toast})}
  async function load(){
    const[w,k,c]=await Promise.all([A('admin.workspaces'),A('admin.keys'),A('admin.config')]);
    if(!w.ok||!k.ok||!c.ok)throw new Error((w.ok?k.ok?c:k:w).message);
    const act=w.workspaces.filter(x=>x.status==='active'),nm=Object.fromEntries(w.workspaces.map(x=>[x.workspaceId,x.name]));
    el.innerHTML=`${fresh?`<div class="note"><b>New key (shown once, copy it now):</b><br><code style="overflow-wrap:anywhere;user-select:all">${esc(fresh)}</code><br><small>Anyone holding this key can access the workspace until you revoke it. Do not post it publicly.</small></div>`:''}
    <h3>Workspaces</h3><p>${act.map(x=>esc(x.name)).join(', ')||'None yet'}</p>
    <div class="row"><input id="wn" placeholder="New workspace name" maxlength="60" aria-label="Workspace name" style="flex:1"><button id="wc">Create</button></div>
    <h3>New key</h3><div class="filters"><select id="kw" aria-label="Workspace">${act.map(x=>`<option value="${esc(x.workspaceId)}">${esc(x.name)}</option>`).join('')}</select>
    <input id="kl" placeholder="Label, e.g. Office laptop" maxlength="60" aria-label="Key label"><select id="kp" aria-label="Permissions"><option value="read,write">Read + write</option><option value="read">Read only</option></select>
    <label class="mut">Expires (optional)<input type="date" id="ke"></label></div><button id="kc">Generate key</button>
    <h3>Branding</h3><label>App name<input id="an" maxlength="40" value="${esc(c.appName)}"></label><button class="sec" id="as2">Save name</button>
    <label>Logo (PNG, JPEG or WebP; resized to fit 512 px, proportions kept)<input type="file" id="lf" accept="image/png,image/jpeg,image/webp"></label><button class="sec" id="lu">Upload logo</button>
    <p class="mut">The in-app logo updates on all connected devices. The installed home-screen icon is a static file: replace <code>assets/icons/*</code> in GitHub to change it.</p>
    <h3>Categories</h3>${['income','expense'].map(t=>`<p><b>${t==='income'?'Income':'Expense'}</b></p><div class="row">${c.categories.filter(x=>x.type===t).map(x=>`<button class="sec" data-ls="category|${esc(x.categoryId)}|${x.status==='active'?'disabled':'active'}" title="${x.status==='active'?'Disable':'Enable'}">${esc(x.name)}${x.status==='active'?'':' (off)'}</button>`).join('')}</div>`).join('')}
    <div class="row" style="margin-top:8px"><select id="ct" aria-label="Type" style="flex:1"><option value="income">Income</option><option value="expense">Expense</option></select><input id="cn" maxlength="60" placeholder="New category" aria-label="New category" style="flex:2"><button id="ca">Add</button></div>
    <h3>Accounts / payment methods</h3><div class="row">${c.accounts.map(x=>`<button class="sec" data-ls="account|${esc(x.accountId)}|${x.status==='active'?'disabled':'active'}">${esc(x.name)}${x.status==='active'?'':' (off)'}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input id="an2" maxlength="60" placeholder="New account" aria-label="New account" style="flex:1"><button id="aa">Add</button></div>
    <p class="mut">Tap a name to disable or re-enable it. Disabled items are hidden from new entries; past transactions keep their names.</p>
    <h3>Keys</h3><ul class="txs">${k.keys.map(x=>`<li class="tx ${x.status==='active'?'income':'expense'}"><div><b>${esc(x.keyLabel)}</b><small>${esc(nm[x.workspaceId]||x.workspaceId)} · ${esc(x.permissions)} · ${esc(x.status)}${x.expiresAt?' · expires '+esc(String(x.expiresAt).slice(0,10)):''}${x.lastUsedAt?' · last used '+esc(String(x.lastUsedAt).slice(0,10)):''}</small></div><div></div>
    <div class="act">${x.status==='active'?`<button class="sec" data-rot="${esc(x.keyId)}">Rotate</button><button class="sec" data-rev="${esc(x.keyId)}">Revoke</button>`:''}</div></li>`).join('')||'<li class="card">No keys yet.</li>'}</ul>
    <button class="sec" id="al">Lock administrator</button><p class="err" id="ae" role="alert"></p>`;
    const go=async(f,msg)=>{try{const r=await f();if(!r.ok)throw new Error(r.message);if(r.token)fresh=r.token;else fresh=null;toast(msg);adminPanel(el,{esc,toast})}catch(x){el.querySelector('#ae').textContent=x.message}};
    el.querySelector('#al').onclick=lock;
    const q=s=>el.querySelector(s);
    q('#as2').onclick=()=>go(()=>A('admin.settingSet',{appName:q('#an').value}),'Name saved');
    q('#ca').onclick=()=>go(()=>A('admin.listAdd',{kind:'category',type:q('#ct').value,name:q('#cn').value}),'Category added');
    q('#aa').onclick=()=>go(()=>A('admin.listAdd',{kind:'account',name:q('#an2').value}),'Account added');
    el.querySelectorAll('[data-ls]').forEach(b=>b.onclick=()=>{const[kind,id,status]=b.dataset.ls.split('|');go(()=>A('admin.listSet',{kind,id,status}),status==='active'?'Enabled':'Disabled')});
    q('#lu').onclick=()=>go(async()=>{const f=q('#lf').files[0];if(!f)throw new Error('Choose an image first');
      if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>5e6)throw new Error('Use a PNG, JPEG or WebP image under 5 MB');
      const bm=await createImageBitmap(f),sc=Math.min(1,512/Math.max(bm.width,bm.height)),cv=document.createElement('canvas');
      cv.width=Math.round(bm.width*sc);cv.height=Math.round(bm.height*sc);cv.getContext('2d').drawImage(bm,0,0,cv.width,cv.height);
      return A('admin.logoUpload',{mime:'image/png',data:cv.toDataURL('image/png').split(',')[1]})},'Logo uploaded');
    el.querySelector('#wc').onclick=()=>go(()=>A('admin.workspaceCreate',{name:el.querySelector('#wn').value}),'Workspace created');
    el.querySelector('#kc').onclick=()=>go(()=>A('admin.keyCreate',{workspaceId:el.querySelector('#kw').value,label:el.querySelector('#kl').value,permissions:el.querySelector('#kp').value.split(','),expiresAt:el.querySelector('#ke').value}),'Key created');
    el.querySelectorAll('[data-rev]').forEach(b=>b.onclick=()=>confirm('Revoke this key now? Devices using it lose access immediately.')&&go(()=>A('admin.keyRevoke',{keyId:b.dataset.rev}),'Key revoked'));
    el.querySelectorAll('[data-rot]').forEach(b=>b.onclick=()=>confirm('Rotate: revoke this key and issue a replacement?')&&go(()=>A('admin.keyRotate',{keyId:b.dataset.rot}),'Key rotated'));
  }
}
