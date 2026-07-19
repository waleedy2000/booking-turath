import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { enqueueSms, processSmsQueue } from "@/lib/sms-service";
import { getBookingNotificationRecipients } from "@/lib/participant-service";
import { getSettings } from "@/lib/settings-service";
import { formatTo12Hour } from "@/utils/timeFormat";

type NotificationStage = 'confirmation' | 'early_reminder' | 'final_reminder';

type BookingForEvents = {
  id: string;
  department_id: string;
  department_name: string;
  date: string;
  start_time: string;
  end_time?: string;
};

type SmsQueueResult = {
  status: string;
};

const KUWAIT_OFFSET_HOURS = 3;
const PROCESS_LIMIT = 20;

function kuwaitLocalToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - KUWAIT_OFFSET_HOURS, minute, 0, 0));
}

function previousKuwaitDayAtEight(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 20 - KUWAIT_OFFSET_HOURS, 0, 0, 0));
}

function getKuwaitDateString(date: Date) {
  return new Date(date.getTime() + KUWAIT_OFFSET_HOURS * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
}

export function getMeetingStartAt(date: string, startTime: string): Date {
  return kuwaitLocalToUtc(date, startTime);
}

export function getEarlyReminderAt(date: string, startTime: string): Date {
  const meetingStartAt = getMeetingStartAt(date, startTime);
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));

  if (startMinutes < 12 * 60) {
    return previousKuwaitDayAtEight(date);
  }

  return new Date(meetingStartAt.getTime() - 5 * 60 * 60 * 1000);
}

function buildEventRows(booking: BookingForEvents, phones: string[], options: { includeConfirmation?: boolean } = {}) {
  const now = new Date();
  const includeConfirmation = options.includeConfirmation !== false;
  const meetingStartAt = getMeetingStartAt(booking.date, booking.start_time);
  const earlyScheduledAt = getEarlyReminderAt(booking.date, booking.start_time);
  const earlyExpiresAt = new Date(meetingStartAt.getTime() - 60 * 60 * 1000);
  const finalScheduledAt = new Date(meetingStartAt.getTime() - 30 * 60 * 1000);
  const finalExpiresAt = new Date(meetingStartAt.getTime() - 10 * 60 * 1000);

  return phones.flatMap((phone) => {
    const finalIsExpired = now > finalExpiresAt || now >= meetingStartAt;

    const rows = [
      includeConfirmation ? {
        booking_id: booking.id,
        department_id: booking.department_id,
        phone,
        channel: 'sms',
        stage: 'confirmation',
        scheduled_at: now.toISOString(),
        expires_at: meetingStartAt.toISOString(),
        status: now >= meetingStartAt ? 'expired' : 'pending',
      } : null,
      {
        booking_id: booking.id,
        department_id: booking.department_id,
        phone,
        channel: 'sms',
        stage: 'final_reminder',
        scheduled_at: finalScheduledAt.toISOString(),
        expires_at: finalExpiresAt.toISOString(),
        status: finalIsExpired ? 'expired' : 'pending',
        error: finalIsExpired ? 'final_reminder_expired_at_booking_creation' : null,
      },
    ];

    return rows.filter(Boolean);
  });
}

export async function createBookingNotificationEvents(booking: BookingForEvents, options: { includeConfirmation?: boolean } = {}) {
  const supabase = getSupabaseAdmin();
  const phones = await getBookingNotificationRecipients(booking.department_id);

  if (phones.length === 0) {
    console.log(`[BookingNotificationEvents] No recipients for booking ${booking.id}`);
    return { created: 0, recipients: 0 };
  }

  const rows = buildEventRows(booking, phones, options);
  const { data, error } = await supabase
    .from('booking_notification_events')
    .upsert(rows, { onConflict: 'booking_id,phone,channel,stage', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[BookingNotificationEvents] Failed to create events:', error);
    throw error;
  }

  return { created: data?.length || 0, recipients: phones.length };
}

export async function ensureNotificationEventsForUpcomingBookings(limit = 20) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const today = getKuwaitDateString(now);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, department_id, department_name, date, start_time, end_time')
    .gte('date', today)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[BookingNotificationEvents] Failed to fetch upcoming bookings:', error);
    throw error;
  }

  let seeded = 0;
  for (const booking of bookings || []) {
    if (!booking.department_id || getMeetingStartAt(booking.date, booking.start_time) <= now) {
      continue;
    }

    const { data: existing, error: existingError } = await supabase
      .from('booking_notification_events')
      .select('id')
      .eq('booking_id', booking.id)
      .limit(1);

    if (existingError) {
      console.error('[BookingNotificationEvents] Failed to check existing events:', existingError);
      continue;
    }

    if (!existing || existing.length === 0) {
      await createBookingNotificationEvents(booking, { includeConfirmation: false });
      seeded++;
    }
  }

  return { checked: bookings?.length || 0, seeded };
}

function formatBookingDate(date: string) {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function formatBookingTime(time: string) {
  const formatted = formatTo12Hour(time);
  return `${formatted.time} ${formatted.period}`;
}

function buildSmsMessage(stage: NotificationStage, booking: BookingForEvents) {
  const formattedDate = formatBookingDate(booking.date);
  const formattedStart = formatBookingTime(booking.start_time);
  const formattedEnd = booking.end_time ? formatBookingTime(booking.end_time) : '';

  if (stage === 'confirmation') {
    return `تأكيد حجز قاعة اجتماعات إحياء التراث - الفروانية\n\nتم الحجز بنجاح\n\nالموقع: مبنى صباح الناصر\nالتاريخ: ${formattedDate}\nالوقت: ${formattedStart}${formattedEnd ? ` - ${formattedEnd}` : ''}\nالجهة: ${booking.department_name}\n\nيشرفنا حضوركم`;
  }

  return `تذكير بموعد اجتماع\n\nلديك اجتماع بعد 30 دقيقة:\n\nقاعة اجتماعات مبنى صباح الناصر\nاليوم: ${formattedDate}\nالوقت: ${formattedStart}\n\nيشرفنا حضوركم`;
}

async function markEvent(id: string, status: 'sent' | 'failed' | 'expired' | 'skipped', fields: Record<string, unknown> = {}) {
  const supabase = getSupabaseAdmin();
  return supabase
    .from('booking_notification_events')
    .update({
      status,
      ...fields,
    })
    .eq('id', id);
}

function isFinalReminderWindowValid(now: Date, meetingStartAt: Date) {
  const earliest = new Date(meetingStartAt.getTime() - 35 * 60 * 1000);
  const latest = new Date(meetingStartAt.getTime() - 25 * 60 * 1000);
  return now >= earliest && now <= latest;
}

async function isStageEnabled(stage: NotificationStage) {
  const settings = await getSettings();
  if (settings?.enable_notifications === false) return false;
  if (stage === 'confirmation' && settings?.enable_confirmation === false) return false;
  if (stage !== 'confirmation' && settings?.enable_reminder === false) return false;
  return true;
}

export async function processDueNotificationEvents(options: { limit?: number; bookingId?: string; stage?: NotificationStage } = {}) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const limit = options.limit || PROCESS_LIMIT;

  let query = supabase
    .from('booking_notification_events')
    .select('*')
    .eq('status', 'pending')
    .eq('channel', 'sms')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (options.bookingId) query = query.eq('booking_id', options.bookingId);
  if (options.stage) query = query.eq('stage', options.stage);

  const { data: events, error } = await query;
  if (error) {
    console.error('[BookingNotificationEvents] Failed to fetch due events:', error);
    throw error;
  }

  const results = {
    found: events?.length || 0,
    sent: 0,
    failed: 0,
    expired: 0,
    skipped: 0,
  };

  for (const event of events || []) {
    const expiresAt = event.expires_at ? new Date(event.expires_at) : null;
    if (expiresAt && now > expiresAt) {
      await markEvent(event.id, 'expired', { error: 'event_expired_before_processing' });
      results.expired++;
      continue;
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, department_id, department_name, date, start_time, end_time')
      .eq('id', event.booking_id)
      .single();

    if (bookingError || !booking) {
      await markEvent(event.id, 'failed', { error: 'booking_not_found' });
      results.failed++;
      continue;
    }

    const meetingStartAt = getMeetingStartAt(booking.date, booking.start_time);
    if (now >= meetingStartAt) {
      await markEvent(event.id, 'expired', { error: 'meeting_already_started' });
      results.expired++;
      continue;
    }

    if (event.stage === 'final_reminder' && !isFinalReminderWindowValid(now, meetingStartAt)) {
      await markEvent(event.id, 'expired', { error: 'final_reminder_outside_grace_window' });
      results.expired++;
      continue;
    }

    const stage = event.stage as NotificationStage;
    if (!(await isStageEnabled(stage))) {
      await markEvent(event.id, 'skipped', { error: 'notification_stage_disabled' });
      results.skipped++;
      continue;
    }

    try {
      const message = buildSmsMessage(stage, booking);
      const queued = await enqueueSms([event.phone], message, stage, event.department_id || undefined, now.toISOString());
      if (queued.ids.length === 0) {
        await markEvent(event.id, 'skipped', { error: 'duplicate_sms_already_queued' });
        results.skipped++;
        continue;
      }
      const smsResult = await processSmsQueue({ ids: queued.ids });
      const failedSms = smsResult.results?.some((result: SmsQueueResult) => result.status !== 'sent');
      if (failedSms) {
        throw new Error('sms_queue_processing_failed');
      }
      await markEvent(event.id, 'sent', { sent_at: new Date().toISOString(), error: null });
      results.sent++;
    } catch (sendError: unknown) {
      console.error(`[BookingNotificationEvents] Failed to process event ${event.id}:`, sendError);
      const message = sendError instanceof Error ? sendError.message : 'sms_processing_failed';
      await markEvent(event.id, 'failed', { error: message });
      results.failed++;
    }
  }

  return results;
}
