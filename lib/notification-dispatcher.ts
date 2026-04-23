import { sendPushToPhones } from "@/lib/notification-service";
import { enqueueSms, processSmsQueue } from "@/lib/sms-service";
import { getParticipantPhones } from "@/lib/participant-service";
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

  // Control Layer - halt if disabled
  if (settings) {
    if (settings.enable_notifications === false) return;
    if (settings.enable_booking_notifications === false) return;
  }

  const { department_id, booking_contact_phone, department_name, payload } = event;

  // 1. SMS Confirmation to booking contact
  if (settings?.enable_confirmation !== false && booking_contact_phone) {
    const confMsg = `📢 تأكيد حجز قاعة الاجتماعات\n\nتم تسجيل الحجز بنجاح:\n\n📍 الموقع: قاعة اجتماعات مبنى صباح الناصر\n📅 التاريخ: ${payload?.formatted_date || ''}\n⏰ الوقت: ${payload?.formatted_start || ''} – ${payload?.formatted_end || ''}\n🏢 الجهة: ${department_name}\n\nنرجو الالتزام بالموعد المحدد.`;

    await enqueueSms(
      [booking_contact_phone],
      confMsg,
      'confirmation',
      department_id
    );

    // Flush immediately (fire-and-forget)
    processSmsQueue().catch(err =>
      console.error("[Dispatcher] Background queue flush failed:", err)
    );
  }

  // 2. Push notification to booking contact
  if (booking_contact_phone) {
    await sendPushToPhones(
      [booking_contact_phone],
      "حجز جديد",
      "تم تسجيل حجز جديد",
      "booking",
      department_id
    );
  }

  // 3. Also notify department participants via push (exclude contact to avoid dup)
  const participantPhones = await getParticipantPhones(department_id);
  if (participantPhones.length > 0) {
    const otherPhones = participantPhones.filter(p => p !== booking_contact_phone);
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

  // Get participants for this department (targeted, not broadcast)
  const phones = await getParticipantPhones(department_id);

  if (phones.length === 0) {
    console.log(`[Dispatcher] No participants found for department ${department_id}`);
    return;
  }

  // SMS reminder to participants
  const reminderMsg = `⏰ تذكير بموعد اجتماع\n\nلديك اجتماع بعد ${reminderMinutes} دقيقة:\n\n📍 قاعة اجتماعات مبنى صباح الناصر\n📅 اليوم: ${payload?.formatted_date || ''}\n⏰ الوقت: ${payload?.formatted_start || ''}\n\nيرجى الحضور في الوقت المحدد.`;

  await enqueueSms(phones, reminderMsg, 'reminder', department_id);

  // Push reminder to same participants
  await sendPushToPhones(
    phones,
    "⏰ تذكير بالحجز",
    `لديك حجز${startTimeStr}`,
    "reminder",
    department_id
  );

  // Flush queue
  processSmsQueue().catch(err =>
    console.error("[Dispatcher] Background queue flush failed:", err)
  );
}
