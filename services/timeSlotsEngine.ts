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
