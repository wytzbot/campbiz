const admin=require('firebase-admin');
function getAdminApp(){if(admin.apps.length)return admin.app();let s;if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)s=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);else{const{FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw new Error('Firebase Admin environment variables are not configured.');s={projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}}return admin.initializeApp({credential:admin.credential.cert(s)})}
const PLANS={monthly:process.env.PAYSTACK_MONTHLY_PLAN_CODE||'PLN_l3x2lebuzk6dzqw',annual:process.env.PAYSTACK_ANNUAL_PLAN_CODE||'PLN_9b33lqkxewk4hh8'};
module.exports=async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const expected=process.env.CRON_SECRET;if(expected&&req.headers.authorization!==`Bearer ${expected}`&&req.headers['x-cron-secret']!==expected)return res.status(401).json({ok:false});
 try{
  const app=getAdminApp(),db=admin.firestore(app),secret=process.env.PAYSTACK_SECRET_KEY;if(!secret)return res.status(503).json({ok:false,error:'Paystack secret key is not configured.'});
  const now=admin.firestore.Timestamp.now();
  const candidates=await db.collection('billingCustomers').where('trialBillingReady','==',true).limit(50).get();
  let processed=0,failed=0;
  for(const doc of candidates.docs){
   const d=doc.data();if(!d.trialEndsAt?.toMillis||d.trialEndsAt.toMillis()>Date.now()||!d.authorizationCode||!d.paystackCustomerCode||d.subscriptionStatus==='active')continue;
   const plan=d.selectedPlan||d.plan||'monthly';const planCode=PLANS[plan];if(!planCode){failed++;continue;}
   const r=await fetch('https://api.paystack.co/subscription',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({customer:d.paystackCustomerCode,plan:planCode,authorization:d.authorizationCode,start_date:new Date().toISOString()})});
   const x=await r.json().catch(()=>({}));
   if(r.ok&&x.status){const nextPayment=x.data?.next_payment_date||null;const subscriptionEndsAt=nextPayment?admin.firestore.Timestamp.fromDate(new Date(nextPayment)):null;if(!subscriptionEndsAt){await doc.ref.set({subscriptionStatus:'billing_setup_failed',billingError:'Paystack did not return the next billing date.',updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});failed++;continue;}await doc.ref.set({subscriptionStatus:'active',plan,planCode,paystackSubscriptionCode:x.data?.subscription_code||null,nextPaymentDate:nextPayment,subscriptionEndsAt,trialBillingReady:false,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});processed++;}
   else{await doc.ref.set({subscriptionStatus:'billing_setup_failed',billingError:String(x.message||'subscription_create_failed').slice(0,300),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});failed++;}
  }
  return res.status(200).json({ok:true,processed,failed,checkedAt:now.toDate().toISOString()});
 }catch(e){console.error('Trial cron error',e);return res.status(500).json({ok:false,error:'Trial billing job failed.'})}
};
