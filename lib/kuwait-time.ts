/**
 * Centralized Kuwait Time & Date Helpers
 * Timezone authority: Asia/Kuwait (UTC+3)
 */

/**
 * Returns current date in Kuwait formatted as "YYYY-MM-DD"
 */
export function getKuwaitDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns current time in Kuwait formatted as "HH:mm" (24-hour format)
 */
export function getKuwaitTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Returns a JS Date object set to 00:00:00 local time representing today's date in Kuwait
 */
export function getKuwaitTodayDate(now: Date = new Date()): Date {
  const dateStr = getKuwaitDateString(now);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Checks if a slot (date "YYYY-MM-DD", startTime "HH:mm") has already started or passed in Kuwait time
 */
export function isSlotInPastForKuwait(date: string, startTime: string, now: Date = new Date()): boolean {
  if (!date || !startTime) return false;

  const todayKuwait = getKuwaitDateString(now);
  if (date < todayKuwait) return true;
  if (date > todayKuwait) return false;

  // Same date (today): slot is in the past if slot start time <= current Kuwait time
  const currentKuwaitTime = getKuwaitTimeString(now);
  return startTime <= currentKuwaitTime;
}
