import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  if (!gatewayUrl) {
    console.warn("⚠️ SMS Gateway not configured");
    return NextResponse.json({ success: true, message: 'SMS Gateway not configured, simulation skipped.' }, { status: 200 });
  }

  const { data: messages, error } = await supabase
    .from('message_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20);

  if (error) {
    console.error("Queue fetch error:", error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json({ success: true, message: 'Queue is empty' });
  }

  const results = [];

  for (const msg of messages) {
    try {
      console.log(`Sending to: ${msg.phone}`);

      const res = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: msg.phone,
          message: msg.message,
        })
      });

      if (res.ok) {
        await supabase
          .from('message_queue')
          .update({ status: 'sent', attempts: msg.attempts + 1 })
          .eq('id', msg.id);
        
        console.log(`Status: Sent successfully`);
        results.push({ id: msg.id, status: 'sent' });
      } else {
        throw new Error(`Gateway returned status: ${res.status}`);
      }
    } catch (err) {
      console.error(`Failed to send SMS for msg ${msg.id}:`, err);
      console.log(`Status: Failed`);
      
      const newAttempts = msg.attempts + 1;
      const newStatus = newAttempts >= 3 ? 'failed' : 'pending';

      try {
        await supabase
          .from('message_queue')
          .update({
            attempts: newAttempts,
            status: newStatus,
          })
          .eq('id', msg.id);
      } catch (updateErr) {
        console.error("Failed to update status in DB:", updateErr);
      }
        
      results.push({ id: msg.id, status: newStatus });
    }

    // Rate Limiting (1000 ms) for mobile SMS gateways
    await new Promise((res) => setTimeout(res, 1000));
  }

  return NextResponse.json({ success: true, processed: messages.length, results });
}

// Allow GET mapping for easy manual Cron/Browser testing
export { POST as GET };
