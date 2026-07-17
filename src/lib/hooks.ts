'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getStoredUser } from './api';

let socket: Socket | null = null;

const REFETCH_THROTTLE_MS = 4_000;

export function useSocket(onRefresh?: () => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    let cancelled = false;
    let localSocket: Socket | null = null;

    // Leading + trailing throttle: a burst of socket events triggers at most
    // one refetch now and one at the end of the window (keeps final state fresh).
    let lastRun = 0;
    let trailing: number | null = null;
    const requestRefresh = () => {
      if (!onRefresh) return;
      const now = Date.now();
      const elapsed = now - lastRun;
      if (elapsed >= REFETCH_THROTTLE_MS) {
        lastRun = now;
        onRefresh();
      } else if (trailing == null) {
        trailing = window.setTimeout(() => {
          trailing = null;
          lastRun = Date.now();
          onRefresh();
        }, REFETCH_THROTTLE_MS - elapsed);
      }
    };

    async function connect() {
      let token: string | undefined;
      try {
        const res = await fetch('/api/auth/ws-token', { credentials: 'same-origin', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          token = data.token;
        }
      } catch {
        // socket will be rejected server-side without a token
      }
      if (cancelled) return;

      localSocket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        auth: token ? { token } : undefined,
        reconnection: true,
        reconnectionDelay: 2_000,
      });
      socket = localSocket;

      const handleConnect = () => setConnected(true);
      const handleDisconnect = () => setConnected(false);

      localSocket.on('connect', handleConnect);
      localSocket.on('disconnect', handleDisconnect);
      localSocket.on('transit:update', requestRefresh);
      localSocket.on('gps:update', requestRefresh);
      localSocket.on('dashboard:refresh', requestRefresh);
    }

    void connect();

    return () => {
      cancelled = true;
      if (trailing != null) window.clearTimeout(trailing);
      localSocket?.removeAllListeners();
      localSocket?.disconnect();
      if (socket === localSocket) socket = null;
    };
  }, [onRefresh]);

  return { connected };
}

export function useAuthGuard(requiredRole?: string) {
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      window.location.href = '/login';
      return;
    }
    if (requiredRole && u.role !== requiredRole && u.role !== 'admin') {
      window.location.href = '/login';
      return;
    }
    setUser(u);
    setReady(true);
  }, [requiredRole]);

  return { user, ready };
}

export function formatEta(minutes: number | string | null | undefined): string {
  if (minutes == null) return '--:--';
  const m = Number(minutes);
  const mins = Math.floor(m);
  const secs = Math.round((m - mins) * 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function useLiveEta(initialMinutes: number | null) {
  const [eta, setEta] = useState(initialMinutes);

  useEffect(() => {
    setEta(initialMinutes);
  }, [initialMinutes]);

  useEffect(() => {
    if (eta == null || eta <= 0) return;
    const interval = setInterval(() => {
      setEta((prev) => (prev != null && prev > 0 ? Math.max(0, prev - 1 / 60) : prev));
    }, 1000);
    return () => clearInterval(interval);
  }, [eta]);

  return formatEta(eta);
}

export function useRefresh(callback: () => void) {
  return useCallback(callback, [callback]);
}
