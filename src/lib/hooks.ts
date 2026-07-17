'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getStoredUser } from './api';

let socket: Socket | null = null;

export function useSocket(onRefresh?: () => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    let cancelled = false;
    let localSocket: Socket | null = null;

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
      const handleTransit = () => onRefresh?.();
      const handleGps = () => onRefresh?.();
      const handleDashboard = () => onRefresh?.();

      localSocket.on('connect', handleConnect);
      localSocket.on('disconnect', handleDisconnect);
      localSocket.on('transit:update', handleTransit);
      localSocket.on('gps:update', handleGps);
      localSocket.on('dashboard:refresh', handleDashboard);
    }

    void connect();

    return () => {
      cancelled = true;
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
