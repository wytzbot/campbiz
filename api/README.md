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
