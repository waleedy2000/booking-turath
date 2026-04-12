importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyDgFoIJL4kOc2HJ4dvJ2WSuGcc7M0Xeydk",
  authDomain: "booking-turath.firebaseapp.com",
  projectId: "booking-turath",
  storageBucket: "booking-turath.firebasestorage.app",
  messagingSenderId: "357011796124",
  appId: "1:357011796124:web:8069f20a7768e1b090bd59",
})

const messaging = firebase.messaging()

// استقبال الإشعارات في الخلفية
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload)

  const notificationTitle = payload.notification.title
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icons/icon-192.png",
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})