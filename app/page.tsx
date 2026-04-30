'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ar } from "date-fns/locale"
import dayjs from 'dayjs'
import 'dayjs/locale/ar'
import { Booking } from '../services/availabilityEngine'
import { getAvailableSlots } from '../services/timeSlotsEngine'
import { formatTimeRange, formatSingleTime, formatTo12Hour } from '@/utils/timeFormat'
import Logo from '@/components/branding/Logo'
import Select from '@/components/ui/Select'
import usePWAInstall from '@/hooks/usePWAInstall'
import { app } from "@/lib/firebase"
import { requestPermissionAndGetToken } from "@/lib/firebase-messaging"
import ForegroundNotificationToast from "@/components/ForegroundNotificationToast"
import MonthlyInquiry from "@/components/MonthlyInquiry"

dayjs.locale('ar')

const BookingCalendar = dynamic(() => import('../components/BookingCalendar'), {
  ssr: false,
})

export default function Home() {
  console.log("Firebase connected:", app)

  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')

  useEffect(() => {
    const storedPhone = localStorage.getItem("phone")
    if (storedPhone) {
      requestPermissionAndGetToken(storedPhone)
    } else {
      setShowPhoneModal(true)
    }
  }, [])

  const router = useRouter()
  const [dateObj, setDateObj] = useState<Date | undefined>()
  const date = dateObj ? dayjs(dateObj).format('YYYY-MM-DD') : ''
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')
  const [isAutoSelected, setIsAutoSelected] = useState(false)
  const [department, setDepartment] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: React.ReactNode } | null>(null)
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [monthBookings, setMonthBookings] = useState<Booking[]>([])

  const { install, isInstallable, isIOS, isStandalone, installed, showInstallPrompt } = usePWAInstall()

  const showToast = (type: 'success' | 'error', message: React.ReactNode) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }
  const [loadingTimes, setLoadingTimes] = useState(false)
  const cacheRef = useRef<Record<string, string[]>>({})
  const calendarRef = useRef<HTMLDivElement>(null)

  const [isScrollingUp, setIsScrollingUp] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY
        if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
          setIsScrollingUp(false)
        } else if (currentScrollY < lastScrollY.current) {
          setIsScrollingUp(true)
        }
        lastScrollY.current = currentScrollY
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // إغلاق التقويم عند الضغط خارجه
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(e.target as Node)
      ) {
        setShowCalendar(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

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
          const times = Array.isArray(data) ? data.map((b: any) => typeof b === 'string' ? b : b.time) : []
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

  // Calendar Intelligence - جلب بيانات الشهر
  useEffect(() => {
    const fetchMonth = async () => {
      const monthStr = dayjs(currentMonth).format('YYYY-MM')
      try {
        const res = await fetch(`/api/bookings?month=${monthStr}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setMonthBookings(data)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchMonth()
  }, [currentMonth])

  const mappedBookings = monthBookings.map((b: any) => ({
    date: b.date,
    start: b.start || b.start_time || b.time || '',
    end: b.end || b.end_time || (b.time ? String(Number(b.time.split(':')[0]) + 2).padStart(2, '0') + ':' + b.time.split(':')[1] : '')
  }));

  const slots = getAvailableSlots(date, mappedBookings);

  useEffect(() => {
    if (date && !loadingTimes) {
      const activeSlot = slots.find(s => s.start === selectedTime);
      if (!selectedTime || (activeSlot && activeSlot.status === 'booked')) {
        const firstAvailable = slots.find(s => s.status === 'available');
        if (firstAvailable) {
          setSelectedTime(firstAvailable.start);
          setIsAutoSelected(true);
        } else {
          setSelectedTime('');
          setIsAutoSelected(false);
        }
      }
    }
  }, [date, monthBookings, loadingTimes])

  const isFormValid = department && pin && date && selectedTime

  return (
    <main className="min-h-screen p-6 font-[Cairo] pb-[max(100px,calc(100px+env(safe-area-inset-bottom)))]">

      {/* In-app foreground notification toast */}
      <ForegroundNotificationToast />

      {/* مودل طلب رقم الجوال لتفعيل الإشعارات */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 transition-opacity animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 text-center transform transition-transform scale-100">
            <h3 className="text-xl font-bold text-[#097834] mb-3">تفعيل الإشعارات 🔔</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
              يرجى إدخال رقم جوالك المرتبط بجهتك حتى تصلك إشعارات الحجز الخاصة بك.
            </p>
            <input
              type="tel"
              dir="ltr"
              placeholder="99999999"
              className="w-full p-4 border-2 border-gray-200 rounded-xl mb-4 text-center text-lg font-bold outline-none focus:border-[#097834] focus:ring-2 focus:ring-[#097834]/20 transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
            <button
              onClick={() => {
                let phone = phoneInput.trim();
                if (!phone) {
                  showToast('error', 'يرجى إدخال رقم الجوال');
                  return;
                }
                
                // التطبيع قبل الحفظ: إضافة +965 إذا لم تكن موجودة
                if (!phone.startsWith('+')) {
                  if (phone.startsWith('965')) {
                    phone = '+' + phone;
                  } else {
                    phone = '+965' + phone;
                  }
                }

                if (phone.length < 11) {
                  showToast('error', 'يرجى إدخال رقم صحيح');
                  return;
                }

                localStorage.setItem("phone", phone);
                setShowPhoneModal(false);
                requestPermissionAndGetToken(phone);
                showToast('success', 'تم حفظ الرقم وتفعيل الإشعارات');
              }}
              className="w-full bg-[#097834] hover:bg-[#075f28] !text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              حفظ وتفعيل
            </button>
            <button
              onClick={() => setShowPhoneModal(false)}
              className="w-full mt-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 font-semibold text-sm transition-colors py-2"
            >
              تخطي (لن تصلك إشعارات)
            </button>
          </div>
        </div>
      )}

      {/* العنوان */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="flex flex-col items-center justify-center">
          <Logo variant="white" priority className="h-20 w-auto object-contain hidden dark:block" />
          <Logo variant="full" priority className="h-20 w-auto object-contain dark:hidden" />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-bold text-[#097834] cursor-pointer select-none hover:opacity-90 transition-opacity"
            onDoubleClick={() => router.push('/admin')}
            title="قاعة الاجتماعات"
          >
            إدارة حجز قاعة مبنى صباح الناصر
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            حجز القاعة مع إشعارات
          </p>
        </div>
      </div>

      {/* لمسة احترافية ذهبية */}
      <div className="w-12 h-1 bg-[#c9a227] mx-auto my-6 rounded-full"></div>

      {/* الكارد */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/50 p-8 max-w-md mx-auto border border-gray-100 dark:border-gray-800 transition-all duration-300">

        {/* اختيار الجهة */}
        <Select
          value={department}
          onChange={setDepartment}
          placeholder="اختر الجهة"
          options={[
            { label: "مجلس الإدارة", value: "مجلس الإدارة" },
            { label: "الكلمة الطيبة", value: "الكلمة الطيبة" },
            { label: "الاستقطاعات", value: "الاستقطاعات" },
            { label: "المشاريع", value: "المشاريع" },
            { label: "ضبط الجودة", value: "ضبط الجودة" },
            { label: "الإعلامية والتسويق", value: "الإعلامية والتسويق" },
            { label: "الاستقبال", value: "الاستقبال" },
            { label: "مركز التحفيظ", value: "مركز التحفيظ" },
            { label: "اللجنة العلمية", value: "اللجنة العلمية" },
            { label: "النشء والشباب", value: "النشء والشباب" },
            { label: "الدعم الفني", value: "الدعم الفني" },
          ]}
        />

        {/* رمز الجهة */}
        <input
          type="password"
          placeholder="رمز الجهة"
          className="w-full p-3 border rounded-xl mb-4 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />

        {/* التاريخ */}
        <div ref={calendarRef} className="relative w-full mb-4 calendar-wrapper">
          <div
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center justify-between border rounded-xl p-3 cursor-pointer bg-white dark:bg-gray-800 dark:border-gray-700 group hover:border-[#097834] transition-colors shadow-sm"
          >
            <span className={`font-semibold transition-colors ${dateObj ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
              {dateObj ? dayjs(dateObj).format("YYYY / MM / DD") : "📅 اختر التاريخ"}
            </span>
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-[#097834] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>

          {/* التقويم */}
          {showCalendar && (
            <BookingCalendar
              dateObj={dateObj}
              setDateObj={setDateObj}
              setCurrentMonth={setCurrentMonth}
              setShowCalendar={setShowCalendar}
              monthBookings={monthBookings}
            />
          )}
        </div>

        {/* رسالة الازدحام الذكية */}
        {dateObj && monthBookings.filter(b => b.date === dayjs(dateObj).format('YYYY-MM-DD')).length >= 5 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4 text-sm font-bold flex items-center justify-center gap-2 animate-pulse">
            <span>⚠</span> <span>هذا اليوم مزدحم جدًّا والأوقات المتاحة محدودة</span>
          </div>
        )}

        {/* الأوقات */}
        <div className="grid grid-cols-2 md:flex md:flex-nowrap md:overflow-x-auto gap-3 pb-4 pt-1 md:snap-x md:snap-mandatory scroll-smooth direction-rtl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slots.map((slot) => {
            const isBooked = slot.status === "booked";
            return (
              <button
                key={slot.start}
                disabled={isBooked || loadingTimes}
                type="button"
                onClick={() => {
                  if (!isBooked) {
                    setSelectedTime(slot.start)
                    setIsAutoSelected(false)
                  }
                }}
                className={`time-btn w-full min-w-0 md:flex-shrink-0 md:w-[140px] md:snap-center py-4 md:py-3 px-3 md:px-4 min-h-[120px] md:min-h-[48px] ${loadingTimes
                  ? '!bg-gray-100 !text-gray-400 cursor-wait'
                  : isBooked
                    ? '!bg-gray-300 !text-gray-500 cursor-not-allowed !transform-none !shadow-none opacity-60'
                    : selectedTime === slot.start
                      ? 'active scale-105 shadow-md border-transparent'
                      : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200'
                  }`}
              >
                {loadingTimes ? '...' : <span dir="rtl">{formatTimeRange(slot.start, slot.end)}</span>}
              </button>
            );
          })}
        </div>

        {selectedTime && (
          <div className="mt-4 p-5 bg-[#f8f7f3] dark:bg-gray-800 border border-[#e6e2d8] dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-200 font-bold text-center shadow-sm transition-all duration-300 animate-fade-in">
            {date ? `📅 ${dayjs(date).format('DD / MM / YYYY')}` : "📅 اختر التاريخ"} — <span dir="rtl">⏰ {formatSingleTime(selectedTime)}</span> {department && `— 🏢 ${department}`}
            {isAutoSelected && (
              <p className="text-xs text-[#097834] mt-2 font-semibold">
                ✔ تم اختيار أقرب وقت متاح تلقائيًّا
              </p>
            )}
          </div>
        )}

        {/* زر الحجز */}
        <button
          disabled={isLoading || !isFormValid}
          onClick={async () => {
            setToast(null)
            if (!date) return showToast('error', 'الرجاء اختيار التاريخ')
            if (!selectedTime) return showToast('error', 'الرجاء اختيار الوقت')
            if (!department) return showToast('error', 'الرجاء اختيار الجهة')
            if (!pin) return showToast('error', 'الرجاء إدخال رمز التحقق')

            const activeSlot = slots.find(s => s.start === selectedTime);
            if (!activeSlot) return showToast('error', 'الرجاء اختيار وقت متاح');

            setIsLoading(true)
            try {
              const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  department,
                  pin,
                  date,
                  start: activeSlot.start,
                  end: activeSlot.end
                })
              })

              const data = await res.json()

              if (!res.ok) {
                showToast('error', data.message || data.error || 'حدث خطأ غير متوقع')
              } else {
                showToast('success', (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-base font-bold !text-white mb-1">تم حجز القاعة</p>
                    <div className="space-y-0.5 text-right" dir="rtl">
                      <p className="!text-white/90">التاريخ: {date ? dayjs(date).format('DD / MM / YYYY') : "التاريخ غير متوفر"}</p>
                      <p className="!text-white/90">الوقت: {(() => {
                        const s = formatTo12Hour(activeSlot.start);
                        const e = formatTo12Hour(activeSlot.end);
                        return `${s.time} ${s.period} - ${e.time} ${e.period}`;
                      })()}</p>
                      <p className="!text-white/90">الجهة: {department}</p>
                    </div>
                  </div>
                ))

                // إضافة الوقت المحجوز إلى الكاش والتحديث المباشر
                const newBooking = { date, start: activeSlot.start, end: activeSlot.end };
                setMonthBookings(prev => [...prev, newBooking]);

                // تفريغ الحقول المطلوبة مباشرة لتجنب تكرار الحجز
                setSelectedTime('');
                setPin('');
                setDateObj(undefined);
                setIsAutoSelected(false);
              }

            } catch (err) {
              showToast('error', 'عذراً، فشل الاتصال بالخادم')
            } finally {
              setIsLoading(false)
            }
          }}
          className={`book-btn mt-6 w-full !text-white p-4 rounded-xl font-semibold transition-all duration-300 ${isLoading || !isFormValid
            ? 'opacity-50 cursor-not-allowed bg-gray-400 !transform-none !shadow-none'
            : 'bg-gradient-to-r from-[#097834] to-[#0d8f40] shadow-md hover:scale-[1.02] active:scale-[0.98]'
            }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 !text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>جاري الحجز...</span>
            </div>
          ) : 'احجز الآن'}
        </button>

      </div>

      {/* Monthly Inquiry UI Section */}
      <MonthlyInquiry />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-[#097834] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-[#097834]">جارٍ المعالجة...</p>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-2xl font-bold !text-white transition-all duration-300 z-50 animate-bounce ${toast.type === 'success' ? 'bg-green-600 border-2 border-green-500' : 'bg-red-500 border-2 border-red-400'
            }`}
        >
          {toast.message}
        </div>
      )}

      {/* PWA Install Success Feedback */}
      {installed && (
        <div className="fixed bottom-6 right-6 z-[999] bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg border border-green-500 font-bold animate-bounce flex items-center gap-2">
          <span>🎉 تم تثبيت التطبيق بنجاح</span>
        </div>
      )}

      {/* PWA Install Button */}
      {!isStandalone && (isInstallable || isIOS) && showInstallPrompt && !installed && (
        <button
          type="button"
          onClick={() => {
            if (isIOS) {
              alert("لتثبيت التطبيق على الآيفون: اضغط زر المشاركة (Share) أسفل الشاشة ثم اختر Add to Home Screen.");
            } else {
              install();
            }
          }}
          className={`
            fixed bottom-6 right-4 md:bottom-8 md:right-8 z-[999]
            bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800
            dark:from-green-600 dark:to-green-700 dark:hover:from-green-500 dark:hover:to-green-600
            !text-white px-4 py-2.5 text-sm
            rounded-full shadow-lg hover:scale-105 hover:shadow-green-900/50
            transition-all duration-300 font-semibold flex items-center gap-2
            ${isScrollingUp ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}
          `}
          title="تثبيت التطبيق"
        >
          <svg className="w-4 h-4 !text-white stroke-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          <span className="!text-white">تثبيت التطبيق</span>
        </button>
      )}

    </main>
  )
}