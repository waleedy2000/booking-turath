import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

export async function GET() {
  try {
    const { data, error } = await supabase.from('subscribers').select('*');
    if (error) return NextResponse.json({ error: 'خطأ' }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone } = await request.json();
    if (!phone) return NextResponse.json({ error: 'الرقم مطلوب' }, { status: 400 });
    
    const { error } = await supabase.from('subscribers').insert([{ name, phone }]);
    if (error) return NextResponse.json({ error: 'فشل الإضافة' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    
    const { error } = await supabase.from('subscribers').delete().eq('id', id);
    if (error) return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
