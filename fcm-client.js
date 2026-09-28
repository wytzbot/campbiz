/* CampBiz FCM client.
   Uses the public Firebase Web SDK config from firebase-config.js.
   The token endpoint must be implemented server-side before this is called.
*/
import { firebaseConfig, firebaseVapidKey } from "./firebase-config.js";

export async function enableCampusNotifications({ tokenEndpoint = "/api/fcm/token", authToken = "", schoolId = "", anonymousId = "" } = {}) {
  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId || !firebaseConfig?.messagingSenderId || !firebaseConfig?.appId) {
    throw new Error("Firebase web configuration is incomplete.");
  }
  if (!firebaseVapidKey) throw new Error("FCM Web Push VAPID key is missing.");
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("This browser does not support web notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js")
  ]);

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js", { scope: "./firebase-cloud-messaging-push-scope" });
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: firebaseVapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("FCM did not return a registration token.");

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({ token, schoolId, anonymousId })
  });
  if (!response.ok) throw new Error(`The notification token could not be registered (HTTP ${response.status}).`);
  return token;
}
