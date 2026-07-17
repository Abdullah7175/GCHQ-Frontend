import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'gchq_token';

/** Short-lived in-memory handshake helper for Socket.IO (token never persisted by the client). */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ token });
}
