'use client';

import { useState, useEffect } from 'react';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { ar } from "date-fns/locale";
import { Booking, getDayStatus } from "../services/availabilityEngine";

interface BookingCalendarProps {
  dateObj: Date | undefined;
  setDateObj: (date: Date) => void;
  setCurrentMonth: (date: Date) => void;
  setShowCalendar: (show: boolean) => void;
  monthBookings: Booking[];
}

export default function BookingCalendar({ 
  dateObj, 
  setDateObj, 
  setCurrentMonth, 
  setShowCalendar,
  monthBookings 
}: BookingCalendarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDateNormalized = dateObj ? new Date(new Date(dateObj).setHours(0, 0, 0, 0)) : undefined;

  const capacityPerDay = 7;

  return (
    <div className="calendar-popup absolute mt-2 z-50 right-0 left-0 flex justify-center bg-white dark:bg-gray-900 shadow-2xl rounded-2xl overflow-hidden p-3 border border-gray-100 dark:border-gray-800">
      <DayPicker
        mode="single"
        selected={selectedDateNormalized}
        onSelect={(d) => {
          if (d) {
            setDateObj(d);
            setShowCalendar(false);
          }
        }}
        today={new Date()}
        onMonthChange={setCurrentMonth}
        disabled={(d) => d < today || getDayStatus(d, monthBookings, capacityPerDay) === "full"}
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
  );
}
