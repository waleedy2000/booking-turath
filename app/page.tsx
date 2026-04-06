'use client'

import { useState, useEffect, useRef } from 'react'

export default function Home() {

  const [date, setDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [department, setDepartment] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const cacheRef = useRef<Record<string, string[]>>({})

  // استدعاء API جلب الأوقات المحجوزة للتاريخ المحدد
  useEffect(() => {
    if (!date) {
      setBookedTimes([])
      return
    }

    if (cacheRef.current[date]) {
      setBookedTimes(cacheRef.current[date])
      return
    }

    const fetchBookedTimes = async () => {
      setLoadingTimes(true)
      try {
        const res = await fetch(`/api/bookings?date=${date}`)
        if (res.ok) {
          const data = await res.json()
          const times = data || []
          setBookedTimes(times)
          cacheRef.current[date] = times
        } else {
          console.error('Failed to fetch booked times')
          setBookedTimes([])
        }
      } catch (err) {
        console.error('Network error fetching booked times', err)
        setBookedTimes([])
      } finally {
        setLoadingTimes(false)
      }
    }

    fetchBookedTimes()
  }, [date])

  const times = [
    '3:00 م', '3:30 م', '4:00 م', '4:30 م',
    '5:00 م', '5:30 م', '6:00 م'
  ]

  return (
    <main className="min-h-screen bg-gray-50 p-6 font-[Cairo]">

      {/* العنوان */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#097834]">
          قاعة اجتماعات مبنى صباح الناصر
        </h1>
        <p className="text-[#1D1D1B] mt-2">
          جمعية إحياء التراث الإسلامي - مركز محافظة الفروانية
        </p>
      </div>

      {/* الكارد */}
      <div className="bg-white rounded-2xl shadow p-6 max-w-md mx-auto">

        {/* اختيار الجهة */}
        <select
          className="w-full p-3 border rounded-xl mb-3"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">اختر الجهة</option>
          <option>مجلس الإدارة</option>
          <option>الكلمة الطيبة</option>
          <option>الاستقطاعات</option>
          <option>المشاريع</option>
          <option>ضبط الجودة</option>
          <option>الإعلامية والتسويق</option>
          <option>الاستقبال</option>
          <option>مركز التحفيظ</option>
          <option>اللجنة العلمية</option>
          <option>النشء والشباب</option>
        </select>

        {/* رمز الجهة */}
        <input
          type="password"
          placeholder="رمز الجهة"
          className="w-full p-3 border rounded-xl mb-4"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />

        {/* التاريخ */}
        <input
          type="date"
          className="w-full p-3 border rounded-xl mb-4"
          min={new Date().toISOString().split('T')[0]}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* الأوقات */}
        <div className="grid grid-cols-3 gap-2">
          {times.map((t) => {
            const isBooked = bookedTimes.includes(t);
            return (
              <button
                key={t}
                disabled={isBooked || loadingTimes}
                type="button"
                onClick={() => !isBooked && setSelectedTime(t)}
                className={`p-2 rounded-xl transition-colors font-semibold ${
                  loadingTimes
                    ? 'bg-gray-100 text-gray-400 cursor-wait'
                    : isBooked
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed line-through decoration-gray-400'
                    : selectedTime === t
                    ? 'bg-[#097834] text-white shadow'
                    : 'bg-green-100 text-[#097834] hover:bg-green-200 cursor-pointer'
                }`}
              >
                {loadingTimes ? '...' : t}
              </button>
            );
          })}
        </div>

        {/* رسائل التنبيه */}
        {error && <div className="mb-4 text-red-600 text-sm font-semibold text-center">{error}</div>}
        {message && <div className="mb-4 text-[#097834] text-sm font-semibold text-center">{message}</div>}

        {/* زر الحجز */}
        <button
          disabled={isLoading}
          onClick={async () => {
            setError('')
            setMessage('')
            if (!department) return setError('اختر الجهة')
            if (!pin) return setError('أدخل رمز الجهة')
            if (!date) return setError('اختر التاريخ')
            if (!selectedTime) return setError('اختر الوقت')

            setIsLoading(true)
            try {
              const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  department,
                  pin,
                  date,
                  time: selectedTime
                })
              })
              
              const data = await res.json()
              
              if (!res.ok) {
                setError(data.error || 'حدث خطأ غير متوقع')
              } else {
                setMessage(data.message || 'تم تأكيد الحجز بنجاح!')
                
                // إضافة الوقت المحجوز إلى الكاش والتحديث المباشر
                const updatedTimes = [...(cacheRef.current[date] || []), selectedTime];
                cacheRef.current[date] = updatedTimes;
                setBookedTimes(updatedTimes);

                setTimeout(() => {
                  setMessage('')
                  setDepartment('')
                  setPin('')
                  setDate('')
                  setSelectedTime('')
                }, 3000)
              }

            } catch (err) {
              setError('عذراً، فشل الاتصال بالخادم')
            } finally {
              setIsLoading(false)
            }
          }}
          className={`mt-6 w-full text-white p-3 rounded-xl transition-colors ${
            isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#C7AC25] hover:bg-[#b59b1f]'
          }`}
        >
          {isLoading ? 'جاري تأكيد الحجز...' : 'احجز الآن'}
        </button>

      </div>

    </main>
  )
}