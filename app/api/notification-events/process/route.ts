import { NextResponse } from 'next/server';
import { ensureNotificationEventsForUpcomingBookings, processDueNotificationEvents } from '@/lib/booking-notification-events';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("[NotificationEventsProcessor] Unauthorized access attempt");
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const seeded = await ensureNotificationEventsForUpcomingBookings(20);
    const result = await processDueNotificationEvents({ limit: 20 });
    return NextResponse.json({ success: true, seeded, ...result });
  } catch (err: unknown) {
    console.error("[NotificationEventsProcessor] Fatal error:", err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export { GET as POST };
