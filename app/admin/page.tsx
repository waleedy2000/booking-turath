'use client'

import { useEffect, useState } from 'react'
import * as XLSX from "xlsx"
import toast, { Toaster } from 'react-hot-toast'
import { formatTimeRange, formatSingleTime } from '@/utils/timeFormat'
import Logo from '@/components/branding/Logo'

type Booking = {
  id: string
  department_name: string
  date: string
  start_time: string
  end_time: string
  time?: string
}

import { getAvailableSlots } from '@/services/timeSlotsEngine'

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '1234';

const times = [
  '3:00 م', '3:30 م', '4:00 م',
  '4:30 م', '5:00 م', '5:30 م', '6:00 م'
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  
  // Bookings State
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [searchEntity, setSearchEntity] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // Subscribers & Settings State
  const [activeTab, setActiveTab] = useState<'bookings' | 'subscribers'>('bookings')
  const [subscribers, setSubscribers] = useState<{id: string; name: string, phone: string}[]>([])
  const [newSubName, setNewSubName] = useState('')
  const [newSubPhone, setNewSubPhone] = useState('')
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0, recent: [] as any[] })
  const [settings, setSettings] = useState({ 
    enable_confirmation: true, 
    enable_reminder: true, 
    reminder_minutes: 30,
    enable_notifications: true,
    enable_booking_notifications: true 
  })
  const [departments, setDepartments] = useState<{name: string, phone: string | null}[]>([])
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [pushStats, setPushStats] = useState({ dailySent: 0, dailyFailed: 0, failureRate: 0 })
  const [triggeringReminders, setTriggeringReminders] = useState(false)

  // جلب الحجوزات
  const fetchBookings = async () => {
    setLoading(true)
    try {
      let url = '/api/bookings'

      if (selectedDate) {
        url += `?date=${selectedDate}`
      }

      const res = await fetch(url)
      const data = await res.json()

      setBookings(data || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchBookings()
  }, [selectedDate])

  const fetchSubscribers = async () => {
    setLoadingSubs(true)
    try {
      const res = await fetch('/api/subscribers')
      const data = await res.json()
      setSubscribers(Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []))

      const statsRes = await fetch('/api/queue-stats')
      const statsData = await statsRes.json()
      setQueueStats(statsData)
    } catch (err) {
      console.error(err)
    }
    setLoadingSubs(false)
  }

  const fetchSettingsAndDepts = async () => {
    setLoadingSettings(true)
    try {
      const [setRes, deptRes, statsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/departments'),
        fetch('/api/notification-stats')
      ]);
      const setData = await setRes.json();
      const deptData = await deptRes.json();
      const statsData = await statsRes.json();
      if (setData && !setData.error) setSettings(setData);
      if (deptData && Array.isArray(deptData)) setDepartments(deptData);
      if (statsData && !statsData.error) setPushStats(statsData);
    } catch(err) { console.error(err) }
    setLoadingSettings(false)
  }

  useEffect(() => {
    if (activeTab === 'subscribers') {
      fetchSubscribers()
      fetchSettingsAndDepts()
    }
  }, [activeTab])

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      toast.success('تم الحفظ');
    } catch (err) {
      toast.error('فشل التحديث');
    }
  }

  const updateDeptPhone = async (name: string, phone: string) => {
    const cleanPhone = phone.trim();
    if (cleanPhone && (!cleanPhone.startsWith('965') || cleanPhone.length < 11 || cleanPhone.length > 12)) {
      toast.error('الرقم يجب أن يبدأ بـ 965 ويكون 11 أو 12 رقم');
      // fetchSettingsAndDepts to reset the value visually
      fetchSettingsAndDepts();
      return;
    }

    try {
      await fetch('/api/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: cleanPhone })
      });
      toast.success('تم حفظ رقم الجهة');
      fetchSettingsAndDepts();
    } catch (err) {
      toast.error('فشل التحديث');
    }
  }

  const testSms = async (type: string) => {
    if (!newSubPhone) return toast.error('أدخل رقم جوال في حقل الإضافة بالأسفل لتجربة الرسائل، ثم اضغط زر التجربة');
    const loadId = toast.loading('جاري إجراء الاختبار...');
    try {
      await fetch('/api/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newSubPhone, type })
      });
      toast.success('تم وضع الرسالة التجريبية في الطابور وتشغيله', { id: loadId });
      fetchSubscribers(); // To refresh queue stats
    } catch (err) {
      toast.error('فشل في الإرسال', { id: loadId });
    }
  }

  const triggerReminders = async () => {
    setTriggeringReminders(true);
    const id = toast.loading('جاري فحص وإرسال التذكيرات...');
    try {
      const res = await fetch('/api/reminders');
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم بنجاح! معالجة ${data.processed} تذكيرات`, { id });
      } else {
        toast.error('فشل معالجة التذكيرات: ' + data.error, { id });
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالسيرفر', { id });
    }
    setTriggeringReminders(false);
  };

  const addSubscriber = async () => {
    if (!newSubPhone) return toast.error('الرقم مطلوب')
    const loadingToast = toast.loading('جاري الإضافة...')
    try {
      await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubName, phone: newSubPhone })
      })
      setNewSubName('')
      setNewSubPhone('')
      fetchSubscribers()
      toast.success('تمت الإضافة بنجاح', { id: loadingToast })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء الإضافة', { id: loadingToast })
    }
  }

  const deleteSubscriber = async (id: string) => {
    if (!confirm('تأكيد الحذف؟')) return
    const loadingToast = toast.loading('جاري الحذف...')
    try {
      await fetch('/api/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      fetchSubscribers()
      toast.success('تم الحذف بنجاح', { id: loadingToast })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء الحذف', { id: loadingToast })
    }
  }

  // حذف حجز
  const deleteBooking = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف الحجز؟')) return

    const loadingToast = toast.loading('جاري الحذف...')
    try {
      await fetch('/api/bookings', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })

      fetchBookings()
      toast.success('تم حذف الحجز بنجاح', { id: loadingToast })
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء الحذف', { id: loadingToast })
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center font-[Cairo] p-6">
        <Toaster position="bottom-center" />
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow max-w-md w-full text-center border dark:border-gray-800">
          <h1 className="text-2xl font-bold mb-6 text-[#097834]">دخول الإدارة</h1>
          <input
            type="password"
            placeholder="كلمة المرور"
            className="w-full p-3 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#097834] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (password === ADMIN_PASSWORD) {
                  setIsAuthenticated(true)
                  toast.success('تم تسجيل الدخول بنجاح')
                } else {
                  toast.error('كلمة المرور غير صحيحة')
                }
              }
            }}
          />
          <button
            onClick={() => {
              if (password === ADMIN_PASSWORD) {
                setIsAuthenticated(true)
                toast.success('تم تسجيل الدخول بنجاح')
              } else {
                toast.error('كلمة المرور غير صحيحة')
              }
            }}
            className="bg-[#097834] hover:bg-[#075f28] transition-colors !text-white px-4 py-3 rounded-xl w-full font-bold"
          >
            دخول
          </button>
        </div>
      </main>
    )
  }

  // فلترة الجهة
  const filteredBookings = bookings.filter(b => 
    b.department_name.toLowerCase().includes(searchEntity.toLowerCase())
  )

  const getStats = () => {
    if (!filteredBookings.length) return null

    // عدد الحجوزات
    const total = filteredBookings.length

    // أكثر جهة
    const deptCount: Record<string, number> = {}

    filteredBookings.forEach((b) => {
      deptCount[b.department_name] =
        (deptCount[b.department_name] || 0) + 1
    })

    const topDepartment = Object.entries(deptCount).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0]

    // أكثر وقت
    const timeCount: Record<string, number> = {}

    filteredBookings.forEach((b) => {
      const slotStart = b.start_time || b.time || '';
      timeCount[slotStart] = (timeCount[slotStart] || 0) + 1
    })

    const peakTime = Object.entries(timeCount).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0]

    // نسبة الإشغال
    const occupancy = Math.round((total / 7) * 100)

    return {
      total,
      topDepartment,
      peakTime,
      occupancy
    }
  }

  const stats = getStats()

  // تجهيز المتغيرات للـ Time Engine
  const engineBookings = filteredBookings.map((b: any) => ({
    id: b.id,
    date: b.date,
    start: b.start_time || b.start || b.time || '',
    end: b.end_time || b.end || (b.time ? String(Number(b.time.split(':')[0]) + 2).padStart(2, '0') + ':' + b.time.split(':')[1] : ''),
    entity: b.department_name
  }));

  const exportToExcel = () => {
    if (!engineBookings.length) return toast.error('لا توجد حجوزات للتصدير')
    
    setIsExporting(true)
    try {
      const data = engineBookings.map((b) => ({
        'التاريخ': b.date,
        'البداية': b.start,
        'النهاية': b.end,
        'الجهة': b.entity,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Bookings");

      XLSX.writeFile(wb, "bookings.xlsx");
      toast.success('تم تصدير الحجوزات بنجاح');
    } catch (err) {
      toast.error('حدث خطأ أثناء التصدير')
    }
    setIsExporting(false)
  }

  const slots = selectedDate ? getAvailableSlots(selectedDate, engineBookings) : [];

  return (
    <main className="p-6 max-w-3xl mx-auto font-[Cairo]">
      <Toaster position="bottom-center" />

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Logo variant="icon" priority className="w-10 h-10 object-contain" />
          <h1 className="font-semibold text-lg text-[#097834]">
            نظام الحجز
          </h1>
        </div>
        {activeTab === 'bookings' && (
          <button 
            onClick={exportToExcel}
            disabled={isExporting}
            className={`bg-[#097834] !text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all hover:bg-[#075f28] ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isExporting ? 'جاري التصدير...' : '📊 تصدير Excel'}
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex-1 p-3 rounded-xl font-bold transition-all duration-200 ${activeTab === 'bookings' ? 'bg-[#097834] !text-white shadow-md scale-105' : 'bg-green-50 text-[#097834] hover:bg-green-100'}`}
        >
          جدول الحجوزات
        </button>
        <button
          onClick={() => setActiveTab('subscribers')}
          className={`flex-1 p-3 rounded-xl font-bold transition-all duration-200 ${activeTab === 'subscribers' ? 'bg-[#097834] !text-white shadow-md scale-105' : 'bg-green-50 text-[#097834] hover:bg-green-100'}`}
        >
          أرقام الإشعارات (SMS)
        </button>
      </div>

      {activeTab === 'bookings' ? (
      <>
        {/* فلاتر */}
        <div className="flex gap-3 mb-4">
          <input
            type="date"
            className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#097834] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <input
            type="text"
            placeholder="بحث بالجهة..."
            value={searchEntity}
            onChange={(e) => setSearchEntity(e.target.value)}
            className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#097834] dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>

      {/* الإحصائيات الذكية */}
      {selectedDate && stats && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 mb-6">

          {/* نسبة الإشغال */}
          <div className={`p-4 rounded-xl text-center shadow-sm border ${
            stats.occupancy > 70 ? 'bg-red-50 border-red-200' :
            stats.occupancy > 40 ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <p className="text-sm text-gray-600 mb-1 font-semibold">الإشغال</p>
            <p className={`font-bold text-xl ${
              stats.occupancy > 70 ? 'text-red-700' :
              stats.occupancy > 40 ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {stats.occupancy}%
            </p>
          </div>

          {/* عدد الحجوزات */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-semibold">الحجوزات</p>
            <p className="font-bold text-xl text-gray-800 dark:text-gray-200">{stats.total}</p>
          </div>

          {/* أكثر جهة */}
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 shadow-sm text-center">
            <p className="text-sm text-gray-600 mb-1 font-semibold">أكثر جهة</p>
            <p className="font-bold text-lg text-purple-700 break-words line-clamp-1" title={stats.topDepartment || '-'}>
              {stats.topDepartment || '-'}
            </p>
          </div>

          {/* وقت الذروة */}
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 shadow-sm text-center">
            <p className="text-sm text-gray-600 mb-1 font-semibold">وقت الذروة</p>
            <p className="font-bold text-xl text-orange-700" dir="rtl">
              {stats.peakTime ? formatSingleTime(stats.peakTime) : '-'}
            </p>
          </div>

        </div>
      )}

      {/* قائمة */}
      {!selectedDate ? (
        <p className="text-center mt-6 text-gray-600 font-semibold bg-gray-100 p-4 rounded-xl">اختر تاريخاً لعرض الجدول اليومي</p>
      ) : loading ? (
        <p className="text-center text-gray-500 mt-6">جاري التحميل...</p>
      ) : (
        <div className="space-y-2 mt-6 transition-opacity duration-300 opacity-100">
          {slots.map((slot) => {
            const booking = engineBookings.find(
              (b) => slot.start < b.end && slot.end > b.start
            );

            return (
              <div
                key={slot.start}
                className={`p-4 rounded-xl flex justify-between items-center shadow-sm transition-all ${
                  booking
                    ? 'bg-[#fef2f2] dark:bg-red-950/30 border border-[#fecaca] dark:border-red-900/50'
                    : 'bg-[#f0fdf4] dark:bg-green-950/30 border border-[#bbf7d0] dark:border-green-900/50'
                }`}
              >
                {/* الوقت */}
                <span className="font-extrabold text-gray-800 dark:text-gray-200 text-lg" dir="rtl">
                  <span dir="rtl">{formatTimeRange(slot.start, slot.end)}</span>
                </span>

                {/* الحالة */}
                {booking ? (
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-red-900 bg-red-100 px-3 py-1 rounded-full">
                      ❌ محجوز ({booking.entity})
                    </span>

                    <button
                      onClick={() => deleteBooking(booking.id)}
                      className="bg-[#dc2626] !text-white hover:bg-red-700 border border-red-800 px-4 py-2 rounded-lg transition-colors font-bold text-sm shadow-sm"
                    >
                      إلغاء الحجز
                    </button>
                  </div>
                ) : (
                  <span className="!text-white text-sm font-bold bg-[#097834] px-4 py-1 rounded-full">✅ متاح</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      ) : (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mt-6 animate-fade-in">
          {/* Queue Monitor Dashboard */}
          <h2 className="text-xl font-bold mb-4 text-[#097834]">حالة إرسال الرسائل (Queue)</h2>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="p-4 rounded-xl text-center shadow-sm bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50">
              <p className="text-sm text-[#C7AC25] mb-1 font-semibold">بانتظار الإرسال</p>
              <p className="font-bold text-xl text-[#b89a20] dark:text-yellow-500">{queueStats.pending}</p>
            </div>
            <div className="p-4 rounded-xl text-center shadow-sm bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50">
              <p className="text-sm text-[#16a34a] mb-1 font-semibold">تم الإرسال</p>
              <p className="font-bold text-xl text-green-800 dark:text-green-500">{queueStats.sent}</p>
            </div>
            <div className="p-4 rounded-xl text-center shadow-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
              <p className="text-sm text-[#dc2626] mb-1 font-semibold">فشل</p>
              <p className="font-bold text-xl text-red-800 dark:text-red-500">{queueStats.failed}</p>
            </div>
          </div>

          {/* Detailed Queue Table */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 mb-8 max-h-56 overflow-y-auto custom-scrollbar text-sm">
            {queueStats.recent?.length > 0 ? (
              <table className="w-full text-right">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-bold w-1/4">النوع</th>
                    <th className="pb-2 font-bold w-1/4">الرقم</th>
                    <th className="pb-2 font-bold w-1/4">الحالة</th>
                    <th className="pb-2 font-bold w-1/4">وقت الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {queueStats.recent.map((msg: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-100 transition-colors">
                      <td className="py-2.5 font-semibold text-gray-700">
                        {msg.message_type === 'confirmation' ? '🟢 تأكيد' : msg.message_type === 'reminder' ? '🟡 تذكير' : '⚪ تجربة'}
                      </td>
                      <td className="py-2.5" dir="ltr">{msg.phone}</td>
                      <td className="py-2.5 font-bold">
                        {msg.status === 'sent' ? <span className="text-[#16a34a]">🟢 مرسل</span> : msg.status === 'failed' ? <span className="text-[#dc2626]">🔴 فشل</span> : <span className="text-[#C7AC25]">⏳ بانتظار</span>}
                      </td>
                      <td className="py-2.5 text-gray-500" dir="ltr">{new Date(msg.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-center font-semibold py-4">لا توجد رسائل حديثة في الطابور</p>
            )}
          </div>

          {/* Settings Section */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#097834]">إعدادات الإشعارات</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => testSms('confirmation')} className="bg-[#097834] hover:bg-[#065f2a] !text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-all hover:scale-105">🟢 اختبار تأكيد</button>
                <button type="button" onClick={() => testSms('reminder')} className="bg-[#C7AC25] hover:bg-[#b89a20] text-[#1D1D1B] px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-all hover:scale-105">🟡 اختبار تذكير</button>
              </div>
            </div>
            {loadingSettings ? <p className="text-sm text-gray-500">جاري التحميل...</p> : (
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.enable_confirmation} onChange={(e) => updateSetting('enable_confirmation', e.target.checked)} className="w-5 h-5 accent-[#097834]" />
                  <span className="font-bold">تفعيل رسائل SMS التأكيدية (للجهات)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.enable_reminder} onChange={(e) => updateSetting('enable_reminder', e.target.checked)} className="w-5 h-5 accent-[#097834]" />
                  <span className="font-bold">تفعيل رسائل SMS التذكيرية (للمنظمين)</span>
                </label>
                <div className="flex items-center gap-3 mb-6">
                  <span className="font-bold text-gray-700">التذكير قبل: </span>
                  <input type="number" min="5" value={settings.reminder_minutes} onChange={(e) => updateSetting('reminder_minutes', parseInt(e.target.value) || 30)} className="w-20 p-2 border border-gray-300 rounded-lg text-center focus:border-[#097834] focus:ring-1 focus:ring-[#097834] outline-none" />
                  <span className="font-bold text-gray-700">دقيقة</span>
                </div>

                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[#097834] text-lg">إشعارات التطبيق (Push Notifications)</h3>
                    <div className="flex gap-2">
                       <button 
                          type="button" 
                          disabled={triggeringReminders}
                          onClick={triggerReminders} 
                          className="bg-[#097834] hover:bg-[#065f2a] !text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                          {triggeringReminders ? '⏳ جاري التشغيل...' : '🔘 تشغيل التذكير الآن'}
                       </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4 bg-white px-3 py-2 rounded-lg shadow-sm w-fit border border-gray-200">
                      <span className="text-sm font-bold text-gray-500 ml-2">حالة النظام:</span>
                      {!settings.enable_notifications ? (
                        <><span className="text-xl">🔴</span><span className="font-bold text-sm text-red-600">النظام متوقف</span></>
                      ) : pushStats.failureRate > 20 ? (
                        <><span className="text-xl">🟡</span><span className="font-bold text-sm text-yellow-600">مشاكل جزئية ({pushStats.failureRate}%)</span></>
                      ) : (
                        <><span className="text-xl">🟢</span><span className="font-bold text-sm text-green-600">يعمل بكفاءة</span></>
                      )}
                  </div>

                  {/* Push Notifications Metrics Dashboard */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 rounded-lg text-center shadow-sm bg-white border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 font-semibold">رسائل التطبيق (اخر 24 ساعة)</p>
                      <p className="font-bold text-lg text-gray-800">{pushStats.dailySent}</p>
                    </div>
                    <div className="p-3 rounded-lg text-center shadow-sm bg-white border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 font-semibold">فشل في الإرسال</p>
                      <p className="font-bold text-lg text-red-500">{pushStats.dailyFailed}</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer mb-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100 transition-colors hover:border-[#097834]">
                    <input type="checkbox" checked={settings.enable_notifications} onChange={(e) => updateSetting('enable_notifications', e.target.checked)} className="w-5 h-5 accent-[#097834]" />
                    <span className="font-bold text-gray-800">التفعيل المركزي للإشعارات (Master Switch)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-lg shadow-sm border border-gray-100 transition-colors hover:border-[#097834]">
                    <input type="checkbox" checked={settings.enable_booking_notifications} onChange={(e) => updateSetting('enable_booking_notifications', e.target.checked)} className="w-5 h-5 accent-[#097834]" />
                    <span className="font-bold text-gray-800">تفعيل إشعارات حجز القاعات التلقائية</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Departments UI */}
          <h2 className="text-xl font-bold mb-4 text-[#097834]">أرقام الجهات (لاستقبال رسائل التأكيد)</h2>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-8 max-h-64 overflow-y-auto custom-scrollbar">
            {departments.map((dept, idx) => {
              const p = dept.phone || '';
              let statusIcon = '🔴'; // Empty
              if (p) {
                 if (p.startsWith('965') && (p.length === 11 || p.length === 12)) statusIcon = '🟢'; // Valid (Kuwait scale)
                 else statusIcon = '🟡'; // Invalid format
              }

              return (
              <div key={idx} className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2 last:border-0 last:pb-0 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                <span className="font-bold text-gray-800 w-1/3">{dept.name}</span>
                <div className="flex items-center justify-end w-2/3 gap-3">
                  <span className="text-xl" title={statusIcon === '🟢' ? 'مفعل' : statusIcon === '🔴' ? 'غير مضاف' : 'غير صالح'}>{statusIcon}</span>
                  <input 
                    type="text" 
                    defaultValue={dept.phone || ''} 
                    maxLength={12}
                    placeholder="رقم الهاتف (مثل: 965...)" 
                    className="p-2 border border-gray-300 rounded-lg text-sm text-left w-52 focus:border-[#097834] focus:ring-1 focus:ring-[#097834] outline-none transition-all"
                    dir="ltr"
                    onBlur={(e) => {
                      if (e.target.value !== dept.phone) {
                        updateDeptPhone(dept.name, e.target.value);
                      }
                    }} 
                  />
                </div>
              </div>
            )})}
          </div>

          <h2 className="text-xl font-bold mb-4 text-[#097834]">إضافة رقم للمنظمين (لتذكير المواعيد)</h2>
          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <input type="text" placeholder="الاسم (مثال: مدير المركز)" className="flex-1 p-3 border rounded-xl focus:outline-none focus:border-[#097834]" value={newSubName} onChange={e => setNewSubName(e.target.value)} />
            <input type="text" placeholder="رقم الجوال (مثال: 96512345678)" className="flex-1 p-3 border rounded-xl focus:outline-none focus:border-[#097834]" value={newSubPhone} onChange={e => setNewSubPhone(e.target.value)} />
            <button onClick={addSubscriber} className="bg-[#097834] !text-white px-6 py-3 rounded-xl font-bold hover:bg-[#075f28] transition-transform hover:scale-105">إضافة</button>
          </div>

          <h2 className="text-xl font-bold mb-4 text-[#097834]">الأرقام المشتركة</h2>
          {loadingSubs ? (
            <p className="text-center text-gray-500 py-6">جاري التحميل...</p>
          ) : subscribers.length === 0 ? (
             <p className="text-center text-gray-500 bg-gray-50 p-6 rounded-xl border border-gray-200">لا توجد أرقام مسجلة للإشعارات</p>
          ) : (
            <div className="space-y-3">
              {subscribers.map(sub => (
                <div key={sub.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <div>
                    <p className="font-bold text-gray-800 text-lg" dir="ltr">{sub.phone}</p>
                    <p className="text-sm text-gray-500">{sub.name || 'بدون اسم'}</p>
                  </div>
                  <button onClick={() => deleteSubscriber(sub.id)} className="bg-[#dc2626] hover:bg-red-700 !text-white px-4 py-2 rounded-lg text-sm font-bold transition-transform hover:scale-105 shadow-sm">حذف</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
