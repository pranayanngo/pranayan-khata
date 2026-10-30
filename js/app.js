import * as DB from './db.js';
import {fmt,toPaise} from './db.js';
import * as Sync from './sync.js';
import {adminPanel} from './admin.js';
import {API_URL,CONFIG_ERROR} from './cfg.js';
window.__boot=true;
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEF_CAT={income:['Donations','Membership contributions','Grants','Project funding','Other income'],
 expense:['Healthcare programmes','Education programmes','Environment projects','Senior citizen support','Office expenses','Travel & transport','Food & events','Salaries & honorariums','Printing & stationery','Equipment & supplies','Other expenses']};
const DEF_ACC=['Cash','Bank','UPI'];let CAT=DEF_CAT,ACC=DEF_ACC;
const ICON={'Donations':'🤝','Membership contributions':'👥','Grants':'🏛️','Project funding':'💼','Other income':'💰','Healthcare programmes':'🩺','Education programmes':'🎓','Environment projects':'🌱','Senior citizen support':'🧓','Office expenses':'🗂️','Travel & transport':'🚌','Food & events':'🍽️','Salaries & honorariums':'👤','Printing & stationery':'🖨️','Equipment & supplies':'🛠️','Other expenses':'🧾'};
const icon=t=>ICON[t.category]||(t.type==='income'?'💰':'🧾');
const copts=(l,sel,ty)=>l.map(x=>`<option value="${esc(x)}"${x===sel?' selected':''}>${ICON[x]||(ty==='income'?'💰':'🧾')}  ${esc(x)}</option>`).join('');
function applyConfig(){
  const c=Sync.S.mode==='shared'&&Sync.S.cfg;CAT=DEF_CAT;ACC=DEF_ACC;let name='PRANAYAN KHATA',logo='assets/logo/pranayan-logo.png';
  if(c){const on=t=>c.categories.filter(x=>x.type===t&&x.status==='active').map(x=>x.name);
    if(c.categories.length)CAT={income:on('income'),expense:on('expense')};
    const ac=c.accounts.filter(x=>x.status==='active').map(x=>x.name);if(ac.length)ACC=ac;
    name=c.appName||name;if(c.logo)logo=c.logo}
  document.title=name;$('#brand').textContent=name;if($('#logo').getAttribute('src')!==logo)$('#logo').src=logo;
}
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const addDays=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&addDays(s,0)===s;
const sum=(l,t)=>l.filter(x=>x.type===t).reduce((a,x)=>a+x.amount,0);
const opts=(a,sel,all)=>(all?`<option value="">${all}</option>`:'')+a.map(x=>`<option${x===sel?' selected':''}>${esc(x)}</option>`).join('');
let tx=[],opening=0,shown=30,filt={q:'',type:'',cat:'',acc:'',range:'',from:'',to:'',sort:'new'},rep={from:'',to:''};

let tt;function toast(m,bad){const t=$('#toast');t.textContent=m;t.className='show'+(bad?' bad':'');clearTimeout(tt);tt=setTimeout(()=>t.className='',3500)}
let all=[];
async function load(){all=await DB.all();tx=all.filter(t=>t.op!=='delete');Sync.S.pending=all.filter(t=>t.sync&&t.sync!=='synced').length}
function header(){applyConfig();const sh=Sync.S.mode==='shared';$('#mode').textContent=sh?'Shared Mode · '+Sync.S.ws:'Private Mode · this device only';const b=$('#sync');b.hidden=!sh;if(sh)b.textContent='↻ '+Sync.label()}
async function reloadAll(){filt={...filt,q:'',type:'',cat:'',acc:'',range:'',from:'',to:''};rep={from:'',to:''};opening=Sync.S.mode==='shared'?0:(await DB.getMeta('opening'))||0;await load();header()}
async function onSync(changed){await load();header();if(changed&&['','/','/list','/reports'].includes(location.hash.slice(1)))route(true)}

/* ---------- Dashboard ---------- */
function dash(){
  const t=today(),m=t.slice(0,7),td=tx.filter(x=>x.date===t),mo=tx.filter(x=>x.date.startsWith(m));
  const inc=sum(tx,'income'),exp=sum(tx,'expense'),sh=Sync.S.mode==='shared';
  const T=[['💰','Total Income',fmt(inc),'g'],['💸','Total Expenditure',fmt(exp),'r'],['☀️',"Today's Income",fmt(sum(td,'income')),'g'],['🧾',"Today's Expenditure",fmt(sum(td,'expense')),'r'],
   ['📅',"This Month's Income",fmt(sum(mo,'income')),'g'],['🗓️',"This Month's Expenditure",fmt(sum(mo,'expense')),'r'],['⏳','Pending Synchronization',sh?String(Sync.S.pending):'N/A (Private)','o']];
  const rec=[...tx].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const day=new Date().toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',year:'numeric'});
  app.innerHTML=`<p class="date">${day}</p>
  <div class="hero"><small>Current Balance</small><b>${esc(fmt(opening+inc-exp))}</b><div class="hs">This month: ${esc(fmt(sum(mo,'income')-sum(mo,'expense')))} net · ${sh?'Shared · '+esc(Sync.S.ws):'Private · this device'}</div></div>
  <div class="tiles">${T.map(([i,l,v,c])=>`<div class="tile ${c}"><span class="tic" aria-hidden="true">${i}</span><div><small>${l}</small><b>${esc(v)}</b></div></div>`).join('')}</div>
  <div class="sec-h"><h3>Recent transactions</h3>${rec.length?'<a href="#/list">View all</a>':''}</div>${rec.length?`<ul class="txs">${rec.map(row).join('')}</ul>`:`<div class="empty"><div class="eico">🌱</div><b>No transactions yet</b><p>Record your first income or expense to see your balance grow.</p>${Sync.canWrite()?'<a class="btn" href="#/add">Add transaction</a>':''}</div>`}`;
}
const BL={pending:'⏳ Pending sync',synced:'✓ Synced',failed:'⚠ Failed',conflict:'⚡ Conflict'};
const sbadge=t=>t.sync?`<small class="sb ${t.sync}">${BL[t.sync]}${t.sync==='failed'?': '+esc(t.err)+` <button class="sec" data-retry="${esc(t.id)}">Retry</button>`:''}${t.sync==='conflict'?` <button class="sec" data-resolve="${esc(t.id)}">Resolve</button>`:''}</small>`:'';
const trow=t=>`<tr><td>${esc(t.date)}</td><td><span aria-hidden="true">${icon(t)}</span> ${esc(t.category)}</td><td>${esc(t.desc)}${t.ref?' <small class="mut">Ref '+esc(t.ref)+'</small>':''}</td><td>${t.type==='income'?'Income':'Expense'}</td><td>${esc(t.account)}</td><td class="n ${t.type==='income'?'ti':'te'}">${t.type==='income'?'+':'−'}${fmt(t.amount)}</td><td>${sbadge(t)}</td><td><button data-edit="${esc(t.id)}" aria-label="Edit">✎</button><button data-del="${esc(t.id)}" aria-label="Delete">🗑</button></td></tr>`;
const row=t=>`<li class="tx ${t.type}"><span class="ic" aria-hidden="true">${icon(t)}</span><div><b>${esc(t.category)}</b><small>${esc(t.date)} · ${esc(t.account)}${t.desc?' · '+esc(t.desc):''}${t.ref?' · Ref '+esc(t.ref):''}</small>${sbadge(t)}</div>
<div class="amt">${t.type==='income'?'+':'−'}${fmt(t.amount)}</div>
<div class="act"><button data-edit="${esc(t.id)}" aria-label="Edit">✎</button><button data-del="${esc(t.id)}" aria-label="Delete">🗑</button></div></li>`;
const guard=()=>{if(!Sync.canWrite()){toast('This key is read-only',1);return false}return true};
app.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset,find=id=>all.find(x=>x.id===id),shared=Sync.S.mode==='shared';
  try{
    if(d.edit&&guard())location.hash='#/edit/'+d.edit;
    if(d.del&&guard()&&confirm('Delete this transaction? This cannot be undone.')){
      const t=find(d.del);
      if(shared&&t&&t.op!=='create')await DB.put({...t,sync:'pending',op:'delete',base:t.sync==='synced'?t.updatedAt:t.base});else await DB.del(d.del); // never-synced entries are simply discarded
      await load();toast(shared&&find(d.del)?'Deletion queued — not yet removed from the shared ledger':'Deleted');route(true);Sync.syncNow();
    }
    if(d.retry){const t=find(d.retry);await DB.put({...t,sync:'pending',err:''});await load();route(true);Sync.syncNow()}
    if(d.resolve){const{server,...t}=find(d.resolve);
      if(confirm('Someone else changed this record.\nOK = keep the shared version.\nCancel = apply my edit over it.'))await DB.put({...server,sync:'synced'});
      else await DB.put({...t,sync:'pending',op:'update',base:server.updatedAt});
      await load();route(true);Sync.syncNow()}
  }catch(x){toast('Action failed: '+x.message,1)}
});

/* ---------- Add / Edit ---------- */
function form(t={}){
  if(!Sync.canWrite()){app.innerHTML='<div class="note">This key is read-only: you cannot add or edit transactions.</div>';return}
  const ty=t.type||'expense';
  app.innerHTML=`<h2>${t.id?'Edit':'Add'} transaction</h2><form id="f" novalidate>
  <div class="seg" role="radiogroup" aria-label="Type"><label><input type="radio" name="type" value="income"${ty==='income'?' checked':''}>Income</label><label><input type="radio" name="type" value="expense"${ty==='expense'?' checked':''}>Expense</label></div>
  <label class="amtf">Amount (₹)<input name="amount" inputmode="decimal" autocomplete="off" required value="${t.amount!=null?(t.amount/100).toFixed(2):''}"></label>
  <label>Date<input type="date" name="date" required value="${esc(t.date||today())}"></label>
  <label>Category<select name="category" id="cat"></select></label>
  <label>Account / payment method<select name="account">${opts(ACC,t.account)}</select></label>
  <label>Description (optional)<input name="desc" maxlength="200" value="${esc(t.desc)}"></label>
  <label>Reference number (optional)<input name="ref" maxlength="60" value="${esc(t.ref)}"></label>
  <p class="err" id="err" role="alert"></p>
  <div class="row"><button type="submit">Save</button><button type="button" class="sec" onclick="history.back()">Cancel</button></div></form>`;
  const f=$('#f'),fillCat=()=>{const l=CAT[f.type.value];$('#cat').innerHTML=copts(t.category&&f.type.value===t.type&&!l.includes(t.category)?[...l,t.category]:l,t.category,f.type.value)};
  fillCat();f.querySelectorAll('[name=type]').forEach(r=>r.onchange=fillCat);
  f.onsubmit=async e=>{
    e.preventDefault();const b=f.querySelector('[type=submit]');if(b.disabled)return;
    const d=Object.fromEntries(new FormData(f)),amt=toPaise(d.amount);
    const err=!amt?'Enter an amount greater than zero, e.g. 1500 or 1500.50':!validDate(d.date)?'Enter a valid date':!(CAT[d.type].includes(d.category)||d.category===t.category)?'Choose a category':'';
    if(err){$('#err').textContent=err;return}
    b.disabled=true;
    try{const now=new Date().toISOString();
      const rec={id:t.id||crypto.randomUUID(),type:d.type,amount:amt,date:d.date,category:d.category,account:d.account,desc:d.desc.trim(),ref:d.ref.trim(),createdAt:t.createdAt||now,updatedAt:now};
      if(Sync.S.mode==='shared'){if(!Sync.canWrite())throw Error('This key is read-only');Object.assign(rec,t.id?{sync:'pending',op:t.op==='create'?'create':'update',base:t.sync==='synced'?t.updatedAt:t.base}:{sync:'pending',op:'create'})}
      await DB.put(rec);
      await load();toast(Sync.S.mode==='shared'?'Queued — not yet saved to the shared ledger':'Saved on this device');location.hash='#/list';Sync.syncNow();
    }catch(x){$('#err').textContent='Could not save: '+x.message;b.disabled=false}
  };
}

/* ---------- List ---------- */
function bounds(){
  if(filt.from||filt.to)return[filt.from,filt.to];
  const t=today(),ms=t.slice(0,7)+'-01',wd=(new Date(t+'T00:00:00Z').getUTCDay()+6)%7;
  switch(filt.range){case'today':return[t,t];case'yday':return[addDays(t,-1),addDays(t,-1)];
   case'week':return[addDays(t,-wd),t];case'month':return[ms,t];
   case'last':{const e=addDays(ms,-1);return[e.slice(0,7)+'-01',e]}}
  return['',''];
}
function filtered(){
  const[a,b]=bounds(),q=filt.q.toLowerCase();
  const S={new:(x,y)=>y.date.localeCompare(x.date)||y.createdAt.localeCompare(x.createdAt),old:(x,y)=>x.date.localeCompare(y.date),amt:(x,y)=>y.amount-x.amount,cat:(x,y)=>x.category.localeCompare(y.category)}[filt.sort];
  return tx.filter(t=>(!filt.type||t.type===filt.type)&&(!filt.cat||t.category===filt.cat)&&(!filt.acc||t.account===filt.acc)&&(!a||t.date>=a)&&(!b||t.date<=b)&&(!q||[t.desc,t.ref,t.category].join(' ').toLowerCase().includes(q))).sort(S);
}
function list(){
  const R=[['','All time'],['today','Today'],['yday','Yesterday'],['week','This week'],['month','This month'],['last','Last month']];
  const S=[['new','Newest'],['old','Oldest'],['amt','Amount'],['cat','Category']];
  app.innerHTML=`<h2>Transactions</h2><input class="srch" data-f="q" type="search" placeholder="Search description, reference, category" aria-label="Search" value="${esc(filt.q)}"><details class="fx"${matchMedia('(min-width:900px)').matches?' open':''}><summary>Filters &amp; sorting</summary><div class="filters">
  <select data-f="type" aria-label="Type"><option value="">Income + Expense</option><option value="income"${filt.type==='income'?' selected':''}>Income</option><option value="expense"${filt.type==='expense'?' selected':''}>Expense</option></select>
  <select data-f="cat" aria-label="Category">${opts([...CAT.income,...CAT.expense],filt.cat,'All categories')}</select>
  <select data-f="acc" aria-label="Account">${opts(ACC,filt.acc,'All accounts')}</select>
  <select data-f="range" aria-label="Period">${R.map(([v,l])=>`<option value="${v}"${filt.range===v?' selected':''}>${l}</option>`).join('')}</select>
  <label class="mut">From<input type="date" data-f="from" value="${filt.from}"></label><label class="mut">To<input type="date" data-f="to" value="${filt.to}"></label>
  <select data-f="sort" aria-label="Sort">${S.map(([v,l])=>`<option value="${v}"${filt.sort===v?' selected':''}>${l}</option>`).join('')}</select></div></details>
  <p id="sum" class="mut"></p><ul class="txs cards" id="rows"></ul><div class="tbl"><table class="rep"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Type</th><th>Account</th><th class="n">Amount</th><th>Sync</th><th></th></tr></thead><tbody id="tb"></tbody></table></div><div id="more"></div>`;
  app.querySelectorAll('[data-f]').forEach(el=>el.oninput=()=>{filt[el.dataset.f]=el.value;shown=30;paint()});
  paint();
}
function paint(){
  const l=filtered();
  $('#sum').textContent=`${l.length} transaction(s) · Income ${fmt(sum(l,'income'))} · Expense ${fmt(sum(l,'expense'))}`;
  $('#rows').innerHTML=l.slice(0,shown).map(row).join('')||'<li class="card">No transactions match.</li>';
  $('#tb').innerHTML=l.slice(0,shown).map(trow).join('')||'<tr><td colspan="8">No transactions match.</td></tr>';
  $('#more').innerHTML=l.length>shown?'<button class="sec" id="mb">Load more</button>':'';
  if($('#mb'))$('#mb').onclick=()=>{shown+=30;paint()};
}

/* ---------- Reports ---------- */
function reports(){
  const t=today();if(!rep.from){rep.from=t.slice(0,7)+'-01';rep.to=t}
  const{from,to}=rep,bad=from>to;
  const fl=x=>(!rep.cat||x.category===rep.cat)&&(!rep.acc||x.account===rep.acc),fd=!!(rep.cat||rep.acc);
  const before=tx.filter(x=>x.date<from&&fl(x)),P=tx.filter(x=>x.date>=from&&x.date<=to&&fl(x));
  const op=(fd?0:opening)+sum(before,'income')-sum(before,'expense'),inc=sum(P,'income'),exp=sum(P,'expense');
  const by=ty=>{const m={};P.filter(x=>x.type===ty).forEach(x=>m[x.category]=(m[x.category]||0)+x.amount);return Object.entries(m).sort((a,b)=>b[1]-a[1])};
  const ct=(title,r,tot,c)=>`<h3>${title}</h3>${r.length?`<table class="rep">${r.map(([k,v])=>`<tr><td>${esc(k)}<div class="bar" aria-hidden="true"><i class="${c}" style="width:${tot?Math.round(v*100/tot):0}%"></i></div></td><td class="n">${fmt(v)} (${tot?Math.round(v*100/tot):0}%)</td></tr>`).join('')}</table>`:'<p class="mut">No data.</p>'}`;
  const M={};P.forEach(x=>{const k=x.date.slice(0,7);(M[k]??={i:0,e:0})[x.type==='income'?'i':'e']+=x.amount});
  const mx=Math.max(1,...Object.values(M).flatMap(v=>[v.i,v.e]));
  const trend=Object.keys(M).sort().map(k=>`<tr><td>${k}<div class="bar" aria-hidden="true"><i class="g" style="width:${Math.round(M[k].i*100/mx)}%"></i></div><div class="bar" aria-hidden="true"><i style="width:${Math.round(M[k].e*100/mx)}%"></i></div></td><td class="n">${fmt(M[k].i)}<br>${fmt(M[k].e)}</td><td class="n">${fmt(M[k].i-M[k].e)}</td></tr>`).join('');
  app.innerHTML=`<h2>Reports</h2><div class="noprint"><div class="row">${[['today','Today'],['month','This month'],['lastm','Last month'],['year','This year']].map(([q,l])=>`<button class="sec" data-q="${q}">${l}</button>`).join('')}</div>
  <div class="filters"><label>From<input type="date" id="rf" value="${from}"></label><label>To<input type="date" id="rt" value="${to}"></label><select id="rcat" aria-label="Category" class="wide">${opts([...CAT.income,...CAT.expense],rep.cat,'All categories')}</select><select id="racc" aria-label="Account" class="wide">${opts(ACC,rep.acc,'All accounts')}</select></div>
  ${bad?'<p class="err">“From” date is after “To” date.</p>':''}<div class="row"><button id="pr">Print / Save PDF</button><button class="sec" id="rc">Export CSV</button></div></div>
  <div class="card"><h3>PRANAYAN KHATA · ${Sync.S.mode==='shared'?'Shared ledger: '+esc(Sync.S.ws):'Private ledger'} report</h3><p>${from} to ${to}${rep.cat?' · '+esc(rep.cat):''}${rep.acc?' · '+esc(rep.acc):''} · ${P.length} transaction(s)</p>${fd?'<p class="mut">Filtered report: balances cover only the selected category/account.</p>':''}
  <table class="rep"><tr><td>Opening balance</td><td class="n">${fmt(op)}</td></tr><tr><td>Total income</td><td class="n">${fmt(inc)}</td></tr><tr><td>Total expenditure</td><td class="n">${fmt(exp)}</td></tr><tr><th>Closing balance</th><th class="n">${fmt(op+inc-exp)}</th></tr></table>
  ${ct('Expenditure by category (highest first)',by('expense'),exp,'')}${ct('Income by category',by('income'),inc,'g')}
  <h3>Monthly trend</h3>${trend?`<table class="rep"><tr><th>Month</th><th class="n">Income / Expense</th><th class="n">Net</th></tr>${trend}</table>`:'<p class="mut">No data.</p>'}</div>`;
  app.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const q=b.dataset.q,y=t.slice(0,4);
    if(q==='today')rep={...rep,from:t,to:t};if(q==='month')rep={...rep,from:t.slice(0,7)+'-01',to:t};
    if(q==='lastm'){const e=addDays(t.slice(0,7)+'-01',-1);rep={...rep,from:e.slice(0,7)+'-01',to:e}}
    if(q==='year')rep={...rep,from:y+'-01-01',to:t};reports()});
  $('#rcat').onchange=e=>{rep.cat=e.target.value;reports()};$('#racc').onchange=e=>{rep.acc=e.target.value;reports()};
  $('#rf').onchange=e=>{rep.from=e.target.value||rep.from;reports()};$('#rt').onchange=e=>{rep.to=e.target.value||rep.to;reports()};
  $('#pr').onclick=()=>print();$('#rc').onclick=()=>csv(P,`khata-report-${from}_${to}.csv`);
}

/* ---------- Backup / export ---------- */
const dl=(name,text,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)};
const cell=v=>{v=String(v??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
function csv(l,name){
  const h=['id','date','type','amount_inr','category','account','description','reference'];
  dl(name,'\ufeff'+[h.join(','),...l.map(t=>[t.id,t.date,t.type,(t.amount/100).toFixed(2),t.category,t.account,t.desc,t.ref].map(cell).join(','))].join('\r\n'),'text/csv');
}
function check(t){
  if(!t||typeof t.id!=='string'||!t.id||!['income','expense'].includes(t.type)||!Number.isInteger(t.amount)||t.amount<=0||!validDate(t.date)||typeof t.category!=='string')throw Error('Backup contains an invalid record');
  const s=k=>String(t[k]??'').slice(0,200);
  return{id:t.id,type:t.type,amount:t.amount,date:t.date,category:s('category'),account:s('account'),desc:s('desc'),ref:s('ref'),createdAt:s('createdAt')||new Date().toISOString(),updatedAt:s('updatedAt')||new Date().toISOString()};
}
function backup(){
  app.innerHTML=`<h2>Backup and Export</h2>${Sync.S.mode==='shared'?'<div class="note">This exports the shared records as last synced to this device. Pending items are included and marked.</div>':'<div class="note">Your private records exist <b>only in this browser on this device</b>. Nothing is uploaded. To move them to another device, export a backup and restore it there.</div>'}
  <div class="card row"><button id="bj">Download JSON backup</button><button class="sec" id="bc">Export all as CSV</button></div>
  ${Sync.S.mode==='shared'?'<div class="note">Restore is disabled in Shared Mode so a backup can never overwrite the shared ledger.</div>':'<div class="card"><h3>Restore from backup</h3><p class="mut">Replaces all records on this device. The file is fully checked before anything is changed.</p><input type="file" id="rf" accept="application/json,.json"></div>'}`;
  $('#bj').onclick=()=>dl(`khata-backup-${today()}.json`,JSON.stringify({app:'pranayan-khata',version:1,exportedAt:new Date().toISOString(),opening,tx}),'application/json');
  $('#bc').onclick=()=>csv(tx,`khata-all-${today()}.csv`);
  if($('#rf'))$('#rf').onchange=async e=>{const f=e.target.files[0];if(!f)return;
    try{if(f.size>20e6)throw Error('File too large');const j=JSON.parse(await f.text());
      if(j.app!=='pranayan-khata'||!Array.isArray(j.tx))throw Error('Not a PRANAYAN KHATA backup');
      const clean=j.tx.map(check),op=j.opening??0;if(!Number.isInteger(op))throw Error('Invalid opening balance');
      if(!confirm(`Replace ALL records on this device with ${clean.length} record(s) from this backup?`)){e.target.value='';return}
      await DB.replaceAll(clean);await DB.setMeta('opening',op);opening=op;await load();toast('Backup restored');
    }catch(x){toast('Restore failed: '+x.message,1)}e.target.value=''};
}

/* ---------- Settings ---------- */
let deferred;
function settings(){
  const sh=Sync.S.mode==='shared',S=Sync.S;
  app.innerHTML=`<h2>Settings</h2>
  ${sh?'<div class="note">Opening balance is not used in Shared Mode; totals start from zero.</div>':`<div class="card"><h3>Opening balance</h3><form id="of"><label>Amount (₹)<input id="ob" inputmode="decimal" value="${(opening/100).toFixed(2)}"></label><p class="err" id="oe" role="alert"></p><button>Save opening balance</button></form></div>`}
  <div class="card"><h3>Shared access</h3>${sh?`<p>Connected to <b>${esc(S.ws)}</b> (${esc(S.perms.join(', '))}).</p><p class="mut">${esc(Sync.label())}${S.err?' · '+esc(S.err):''}</p><div class="row"><button id="sn">Sync now</button><button class="danger" id="sd">Disconnect</button></div><h3>Replace key</h3><p class="mut">Use this after the administrator rotates your key. Your pending changes are kept.</p>`:'<p class="note">A secret key opens one shared workspace. Entering it does <b>not</b> upload your private records, which stay separate on this device. Anyone holding a key can use that workspace, so share keys only with people you trust.</p>'}
  ${API_URL?`<label>${sh?'New secret key':'Secret key'}<input type="password" id="sk" autocomplete="off"></label><button id="sc">${sh?'Replace key':'Connect'}</button><p class="err" id="se" role="alert"></p>`:`<p class="err">Shared Mode is not configured. ${CONFIG_ERROR?'Problem in js/config.js: '+esc(CONFIG_ERROR):'Set API_URL in js/config.js.'} <a href="check.html">Run the setup check</a></p>`}</div>
  ${API_URL?'<div class="card"><h3>Administrator</h3><div id="adm"></div></div>':''}
  <div class="card"><h3>Install</h3><p>Android/desktop: use the Install button in the top bar or your browser menu. iPhone/iPad: Safari → Share → <b>Add to Home Screen</b>.</p></div>
  ${sh?'':'<div class="card"><h3>Danger zone</h3><button class="danger" id="wp">Delete all data on this device</button></div>'}`;
  if($('#of'))$('#of').onsubmit=async e=>{e.preventDefault();const p=toPaise($('#ob').value);if(p===null){$('#oe').textContent='Enter a valid amount';return}
    try{await DB.setMeta('opening',p);opening=p;toast('Opening balance saved');$('#oe').textContent=''}catch(x){$('#oe').textContent=x.message}};
  if($('#sc'))$('#sc').onclick=async()=>{const k=$('#sk').value.trim();if(!k)return;$('#sc').disabled=true;
    try{await Sync.connect(k);await reloadAll();toast(sh?'Key replaced':'Connected to shared workspace');settings()}catch(x){$('#se').textContent=x.message;$('#sc').disabled=false}};
  if($('#sn'))$('#sn').onclick=()=>Sync.syncNow(true);
  if($('#sd'))$('#sd').onclick=async()=>{const p=S.pending;
    if(!confirm(p?`${p} change(s) have NOT been saved to the shared ledger and will be lost. Disconnect anyway?`:'Disconnect and remove the shared data and key from this device?'))return;
    await Sync.disconnect();await reloadAll();toast('Disconnected. Back in Private Mode.');settings()};
  if($('#adm'))adminPanel($('#adm'),{esc,toast});
  if($('#wp'))$('#wp').onclick=async()=>{if(confirm('Delete ALL private records on this device?')&&confirm('Really delete everything? Export a backup first if unsure.')){await DB.wipe();tx=[];all=[];opening=0;toast('All data deleted');route()}};
}

/* ---------- Router / init ---------- */
const R={'':dash,'/':dash,'/list':list,'/add':()=>form(),'/reports':reports,'/backup':backup,'/settings':settings};
function route(keep){
  const h=location.hash.slice(1),m=/^\/edit\/(.+)$/.exec(h);
  if(m){const t=tx.find(x=>x.id===m[1]);if(!t){location.hash='#/list';return}form(t)}else(R[h]||dash)();
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+(h||'/')));
  $('#fab').hidden=!(h===''||h==='/'||h==='/list')||!Sync.canWrite();if(!keep)scrollTo(0,0);
}
const net=()=>{const n=$('#net');n.textContent=navigator.onLine?'Online':'Offline';n.classList.toggle('off',!navigator.onLine)};
addEventListener('online',net);addEventListener('offline',net);net();$('#sync').onclick=()=>Sync.syncNow(true);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false});
$('#install').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('#install').hidden=true};
addEventListener('hashchange',route);
(async()=>{
  try{Sync.init({onChange:onSync});await Sync.restore();await DB.open();opening=Sync.S.mode==='shared'?0:(await DB.getMeta('opening'))||0;await load();navigator.storage?.persist?.()}
  catch(e){app.innerHTML=`<div class="note"><b>Storage unavailable.</b> ${esc(e.message)}. Private browsing may block local storage; open the app in a normal window.</div>`;return}
  header();route();if(Sync.S.mode==='shared')Sync.start();
  if('serviceWorker'in navigator){const had=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had)toast('App updated. Reload the page to use the new version.')});
    navigator.serviceWorker.register('service-worker.js').catch(()=>{})}
})();
