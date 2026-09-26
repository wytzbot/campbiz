/* Optional FCM client. This remains inactive until public Firebase config is supplied. */
export async function enableCampusNotifications(firebaseConfig, vapidKey, tokenEndpoint, authToken){
  if(!firebaseConfig?.apiKey || !vapidKey || !tokenEndpoint) throw new Error('FCM configuration is incomplete.');
  if(!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('This browser does not support web notifications.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw new Error('Notification permission was not granted.');
  const [{initializeApp}, {getMessaging, getToken}] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js')
  ]);
  const app=initializeApp(firebaseConfig);
  const registration=await navigator.serviceWorker.register('./firebase-messaging-sw.js');
  const messaging=getMessaging(app);
  const token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:registration});
  if(!token) throw new Error('FCM did not return a registration token.');
  const response=await fetch(tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/json',...(authToken?{Authorization:`Bearer ${authToken}`}:{})},body:JSON.stringify({token})});
  if(!response.ok) throw new Error('The notification token could not be registered.');
  return token;
}
