export function formatTo12Hour(timeStr: string) {
  if (!timeStr) return { time: '', period: '' };
  
  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  
  if (isNaN(hour)) return { time: timeStr, period: '' };
  
  const period = hour >= 12 ? 'م' : 'ص';
  
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'
  
  const hourFormatted = hour.toString().padStart(2, '0');
  
  return { time: `${hourFormatted}:${minuteStr}`, period };
}

export function formatTimeRange(start: string, end: string): string {
  const s = formatTo12Hour(start);
  const e = formatTo12Hour(end);
  return `${s.time} ${s.period} - ${e.time} ${e.period}`;
}

export function formatSingleTime(time: string): string {
  if (!time) return '';
  const t = formatTo12Hour(time);
  return t.period ? `${t.time} ${t.period}` : t.time;
}
