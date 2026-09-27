# Secure production backend wiring

Required:
- Google-authenticated owner sessions
- Google Drive OAuth and file references
- Firebase/Firestore database
- Paystack subscription initialization, verification and webhook
- FCM token registration and scheduled notifications

FCM flow:
1. Student explicitly grants browser notification permission.
2. Frontend obtains an FCM registration token.
3. Token is sent to `/api/fcm/token`.
4. Backend stores token + school + anonymous/session identifier + preferences.
5. Scheduled timer/deadline jobs send FCM notifications using Firebase Admin SDK.
6. `firebase-messaging-sw.js` receives background messages.

Never put Firebase Admin credentials, Google OAuth client secrets, or Paystack secret keys in the frontend.

## Paystack billing
`POST /api/subscription/authorize` accepts an authenticated owner's `reference` and either:
- `{ "type":"pin", "nonce":"...", "encrypted_pin":"..." }` when the stored charge's `next_action.type` is `requires_pin`.
- `{ "type":"otp", "code":"123456" }` when the stored charge's `next_action.type` is `requires_otp`.

Paystack handles the recurring plan after the initial successful checkout. The application grants Pro access only after server-side transaction verification or a trusted Paystack webhook.
