import { ArrowLeft } from "lucide-react";

export function formatTo12Hour(timeStr: string) {
  if (!timeStr) return { time: '', period: '' };

  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);

  if (isNaN(hour)) return { time: timeStr, period: '' };

  const period = hour >= 12 ? 'م' : 'ص';

  hour = hour % 12;
  hour = hour ? hour : 12;

  const hourFormatted = hour.toString().padStart(2, '0');

  return { time: `${hourFormatted}:${minuteStr}`, period };
}

export function formatTimeRange(start: string, end: string) {
  const s = formatTo12Hour(start);
  const e = formatTo12Hour(end);

  return (
    <span className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-1.5 w-full" dir="rtl">
      <span className="flex items-center text-xl md:text-base">
        <span className="font-semibold">{s.time}</span>
        <span className="text-xs md:text-[10px] opacity-60 ms-[2px]">{s.period}</span>
      </span>
      <ArrowLeft className="w-6 h-6 md:w-4 md:h-4 mx-0.5 opacity-50 stroke-2 -rotate-90 md:rotate-0 flex-shrink-0" />
      <span className="flex items-center text-xl md:text-base">
        <span className="font-semibold">{e.time}</span>
        <span className="text-xs md:text-[10px] opacity-60 ms-[2px]">{e.period}</span>
      </span>
    </span>
  );
}

export function formatSingleTime(time: string) {
  if (!time) return null;
  const t = formatTo12Hour(time);

  return (
    <span className="inline-flex items-center" dir="rtl">
      <span className="font-semibold">{t.time}</span>
      {t.period && <span className="text-[10px] opacity-60 ms-[2px]">{t.period}</span>}
    </span>
  );
}
