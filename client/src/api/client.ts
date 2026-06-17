import { AuthStatus, ScanResult } from '../types/drive';
import { GmailSearchResult, GmailTemplates } from '../types/gmail';

export class ScopeError extends Error {
  constructor() {
    super('Insufficient scope');
    this.name = 'ScopeError';
  }
}

export class ReauthError extends Error {
  constructor(message?: string) {
    super(message ?? 'Re-authentication required');
    this.name = 'ReauthError';
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
    if (body.error === 'REAUTH_REQUIRED') throw new ReauthError(body.message);
    if (body.error === 'INSUFFICIENT_SCOPE') throw new ScopeError();
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
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

// ── Gmail ─────────────────────────────────────────

export const getGmailTemplates = () =>
  apiFetch<GmailTemplates>('/api/gmail/templates');

export const searchGmail = (template: string, pageToken?: string) => {
  const params = new URLSearchParams({ template });
  if (pageToken) params.set('pageToken', pageToken);
  return apiFetch<GmailSearchResult>(`/api/gmail/search?${params.toString()}`);
};

export const trashEmails = (messageIds: string[]) =>
  apiFetch<{ ok: boolean; count: number }>('/api/gmail/trash', jsonPost({ messageIds }));
