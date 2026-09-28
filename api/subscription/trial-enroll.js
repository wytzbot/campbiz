const admin=require('firebase-admin');
const crypto=require('crypto');
function getAdminApp(){if(admin.apps.length)return admin.app();let s;if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)s=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);else{const{FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw new Error('Firebase Admin environment variables are not configured.');s={projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}}return admin.initializeApp({credential:admin.credential.cert(s)})}
function reply(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body)}
const PLANS={monthly:process.env.PAYSTACK_MONTHLY_PLAN_CODE||'PLN_l3x2lebuzk6dzqw',annual:process.env.PAYSTACK_ANNUAL_PLAN_CODE||'PLN_9b33lqkxewk4hh8'};
module.exports=async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{ok:false,error:'Method not allowed.'})}
 try{
  const bearer=req.headers.authorization||'';if(!bearer.startsWith('Bearer '))return reply(res,401,{ok:false,error:'Google sign-in is required.'});
  const app=getAdminApp();const decoded=await admin.auth(app).verifyIdToken(bearer.slice(7));const email=(decoded.email||'').trim().toLowerCase();
  if(!email)return reply(res,400,{ok:false,error:'A Google account email is required.'});
  const plan=String(req.body?.plan||'monthly');if(!PLANS[plan])return reply(res,400,{ok:false,error:'Choose a valid Paystack plan.'});
  const secret=process.env.PAYSTACK_SECRET_KEY;if(!secret)return reply(res,503,{ok:false,error:'Paystack secret key is not configured.'});
  const appUrl=(process.env.APP_URL||'https://campbiz.vercel.app').replace(/\/$/,'');const db=admin.firestore(app);const ref=db.collection('billingCustomers').doc(decoded.uid);const snap=await ref.get();const existing=snap.exists?snap.data():{};
  const trialEnd=existing.trialEndsAt?.toMillis?existing.trialEndsAt.toMillis():0;
  if(!trialEnd)return reply(res,409,{ok:false,error:'Your trial has not been initialized yet. Refresh and try again.'});
  if(existing.trialBillingReady&&existing.authorizationCode){await ref.set({selectedPlan:plan,plan:plan,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});return reply(res,200,{ok:true,enrolled:true,message:'Your payment method is already enrolled. The selected plan will begin after your free trial.'});}
  const reference=('CBZTRIAL_'+decoded.uid.replace(/[^a-zA-Z0-9]/g,'').slice(0,18)+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(3).toString('hex')).slice(0,70);
  const paymentRef=db.collection('subscriptionPayments').doc(reference);await paymentRef.create({uid:decoded.uid,email,reference,flow:'trial_tokenization',plan,planCode:PLANS[plan],amount:5000,currency:'NGN',status:'initializing',createdAt:admin.firestore.FieldValue.serverTimestamp()});
  const r=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:5000,currency:'NGN',reference,channels:['card'],callback_url:`${appUrl}/?subscription=trial-enroll&reference=${encodeURIComponent(reference)}`,metadata:{firebase_uid:decoded.uid,plan,flow:'trial_tokenization',trialEndsAt:new Date(trialEnd).toISOString()}})});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.status){await paymentRef.set({status:'initialization_failed',providerMessage:String(d.message||'provider_error').slice(0,300),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});return reply(res,502,{ok:false,error:'Paystack could not open the card setup checkout.'});}
  await paymentRef.set({status:'pending',accessCode:d.data?.access_code||null,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return reply(res,200,{ok:true,reference,authorizationUrl:d.data?.authorization_url||null,message:'Secure card setup opened. Paystack will process a refundable ₦50 verification charge, then CampBiz will refund it. Your Pro trial remains free and billing starts only after the trial.'});
 }catch(e){console.error('Trial enrollment error',e);return reply(res,500,{ok:false,error:'Unable to set up billing for the end of your trial.'})}
};
