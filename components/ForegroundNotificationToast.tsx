'use client'

import { useEffect, useState, useCallback } from 'react'

type FcmToast = {
  id: number
  title: string
  body: string
  tag: string
}

let toastIdCounter = 0

/**
 * In-app toast banner for FCM foreground messages.
 * Listens for the `fcm-foreground` custom event dispatched by firebase-messaging.ts
 * and renders a slide-in banner at the top of the viewport.
 *
 * This component ensures the user always sees a visual notification even when
 * the browser suppresses system notifications in foreground PWA mode.
 */
export default function ForegroundNotificationToast() {
  const [toasts, setToasts] = useState<FcmToast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.title) return

      const id = ++toastIdCounter
      const toast: FcmToast = {
        id,
        title: detail.title,
        body: detail.body || '',
        tag: detail.tag || 'default',
      }

      setToasts((prev) => [...prev, toast])

      // Auto-dismiss after 6 seconds
      setTimeout(() => dismiss(id), 6000)
    }

    window.addEventListener('fcm-foreground', handler)
    return () => window.removeEventListener('fcm-foreground', handler)
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex flex-col items-center gap-2 pt-[max(12px,env(safe-area-inset-top))] px-3 pointer-events-none"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          dir="rtl"
          className="pointer-events-auto w-full max-w-md animate-slide-down bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden"
          onClick={() => dismiss(t.id)}
        >
          {/* Green accent bar */}
          <div className="h-1 bg-gradient-to-l from-[#097834] to-[#0d8f40]" />

          <div className="flex items-start gap-3 p-4">
            {/* Bell icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#097834]/10 dark:bg-[#097834]/20 flex items-center justify-center text-lg">
              🔔
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug">
                {t.title}
              </p>
              {t.body && (
                <p className="text-gray-600 dark:text-gray-400 text-xs mt-1 leading-relaxed">
                  {t.body}
                </p>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                dismiss(t.id)
              }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
