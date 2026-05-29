import { AuthStatus, ScanResult } from '../types/drive';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function triggerLogin(): void {
  window.location.href = '/auth/login';
}

export const getAuthStatus = () => apiFetch<AuthStatus>('/auth/status');

export const scanDrive = () => apiFetch<ScanResult>('/api/drive/scan');

export const switchAccount = (sessionId: string) =>
  apiFetch<{ ok: boolean }>('/auth/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

export const logout = () =>
  apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' });

export const removeAccount = (sessionId: string) =>
  apiFetch<{ ok: boolean }>(`/auth/session/${sessionId}`, { method: 'DELETE' });
