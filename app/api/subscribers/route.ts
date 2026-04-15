import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET() {
  const { data, error } = await supabase.from('subscribers').select('*');
  if (error) return NextResponse.json({ error: 'خطأ' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { name, phone } = await request.json();
  if (!phone) return NextResponse.json({ error: 'الرقم مطلوب' }, { status: 400 });
  
  const { error } = await supabase.from('subscribers').insert([{ name, phone }]);
  if (error) return NextResponse.json({ error: 'فشل الإضافة' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
  
  const { error } = await supabase.from('subscribers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 });
  return NextResponse.json({ success: true });
}
