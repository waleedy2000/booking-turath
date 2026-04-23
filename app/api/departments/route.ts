import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
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
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, booking_contact_name, booking_contact_phone } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const updateData: any = {};
    if (phone !== undefined) updateData.phone = phone || null;
    if (booking_contact_name !== undefined) updateData.booking_contact_name = booking_contact_name || null;
    if (booking_contact_phone !== undefined) updateData.booking_contact_phone = booking_contact_phone || null;

    const { error } = await supabase
      .from('departments')
      .update(updateData)
      .eq('name', name);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
