"use client"

import { getMessaging, getToken, isSupported } from "firebase/messaging"
import { app, firebaseConfig } from "./firebase"

const VAPID_KEY = "BFb-a-WdLDEc7f9c0usHSaVT27odGy5V2eHSricq4Hr6XH3_go7oO3w4OuN7GKPuNTgk_r9QYpqg7vIBicQvtaE"

export async function requestPermissionAndGetToken() {
  console.log("API KEY:", firebaseConfig.apiKey)
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