import { NextResponse } from 'next/server';
import { processSmsQueue } from '@/lib/sms-service';

export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await processSmsQueue();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[ApiSendQueue] Handler error:", err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET mapping for easy manual Cron/Browser testing
export { POST as GET };
