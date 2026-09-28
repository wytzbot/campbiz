const admin=require('firebase-admin');
const crypto=require('crypto');

function getAdminApp(){
  if(admin.apps.length)return admin.app();
  let s;
  if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)s=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  else{const{FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw new Error('Firebase Admin environment variables are not configured.');s={projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}}
  return admin.initializeApp({credential:admin.credential.cert(s)});
}
function readRawBody(req){return new Promise((resolve,reject)=>{if(req.rawBody)return resolve(Buffer.isBuffer(req.rawBody)?req.rawBody:Buffer.from(req.rawBody));const chunks=[];req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c)));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});}
function validSignature(raw,signature,secret){if(!signature||!secret)return false;const expected=crypto.createHmac('sha512',secret).update(raw).digest('hex');const a=Buffer.from(expected,'utf8'),b=Buffer.from(String(signature),'utf8');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false});
  let createdEventRef=null;
  try{
    const secret=process.env.PAYSTACK_SECRET_KEY;
    const raw=await readRawBody(req);
    const signature=req.headers['x-paystack-signature']||'';
    if(!validSignature(raw,signature,secret))return res.status(401).json({ok:false});
    const event=JSON.parse(raw.toString('utf8')||'{}');
    const app=getAdminApp();const db=admin.firestore(app);const data=event.data||{};
    const identity=`${event.event||'unknown'}:${data.reference||data.subscription?.subscription_code||data.invoice_code||data.id||''}`;const eventKey=crypto.createHash('sha256').update(identity).digest('hex');
    const eventRef=db.collection('paystackEvents').doc(eventKey);
    const existing=await eventRef.get();if(existing.exists)return res.status(200).json({ok:true,duplicate:true});
    await eventRef.create({event:event.event||null,reference:data.reference||null,receivedAt:admin.firestore.FieldValue.serverTimestamp()});createdEventRef=eventRef;

    const metadata=data.metadata&&typeof data.metadata==='object'?data.metadata:{};
    let uid=metadata.firebase_uid||null;
    const reference=data.reference||null;
    if(!uid&&reference){const p=await db.collection('subscriptionPayments').doc(reference).get();if(p.exists)uid=p.data().uid;}
    if(!uid&&data.customer?.metadata?.firebase_uid)uid=data.customer.metadata.firebase_uid;
    if(!uid)return res.status(200).json({ok:true,ignored:true});

    const customerRef=db.collection('billingCustomers').doc(uid);
    const currentSnap=await customerRef.get();const current=currentSnap.exists?currentSnap.data():{};
    const interval=(data.plan_object?.interval||data.plan?.interval||data.subscription?.plan?.interval||current.planInterval||'').toLowerCase();
    const plan=metadata.plan||current.plan||(interval==='monthly'?'monthly':interval==='annually'?'annual':null);
    const nextPayment=data.next_payment_date||data.plan_object?.next_payment_date||data.subscription?.next_payment_date||null;
    const nextDate=nextPayment?new Date(nextPayment):null;
    const updates={uid,provider:'paystack',updatedAt:admin.firestore.FieldValue.serverTimestamp()};
    if(data.customer?.customer_code)updates.paystackCustomerCode=data.customer.customer_code;
    if(data.subscription_code)updates.paystackSubscriptionCode=data.subscription_code;
    if(plan)updates.plan=plan;
    if(interval)updates.planInterval=interval;

    if(event.event==='subscription.create'){
      updates.subscriptionStatus='active';
      if(nextDate&&!Number.isNaN(nextDate.getTime()))updates.subscriptionEndsAt=admin.firestore.Timestamp.fromDate(nextDate);
      await customerRef.set(updates,{merge:true});
    }else if(event.event==='charge.success'){
      if(metadata.flow==='trial_tokenization'){
        if(reference)await db.collection('subscriptionPayments').doc(reference).set({status:'tokenization_charged',providerEvent:event.event,providerTransactionId:data.id||null,authorization:data.authorization||null,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      }else{
        updates.subscriptionStatus='active';
        let endTs=null;
        if(nextDate&&!Number.isNaN(nextDate.getTime()))endTs=admin.firestore.Timestamp.fromDate(nextDate);
        else{
          const code=data.subscription_code||current.paystackSubscriptionCode;
          if(code&&secret){try{const sr=await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(code)}`,{headers:{Authorization:`Bearer ${secret}`}});const sd=await sr.json().catch(()=>({}));const np=sd?.data?.next_payment_date;if(sr.ok&&np){const nd=new Date(np);if(!Number.isNaN(nd.getTime()))endTs=admin.firestore.Timestamp.fromDate(nd)}}catch(err){console.error('Subscription lookup failed',err)}}
          if(!endTs&&current.subscriptionEndsAt)endTs=current.subscriptionEndsAt;
        }
        if(endTs)updates.subscriptionEndsAt=endTs;
        await customerRef.set(updates,{merge:true});
        if(reference)await db.collection('subscriptionPayments').doc(reference).set({status:'verified',providerEvent:event.event,providerTransactionId:data.id||null,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      }
    }else if(event.event==='invoice.payment_failed'){
      await customerRef.set({...updates,subscriptionStatus:'past_due'},{merge:true});
    }else if(event.event==='subscription.not_renew'){
      await customerRef.set({...updates,subscriptionStatus:'non_renewing'},{merge:true});
    }else if(event.event==='subscription.disable'){
      await customerRef.set({...updates,subscriptionStatus:'cancelled',subscriptionEndsAt:nextDate&&!Number.isNaN(nextDate.getTime())?admin.firestore.Timestamp.fromDate(nextDate):current.subscriptionEndsAt||null},{merge:true});
    }
    return res.status(200).json({ok:true});
  }catch(e){console.error('Paystack webhook error',e);if(createdEventRef)await createdEventRef.delete().catch(()=>{});return res.status(500).json({ok:false});}
};

module.exports.config={api:{bodyParser:false}};
