import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Availability probe for the deployment and its Supabase connection.
 * The response deliberately contains no credentials, user data, or database details.
 */
export async function GET() {
  try {
    const { error } = await createServiceClient()
      .from('profiles')
      .select('id', { head: true })
      .limit(1);

    if (error) throw error;

    return NextResponse.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
