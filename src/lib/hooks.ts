'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getStoredUser } from './api';

let socket: Socket | null = null;

export function useSocket(onRefresh?: () => void) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    if (!socket) {
      socket = io(wsUrl, { transports: ['websocket', 'polling'] });
    }

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleTransit = () => onRefresh?.();
    const handleGps = () => onRefresh?.();
    const handleDashboard = () => onRefresh?.();

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('transit:update', handleTransit);
    socket.on('gps:update', handleGps);
    socket.on('dashboard:refresh', handleDashboard);

    if (socket.connected) setConnected(true);

    return () => {
      socket?.off('connect', handleConnect);
      socket?.off('disconnect', handleDisconnect);
      socket?.off('transit:update', handleTransit);
      socket?.off('gps:update', handleGps);
      socket?.off('dashboard:refresh', handleDashboard);
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
