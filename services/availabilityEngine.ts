export type Booking = {
  date: string;
  start?: string;
  end?: string;
  [key: string]: any; // Allow raw supabase payload
};

export type DayStatus = "available" | "partial" | "full";

export function getDayStatus(
  date: Date,
  bookings: Booking[],
  capacityPerDay: number
): DayStatus {
  const target = formatDate(date);

  const dayBookings = bookings.filter((b) => b.date === target);

  if (dayBookings.length === 0) {
    return "available";
  }

  if (dayBookings.length >= capacityPerDay) {
    return "full";
  }

  return "partial";
}

function formatDate(date: Date): string {
  const tempDate = new Date(date);
  tempDate.setMinutes(tempDate.getMinutes() - tempDate.getTimezoneOffset());
  return tempDate.toISOString().split("T")[0];
}

export function hasConflict(
  newBooking: Booking,
  existing: Booking[]
): boolean {
  const newStart = newBooking.start;
  const newEnd = newBooking.end;
  if (!newStart || !newEnd) return false;

  return existing.some((b) => {
    if (b.date !== newBooking.date) return false;
    if (!b.start || !b.end) return false;

    return (
      newStart < b.end &&
      newEnd > b.start
    );
  });
}
