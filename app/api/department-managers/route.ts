import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { normalizeKuwaitiPhone } from "@/utils/phone";

const supabase = getSupabaseAdmin();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ error: 'department_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('department_managers')
      .select('*')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    const status = err?.message?.startsWith('Phone number') ? 400 : 500;
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { department_id, manager_name, manager_phone, role } = body;

    if (!department_id || !manager_phone) {
      return NextResponse.json({ error: 'department_id and manager_phone are required' }, { status: 400 });
    }

    const item = {
      department_id,
      manager_name: manager_name?.trim() || null,
      manager_phone: normalizeKuwaitiPhone(manager_phone),
      role: role?.trim() || 'manager',
      is_active: true,
    };

    const { data, error } = await supabase
      .from('department_managers')
      .upsert(item, { onConflict: 'department_id,manager_phone' })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    const status = err?.message?.startsWith('Phone number') ? 400 : 500;
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, manager_name, manager_phone, role, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (manager_name !== undefined) updateData.manager_name = manager_name?.trim() || null;
    if (manager_phone !== undefined) updateData.manager_phone = normalizeKuwaitiPhone(manager_phone);
    if (role !== undefined) updateData.role = role?.trim() || 'manager';
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

    const { data, error } = await supabase
      .from('department_managers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    const status = err?.message?.startsWith('Phone number') ? 400 : 500;
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status }
    );
  }
}
