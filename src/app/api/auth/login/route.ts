import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const COOKIE = 'gchq_token';

/**
 * `Secure` cookies are silently discarded by browsers on plain HTTP, which
 * logs the user straight back out. Only mark the cookie Secure when the site
 * is actually served over HTTPS (direct or behind a TLS proxy).
 */
function isHttps(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === 'https:' ||
    req.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https'
  );
}

function cookieOptions(req: NextRequest, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password || password.length < 6 || password.length > 128) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 400 });
  }

  // Forward the real client IP so backend rate limiting is per user, not per proxy
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 });
  }

  const data = await upstream.json().catch(() => ({ message: 'Login failed' }));
  if (!upstream.ok) {
    console.warn(`[auth] login failed for ${email} — upstream status ${upstream.status}`);
    return NextResponse.json(
      { message: Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Invalid credentials' },
      { status: upstream.status },
    );
  }

  // Never return the access token to the browser Network panel for the web app.
  // Token is stored only in an HttpOnly cookie (XSS-resistant).
  const res = NextResponse.json({
    user: data.user,
    expiresIn: data.expiresIn,
    tokenType: data.tokenType,
  });

  res.cookies.set(COOKIE, data.accessToken, cookieOptions(req, 8 * 60 * 60));
  return res;
}
