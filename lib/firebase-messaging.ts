"use client"

import { getMessaging, getToken, isSupported } from "firebase/messaging"
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

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
  })

  console.log("FCM Token:", token)

  return token
}