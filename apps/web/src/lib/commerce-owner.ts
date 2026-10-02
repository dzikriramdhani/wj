import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const guestCookieName = 'wj_guest_session';

export type CommerceOwner = {
  userId: string | null;
  guestSessionId: string | null;
  createdGuestSession: boolean;
};

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function getCommerceOwner(): Promise<CommerceOwner> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return { userId: user.id, guestSessionId: null, createdGuestSession: false };

  const cookieStore = await cookies();
  const current = cookieStore.get(guestCookieName)?.value;
  if (isUuid(current)) return { userId: null, guestSessionId: current!, createdGuestSession: false };
  return { userId: null, guestSessionId: randomUUID(), createdGuestSession: true };
}

export function attachGuestSession(response: NextResponse, owner: CommerceOwner) {
  if (owner.createdGuestSession && owner.guestSessionId) {
    response.cookies.set(guestCookieName, owner.guestSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export function hasGuestSession(value: string | undefined) {
  return isUuid(value);
}
