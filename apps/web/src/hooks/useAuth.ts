'use client';

import { useState, useEffect } from 'react';
import { AUTH_TOKEN_KEY } from '../lib/constants';
import type { JwtPayload } from '@cubiqport/shared';

interface AuthState {
  token: string | null;
  payload: JwtPayload | null;
  isLoaded: boolean;
}

/**
 * JWT token'ını localStorage'dan okur ve payload'ı parse eder.
 * İmzayı doğrulamaz — yetkilendirme kararları sunucu tarafında alınır.
 * Rol bilgisi yalnızca UI görünürlüğünü kontrol etmek için kullanılır.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ token: null, payload: null, isLoaded: false });

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setState({ token: null, payload: null, isLoaded: true });
      return;
    }

    try {
      const raw = token.split('.')[1];
      const payload = JSON.parse(atob(raw)) as JwtPayload;
      setState({ token, payload, isLoaded: true });
    } catch {
      // Bozuk token — temizle
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setState({ token: null, payload: null, isLoaded: true });
    }
  }, []);

  return state;
}

/** Token ile Authorization header'ı döndürür */
export function getAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
