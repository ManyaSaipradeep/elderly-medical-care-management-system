import { NextRequest, NextResponse } from 'next/server';
import { runTick } from '@/lib/tick';
import { safeEqual } from '@/lib/crypto';
import { log } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Called every 5 minutes by Cloud Scheduler / cron-job.org with header `x-cron-secret`.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const given = req.headers.get('x-cron-secret') || '';
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const sent = await runTick();
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    log('tick.failed', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
