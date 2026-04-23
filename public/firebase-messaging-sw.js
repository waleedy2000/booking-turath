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
// ⚠️ IMPORTANT: With webpush.notification in the FCM payload, the browser
// auto-displays the notification. We must NOT call showNotification() here
// or the user will see the notification TWICE.
// This handler is kept for logging/debugging only.
messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Background message received:", payload)
  console.log("[firebase-messaging-sw.js] Browser will auto-display via webpush.notification")
  // Do NOT call self.registration.showNotification() here.
  // The browser handles display via the webpush.notification payload.
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()

  event.waitUntil(
    clients.openWindow("/")
  )
})