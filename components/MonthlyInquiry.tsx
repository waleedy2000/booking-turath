'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { ar } from "date-fns/locale";
import dayjs from "dayjs";
import { Booking, getDayStatus } from "@/services/availabilityEngine";
import { formatTo12Hour } from '@/utils/timeFormat';
import { ArrowLeft } from 'lucide-react';

export default function MonthlyInquiry() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthBookings, setMonthBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMonth = async () => {
      setLoading(true);
      const monthStr = dayjs(currentMonth).format('YYYY-MM');
      try {
        const res = await fetch(`/api/bookings?month=${monthStr}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setMonthBookings(data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonth();
  }, [currentMonth]);

  const capacityPerDay = 7;

  const selectedDateStr = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : null;
  const selectedDayBookings = monthBookings.filter(b => b.date === selectedDateStr).sort((a, b) => {
    const timeA = a.start_time || a.start || a.time || '';
    const timeB = b.start_time || b.start || b.time || '';
    return timeA > timeB ? 1 : -1;
  });

  return (
    <div className="mt-12 bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/50 p-6 md:p-8 max-w-md mx-auto border border-gray-100 dark:border-gray-800 transition-all duration-300">
      
      {/* لمسة احترافية ذهبية */}
      <div className="w-12 h-1 bg-[#c9a227] mx-auto mb-6 rounded-full"></div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[#097834]">استعلام حجوزات الشهر</h2>
        <p className="text-sm text-gray-500 mt-1">اضغط على أي يوم لمعرفة الأوقات المحجوزة</p>
      </div>

      {/* Calendar Section */}
      <div className="flex justify-center bg-[#f8f7f3] dark:bg-gray-800 p-4 rounded-xl border border-[#e6e2d8] dark:border-gray-700 mb-6 shadow-inner">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={(d) => d && setSelectedDate(d)}
          onMonthChange={setCurrentMonth}
          modifiers={{
            available: (d) => getDayStatus(d, monthBookings, capacityPerDay) === "available",
            partial: (d) => getDayStatus(d, monthBookings, capacityPerDay) === "partial",
            full: (d) => getDayStatus(d, monthBookings, capacityPerDay) === "full"
          }}
          components={{
            Chevron: (props: any) => 
              props.orientation === 'left' ? <span className="nav-arrow">‹</span> : <span className="nav-arrow">›</span>
          }}
          locale={ar}
          dir="rtl"
        />
      </div>

      {/* Selected Day Info Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-100 dark:border-gray-800 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            📅 <span>{selectedDate ? dayjs(selectedDate).format('DD / MM / YYYY') : 'اختر يوماً'}</span>
          </span>
          {selectedDate && selectedDayBookings.length > 0 && (
            <span className="text-xs px-2 py-1 font-bold bg-[#e6f2eb] dark:bg-[#1a3826] text-[#1f6f4a] dark:text-[#a3e6c2] rounded-lg">
              {selectedDayBookings.length} حجز
            </span>
          )}
        </h3>
        
        {loading && monthBookings.length === 0 ? (
           <p className="text-center text-gray-500 py-6 text-sm font-bold animate-pulse">جارٍ تحميل البيانات...</p>
        ) : selectedDate ? (
          selectedDayBookings.length > 0 ? (
            <div className="space-y-3">
              {selectedDayBookings.map((b, i) => {
                const startStr = b.start_time || b.start || b.time;
                const endStr = b.end_time || b.end || (b.time ? String(Number(b.time.split(':')[0]) + 2).padStart(2, '0') + ':' + b.time.split(':')[1] : '');
                
                const s = formatTo12Hour(startStr);
                const e = formatTo12Hour(endStr);

                return (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#f8f7f3] hover:bg-[#e6f2eb] dark:bg-gray-800 dark:hover:bg-[#1a3826] border border-[#e6e2d8] hover:border-[#1f6f4a] dark:border-gray-700 dark:hover:border-[#145c3a] transition-colors duration-200">
                    
                    {/* Time Format similar to time slots but slightly smaller */}
                    <div className="flex items-center justify-center gap-1.5 text-[#1f6f4a] dark:text-[#a3e6c2]" dir="rtl">
                      <div className="flex items-baseline">
                        <span className="font-bold text-[15px]">{s.time}</span>
                        <span className="text-[10px] opacity-70 ms-1">{s.period}</span>
                      </div>
                      <ArrowLeft className="w-3.5 h-3.5 mx-1 opacity-50 stroke-2" />
                      <div className="flex items-baseline">
                        <span className="font-bold text-[15px]">{e.time}</span>
                        <span className="text-[10px] opacity-70 ms-1">{e.period}</span>
                      </div>
                    </div>
                    
                    {b.department_name && (
                      <div className="flex justify-center sm:justify-end">
                        <span className="text-[11px] font-bold bg-white dark:bg-gray-900 px-2.5 py-1 rounded-md text-[#097834] shadow-sm border border-gray-100 dark:border-gray-800">
                          🏢 {b.department_name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-3">
               <span className="text-4xl opacity-20">🍃</span>
               <p className="text-sm font-bold">لا توجد حجوزات في هذا اليوم</p>
            </div>
          )
        ) : (
          <p className="text-center text-gray-500 py-6 text-sm font-bold">الرجاء اختيار تاريخ من التقويم</p>
        )}
      </div>
    </div>
  );
}
