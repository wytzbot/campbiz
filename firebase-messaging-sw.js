/* CampBiz FCM background worker.
   Public Firebase Web SDK values belong here as client configuration.
   NEVER put Firebase Admin credentials in this file. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"YOUR_FIREBASE_WEB_API_KEY",
  authDomain:"YOUR_PROJECT.firebaseapp.com",
  projectId:"YOUR_PROJECT_ID",
  storageBucket:"YOUR_PROJECT.firebasestorage.app",
  messagingSenderId:"YOUR_SENDER_ID",
  appId:"YOUR_APP_ID"
});

const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const title=payload?.notification?.title||"CampBiz";
  self.registration.showNotification(title,{
    body:payload?.notification?.body||"You have a new reminder.",
    icon:"/assets/icon-192.png",
    badge:"/assets/icon-192.png",
    data:payload?.data||{}
  });
});
