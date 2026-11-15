import { NextRequest, NextResponse } from 'next/server';
import { one } from '@/lib/db';
import { currentMember, currentPerson } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Photos are private: only members of the circle or its person-at-the-centre device may load them.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const [member, person] = await Promise.all([currentMember(), currentPerson()]);
  const circleIds = [member?.circle.id, person?.id].filter(Boolean);
  if (!circleIds.length) return new NextResponse('Not found', { status: 404 });
  const row = await one<{ bytes: Buffer; mime: string }>('select bytes, mime from photos where id = $1 and circle_id = any($2::uuid[])', [id, circleIds]);
  if (!row) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(row.bytes), { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=86400' } });
}
