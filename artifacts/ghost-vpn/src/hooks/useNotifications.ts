// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/react";

const BASE = () => import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  createdAt: string;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE()}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function useNotifications(pollIntervalMs = 30_000) {
  const { isSignedIn } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Track which notification IDs we've already toasted for
  const toastedIds = useRef<Set<number>>(new Set());
  const [newAlert, setNewAlert] = useState<AppNotification | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const rows: AppNotification[] = await apiFetch("/api/notifications");
      setNotifications(rows);
      const unread = rows.filter((n) => !n.read);
      setUnreadCount(unread.length);

      // Fire toast for any unread notifications we haven't toasted yet
      for (const n of unread) {
        if (!toastedIds.current.has(n.id)) {
          toastedIds.current.add(n.id);
          setNewAlert(n);
          break; // show one at a time
        }
      }
    } catch {
      // silently ignore (user may not be on a page that has auth context yet)
    }
  }, [isSignedIn]);

  const markRead = useCallback(async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const dismissAlert = useCallback(() => setNewAlert(null), []);

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, pollIntervalMs);
    return () => clearInterval(t);
  }, [fetchNotifications, pollIntervalMs]);

  return { notifications, unreadCount, newAlert, markRead, markAllRead, dismissAlert, refetch: fetchNotifications };
}
