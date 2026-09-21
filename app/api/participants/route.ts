import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { normalizeKuwaitiPhone } from "@/lib/phone-utils";

const supabase = getSupabaseAdmin();

// GET /api/participants?department_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id مطلوب' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('department_participants')
      .select('*')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Participants API] Error fetching participants:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/participants — add participant(s)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department_id, name, phone, participants } = body;

    // Bulk import mode
    if (Array.isArray(participants) && department_id) {
      // Map to deduplicate by normalized phone, keeping the latest non-empty name
      const phoneMap = new Map<string, { department_id: string; name: string | null; phone: string; is_active: boolean }>();

      for (const p of participants) {
        if (!p || typeof p !== 'object') continue;
        const rawPhone = String(p.phone || '').trim();
        if (!rawPhone) continue;

        const normalized = normalizeKuwaitiPhone(rawPhone);
        if (!normalized) {
          return NextResponse.json(
            { success: false, error: 'يحتوي الملف على رقم هاتف غير صالح، يجب أن تكون الأرقام كويتية (8 أرقام)' },
            { status: 400 }
          );
        }

        const trimmedName = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : null;
        const existing = phoneMap.get(normalized);

        phoneMap.set(normalized, {
          department_id,
          name: trimmedName || existing?.name || null,
          phone: normalized,
          is_active: true,
        });
      }

      const items = Array.from(phoneMap.values());
      if (items.length === 0) {
        return NextResponse.json({ success: false, error: 'لا توجد أرقام صالحة للاستيراد' }, { status: 400 });
      }

      // Upsert to handle duplicates gracefully
      const { error } = await supabase
        .from('department_participants')
        .upsert(items, { onConflict: 'department_id,phone' });

      if (error) {
        console.error('[Participants API] Error bulk upserting participants:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, imported: items.length });
    }

    // Single add mode
    if (!department_id || !phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ success: false, error: 'department_id و phone مطلوبين' }, { status: 400 });
    }

    const normalizedPhone = normalizeKuwaitiPhone(phone.trim());
    if (!normalizedPhone) {
      return NextResponse.json(
        { success: false, error: 'رقم الهاتف غير صالح، يجب أن يكون رقماً كويتياً (8 أرقام)' },
        { status: 400 }
      );
    }

    const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : null;

    const { error } = await supabase
      .from('department_participants')
      .upsert(
        { department_id, name: trimmedName, phone: normalizedPhone, is_active: true },
        { onConflict: 'department_id,phone' }
      );

    if (error) {
      console.error('[Participants API] Error upserting participant:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/participants — remove participant
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID مطلوب' }, { status: 400 });
    }

    const { error } = await supabase
      .from('department_participants')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Participants API] Error deleting participant:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
