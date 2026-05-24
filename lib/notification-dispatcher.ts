import { sendPushToPhones } from "@/lib/notification-service";
import { enqueueSms, processSmsQueue } from "@/lib/sms-service";
import { getParticipantPhones, normalizeKuwaitiPhone } from "@/lib/participant-service";
import { getSettings } from "@/lib/settings-service";
import { formatTo12Hour } from "@/utils/timeFormat";

type BookingCreatedEvent = {
  type: "BOOKING_CREATED";
  department_id: string;
  department_name: string;
  booking_contact_phone?: string;
  payload?: {
    formatted_date?: string;
    formatted_start?: string;
    formatted_end?: string;
    start_time?: string;
    [key: string]: unknown;
  };
};

type BookingReminderEvent = {
  type: "BOOKING_REMINDER";
  department_id: string;
  department_name?: string;
  payload?: {
    start_time?: string;
    formatted_date?: string;
    formatted_start?: string;
    reminder_minutes?: number;
    [key: string]: unknown;
  };
};

type EventType = BookingCreatedEvent | BookingReminderEvent;

export async function dispatchEvent(event: EventType) {
  switch (event.type) {
    case "BOOKING_CREATED":
      return handleBookingCreated(event);
    case "BOOKING_REMINDER":
      return handleBookingReminder(event);
  }
}

async function handleBookingCreated(event: BookingCreatedEvent) {
  const settings = await getSettings();

  if (settings) {
    if (settings.enable_notifications === false) return;
    if (settings.enable_booking_notifications === false) return;
  }

  const { department_id, booking_contact_phone, department_name } = event;

  // SMS confirmation is handled by booking_notification_events.
  if (booking_contact_phone) {
    await sendPushToPhones(
      [booking_contact_phone],
      "حجز جديد",
      "تم تسجيل حجز جديد",
      "booking",
      department_id
    );
  }

  const participantPhones = await getParticipantPhones(department_id);
  if (participantPhones.length > 0) {
    const contactPhone = normalizeKuwaitiPhone(booking_contact_phone);
    const otherPhones = participantPhones.filter((phone) => normalizeKuwaitiPhone(phone) !== contactPhone);
    if (otherPhones.length > 0) {
      await sendPushToPhones(
        otherPhones,
        "حجز جديد",
        `تم حجز القاعة من قبل ${department_name}`,
        "booking",
        department_id
      );
    }
  }
}

async function handleBookingReminder(event: BookingReminderEvent) {
  const settings = await getSettings();

  if (settings) {
    if (settings.enable_notifications === false) return;
    if (settings.enable_reminder === false) return;
  }

  const { department_id, payload } = event;
  const reminderMinutes = payload?.reminder_minutes || settings?.reminder_minutes || 30;
  const startTimeStr = payload?.start_time
    ? (() => { const f = formatTo12Hour(payload.start_time!); return ` الساعة ${f.time} ${f.period}`; })()
    : ' قريباً';

  const phones = await getParticipantPhones(department_id);

  if (phones.length === 0) {
    console.log(`[Dispatcher] No participants found for department ${department_id}`);
    return;
  }

  const reminderMsg = `⏰ تذكير بموعد اجتماع\n\nلديك اجتماع بعد ${reminderMinutes} دقيقة:\n\n📍 قاعة اجتماعات مبنى صباح الناصر\n📅 اليوم: ${payload?.formatted_date || ''}\n⏰ الوقت: ${payload?.formatted_start || ''}\n\nيرجى الحضور في الوقت المحدد.`;

  await enqueueSms(phones, reminderMsg, 'reminder', department_id);

  await sendPushToPhones(
    phones,
    "⏰ تذكير بالحجز",
    `لديك حجز${startTimeStr}`,
    "reminder",
    department_id
  );

  processSmsQueue().catch(err =>
    console.error("[Dispatcher] Background queue flush failed:", err)
  );
}
