import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from "@/utils/supabase-admin";
const supabase = getSupabaseAdmin();

export async function GET() {
  try {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (error) {
      if (error.code === 'PGRST116') {
        // no rows returned
        return NextResponse.json({ 
          enable_confirmation: true, 
          enable_reminder: true, 
          reminder_minutes: 30,
          enable_notifications: true,
          enable_booking_notifications: true 
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? {});
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
    const { 
      enable_confirmation, 
      enable_reminder, 
      reminder_minutes,
      enable_notifications,
      enable_booking_notifications 
    } = body;

    const { data: existing } = await supabase.from('settings').select('id').limit(1).single();

    if (existing) {
      const { error } = await supabase
        .from('settings')
        .update({ 
          enable_confirmation, 
          enable_reminder, 
          reminder_minutes,
          enable_notifications,
          enable_booking_notifications 
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('settings')
        .insert([{ 
          enable_confirmation, 
          enable_reminder, 
          reminder_minutes,
          enable_notifications,
          enable_booking_notifications 
        }]);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
