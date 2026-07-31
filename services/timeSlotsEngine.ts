export type TimeSlot = {
  start: string; // "09:00"
  end: string;   // "11:00"
  durationHours: 1 | 2;
  status?: "available" | "booked";
};

export type Booking = {
  date: string;
  start: string;
  end: string;
};

const WORK_PERIODS = [
  { start: "09:00", end: "12:00" },
  { start: "16:00", end: "22:00" },
];

export const DURATION_HOURS: Array<1 | 2> = [1, 2];

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addDuration(start: string, hours: 1 | 2): string {
  const [h, m] = start.split(":").map(Number);
  const date = new Date();
  date.setHours(h + hours, m);
  return date.toTimeString().slice(0, 5);
}

function buildSlots(durations: Array<1 | 2> = [2]): TimeSlot[] {
  return WORK_PERIODS.flatMap((period) => {
    const periodStart = timeToMinutes(period.start);
    const periodEnd = timeToMinutes(period.end);

    return durations.flatMap((durationHours) => {
      const durationMinutes = durationHours * 60;
      const slots: TimeSlot[] = [];

      for (
        let startMinutes = periodStart;
        startMinutes + durationMinutes <= periodEnd;
        startMinutes += 60
      ) {
        const start = minutesToTime(startMinutes);
        slots.push({
          start,
          end: addDuration(start, durationHours),
          durationHours,
        });
      }

      return slots;
    });
  });
}

function getBookingsForDay(date: string, bookings: Booking[]) {
  return bookings.filter((b) => b.date === date);
}

function isSlotBooked(slot: TimeSlot, bookings: Booking[]) {
  return bookings.some((b) => {
    return (
      slot.start < b.end &&
      slot.end > b.start
    );
  });
}

export function getAvailableSlots(
  date: string,
  bookings: Booking[],
  durations?: Array<1 | 2>
): TimeSlot[] {
  const slots = buildSlots(durations);
  const dayBookings = getBookingsForDay(date, bookings);

  return slots.map((slot) => {
    const booked = isSlotBooked(slot, dayBookings);

    return {
      ...slot,
      status: booked ? "booked" : "available",
    };
  });
}

export type ValidationResult = {
  valid: boolean;
  code?: string;
  message?: string;
};

export function validateBookingRules(date: string, startTime: string, endTime: string): ValidationResult {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  if (!dateRegex.test(date) || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { valid: false, code: 'INVALID_FORMAT', message: 'صيغة التاريخ أو الوقت غير صحيحة' };
  }

  const [year, month, day] = date.split('-').map(Number);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59 ||
      endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) {
    return { valid: false, code: 'INVALID_FORMAT', message: 'صيغة التاريخ أو الوقت غير صحيحة' };
  }

  const checkDate = new Date(year, month - 1, day);
  if (checkDate.getFullYear() !== year || checkDate.getMonth() !== month - 1 || checkDate.getDate() !== day) {
    return { valid: false, code: 'INVALID_FORMAT', message: 'صيغة التاريخ أو الوقت غير صحيحة' };
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return { valid: false, code: 'INVALID_DURATION', message: 'وقت نهاية الحجز يجب أن يكون بعد وقت البداية' };
  }

  const duration = endMinutes - startMinutes;
  if (duration !== 60 && duration !== 120) {
    return { valid: false, code: 'INVALID_DURATION', message: 'مدة الحجز يجب أن تكون 60 أو 120 دقيقة فقط' };
  }

  const isMorning = startMinutes >= timeToMinutes("09:00") && endMinutes <= timeToMinutes("12:00");
  const isEvening = startMinutes >= timeToMinutes("16:00") && endMinutes <= timeToMinutes("22:00");

  if (!isMorning && !isEvening) {
    return { valid: false, code: 'OUTSIDE_WORK_HOURS', message: 'الموعد خارج أوقات العمل أو يتجاوز فترة الاستراحة' };
  }

  // Check past date/time using Kuwait time
  const now = new Date();
  const kuwaitOffsetHours = 3;

  // Construct UTC time of the booking (subtract Kuwait offset)
  const bookingUtcTime = new Date(Date.UTC(year, month - 1, day, startHour - kuwaitOffsetHours, startMinute, 0, 0));

  if (bookingUtcTime.getTime() < now.getTime()) {
    return { valid: false, code: 'PAST_DATE', message: 'لا يمكن حجز موعد في الماضي' };
  }

  return { valid: true };
}
