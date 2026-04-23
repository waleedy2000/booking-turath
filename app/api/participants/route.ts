import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

// GET /api/participants?department_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ error: 'department_id مطلوب' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('department_participants')
      .select('*')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
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
      const items = participants
        .filter((p: any) => p.phone?.trim())
        .map((p: any) => ({
          department_id,
          name: p.name?.trim() || null,
          phone: p.phone.trim(),
          is_active: true,
        }));

      if (items.length === 0) {
        return NextResponse.json({ error: 'لا توجد أرقام صالحة' }, { status: 400 });
      }

      // Upsert to handle duplicates gracefully
      const { error } = await supabase
        .from('department_participants')
        .upsert(items, { onConflict: 'department_id,phone' });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, imported: items.length });
    }

    // Single add mode
    if (!department_id || !phone) {
      return NextResponse.json({ error: 'department_id و phone مطلوبين' }, { status: 400 });
    }

    const { error } = await supabase
      .from('department_participants')
      .upsert(
        { department_id, name: name?.trim() || null, phone: phone.trim(), is_active: true },
        { onConflict: 'department_id,phone' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/participants — remove participant
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    const { error } = await supabase
      .from('department_participants')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
