import { sendToEntityDirect } from "@/lib/notification-service";
import { getSettings } from "@/lib/settings-service";
import { formatSingleTime } from "@/utils/timeFormat";

type EventType = "BOOKING_CREATED" | "BOOKING_REMINDER";

export async function dispatchEvent(event: {
  type: EventType;
  entity_id: string;
  payload?: { start_time?: string; [key: string]: unknown };
}) {
  switch (event.type) {
    case "BOOKING_CREATED":
      return handleBookingCreated(event);
    case "BOOKING_REMINDER":
      return handleBookingReminder(event);
  }
}

async function handleBookingCreated(event: {
  entity_id: string;
  payload?: { start_time?: string; [key: string]: unknown };
}) {
  const settings = await getSettings();

  // Control Layer - halt if disabled
  if (settings) {
    if (settings.enable_notifications === false) return;
    if (settings.enable_booking_notifications === false) return;
  }

  await sendToEntityDirect(
    event.entity_id,
    "حجز جديد",
    "تم تسجيل حجز جديد"
  );
}

async function handleBookingReminder(event: {
  entity_id: string;
  payload?: { start_time?: string; [key: string]: unknown };
}) {
  const settings = await getSettings();

  if (settings) {
    if (settings.enable_notifications === false) return;
    // اربطها مع نفس toggle التذكير 
    if (settings.enable_reminder === false) return;
  }

  const startTimeStr = event.payload?.start_time ? ` الساعة ${formatSingleTime(event.payload.start_time)}` : ' قريباً';

  await sendToEntityDirect(
    event.entity_id,
    "⏰ تذكير بالحجز",
    `لديك حجز${startTimeStr}`,
    "reminder"
  );
}
