"use client"

import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging"
import { app, firebaseConfig } from "./firebase"

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!

if (!VAPID_KEY) {
  throw new Error("VAPID key is missing")
}

export async function requestPermissionAndGetToken() {
  console.log("API KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
  console.log("VAPID:", VAPID_KEY)

  const supported = await isSupported()

  if (!supported) {
    console.log("Messaging not supported")
    return null
  }

  const permission = await Notification.requestPermission()

  if (permission !== "granted") {
    console.log("Permission denied")
    return null
  }

  const messaging = getMessaging(app)

  // Listen for Foreground messages
  onMessage(messaging, (payload) => {
    console.log('Foreground message:', payload)

    new Notification(payload.notification?.title || payload.data?.title || 'إشعار', {
      body: payload.notification?.body || payload.data?.body,
      icon: '/icons/icon-192.png',
    })
  })

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  console.log("FCM Token:", token)

  if (token) {
    await fetch("/api/save-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }).catch(console.error)
  }

  return token
}