import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { EMERGENCY_DEPARTMENT_NAME } from '@/lib/booking-constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emergencyPin, departmentId } = body;

    if (!emergencyPin || typeof emergencyPin !== 'string' || !emergencyPin.trim()) {
      return NextResponse.json(
        { success: false, message: 'رمز الاجتماع الطارئ مطلوب' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (!departmentId || typeof departmentId !== 'string' || !UUID_REGEX.test(departmentId)) {
      return NextResponse.json(
        { success: false, message: 'معرف الجهة غير صالح' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Verify Emergency PIN against the emergency system department
    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('pin_code')
      .eq('name', EMERGENCY_DEPARTMENT_NAME)
      .single();

    if (deptError || !dept || dept.pin_code !== emergencyPin.trim()) {
      return NextResponse.json(
        { success: false, message: 'رمز الاجتماع الطارئ غير صحيح' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // 2. Fetch active participants ONLY for the requested department
    // Strict column projection: id, name, phone ONLY (never select * and never return full phone)
    const { data: participants, error: pError } = await supabase
      .from('department_participants')
      .select('id, name, phone')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (pError) {
      console.error('[EmergencyParticipants API] Error fetching participants:', pError.message);
      return NextResponse.json(
        { success: false, message: 'حدث خطأ أثناء استرجاع المشاركين' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    // 3. Mask phone numbers: only last 4 digits (e.g. ****1234)
    // Full phone is NEVER returned to client
    const safeParticipants = (participants || []).map((p: any) => {
      const rawDigits = String(p.phone || '').replace(/\D/g, '');
      const last4 = rawDigits.length >= 4 ? rawDigits.slice(-4) : '0000';
      const maskedPhone = `****${last4}`;
      const name = p.name && typeof p.name === 'string' && p.name.trim()
        ? p.name.trim()
        : `مشارك (****${last4})`;

      return {
        id: p.id,
        name,
        maskedPhone,
      };
    });

    return NextResponse.json(
      {
        participants: safeParticipants,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    console.error('[EmergencyParticipants API] Unexpected error:', err);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ غير متوقع' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
