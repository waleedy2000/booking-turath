'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { getKuwaitDateString } from '@/lib/kuwait-time';
import { getAvailableSlots, TimeSlot } from '@/services/timeSlotsEngine';
import { formatTimeRange } from '@/utils/timeFormat';

dayjs.locale('ar');

type ManageableBooking = {
  id: string;
  department_name: string;
  department_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type DepartmentOption = {
  id?: string;
  name: string;
};

interface BookingManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments?: DepartmentOption[];
}

export default function BookingManagementModal({
  isOpen,
  onClose,
  departments = [],
}: BookingManagementModalProps) {
  const [mode, setMode] = useState<'regular' | 'emergency'>('regular');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [pin, setPin] = useState('');
  const [emergencyPin, setEmergencyPin] = useState('');
  const [participantPhone, setParticipantPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [bookings, setBookings] = useState<ManageableBooking[] | null>(null);
  const [editingBooking, setEditingBooking] = useState<ManageableBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<ManageableBooking | null>(null);

  // Reschedule state
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Reset errors/success messages on change
  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [mode, selectedDeptId, pin, emergencyPin, participantPhone]);

  // Fetch slots for reschedule date
  useEffect(() => {
    if (!isOpen || !editingBooking || !rescheduleDate) return;

    let isMounted = true;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await fetch(`/api/bookings?date=${rescheduleDate}`);
        const dayBookings = res.ok ? await res.json() : [];

        // Exclude the current booking to avoid self-conflict
        const otherBookings = (dayBookings || []).filter(
          (b: any) => b.id !== editingBooking.id
        );

        // Determine duration: 1 or 2 hours
        const [sh, sm] = editingBooking.start_time.split(':').map(Number);
        const [eh, em] = editingBooking.end_time.split(':').map(Number);
        const durationHours: 1 | 2 = (eh * 60 + em) - (sh * 60 + sm) > 60 ? 2 : 1;

        const slots = getAvailableSlots(
          rescheduleDate,
          otherBookings.map((b: any) => ({
            date: b.date,
            start: b.start_time || b.start,
            end: b.end_time || b.end,
          })),
          [durationHours],
          new Date()
        );

        if (isMounted) {
          setAvailableSlots(slots);
        }
      } catch (err) {
        console.error('Error fetching slots for reschedule:', err);
      } finally {
        if (isMounted) setLoadingSlots(false);
      }
    };

    fetchSlots();
    return () => {
      isMounted = false;
    };
  }, [isOpen, editingBooking, rescheduleDate]);

  // Handle closing modal
  const handleClose = () => {
    setBookings(null);
    setEditingBooking(null);
    setCancellingBooking(null);
    setPin('');
    setEmergencyPin('');
    setParticipantPhone('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  // 1. LOOKUP
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = { action: 'lookup', type: mode };
      if (mode === 'regular') {
        if (!selectedDeptId || !pin) {
          setErrorMsg('يرجى اختيار الجهة وإدخال رمز PIN');
          setIsLoading(false);
          return;
        }
        payload.departmentId = selectedDeptId;
        payload.pin = pin.trim();
      } else {
        if (!emergencyPin || !participantPhone) {
          setErrorMsg('يرجى إدخال رمز الاجتماع الطارئ ورقم هاتف المشارك');
          setIsLoading(false);
          return;
        }
        payload.emergencyPin = emergencyPin.trim();
        payload.participantPhone = participantPhone.trim();
      }

      const res = await fetch('/api/booking-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'تعذر التحقق من الحجز');
        setBookings(null);
      } else {
        setBookings(data.bookings || []);
      }
    } catch (err) {
      setErrorMsg('فشل الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. PREPARE RESCHEDULE
  const startReschedule = (booking: ManageableBooking) => {
    setEditingBooking(booking);
    setRescheduleDate(booking.date);
    setRescheduleSlot(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Execute Reschedule
  const handleConfirmReschedule = async () => {
    if (!editingBooking || !rescheduleSlot) {
      setErrorMsg('يرجى اختيار وقت جديد');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        action: 'reschedule',
        type: mode,
        bookingId: editingBooking.id,
        date: rescheduleDate,
        startTime: rescheduleSlot.start,
        endTime: rescheduleSlot.end,
      };

      if (mode === 'regular') {
        payload.departmentId = selectedDeptId;
        payload.pin = pin.trim();
      } else {
        payload.emergencyPin = emergencyPin.trim();
        payload.participantPhone = participantPhone.trim();
      }

      const res = await fetch('/api/booking-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'فشل تعديل موعد الحجز');
      } else {
        setSuccessMsg('تم تعديل موعد الحجز بنجاح');
        setEditingBooking(null);
        // Refresh bookings list
        handleLookup();
      }
    } catch (err) {
      setErrorMsg('فشل الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. CANCEL
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        action: 'cancel',
        type: mode,
        bookingId: cancellingBooking.id,
      };

      if (mode === 'regular') {
        payload.departmentId = selectedDeptId;
        payload.pin = pin.trim();
      } else {
        payload.emergencyPin = emergencyPin.trim();
        payload.participantPhone = participantPhone.trim();
      }

      const res = await fetch('/api/booking-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'فشل إلغاء الحجز');
      } else {
        setSuccessMsg('تم إلغاء الحجز بنجاح');
        setCancellingBooking(null);
        // Refresh bookings list
        handleLookup();
      }
    } catch (err) {
      setErrorMsg('فشل الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const todayStr = getKuwaitDateString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-[#097834] rounded-xl text-lg">
              ⚙️
            </span>
            <div>
              <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                إدارة حجز قائم
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                تعديل موعد الحجز أو إلغاؤه ذاتياً
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: AUTHENTICATION FORM                                              */}
        {/* ========================================================================= */}
        {bookings === null && !editingBooking && !cancellingBooking && (
          <div>
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setMode('regular')}
                className={`py-2 px-3 text-sm font-bold rounded-xl transition-all ${
                  mode === 'regular'
                    ? 'bg-white dark:bg-gray-900 text-[#097834] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🏢 حجز جهة
              </button>
              <button
                type="button"
                onClick={() => setMode('emergency')}
                className={`py-2 px-3 text-sm font-bold rounded-xl transition-all ${
                  mode === 'emergency'
                    ? 'bg-white dark:bg-gray-900 text-red-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🚨 اجتماع طارئ
              </button>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              {mode === 'regular' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      الجهة التابع لها
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#097834] focus:outline-none"
                    >
                      <option value="">اختر الجهة...</option>
                      {departments.map((dept) => (
                        <option key={dept.id || dept.name} value={dept.id || dept.name}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      رمز PIN الخاص بالجهة
                    </label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="أدخل رمز الـ PIN"
                      className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#097834] focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      رمز الاجتماع الطارئ
                    </label>
                    <input
                      type="password"
                      value={emergencyPin}
                      onChange={(e) => setEmergencyPin(e.target.value)}
                      placeholder="أدخل رمز الطوارئ"
                      className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-600 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      رقم هاتف مشارك مسجل بالاجتماع
                    </label>
                    <input
                      type="tel"
                      value={participantPhone}
                      onChange={(e) => setParticipantPhone(e.target.value)}
                      placeholder="مثال: 55963037 أو +965..."
                      className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-600 focus:outline-none text-left"
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#097834] hover:bg-[#07602a] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <span>عرض حجوزاتي</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: BOOKINGS LIST                                                     */}
        {/* ========================================================================= */}
        {bookings !== null && !editingBooking && !cancellingBooking && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">
                الحجوزات القادمة النشطة ({bookings.length})
              </span>
              <button
                type="button"
                onClick={() => setBookings(null)}
                className="text-xs font-bold text-[#097834] hover:underline"
              >
                تغيير الجهة / الرمز
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
                <p className="text-gray-600 dark:text-gray-400 font-bold mb-1">
                  لا توجد حجوزات نشطة قادمة
                </p>
                <p className="text-xs text-gray-400">
                  لم يتم العثور على أي مواعيد مستقبلية مطابقة لبيانات التحقق المدخلة
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-extrabold text-sm text-gray-900 dark:text-white block">
                          {b.department_name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{dayjs(b.date).format('DD / MM / YYYY')}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        مؤكد ✅
                      </span>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                        {formatTimeRange(b.start_time, b.end_time)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startReschedule(b)}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm"
                      >
                        تعديل الموعد ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancellingBooking(b)}
                        className="py-2 px-3 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold text-xs transition-colors"
                      >
                        إلغاء الحجز ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: RESCHEDULE VIEW                                                   */}
        {/* ========================================================================= */}
        {editingBooking && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <span className="font-bold text-sm text-gray-900 dark:text-white">
                تعديل موعد الحجز
              </span>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                إلغاء والتراجع
              </button>
            </div>

            {/* Current vs Proposed */}
            <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs space-y-1">
              <span className="text-gray-500 font-semibold block">الموعد الحالي:</span>
              <p className="font-extrabold text-gray-900 dark:text-white">
                📅 {dayjs(editingBooking.date).format('DD / MM / YYYY')} (
                {editingBooking.start_time} - {editingBooking.end_time})
              </p>
            </div>

            {/* Date selection */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                اختر التاريخ الجديد
              </label>
              <input
                type="date"
                min={todayStr}
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setRescheduleSlot(null);
                }}
                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#097834] focus:outline-none"
              />
            </div>

            {/* Slots selection */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                اختر الوقت الجديد
              </label>
              {loadingSlots ? (
                <div className="text-center py-4 text-xs text-gray-500 flex items-center justify-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري فحص الأوقات المتاحة...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  لا توجد فترات عمل متاحة في هذا اليوم
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {availableSlots.map((slot) => {
                    const isAvailable = slot.status === 'available';
                    const isSelected =
                      rescheduleSlot?.start === slot.start &&
                      rescheduleSlot?.end === slot.end;

                    return (
                      <button
                        key={`${slot.start}-${slot.end}`}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setRescheduleSlot(slot)}
                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-[#097834] text-white border-[#097834] shadow-sm'
                            : isAvailable
                            ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-[#097834]'
                            : 'bg-gray-100 dark:bg-gray-900 text-gray-400 border-gray-100 dark:border-gray-800 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1" dir="rtl">
                          <span>{slot.start}</span>
                          <span>-</span>
                          <span>{slot.end}</span>
                        </div>
                        <span className="text-[10px] block mt-0.5 opacity-80">
                          {isAvailable ? 'متاح' : 'محجوز'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={isLoading || !rescheduleSlot}
                className="flex-1 py-3 px-4 rounded-xl bg-[#097834] hover:bg-[#07602a] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>تأكيد تعديل الموعد</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 dark:text-gray-300 font-bold text-sm"
              >
                تراجع
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: CANCEL CONFIRMATION DIALOG                                        */}
        {/* ========================================================================= */}
        {cancellingBooking && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl text-center space-y-2">
              <span className="text-3xl block">⚠️</span>
              <h4 className="font-extrabold text-base text-red-900 dark:text-red-300">
                هل أنت متأكد من إلغاء هذا الحجز؟
              </h4>
              <p className="text-xs text-red-700 dark:text-red-400">
                سيتم إلغاء الحجز وتحرير وقت القاعة فوراً للجهات الأخرى
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">الجهة:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {cancellingBooking.department_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">التاريخ:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {dayjs(cancellingBooking.date).format('DD / MM / YYYY')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">الوقت:</span>
                <span className="font-bold text-gray-900 dark:text-white" dir="rtl">
                  {cancellingBooking.start_time} - {cancellingBooking.end_time}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>جاري الإلغاء...</span>
                  </>
                ) : (
                  <span>نعم، تأكيد إلغاء الحجز</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="py-3 px-4 rounded-xl border border-gray-300 text-gray-600 dark:text-gray-300 font-bold text-sm"
              >
                تراجع
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
