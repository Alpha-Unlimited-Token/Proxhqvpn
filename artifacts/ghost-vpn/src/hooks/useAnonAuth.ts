// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useCallback } from "react";

const TOKEN_KEY = "proxhq_anon_token";
const NUMBER_KEY = "proxhq_anon_number";
const EXPIRES_KEY = "proxhq_anon_expires";

function safeRead(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function useAnonAuth() {
  const [token, setToken] = useState<string | null>(() => safeRead(TOKEN_KEY));
  const [accountNumber, setAccountNumber] = useState<string | null>(() => safeRead(NUMBER_KEY));
  const [expiresAt, setExpiresAt] = useState<string | null>(() => safeRead(EXPIRES_KEY));

  const signIn = useCallback((t: string, number: string, expires: string | null) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(NUMBER_KEY, number);
      if (expires) localStorage.setItem(EXPIRES_KEY, expires);
    } catch { /* ignore */ }
    setToken(t);
    setAccountNumber(number);
    setExpiresAt(expires);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(NUMBER_KEY);
      localStorage.removeItem(EXPIRES_KEY);
    } catch { /* ignore */ }
    setToken(null);
    setAccountNumber(null);
    setExpiresAt(null);
  }, []);

  const isLoggedIn = !!token;

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
    : 0;

  return { token, accountNumber, expiresAt, isLoggedIn, daysRemaining, signIn, signOut };
}

export function getAnonToken(): string | null {
  return safeRead(TOKEN_KEY);
}
