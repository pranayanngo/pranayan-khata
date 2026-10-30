// Reads js/config.js safely. If config.js is missing or has a typo, the app still starts
// (Private Mode works) and Settings explains the problem, instead of showing a blank page.
let m={},err='';
try{m=await import('./config.js')}catch(e){err=String((e&&e.message)||e)}
const u=typeof m.API_URL==='string'?m.API_URL.trim():'';
export const API_URL=u;
export const CONFIG_ERROR=err||(u&&!/^https?:\/\//.test(u)?'API_URL must start with https://':'');
export const SYNC_INTERVAL_MS=Number.isFinite(m.SYNC_INTERVAL_MS)&&m.SYNC_INTERVAL_MS>=1000?m.SYNC_INTERVAL_MS:15000;
