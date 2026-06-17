import { OAuth2Client, Credentials } from 'google-auth-library';
import { config } from '../config';
import { sessionStore } from '../session/store';

export function createOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.redirectUri,
  );
}

/**
 * Build an OAuth client bound to a stored session. When the access token is
 * refreshed, the new credentials are merged with the existing ones (a refresh
 * response usually omits the refresh_token) and persisted back to the session
 * store so we don't re-refresh on every request.
 */
export function createSessionClient(sessionId: string, tokens: Credentials): OAuth2Client {
  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on('tokens', (fresh) => {
    sessionStore.updateTokens(sessionId, { ...tokens, ...fresh });
  });
  return client;
}

/**
 * True when a Google call failed because the refresh token is expired or
 * revoked (i.e. the account must sign in again).
 */
export function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: string; response?: { data?: unknown } };
  const data = e.response?.data as { error?: string } | string | undefined;
  return (
    (e.message?.includes('invalid_grant') ?? false) ||
    (typeof data === 'object' && data?.error === 'invalid_grant') ||
    (typeof data === 'string' && data.includes('invalid_grant'))
  );
}

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
];
