import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const COOKIE = 'gchq_token';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const body = await req.text();
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  const userAgent = req.headers.get('user-agent');

  if (token) {
    try {
      await fetch(`${BACKEND}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
          ...(userAgent ? { 'User-Agent': userAgent } : {}),
        },
        body: body || '{}',
        cache: 'no-store',
      });
    } catch {
      // Best-effort server-side revoke
    }
  }

  const isHttps =
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';

  const res = NextResponse.json({ message: 'Logged out successfully' });
  res.cookies.set(COOKIE, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
