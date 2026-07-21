import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const COOKIE = 'gchq_token';

const BLOCKED_PREFIXES = ['seed'];

async function proxy(req: NextRequest, params: { path: string[] }) {
  const segments = params.path || [];
  if (segments.some((s) => s.includes('..'))) {
    return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
  }
  if (BLOCKED_PREFIXES.includes(segments[0])) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    console.warn(`[proxy] 401 no session cookie — ${req.method} /${segments.join('/')}`);
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const search = req.nextUrl.search || '';
  const target = `${BACKEND}/${segments.join('/')}${search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Requested-With': 'XMLHttpRequest',
  };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (clientIp) headers['X-Forwarded-For'] = clientIp;
  const userAgent = req.headers.get('user-agent');
  if (userAgent) headers['User-Agent'] = userAgent;

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ message: 'Upstream unavailable' }, { status: 503 });
  }

  const body = await upstream.text();
  const res = new NextResponse(body, { status: upstream.status });
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) res.headers.set('content-type', upstreamType);
  res.headers.set('cache-control', 'no-store');
  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
