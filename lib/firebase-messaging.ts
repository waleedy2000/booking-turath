"use client"

import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging"
import { app, firebaseConfig } from "./firebase"

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!

if (!VAPID_KEY) {
  throw new Error("VAPID key is missing")
}

export async function requestPermissionAndGetToken(phone?: string) {
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
    console.log('Foreground message (Data-Only):', payload)

    const data = payload.data || {}
    
    // In foreground, we show a manual notification
    new Notification(data.title || 'إشعار جديد', {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      tag: data.tag || 'default',
    })
  })

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  console.log("FCM Token:", token)

  if (token) {
    // Use phone from param or localStorage
    const userPhone = phone || localStorage.getItem("phone")

    if (userPhone) {
      // New: register device with phone + token
      await fetch("/api/register-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: userPhone,
          token,
        }),
      }).catch(console.error)
    } else {
      // Fallback: save token without user (backward compatibility)
      await fetch("/api/save-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      }).catch(console.error)
    }
  }

  return token
}