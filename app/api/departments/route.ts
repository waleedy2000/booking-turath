import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

export async function GET() {
  const { data, error } = await supabase.from('departments').select('name, phone').order('name');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { name, phone } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const { error } = await supabase
      .from('departments')
      .update({ phone: phone || null })
      .eq('name', name);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
