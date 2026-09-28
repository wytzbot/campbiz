// Shared Pro-access rules. The underscore prefix keeps Vercel from deploying this as its own function.
const admin=require('firebase-admin');
const OWNER_EMAIL=String(process.env.OWNER_EMAIL||'ilemobayotolulope11092003@gmail.com').toLowerCase();
const ACTIVE=['active','non_renewing','attention'];
const GRACE_MS=36*60*60*1000; // covers the gap until the daily cron starts billing for owners whose card is already on file
const ms=t=>t&&typeof t.toMillis==='function'?t.toMillis():0;

function entitlementFromDoc(d,now=Date.now()){
  d=d||{};
  const end=ms(d.subscriptionEndsAt),trialEnd=ms(d.trialEndsAt);
  const active=ACTIVE.includes(String(d.subscriptionStatus||''))&&end>now;
  const trialActive=!active&&trialEnd>now;
  const lifetime=String(d.plan||d.selectedPlan||'')==='lifetime';
  const grace=!active&&!trialActive&&d.trialBillingReady===true&&!!d.authorizationCode&&trialEnd>0&&now-trialEnd<GRACE_MS;
  return {active,trialActive,lifetime,grace,entitled:active||trialActive||lifetime||grace};
}

let lifetimeCache={uid:undefined,at:0};
async function lifetimeUid(app){
  if(lifetimeCache.uid!==undefined&&Date.now()-lifetimeCache.at<10*60*1000)return lifetimeCache.uid;
  let uid=null;try{uid=(await admin.auth(app).getUserByEmail(OWNER_EMAIL)).uid}catch{}
  lifetimeCache={uid,at:Date.now()};return uid;
}

// Returns the Set of owner UIDs whose store is currently unlocked.
async function entitledOwners(db,app,uids){
  const unique=[...new Set((uids||[]).filter(Boolean).map(String))];
  const ok=new Set();if(!unique.length)return ok;
  const lt=await lifetimeUid(app);if(lt&&unique.includes(lt))ok.add(lt);
  const rest=unique.filter(u=>!ok.has(u));
  for(let i=0;i<rest.length;i+=300){
    const refs=rest.slice(i,i+300).map(u=>db.collection('billingCustomers').doc(u));
    const snaps=await db.getAll(...refs);
    snaps.forEach(s=>{if(s.exists&&entitlementFromDoc(s.data()).entitled)ok.add(s.id)});
  }
  return ok;
}
async function isOwnerEntitled(db,app,uid){return (await entitledOwners(db,app,[uid])).has(String(uid))}

module.exports={OWNER_EMAIL,entitlementFromDoc,entitledOwners,isOwnerEntitled};
