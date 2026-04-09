export type TimeSlot = {
  start: string; // "09:00"
  end: string;   // "11:00"
  status?: "available" | "booked";
};

export type Booking = {
  date: string;
  start: string;
  end: string;
};

export const START_TIMES = [
  "09:00",
  "10:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function addDuration(start: string, hours: number = 2): string {
  const [h, m] = start.split(":").map(Number);
  const date = new Date();
  date.setHours(h + hours, m);
  return date.toTimeString().slice(0, 5);
}

function buildSlots(): TimeSlot[] {
  return START_TIMES.map((start) => ({
    start,
    end: addDuration(start),
  }));
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
  bookings: Booking[]
) {
  const slots = buildSlots();
  const dayBookings = getBookingsForDay(date, bookings);

  return slots.map((slot) => {
    const booked = isSlotBooked(slot, dayBookings);

    return {
      ...slot,
      status: booked ? "booked" : "available",
    };
  });
}
