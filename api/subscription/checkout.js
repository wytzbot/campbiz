const admin = require("firebase-admin");
const crypto = require("crypto");

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
    catch { throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON."); }
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY)
      throw new Error("Firebase Admin environment variables are not configured.");
    serviceAccount = { projectId:FIREBASE_PROJECT_ID, clientEmail:FIREBASE_CLIENT_EMAIL,
      privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n") };
  }
  return admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
}
function reply(res,status,body){res.setHeader("Cache-Control","no-store");return res.status(status).json(body);}
module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{ok:false,error:"Method not allowed."});}
  try{
    const authorization=req.headers.authorization||"";
    if(!authorization.startsWith("Bearer "))return reply(res,401,{ok:false,error:"Google sign-in is required."});
    const app=getAdminApp();
    const decoded=await admin.auth(app).verifyIdToken(authorization.slice(7));
    if(!decoded.uid)return reply(res,401,{ok:false,error:"Invalid sign-in token."});
    const secret=process.env.FLW_SECRET_KEY;
    const apiBase=(process.env.FLW_V4_API_BASE||"https://api.flutterwave.com").replace(/\/+$/,"");
    if(!secret)return reply(res,503,{ok:false,error:"Flutterwave v4 credentials are not configured."});
    if(!process.env.APP_URL)return reply(res,503,{ok:false,error:"APP_URL is not configured."});

    // V4 recurring charges require a v4 customer and a securely stored/tokenized payment method.
    // These IDs must be written by a trusted v4 payment-method setup flow, never supplied by the browser.
    const db=admin.firestore(app);
    const ownerSnap=await db.collection("billingCustomers").doc(decoded.uid).get();
    const billing=ownerSnap.exists?ownerSnap.data():null;
    if(!billing?.customerId||!billing?.paymentMethodId){
      return reply(res,409,{ok:false,code:"PAYMENT_METHOD_SETUP_REQUIRED",
        error:"Complete the secure Flutterwave v4 card setup before starting the annual subscription."});
    }
    const reference=("CBZ"+decoded.uid.replace(/[^a-zA-Z0-9]/g,"").slice(0,18)+Date.now().toString(36)).slice(0,42);
    const traceId=crypto.randomUUID();
    const idempotencyKey=crypto.randomUUID();
    const paymentRef=db.collection("subscriptionPayments").doc(reference);
    await paymentRef.create({
      uid:decoded.uid, reference, amount:11500, currency:"NGN",
      plan:"annual", status:"initiating", createdAt:admin.firestore.FieldValue.serverTimestamp(),
      provider:"flutterwave_v4"
    });
    const response=await fetch(`${apiBase}/charges`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${secret}`,
        "Content-Type":"application/json",
        "X-Trace-Id":traceId,
        "X-Idempotency-Key":idempotencyKey
      },
      body:JSON.stringify({
        amount:11500,
        currency:"NGN",
        reference,
        customer_id:billing.customerId,
        payment_method_id:billing.paymentMethodId,
          redirect_url:new URL("/?subscription=return",process.env.APP_URL).toString(),
        meta:{firebase_uid:decoded.uid,plan:"annual",billing_interval:"yearly"}
      })
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.status!=="success"){
      await paymentRef.set({status:"initiation_failed",providerMessage:String(result?.message||"provider_error").slice(0,200),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      console.error("Flutterwave v4 charge failed",response.status,result?.message||"unknown");
      return reply(res,502,{ok:false,error:"Flutterwave v4 could not initiate the charge. Please try again."});
    }
    const charge=result.data||{};
    const chargeStatus=String(charge.status||"pending").toLowerCase();
    await paymentRef.set({
      providerChargeId:charge.id||null,
      status:chargeStatus==="succeeded"?"awaiting_verification":chargeStatus,
      providerResponseStatus:chargeStatus,
      nextActionType:charge.next_action?.type||null,
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    // Never grant entitlement from charge initiation; verification/webhook must confirm amount, currency, reference and status.
    return reply(res,202,{ok:true,reference,status:chargeStatus,nextAction:charge.next_action?.type||null,redirectUrl:charge.next_action?.redirect_url?.url||null,
      message:chargeStatus==="failed"?"Payment failed. You have not been subscribed.":chargeStatus==="succeeded"?"Payment received; verifying securely before activating your plan.":"Payment is processing. Your plan activates only after verification."});
  }catch(error){
    console.error("V4 subscription charge error:",error);
    return reply(res,500,{ok:false,error:"Unable to start the v4 subscription charge."});
  }
};
