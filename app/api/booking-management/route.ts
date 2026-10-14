import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { EMERGENCY_DEPARTMENT_NAME } from '@/lib/booking-constants';
import { normalizeKuwaitiPhone } from '@/lib/phone-utils';
import { isSlotInPastForKuwait } from '@/lib/kuwait-time';
import {
  executeBookingReschedule,
  executeBookingCancel,
  isActiveBookingForConflict
} from '@/services/bookingOperationsService';

function doesBookingBelongToDepartment(
  booking: { department_id?: string | null; department_name?: string | null },
  dept: { id: string; name: string }
): boolean {
  if (booking.department_id) {
    return booking.department_id === dept.id;
  }
  return booking.department_name === dept.name;
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  try {
    const body = await request.json();
    const { action, type = 'regular' } = body;

    if (!action || !['lookup', 'reschedule', 'cancel'].includes(action)) {
      return NextResponse.json({ success: false, message: 'الإجراء المطلوب غير صالح' }, { status: 400 });
    }

    const isEmergency = type === 'emergency';
    const now = new Date();

    // =========================================================================
    // 1. LOOKUP ACTION
    // =========================================================================
    if (action === 'lookup') {
      if (isEmergency) {
        const { emergencyPin, participantPhone } = body;
        if (!emergencyPin || !participantPhone) {
          return NextResponse.json(
            { success: false, message: 'يرجى إدخال رمز الاجتماع الطارئ ورقم هاتف المشارك' },
            { status: 400 }
          );
        }

        const normalizedPhone = normalizeKuwaitiPhone(participantPhone);
        if (!normalizedPhone) {
          return NextResponse.json(
            { success: false, message: 'رقم الهاتف غير صحيح' },
            { status: 400 }
          );
        }

        // Verify emergency department PIN
        const { data: dept, error: deptError } = await supabase
          .from('departments')
          .select('id, pin_code, name')
          .eq('name', EMERGENCY_DEPARTMENT_NAME)
          .single();

        if (deptError || !dept || dept.pin_code !== emergencyPin) {
          return NextResponse.json(
            { success: false, message: 'رمز الاجتماع الطارئ غير صحيح' },
            { status: 401 }
          );
        }

        // Find active future bookings for emergency
        const { data: allEmergencyBookings, error: bError } = await supabase
          .from('bookings')
          .select('id, department_name, department_id, date, start_time, end_time, status')
          .eq('department_name', EMERGENCY_DEPARTMENT_NAME)
          .order('date', { ascending: true });

        if (bError) {
          console.error('[BookingManagement lookup emergency error]:', bError);
          return NextResponse.json({ success: false, message: 'حدث خطأ أثناء استرجاع الحجوزات' }, { status: 500 });
        }

        const activeFuture = (allEmergencyBookings || []).filter((b: any) =>
          isActiveBookingForConflict(b) && !isSlotInPastForKuwait(b.date, b.start_time, now)
        );

        if (activeFuture.length === 0) {
          return NextResponse.json({ success: true, bookings: [] });
        }

        const candidateIds = activeFuture.map((b: any) => b.id);
        const { data: invitees, error: invError } = await supabase
          .from('booking_invitees')
          .select('booking_id')
          .eq('phone', normalizedPhone)
          .in('booking_id', candidateIds);

        if (invError) {
          console.error('[BookingManagement invitees lookup error]:', invError);
          return NextResponse.json({ success: false, message: 'حدث خطأ أثناء التحقق' }, { status: 500 });
        }

        const matchedIds = new Set((invitees || []).map((i: any) => i.booking_id));
        const matchedBookings = activeFuture
          .filter((b: any) => matchedIds.has(b.id))
          .map((b: any) => ({
            id: b.id,
            department_name: b.department_name,
            department_id: b.department_id,
            date: b.date,
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status || 'confirmed',
          }));

        return NextResponse.json({ success: true, bookings: matchedBookings });
      } else {
        // Regular Department Lookup
        const { departmentId, pin } = body;
        if (!departmentId || !pin) {
          return NextResponse.json(
            { success: false, message: 'يرجى اختيار الجهة وإدخال رمز PIN' },
            { status: 400 }
          );
        }

        // Query department by id or name
        let query = supabase.from('departments').select('id, pin_code, name');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId);
        if (isUuid) {
          query = query.eq('id', departmentId);
        } else {
          query = query.eq('name', departmentId);
        }

        const { data: dept, error: deptError } = await query.single();

        if (deptError || !dept || dept.pin_code !== pin) {
          return NextResponse.json(
            { success: false, message: 'رمز الجهة غير صحيح' },
            { status: 401 }
          );
        }

        // Fetch active future bookings for this department
        const { data: deptBookings, error: bError } = await supabase
          .from('bookings')
          .select('id, department_name, department_id, date, start_time, end_time, status')
          .eq('department_id', dept.id)
          .order('date', { ascending: true });

        if (bError) {
          console.error('[BookingManagement lookup regular error]:', bError);
          return NextResponse.json({ success: false, message: 'حدث خطأ أثناء استرجاع الحجوزات' }, { status: 500 });
        }

        const activeFuture = (deptBookings || [])
          .filter((b: any) =>
            isActiveBookingForConflict(b) && !isSlotInPastForKuwait(b.date, b.start_time, now)
          )
          .map((b: any) => ({
            id: b.id,
            department_name: b.department_name,
            department_id: b.department_id,
            date: b.date,
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status || 'confirmed',
          }));

        return NextResponse.json({ success: true, bookings: activeFuture });
      }
    }

    // =========================================================================
    // 2. RESCHEDULE ACTION
    // =========================================================================
    if (action === 'reschedule') {
      const { bookingId, date, startTime, endTime } = body;
      if (!bookingId || !date || !startTime || !endTime) {
        return NextResponse.json({ success: false, message: 'معلومات غير مكتملة' }, { status: 400 });
      }

      if (isEmergency) {
        const { emergencyPin, participantPhone } = body;
        if (!emergencyPin || !participantPhone) {
          return NextResponse.json({ success: false, message: 'بيانات التحقق غير مكتملة' }, { status: 400 });
        }

        const normalizedPhone = normalizeKuwaitiPhone(participantPhone);
        if (!normalizedPhone) {
          return NextResponse.json({ success: false, message: 'رقم الهاتف غير صحيح' }, { status: 400 });
        }

        // Verify emergency PIN
        const { data: dept, error: deptError } = await supabase
          .from('departments')
          .select('id, pin_code, name')
          .eq('name', EMERGENCY_DEPARTMENT_NAME)
          .single();

        if (deptError || !dept || dept.pin_code !== emergencyPin) {
          return NextResponse.json({ success: false, message: 'رمز الاجتماع الطارئ غير صحيح' }, { status: 401 });
        }

        // Verify booking belongs to emergency
        const { data: booking, error: bError } = await supabase
          .from('bookings')
          .select('id, department_name, department_id, date, start_time, status')
          .eq('id', bookingId)
          .single();

        if (bError || !booking || booking.department_name !== EMERGENCY_DEPARTMENT_NAME) {
          return NextResponse.json({ success: false, message: 'تعذر التحقق من الحجز' }, { status: 403 });
        }

        if (booking.status === 'cancelled') {
          return NextResponse.json({ success: false, message: 'هذا الحجز ملغى بالفعل' }, { status: 400 });
        }

        if (isSlotInPastForKuwait(booking.date, booking.start_time, now)) {
          return NextResponse.json({ success: false, message: 'لا يمكن تعديل موعد حجز قد فات وقته' }, { status: 400 });
        }

        // Verify phone belongs to invitees
        const { data: invitee, error: invError } = await supabase
          .from('booking_invitees')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (invError || !invitee) {
          return NextResponse.json({ success: false, message: 'تعذر التحقق من الحجز' }, { status: 403 });
        }

        const result = await executeBookingReschedule({
          bookingId,
          date,
          startTime,
          endTime,
          actorType: 'booking_owner'
        });

        return NextResponse.json({ success: result.success, message: result.message }, { status: result.status });
      } else {
        // Regular reschedule
        const { departmentId, pin } = body;
        if (!departmentId || !pin) {
          return NextResponse.json({ success: false, message: 'بيانات التحقق غير مكتملة' }, { status: 400 });
        }

        let query = supabase.from('departments').select('id, pin_code, name');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId);
        if (isUuid) {
          query = query.eq('id', departmentId);
        } else {
          query = query.eq('name', departmentId);
        }

        const { data: dept, error: deptError } = await query.single();
        if (deptError || !dept || dept.pin_code !== pin) {
          return NextResponse.json({ success: false, message: 'رمز الجهة غير صحيح' }, { status: 401 });
        }

        const { data: booking, error: bError } = await supabase
          .from('bookings')
          .select('id, department_id, department_name, date, start_time, status')
          .eq('id', bookingId)
          .single();

        if (bError || !booking || !doesBookingBelongToDepartment(booking, dept)) {
          return NextResponse.json({ success: false, message: 'تعذر التحقق من ملكية الحجز' }, { status: 403 });
        }

        if (booking.status === 'cancelled') {
          return NextResponse.json({ success: false, message: 'هذا الحجز ملغى بالفعل' }, { status: 400 });
        }

        if (isSlotInPastForKuwait(booking.date, booking.start_time, now)) {
          return NextResponse.json({ success: false, message: 'لا يمكن تعديل موعد حجز قد فات وقته' }, { status: 400 });
        }

        const result = await executeBookingReschedule({
          bookingId,
          date,
          startTime,
          endTime,
          actorType: 'booking_owner'
        });

        return NextResponse.json({ success: result.success, message: result.message }, { status: result.status });
      }
    }

    // =========================================================================
    // 3. CANCEL ACTION
    // =========================================================================
    if (action === 'cancel') {
      const { bookingId } = body;
      if (!bookingId) {
        return NextResponse.json({ success: false, message: 'معرف الحجز مطلوب' }, { status: 400 });
      }

      if (isEmergency) {
        const { emergencyPin, participantPhone } = body;
        if (!emergencyPin || !participantPhone) {
          return NextResponse.json({ success: false, message: 'بيانات التحقق غير مكتملة' }, { status: 400 });
        }

        const normalizedPhone = normalizeKuwaitiPhone(participantPhone);
        if (!normalizedPhone) {
          return NextResponse.json({ success: false, message: 'رقم الهاتف غير صحيح' }, { status: 400 });
        }

        // Verify emergency PIN
        const { data: dept, error: deptError } = await supabase
          .from('departments')
          .select('id, pin_code, name')
          .eq('name', EMERGENCY_DEPARTMENT_NAME)
          .single();

        if (deptError || !dept || dept.pin_code !== emergencyPin) {
          return NextResponse.json({ success: false, message: 'رمز الاجتماع الطارئ غير صحيح' }, { status: 401 });
        }

        // Verify booking belongs to emergency
        const { data: booking, error: bError } = await supabase
          .from('bookings')
          .select('id, department_name, department_id, date, start_time, status')
          .eq('id', bookingId)
          .single();

        if (bError || !booking || booking.department_name !== EMERGENCY_DEPARTMENT_NAME) {
          return NextResponse.json({ success: false, message: 'تعذر التحقق من الحجز' }, { status: 403 });
        }

        if (booking.status === 'cancelled') {
          return NextResponse.json({ success: false, message: 'هذا الحجز ملغى بالفعل' }, { status: 400 });
        }

        if (isSlotInPastForKuwait(booking.date, booking.start_time, now)) {
          return NextResponse.json({ success: false, message: 'لا يمكن إلغاء حجز قد فات وقته' }, { status: 400 });
        }

        // Verify phone belongs to invitees
        const { data: invitee, error: invError } = await supabase
          .from('booking_invitees')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (invError || !invitee) {
          return NextResponse.json({ success: false, message: 'تعذر التحقق من الحجز' }, { status: 403 });
        }

        const result = await executeBookingCancel({
          bookingId,
          actorType: 'booking_owner'
        });

        return NextResponse.json({ success: result.success, message: result.message }, { status: result.status });
      } else {
        // Regular cancel
        const { departmentId, pin } = body;
        if (!departmentId || !pin) {
          return NextResponse.json({ success: false, message: 'بيانات التحقق غير مكتملة' }, { status: 400 });
        }

        let query = supabase.from('departments').select('id, pin_code, name');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentId);
        if (isUuid) {
          query = query.eq('id', departmentId);
        } else {
          query = query.eq('name', departmentId);
        }

        const { data: dept, error: deptError } = await query.single();
        if (deptError || !dept || dept.pin_code !== pin) {
          return NextResponse.json({ success: false, message: 'رمز الجهة غير صحيح' }, { status: 401 });
        }

        const { data: booking, error: bError } = await supabase
          .from('bookings')
          .select('id, department_id, department_name, date, start_time, status')
          .eq('id', bookingId)
          .single();

        if (bError || !booking || !doesBookingBelongToDepartment(booking, dept)) {
          return NextResponse.json({ success: false, message: 'تعذر التحقق من ملكية الحجز' }, { status: 403 });
        }

        if (booking.status === 'cancelled') {
          return NextResponse.json({ success: false, message: 'هذا الحجز ملغى بالفعل' }, { status: 400 });
        }

        if (isSlotInPastForKuwait(booking.date, booking.start_time, now)) {
          return NextResponse.json({ success: false, message: 'لا يمكن إلغاء حجز قد فات وقته' }, { status: 400 });
        }

        const result = await executeBookingCancel({
          bookingId,
          actorType: 'booking_owner'
        });

        return NextResponse.json({ success: result.success, message: result.message }, { status: result.status });
      }
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    console.error('[BookingManagement fatal error]:', err);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ داخلي في الخادم' },
      { status: 500 }
    );
  }
}
