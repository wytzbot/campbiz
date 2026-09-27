const admin = require('firebase-admin');
const crypto = require('crypto');

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
    catch { throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON.'); }
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Error('Firebase Admin environment variables are not configured.');
    serviceAccount = { projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  }
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
function reply(res, status, body) { res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(body); }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(res, 405, { ok: false, error: 'Method not allowed.' }); }
  try {
    const bearer = req.headers.authorization || '';
    if (!bearer.startsWith('Bearer ')) return reply(res, 401, { ok: false, error: 'Google sign-in is required.' });
    const app = getAdminApp();
    const decoded = await admin.auth(app).verifyIdToken(bearer.slice(7));
    const { reference, type, pin, nonce, encrypted_pin, code } = req.body || {};
    if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(reference)) return reply(res, 400, { ok: false, error: 'Invalid payment reference.' });
    if (!['pin', 'otp'].includes(type)) return reply(res, 400, { ok: false, error: 'Unsupported authorization type.' });
    const db = admin.firestore(app);
    const ref = db.collection('subscriptionPayments').doc(reference);
    const snap = await ref.get();
    if (!snap.exists || snap.data().uid !== decoded.uid) return reply(res, 404, { ok: false, error: 'Payment was not found.' });
    const payment = snap.data();
    if (!payment.providerChargeId || !['requires_pin', 'requires_otp'].includes(payment.nextActionType)) return reply(res, 409, { ok: false, error: 'This payment is not awaiting PIN or OTP authorization.' });
    if (payment.nextActionType !== `requires_${type}`) return reply(res, 409, { ok: false, error: 'The requested authorization does not match the payment challenge.' });
    let authorization;
    if (type === 'pin') {
      if (typeof nonce !== 'string' || nonce.length < 8 || nonce.length > 128 || typeof encrypted_pin !== 'string' || encrypted_pin.length < 8 || encrypted_pin.length > 2048) return reply(res, 400, { ok: false, error: 'A valid encrypted PIN and nonce are required.' });
      authorization = { type: 'pin', pin: { nonce, encrypted_pin } };
    } else {
      if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) return reply(res, 400, { ok: false, error: 'Enter the OTP sent by your bank.' });
      authorization = { type: 'otp', otp: { code } };
    }
    const secret = process.env.FLW_SECRET_KEY;
    if (!secret) return reply(res, 503, { ok: false, error: 'Flutterwave v4 credentials are not configured.' });
    const base = (process.env.FLW_V4_API_BASE || 'https://api.flutterwave.com').replace(/\/+$/, '');
    const response = await fetch(`${base}/charges/${encodeURIComponent(payment.providerChargeId)}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', 'X-Trace-Id': crypto.randomUUID(), 'X-Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ authorization })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 'success') {
      console.error('Flutterwave authorization failed', response.status, result?.error?.code || result?.message || 'unknown');
      return reply(res, 502, { ok: false, error: 'Authorization could not be completed. Check the details and try again.' });
    }
    const charge = result.data || {};
    const next = charge.next_action || {};
    await ref.set({ status: String(charge.status || 'pending').toLowerCase(), nextActionType: next.type || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return reply(res, 200, { ok: true, reference, status: charge.status || 'pending', nextAction: next.type || null, redirectUrl: next.redirect_url?.url || null, message: 'Authorization submitted. Payment remains pending until independently verified.' });
  } catch (error) {
    console.error('V4 subscription authorization error:', error);
    return reply(res, 500, { ok: false, error: 'Unable to authorize this payment.' });
  }
};
