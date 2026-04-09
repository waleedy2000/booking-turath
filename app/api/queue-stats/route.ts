import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('message_queue')
    .select('status');
    
  if (error) {
    return NextResponse.json({ pending: 0, sent: 0, failed: 0 });
  }

  const stats = { pending: 0, sent: 0, failed: 0 };
  for (const item of data || []) {
    if (item.status === 'pending') stats.pending++;
    else if (item.status === 'sent') stats.sent++;
    else if (item.status === 'failed') stats.failed++;
  }
  const { data: recent, error: recentErr } = await supabase
    .from('message_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ ...stats, recent: recent || [] });
}
