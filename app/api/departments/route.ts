import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
import { normalizeOptionalKuwaitiPhone } from "@/utils/phone";
const supabase = getSupabaseAdmin();

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, phone, booking_contact_name, booking_contact_phone')
      .order('name');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
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
    const { name, phone, booking_contact_name, booking_contact_phone } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const updateData: any = {};
    if (phone !== undefined) updateData.phone = normalizeOptionalKuwaitiPhone(phone);
    if (booking_contact_name !== undefined) updateData.booking_contact_name = booking_contact_name || null;
    if (booking_contact_phone !== undefined) updateData.booking_contact_phone = normalizeOptionalKuwaitiPhone(booking_contact_phone);

    const { error } = await supabase
      .from('departments')
      .update(updateData)
      .eq('name', name);

    if (error) throw error;

    return NextResponse.json({ success: true });
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
    const { name, pin_code, booking_contact_name, booking_contact_phone } = body;

    if (!name || !pin_code) {
      return NextResponse.json({ error: 'name and pin_code are required' }, { status: 400 });
    }

    const insertData = {
      name: String(name).trim(),
      pin_code: String(pin_code).trim(),
      booking_contact_name: booking_contact_name?.trim() || null,
      booking_contact_phone: normalizeOptionalKuwaitiPhone(booking_contact_phone),
    };

    const { data, error } = await supabase
      .from('departments')
      .insert(insertData)
      .select('id, name, phone, booking_contact_name, booking_contact_phone')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Department already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
