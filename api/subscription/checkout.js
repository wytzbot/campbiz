const admin = require('firebase-admin');
const crypto = require('crypto');

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Error('Firebase Admin environment variables are not configured.');
    serviceAccount = { projectId:FIREBASE_PROJECT_ID, clientEmail:FIREBASE_CLIENT_EMAIL, privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n') };
  }
  return admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
}
function reply(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body);}
const PLANS = {
  monthly: process.env.PAYSTACK_MONTHLY_PLAN_CODE || 'PLN_l3x2lebuzk6dzqw',
  annual: process.env.PAYSTACK_ANNUAL_PLAN_CODE || 'PLN_9b33lqkxewk4hh8'
};

module.exports = async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{ok:false,error:'Method not allowed.'});}
  try{
    const authorization=req.headers.authorization||'';
    if(!authorization.startsWith('Bearer ')) return reply(res,401,{ok:false,error:'Google sign-in is required.'});
    const app=getAdminApp();
    const decoded=await admin.auth(app).verifyIdToken(authorization.slice(7));
    const email=(decoded.email||'').trim().toLowerCase();
    if(!email) return reply(res,400,{ok:false,error:'A Google account email is required for billing.'});
    if(email==='ilemobayotolulope11092003@gmail.com') return reply(res,200,{ok:true,free:true,message:'Lifetime free access is enabled for this owner account.'});

    const requestedPlan=req.body?.plan;
    if(!['monthly','annual'].includes(requestedPlan)) return reply(res,400,{ok:false,error:'Choose a valid subscription plan.'});
    const planCode=PLANS[requestedPlan];
    const secret=process.env.PAYSTACK_SECRET_KEY;
    if(!secret) return reply(res,503,{ok:false,error:'Paystack secret key is not configured on the server.'});
    if(!planCode) return reply(res,503,{ok:false,error:'The selected Paystack plan is not configured.'});
    const appUrl=(process.env.APP_URL||'').replace(/\/$/,'');
    if(!appUrl) return reply(res,503,{ok:false,error:'APP_URL is not configured.'});

    const db=admin.firestore(app);
    const ownerRef=db.collection('billingCustomers').doc(decoded.uid);
    const ownerSnap=await ownerRef.get();
    const existing=ownerSnap.exists?ownerSnap.data():{};
    if(existing.subscriptionStatus==='active' && existing.subscriptionEndsAt && existing.subscriptionEndsAt.toMillis?.()>Date.now()){
      return reply(res,409,{ok:false,error:'Your Pro subscription is already active.'});
    }

    const reference=('CBZ_'+decoded.uid.replace(/[^a-zA-Z0-9]/g,'').slice(0,18)+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(3).toString('hex')).slice(0,70);
    const paymentRef=db.collection('subscriptionPayments').doc(reference);
    await paymentRef.create({uid:decoded.uid,email,reference,plan:requestedPlan,planCode,currency:'NGN',status:'initializing',provider:'paystack',createdAt:admin.firestore.FieldValue.serverTimestamp()});

    const response=await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',
      headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
      body:JSON.stringify({email,plan:planCode,reference,callback_url:`${appUrl}/?subscription=return&reference=${encodeURIComponent(reference)}`,metadata:{firebase_uid:decoded.uid,plan:requestedPlan,provider:'paystack'}})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok || !result.status){
      await paymentRef.set({status:'initialization_failed',providerMessage:String(result?.message||'provider_error').slice(0,300),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      return reply(res,502,{ok:false,error:'Paystack could not start the payment. Please try again.'});
    }
    await paymentRef.set({status:'pending',accessCode:result.data?.access_code||null,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    return reply(res,200,{ok:true,reference,plan:requestedPlan,authorizationUrl:result.data?.authorization_url||null,accessCode:result.data?.access_code||null,message:'Payment checkout created. Your Pro access activates only after Paystack payment is verified.'});
  }catch(error){
    console.error('Paystack checkout error:',error);
    return reply(res,500,{ok:false,error:'Unable to start Paystack checkout.'});
  }
};
