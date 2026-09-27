const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON.');
    }
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error('Firebase Admin environment variables are not configured.');
    }
    serviceAccount = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const body = req.body || {};
    const bearer = req.headers.authorization || '';
    let uid = null;
    if (bearer.startsWith('Bearer ')) { try { uid = (await getAdminApp() && await admin.auth(getAdminApp()).verifyIdToken(bearer.slice(7))).uid; } catch {} }
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const schoolId = typeof body.schoolId === 'string' ? body.schoolId.trim() : '';
    const anonymousId = typeof body.anonymousId === 'string' ? body.anonymousId.trim() : '';

    if (!token || token.length < 20 || token.length > 4096) {
      return json(res, 400, { ok: false, error: 'A valid FCM registration token is required.' });
    }
    if (schoolId.length > 200 || anonymousId.length > 200) {
      return json(res, 400, { ok: false, error: 'Invalid notification metadata.' });
    }

    const app = getAdminApp();
    const db = admin.firestore(app);
    const tokenId = require('crypto').createHash('sha256').update(token).digest('hex');

    await db.collection('fcmTokens').doc(tokenId).set({
      token,
      schoolId: schoolId || null,
      anonymousId: anonymousId || null,
      uid,
      platform: 'web',
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true
    }, { merge: true });

    return json(res, 200, { ok: true, registered: true });
  } catch (error) {
    console.error('FCM token registration failed:', error);
    return json(res, 500, { ok: false, error: 'Notification registration is temporarily unavailable.' });
  }
};
