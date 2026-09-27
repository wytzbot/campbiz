# Secure production backend wiring

Required:
- Google-authenticated owner sessions
- Google Drive OAuth and file references
- Firebase/Firestore database
- Flutterwave subscription initialization + verified webhook
- FCM token registration and scheduled notifications

FCM flow:
1. Student explicitly grants browser notification permission.
2. Frontend obtains an FCM registration token.
3. Token is sent to `/api/fcm/token`.
4. Backend stores token + school + anonymous/session identifier + preferences.
5. Scheduled timer/deadline jobs send FCM notifications using Firebase Admin SDK.
6. `firebase-messaging-sw.js` receives background messages.

Never put Firebase Admin credentials, Google OAuth client secrets, or Flutterwave secret keys in the frontend.

## Flutterwave v4 card authorization
`POST /api/subscription/authorize` accepts an authenticated owner's `reference` and either:
- `{ "type":"pin", "nonce":"...", "encrypted_pin":"..." }` when the stored charge's `next_action.type` is `requires_pin`.
- `{ "type":"otp", "code":"123456" }` when the stored charge's `next_action.type` is `requires_otp`.

The endpoint checks ownership and the pending challenge before calling `PUT /charges/{charge_id}`. PINs must be encrypted client-side using Flutterwave's current card-encryption requirements; raw PINs are never accepted or stored. OTP is forwarded only to Flutterwave and is not persisted. Redirect/3DS challenges must be opened using the returned provider URL. This endpoint does not grant subscription entitlement; a separately implemented webhook/verification handler must do that.
