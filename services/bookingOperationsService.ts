import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { validateBookingRules } from "@/services/timeSlotsEngine";
import { rescheduleFinalReminders } from "@/lib/booking-notification-events";

export function isActiveBookingForConflict(booking: any): boolean {
  return booking.status === null || booking.status !== 'cancelled';
}

export type OperationActorType = 'admin' | 'booking_owner';

export type RescheduleParams = {
  bookingId: string;
  date: string;
  startTime: string;
  endTime: string;
  actorType: OperationActorType;
};

export type CancelParams = {
  bookingId: string;
  actorType: OperationActorType;
};

export type OperationResult = {
  success: boolean;
  status: number;
  message: string;
  data?: any;
};

/**
 * Shared core business logic for rescheduling a booking.
 * Used by Admin PUT /api/bookings and Owner /api/booking-management.
 */
export async function executeBookingReschedule(params: RescheduleParams): Promise<OperationResult> {
  const { bookingId, date, startTime, endTime, actorType } = params;
  const supabase = getSupabaseAdmin();

  if (!bookingId || !date || !startTime || !endTime) {
    return { success: false, status: 400, message: 'معلومات غير مكتملة' };
  }

  // 1. Validate booking time rules (includes Kuwait past date checks)
  const validation = validateBookingRules(date, startTime, endTime);
  if (!validation.valid) {
    return { success: false, status: 400, message: validation.message || 'بيانات الوقت غير صحيحة' };
  }

  // 2. Fetch current booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, status: 404, message: 'الحجز غير موجود' };
  }

  if (booking.status === 'cancelled') {
    return { success: false, status: 400, message: 'لا يمكن تعديل حجز ملغى' };
  }

  // 3. Conflict detection excluding current booking
  const { data: allExisting, error: checkError } = await supabase
    .from('bookings')
    .select('*')
    .eq('date', date)
    .neq('id', bookingId);

  if (checkError) {
    console.error('[bookingOperationsService] Error checking conflicts:', checkError.message);
    return { success: false, status: 500, message: 'حدث خطأ أثناء التحقق من المواعيد' };
  }

  const activeExisting = (allExisting as any[])?.filter(isActiveBookingForConflict) || [];
  const conflict = activeExisting.some((b: any) =>
    startTime < b.end_time && endTime > b.start_time
  );

  if (conflict) {
    return { success: false, status: 409, message: 'هذا الوقت محجوز بالفعل' };
  }

  // 4. Update booking
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      date,
      start_time: startTime,
      end_time: endTime,
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('[bookingOperationsService] Failed to update booking:', updateError.message);
    return { success: false, status: 500, message: 'فشل تعديل الحجز' };
  }

  // 5. Notification reminders rescheduling
  try {
    await rescheduleFinalReminders({
      id: booking.id,
      department_id: booking.department_id,
      department_name: booking.department_name,
      date,
      start_time: startTime,
      end_time: endTime,
    });
  } catch (evtErr: any) {
    console.error('[bookingOperationsService] Failed to reschedule final reminders:', evtErr);
    return { success: false, status: 500, message: 'تم تعديل الحجز ولكن فشلت إعادة جدولة التذكير' };
  }

  // 6. Audit log recording (non-blocking failure policy)
  try {
    const { error: auditError } = await supabase
      .from('booking_activity_log')
      .insert({
        booking_id: booking.id,
        action: 'rescheduled',
        actor_type: actorType,
        old_date: booking.date,
        old_start_time: booking.start_time,
        old_end_time: booking.end_time,
        new_date: date,
        new_start_time: startTime,
        new_end_time: endTime,
      });

    if (auditError) {
      console.error('[bookingOperationsService] Audit log insert warning (non-blocking):', auditError.message);
    }
  } catch (auditErr: any) {
    console.error('[bookingOperationsService] Failed to insert audit log (non-blocking):', auditErr);
  }

  return { success: true, status: 200, message: 'تم تعديل الحجز بنجاح' };
}

/**
 * Shared core business logic for soft-cancelling a booking.
 * Used by Admin DELETE /api/bookings and Owner /api/booking-management.
 */
export async function executeBookingCancel(params: CancelParams): Promise<OperationResult> {
  const { bookingId, actorType } = params;
  const supabase = getSupabaseAdmin();

  if (!bookingId) {
    return { success: false, status: 400, message: 'معرف الحجز مطلوب' };
  }

  // 1. Fetch current booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, status: 404, message: 'الحجز غير موجود' };
  }

  if (booking.status === 'cancelled') {
    return { success: false, status: 400, message: 'هذا الحجز ملغى بالفعل' };
  }

  // 2. Soft Cancel
  const { error: cancelError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (cancelError) {
    console.error('[bookingOperationsService] Failed to cancel booking:', cancelError.message);
    return { success: false, status: 500, message: 'فشل الإلغاء' };
  }

  // 3. Mark pending notification events as skipped
  try {
    const { error: skipError } = await supabase
      .from('booking_notification_events')
      .update({ status: 'skipped' })
      .eq('booking_id', bookingId)
      .eq('status', 'pending');

    if (skipError) {
      console.warn('[bookingOperationsService] Failed to skip pending notification events:', skipError.message);
    }
  } catch (skipErr: any) {
    console.warn('[bookingOperationsService] Notification events skip error:', skipErr);
  }

  // 4. Audit log recording (non-blocking failure policy)
  try {
    const { error: auditError } = await supabase
      .from('booking_activity_log')
      .insert({
        booking_id: booking.id,
        action: 'cancelled',
        actor_type: actorType,
        old_date: booking.date,
        old_start_time: booking.start_time,
        old_end_time: booking.end_time,
      });

    if (auditError) {
      console.error('[bookingOperationsService] Audit log insert warning (non-blocking):', auditError.message);
    }
  } catch (auditErr: any) {
    console.error('[bookingOperationsService] Failed to insert audit log (non-blocking):', auditErr);
  }

  return { success: true, status: 200, message: 'تم إلغاء الحجز بنجاح' };
}
