import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const COOKIE = 'gchq_token';

/** Restore the signed-in user in a new tab using the HttpOnly session cookie. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/auth/me`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }

  const data = await upstream.json().catch(() => ({ message: 'Unauthorized' }));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json(data);
}
