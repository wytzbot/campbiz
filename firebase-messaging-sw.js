/* CampBiz FCM background worker.
   Firebase Web SDK configuration is intentionally client-side.
   NEVER put Firebase Admin credentials/private keys in this file. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCvgBO17wI1sPDYkc3TFIosd2vZMjc6vPU",
  authDomain: "campbiz-da92e.firebaseapp.com",
  projectId: "campbiz-da92e",
  storageBucket: "campbiz-da92e.firebasestorage.app",
  messagingSenderId: "731727315087",
  appId: "1:731727315087:web:3b4068792dd2fcc800f0fa",
  measurementId: "G-J7SWN5WJF4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload?.notification?.title || "CampBiz";
  self.registration.showNotification(title, {
    body: payload?.notification?.body || "You have a new reminder.",
    icon: "/assets/icon-192.png",
    badge: "/assets/icon-192.png",
    data: payload?.data || {}
  });
});
