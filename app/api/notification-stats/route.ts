import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch yesterday's date
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // 2. Query total notifications in last 24h
    const { count: dailySent, error: statsError } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);
      
    // 3. Query total failed notifications in last 24h
    const { count: dailyFailed, error: failError } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['partial_failure', 'failed'])
      .gte('created_at', yesterday);

    if (statsError || failError) {
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    return NextResponse.json({
      dailySent: dailySent || 0,
      dailyFailed: dailyFailed || 0,
      failureRate: dailySent ? Math.round(((dailyFailed || 0) / dailySent) * 100) : 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
