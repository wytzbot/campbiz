const admin=require('firebase-admin');
const crypto=require('crypto');
function getAdminApp(){if(admin.apps.length)return admin.app();let s;if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)s=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);else{const{FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw new Error('Firebase Admin environment variables are not configured.');s={projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}}return admin.initializeApp({credential:admin.credential.cert(s)})}
function reply(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body)}
function b64url(v){return Buffer.from(v).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
async function googleAccessToken(){const raw=process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not configured.');const sa=JSON.parse(raw);const now=Math.floor(Date.now()/1000);const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));const claim=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/drive.file',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));const signer=crypto.createSign('RSA-SHA256');signer.update(`${header}.${claim}`);const signature=b64url(signer.sign(sa.private_key));const jwt=`${header}.${claim}.${signature}`;const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});const d=await r.json();if(!r.ok||!d.access_token)throw new Error('Unable to obtain Google Drive access token.');return d.access_token}

async function driveJsonFile(token, folder, fileName, ownerUid) {
  const q = `'${folder.replace(/'/g,"\\'")}' in parents and name='${fileName.replace(/'/g,"\\'")}' and trashed=false`;
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=1&fields=files(id,name)`, {headers:{Authorization:`Bearer ${token}`} });
  const fd = await found.json().catch(()=>({}));
  if (!found.ok) throw new Error('Unable to find the comments file.');
  if (fd.files?.[0]?.id) return {id:fd.files[0].id, created:false};
  const metadata = {name:fileName,parents:[folder],mimeType:'application/json',description:`CampBiz comments storage · ${ownerUid}`};
  const created = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(metadata)});
  const cd = await created.json().catch(()=>({}));
  if (!created.ok || !cd.id) throw new Error('Unable to create the comments file.');
  const empty = Buffer.from(JSON.stringify({comments:[],version:1}));
  const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(cd.id)}?uploadType=media`, {method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:empty});
  if (!up.ok) throw new Error('Unable to initialize the comments file.');
  return {id:cd.id,created:true};
}
async function readDriveJson(token, fileId) {
  const r=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
  const text=await r.text(); if(!r.ok)throw new Error('Unable to read comments.');
  try{return JSON.parse(text)||{comments:[]}}catch{return {comments:[]}}
}
async function writeDriveJson(token,fileId,value){const r=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(value)});if(!r.ok)throw new Error('Unable to save comments.');}
async function notifyOwner(db, ownerUid, title, body, url){
  const snap=await db.collection('fcmTokens').where('uid','==',ownerUid).where('active','==',true).limit(20).get();
  if(snap.empty)return;
  const tokens=snap.docs.map(d=>d.data().token).filter(Boolean);
  if(!tokens.length)return;
  const messaging=getAdminApp() && admin.messaging(getAdminApp());
  const result=await messaging.sendEachForMulticast({tokens,notification:{title,body},data:{url:String(url),type:'comments'}});
  const bad=[];result.responses.forEach((r,i)=>{if(!r.success && ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(r.error?.code))bad.push(snap.docs[i].id)});
  if(bad.length){const batch=db.batch();bad.forEach(id=>batch.update(db.collection('fcmTokens').doc(id),{active:false,updatedAt:admin.firestore.FieldValue.serverTimestamp()}));await batch.commit();}
}


const DEFAULT_REGULATIONS={
  enabled:true,
  reportBanThreshold:50,
  suggestedMinRating:4.5,
  suggestedMinRatings:10,
  suggestedMinLikes:20,
  trustedMinRating:4.5,
  trustedMinRatings:100,
  trustedMinLikes:100
};
async function getCampBizRegulations(db){
  const snap=await db.collection('campbizSettings').doc('regulations').get();
  const x=snap.exists?(snap.data()||{}):{};
  return {...DEFAULT_REGULATIONS,...x,enabled:x.enabled!==false};
}
async function storeStatsFor(db,ownerUid){
  const snap=await db.collection('storeStats').doc(ownerUid).get();
  const x=snap.exists?(snap.data()||{}):{};
  return {ownerUid,ratingAvg:Number(x.ratingAvg||0),ratingCount:Number(x.ratingCount||0),ratingTotal:Number(x.ratingTotal||0),likesCount:Number(x.likesCount||0),trustedStore:Boolean(x.trustedStore),suggested:Boolean(x.suggested)};
}
async function applyMerchantFlags(db,ownerUid){
  const regs=await getCampBizRegulations(db);
  const stats=await storeStatsFor(db,ownerUid);
  const trusted=stats.ratingAvg>=Number(regs.trustedMinRating)&&stats.ratingCount>=Number(regs.trustedMinRatings)&&stats.likesCount>=Number(regs.trustedMinLikes);
  const suggested=stats.ratingAvg>=Number(regs.suggestedMinRating)&&stats.ratingCount>=Number(regs.suggestedMinRatings)&&stats.likesCount>=Number(regs.suggestedMinLikes);
  const next={...stats,trustedStore:trusted,suggested};
  await db.collection('storeStats').doc(ownerUid).set({
    ownerUid,ratingAvg:stats.ratingAvg,ratingCount:stats.ratingCount,ratingTotal:stats.ratingTotal,
    likesCount:stats.likesCount,trustedStore:trusted,suggested,updatedAt:admin.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  const listings=await db.collection('publishedListings').where('ownerUid','==',ownerUid).limit(100).get();
  if(!listings.empty){
    const batch=db.batch();
    listings.docs.forEach(d=>batch.set(d.ref,{
      ratingAvg:stats.ratingAvg,ratingCount:stats.ratingCount,likesCount:stats.likesCount,
      trustedStore:trusted,suggested,updatedAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:true}));
    await batch.commit();
  }
  return next;
}

module.exports=async function handler(req,res){
 if(req.method==='GET' && String(req.query?.action||'')==='comments'){
  try{const listingId=String(req.query?.listingId||'').trim();if(!listingId)return reply(res,400,{ok:false,error:'listingId is required.'});const app=getAdminApp();const db=admin.firestore(app);const ref=await db.collection('publishedListings').doc(listingId).get();if(!ref.exists||ref.data()?.published!==true)return reply(res,404,{ok:false,error:'Listing not found.'});const ownerUid=String(ref.data()?.ownerUid||ref.data()?.uid||'');const token=await googleAccessToken();const folder=process.env.DRIVE_FOLDER_ID||'1--aiQe2xifD9OAA5h2GbSW8FufHcbMaQ';const file=await driveJsonFile(token,folder,`campbiz-comments-${listingId}.json`,ownerUid);const data=await readDriveJson(token,file.id);const comments=Array.isArray(data.comments)?data.comments.slice(-100):[];return reply(res,200,{ok:true,count:comments.length,comments})}catch(e){console.error('Comments read error',e);return reply(res,500,{ok:false,error:'Unable to load comments.'})}
 }
 if(req.method==='GET' && String(req.query?.action||'')==='list'){
  try{const school=String(req.query?.school||'').trim();if(!school)return reply(res,400,{ok:false,error:'Choose a school before loading listings.'});const app=getAdminApp();const snap=await admin.firestore(app).collection('publishedListings').where('school','==',school).limit(300).get();const statsSnap=await admin.firestore(app).collection('storeStats').limit(1000).get();const statsMap=new Map(statsSnap.docs.map(d=>[d.id,d.data()||{}]));const listings=[];snap.forEach(doc=>{const d=doc.data()||{};const ownerUid=String(d.ownerUid||d.uid||'');const st=statsMap.get(ownerUid)||{};if(d.published===true&&d.banned!==true)listings.push({id:doc.id,...d,ratingAvg:Number(st.ratingAvg??d.ratingAvg??0),ratingCount:Number(st.ratingCount??d.ratingCount??0),likesCount:Number(st.likesCount??d.likesCount??0),trustedStore:Boolean(st.trustedStore??d.trustedStore),suggested:Boolean(st.suggested??d.suggested),createdAt:d.createdAt?.toDate?.()?.toISOString?.()||null,updatedAt:d.updatedAt?.toDate?.()?.toISOString?.()||null});});listings.sort((a,b)=>Number(Boolean(b.suggested))-Number(Boolean(a.suggested))||Number(b.ratingAvg||0)-Number(a.ratingAvg||0)||Number(b.likesCount||0)-Number(a.likesCount||0)||String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));return reply(res,200,{ok:true,school,listings})}catch(e){console.error('Published listings read error',e);return reply(res,500,{ok:false,error:'Unable to load published listings for this school.'})}
 }
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{ok:false,error:'Method not allowed.'})}
 try{
  const bearer=req.headers.authorization||'';if(!bearer.startsWith('Bearer '))return reply(res,401,{ok:false,error:'Google sign-in is required.'});
  const app=getAdminApp();const decoded=await admin.auth(app).verifyIdToken(bearer.slice(7));const db=admin.firestore(app);const action=String(req.body?.action||'upload');
  if(action==='status'){
    const snap=await db.collection('driveConnections').doc(decoded.uid).get();const d=snap.exists?snap.data():{};return reply(res,200,{ok:true,connected:!!d.connected,connectedAt:d.connectedAt?.toDate?.()?.toISOString?.()||null});
  }
  if(action==='connect'){
    const accessToken=typeof req.body?.accessToken==='string'?req.body.accessToken.trim():'';if(accessToken.length<20||accessToken.length>4096)return reply(res,400,{ok:false,error:'A valid Google Drive authorization token is required.'});
    const probe=await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1&spaces=drive&fields=files(id)',{headers:{Authorization:`Bearer ${accessToken}`}});const driveData=await probe.json().catch(()=>({}));
    if(!probe.ok||!Array.isArray(driveData.files))return reply(res,403,{ok:false,error:'Google Drive authorization could not be verified.'});
    await db.collection('driveConnections').doc(decoded.uid).set({uid:decoded.uid,connected:true,googleEmail:decoded.email||null,connectedAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    return reply(res,200,{ok:true,connected:true,email:decoded.email||null});
  }
  if(action==='rateStore'){
    const ownerUid=String(req.body?.ownerUid||'').trim();const rating=Number(req.body?.rating);
    if(!ownerUid||ownerUid===decoded.uid||![1,2,3,4,5].includes(rating))return reply(res,400,{ok:false,error:'A valid client store rating is required.'});
    const owner=await db.collection('publishedListings').where('ownerUid','==',ownerUid).limit(1).get();if(owner.empty||owner.docs[0].data()?.published!==true||owner.docs[0].data()?.banned===true)return reply(res,404,{ok:false,error:'Store not found.'});
    const ratingRef=db.collection('storeRatings').doc(`${ownerUid}_${decoded.uid}`);const statsRef=db.collection('storeStats').doc(ownerUid);let stats;
    await db.runTransaction(async tx=>{const oldSnap=await tx.get(ratingRef);const statsSnap=await tx.get(statsRef);const old=oldSnap.exists?Number(oldSnap.data()?.rating||0):0;const cur=statsSnap.exists?statsSnap.data()||{}:{};let count=Number(cur.ratingCount||0),total=Number(cur.ratingTotal||0);if(old){total=total-old+rating}else{count+=1;total+=rating}const avg=count?Math.round((total/count)*10)/10:0;stats={ratingAvg:avg,ratingCount:count,ratingTotal:total,likesCount:Number(cur.likesCount||0),updatedAt:admin.firestore.FieldValue.serverTimestamp()};tx.set(ratingRef,{ownerUid,clientUid:decoded.uid,rating,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});tx.set(statsRef,{ownerUid,...stats},{merge:true});});
    const flags=await applyMerchantFlags(db,ownerUid);
    return reply(res,200,{ok:true,...flags,message:'Your store rating was saved. You can only keep one rating per client account.'});
  }
  if(action==='likeStore'){
    const ownerUid=String(req.body?.ownerUid||'').trim();if(!ownerUid||ownerUid===decoded.uid)return reply(res,400,{ok:false,error:'A valid store is required.'});
    const owner=await db.collection('publishedListings').where('ownerUid','==',ownerUid).limit(1).get();if(owner.empty||owner.docs[0].data()?.published!==true||owner.docs[0].data()?.banned===true)return reply(res,404,{ok:false,error:'Store not found.'});
    const likeRef=db.collection('storeLikes').doc(`${ownerUid}_${decoded.uid}`);const statsRef=db.collection('storeStats').doc(ownerUid);let liked=false;
    await db.runTransaction(async tx=>{const old=await tx.get(likeRef);const statsSnap=await tx.get(statsRef);const cur=statsSnap.exists?statsSnap.data()||{}:{};let likes=Math.max(0,Number(cur.likesCount||0));if(old.exists){tx.delete(likeRef);likes=Math.max(0,likes-1);liked=false}else{tx.set(likeRef,{ownerUid,clientUid:decoded.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});likes+=1;liked=true}tx.set(statsRef,{ownerUid,likesCount:likes,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});});
    const flags=await applyMerchantFlags(db,ownerUid);
    return reply(res,200,{ok:true,liked,likesCount:flags.likesCount,trustedStore:flags.trustedStore,suggested:flags.suggested});
  }
  if(action==='reportStore'){
    const ownerUid=String(req.body?.ownerUid||'').trim();const reason=String(req.body?.reason||'').trim().slice(0,80);
    const allowed=['Spam or misleading listing','Scam or fraud concern','Harassment or inappropriate content','Fake business or impersonation','Unsafe or prohibited service','Incorrect business information','Other'];
    if(!ownerUid||ownerUid===decoded.uid||!allowed.includes(reason))return reply(res,400,{ok:false,error:'Choose a valid report reason.'});
    const owner=await db.collection('publishedListings').where('ownerUid','==',ownerUid).limit(1).get();if(owner.empty||owner.docs[0].data()?.published!==true||owner.docs[0].data()?.banned===true)return reply(res,404,{ok:false,error:'Store not found.'});
    const regs=await getCampBizRegulations(db);const reportRef=db.collection('storeReports').doc(`${ownerUid}_${decoded.uid}`);let reportCount=0,banned=false,created=false;
    await db.runTransaction(async tx=>{const existing=await tx.get(reportRef);const statsRef=db.collection('storeStats').doc(ownerUid);const statsSnap=await tx.get(statsRef);const cur=statsSnap.exists?statsSnap.data()||{}:{};if(existing.exists){throw Object.assign(new Error('You have already reported this store.'),{status:409})}reportCount=Number(cur.reportCount||0)+1;banned=Boolean(cur.banned)||(regs.enabled&&reportCount>=Number(regs.reportBanThreshold));tx.set(reportRef,{ownerUid,reporterUid:decoded.uid,reason,createdAt:admin.firestore.FieldValue.serverTimestamp()});tx.set(statsRef,{ownerUid,reportCount,banned,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});created=true});
    if(banned){const listings=await db.collection('publishedListings').where('ownerUid','==',ownerUid).limit(100).get();if(!listings.empty){const batch=db.batch();listings.docs.forEach(d=>batch.set(d.ref,{banned:true,published:false,bannedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}));await batch.commit()}}
    return reply(res,200,{ok:true,created,reportCount,banned,message:banned?'This account has reached the report threshold and has been restricted.':'Report received. Our moderation rules count one report per client account.'});
  }
  if(action==='comment'||action==='review'){
    const listingId=String(req.body?.listingId||'').trim();const text=String(req.body?.text||'').trim().replace(/\s+/g,' ');if(!listingId||text.length<2||text.length>500)return reply(res,400,{ok:false,error:'Write a comment between 2 and 500 characters.'});const ref=await db.collection('publishedListings').doc(listingId).get();if(!ref.exists||ref.data()?.published!==true)return reply(res,404,{ok:false,error:'Listing not found.'});const listing=ref.data()||{};const ownerUid=String(listing.ownerUid||listing.uid||'');if(!ownerUid)return reply(res,400,{ok:false,error:'This listing has no store owner.'});const token=await googleAccessToken();const folder=process.env.DRIVE_FOLDER_ID||'1--aiQe2xifD9OAA5h2GbSW8FufHcbMaQ';const file=await driveJsonFile(token,folder,`campbiz-comments-${listingId}.json`,ownerUid);const data=await readDriveJson(token,file.id);const comments=Array.isArray(data.comments)?data.comments:[];const comment={id:crypto.randomUUID(),uid:decoded.uid,displayName:String(decoded.name||decoded.email||'CampBiz client').slice(0,80),text,createdAt:new Date().toISOString()};comments.push(comment);while(comments.length>100)comments.shift();await writeDriveJson(token,file.id,{version:1,listingId,ownerUid,comments});await db.collection('publishedListings').doc(listingId).set({commentFileId:file.id,commentCount:comments.length,commentNotificationBatchCount:Math.floor(comments.length/10)},{merge:true});if(comments.length>0&&comments.length%10===0){await notifyOwner(db,ownerUid,`New CampBiz comments · ${comments.length}`,`You have reached ${comments.length} comments on your listing. Tap to open the comments section.`,`${process.env.APP_URL||'https://campbiz.vercel.app'}/?focus=comments#businessView/${encodeURIComponent(listingId)}`)}return reply(res,200,{ok:true,count:comments.length,message:'Your comment is sent.'});
  }
  const connection=await db.collection('driveConnections').doc(decoded.uid).get();if(!connection.exists||connection.data()?.connected!==true)return reply(res,403,{ok:false,error:'Connect Google Drive before uploading business media.'});
  if(action==='publish'){
    const listing=req.body?.listing||{};
    const required=['businessName','school','category','shortDescription','description','priceFrom','priceRange','address','hours','whatsapp','email','featuredImageUrl'];
    if(required.some(k=>listing[k]===undefined||listing[k]===null||String(listing[k]).trim()===''))return reply(res,400,{ok:false,error:'Complete all required listing information before publishing.'});
    if(listing.confirmed!==true)return reply(res,400,{ok:false,error:'Confirm that the business information is accurate before publishing.'});
    if(!String(listing.featuredImageUrl).startsWith('https://drive.google.com/'))return reply(res,400,{ok:false,error:'Featured image must be stored in CampBiz Google Drive storage.'});
    const images=Array.isArray(listing.productImages)?listing.productImages.filter(Boolean):[];
    if(images.length>100)return reply(res,400,{ok:false,error:'A Pro listing can contain up to 100 product images.'});if(images.some(url=>!String(url).startsWith('https://drive.google.com/')))return reply(res,400,{ok:false,error:'Product images must be stored in CampBiz Google Drive storage.'});if(!Number.isFinite(Number(listing.priceFrom))||Number(listing.priceFrom)<=0)return reply(res,400,{ok:false,error:'Starting price must be greater than zero.'});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(listing.email).trim()))return reply(res,400,{ok:false,error:'Enter a valid business email address.'});if(String(listing.website||'').trim()){try{const u=new URL(String(listing.website).trim());if(!['http:','https:'].includes(u.protocol))throw new Error('bad')}catch{return reply(res,400,{ok:false,error:'Website must start with http:// or https://.'})}}
    const billing=await db.collection('billingCustomers').doc(decoded.uid).get();const bd=billing.exists?billing.data()||{}:{};const now=Date.now();const trialEnd=bd.trialEndsAt?.toMillis?.()||0;const subEnd=bd.subscriptionEndsAt?.toMillis?.()||0;const active=['active','non_renewing','attention'].includes(String(bd.subscriptionStatus||''))&&subEnd>now;const trialActive=!active&&trialEnd>now;const isPro=active||trialActive||String(bd.plan||bd.selectedPlan||'')==='lifetime';
    if(images.length>7&&!isPro)return reply(res,403,{ok:false,error:'Free listings allow up to 7 product images. Upgrade to Pro for the larger gallery.'});
    const clean={id:`owner_${decoded.uid}`,uid:decoded.uid,businessName:String(listing.businessName).trim().slice(0,80),school:String(listing.school).trim().slice(0,120),category:String(listing.category).trim().slice(0,80),shortDescription:String(listing.shortDescription).trim().slice(0,140),description:String(listing.description).trim().slice(0,1200),priceFrom:Number(listing.priceFrom)||0,priceRange:String(listing.priceRange).trim().slice(0,80),address:String(listing.address).trim().slice(0,180),hours:String(listing.hours).trim().slice(0,180),delivery:String(listing.delivery||'By arrangement').trim().slice(0,120),whatsapp:String(listing.whatsapp).trim().slice(0,40),email:String(listing.email).trim().slice(0,160),website:String(listing.website||'').trim().slice(0,300),featuredImageUrl:String(listing.featuredImageUrl),featuredImageId:listing.featuredImageId||null,productImages:images.slice(0,isPro?100:7),published:true,ownerUid:decoded.uid,ratingAvg:0,ratingCount:0,likesCount:0,trustedStore:false,suggested:false,banned:false,updatedAt:admin.firestore.FieldValue.serverTimestamp()};
    const ref=db.collection('publishedListings').doc(clean.id);const old=await ref.get();if(!old.exists)clean.createdAt=admin.firestore.FieldValue.serverTimestamp();await ref.set(clean,{merge:true});return reply(res,200,{ok:true,id:clean.id,publishedAt:new Date().toISOString(),imageCount:clean.productImages.length});
  }
  const folder=process.env.DRIVE_FOLDER_ID||'1--aiQe2xifD9OAA5h2GbSW8FufHcbMaQ';const{fileName,mimeType,data}=req.body||{};if(typeof fileName!=='string'||fileName.length<1||fileName.length>180||typeof mimeType!=='string'||typeof data!=='string')return reply(res,400,{ok:false,error:'fileName, mimeType and base64 data are required.'});
  const cleaned=data.replace(/^data:[^;]+;base64,/,'');const bytes=Buffer.from(cleaned,'base64');const imageMime=/^image\/(jpeg|png|webp)$/i.test(mimeType);const maxBytes=imageMime?550*1024:8*1024*1024;if(!bytes.length||bytes.length>maxBytes)return reply(res,413,{ok:false,error:imageMime?'Image must be compressed to 550 KB or smaller before storage.':'File must be between 1 byte and 8 MB.'});
  const token=await googleAccessToken();const boundary='----CampBiz'+crypto.randomBytes(12).toString('hex');const metadata={name:fileName.replace(/[\\/:*?"<>|]/g,'_'),parents:[folder],description:`CampBiz owner asset · ${decoded.uid}`};const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--`)]);
  const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body});const result=await r.json().catch(()=>({}));if(!r.ok||!result.id){console.error('Drive upload failed',result);return reply(res,502,{ok:false,error:'Google Drive could not store this file.'})}
  const perm=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(result.id)}/permissions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type:'anyone',role:'reader'})});if(!perm.ok){console.error('Drive public permission failed',await perm.text().catch(()=>''));return reply(res,502,{ok:false,error:'File was stored but could not be made viewable in the feed.'})}
  const publicUrl=`https://drive.google.com/uc?export=view&id=${result.id}`;return reply(res,200,{ok:true,fileId:result.id,name:result.name,mimeType:result.mimeType,webViewLink:result.webViewLink||`https://drive.google.com/file/d/${result.id}/view`,publicUrl});
 }catch(e){console.error('Drive storage error',e);return reply(res,500,{ok:false,error:'Unable to store this file in Google Drive.'})}
}
