import { NextResponse } from 'next/server';

/** Return a private API response that must not be stored by shared or browser caches. */
export function privateJson<T>(body: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(body, { ...init, headers });
}
