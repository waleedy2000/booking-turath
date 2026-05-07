'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    if (!password) {
      toast.error('الرجاء إدخال كلمة المرور')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('تم تسجيل الدخول بنجاح')
        router.push('/admin')
        router.refresh()
      } else {
        toast.error(data.error || 'كلمة المرور غير صحيحة')
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء الاتصال بالخادم')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-[Cairo] p-6 bg-gray-50 dark:bg-[#0a0a0a]">
      <Toaster position="bottom-center" />
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border dark:border-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-[#097834]">دخول الإدارة</h1>
        <input
          type="password"
          placeholder="كلمة المرور"
          className="w-full p-3 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#097834] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin()
          }}
        />
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="bg-[#097834] hover:bg-[#075f28] transition-colors !text-white px-4 py-3 rounded-xl w-full font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'جاري التحقق...' : 'دخول'}
        </button>
      </div>
    </main>
  )
}
