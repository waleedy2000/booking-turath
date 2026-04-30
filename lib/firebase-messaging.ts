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

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

  // Listen for Foreground messages
  // In foreground, the browser does NOT auto-display notifications.
  // We must show them manually via the service worker registration.
  // NOTE: `new Notification()` silently fails in mobile PWA standalone mode.
  // Only `ServiceWorkerRegistration.showNotification()` works reliably.
  onMessage(messaging, (payload) => {
    console.log('[Foreground] Push message received:', payload)

    const title = payload.notification?.title || payload.data?.title || 'إشعار جديد'
    const body = payload.notification?.body || payload.data?.body || ''
    const tag = payload.data?.type || 'default'

    // 1) System notification via ServiceWorker (works in PWA standalone)
    if (registration?.showNotification) {
      registration.showNotification(title, {
        body,
        icon: '/branding/logo-white.svg',
        badge: '/branding/logo-white.svg',
        tag,
      }).catch((err: unknown) => {
        console.warn('[Foreground] showNotification failed:', err)
      })
    }

    // 2) In-app toast fallback via custom DOM event
    //    This ensures the user always sees something, even if
    //    the system notification is suppressed by the browser.
    window.dispatchEvent(
      new CustomEvent('fcm-foreground', {
        detail: { title, body, tag },
      })
    )
  })

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