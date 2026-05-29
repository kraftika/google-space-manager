import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { createOAuthClient, SCOPES } from './oauthClient';
import { sessionStore } from '../session/store';
import { config } from '../config';

const router = Router();

router.get('/login', (_req: Request, res: Response) => {
  const oauth2Client = createOAuthClient();
  const nonce = uuidv4();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: nonce,
  });
  res.cookie('oauth_nonce', nonce, { httpOnly: true, maxAge: 10 * 60 * 1000 });
  res.redirect(url);
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const storedNonce = req.cookies?.['oauth_nonce'];

  if (!code || !state || state !== storedNonce) {
    res.status(400).send('Invalid OAuth callback');
    return;
  }

  res.clearCookie('oauth_nonce');

  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  const email = userInfo.data.email ?? 'unknown@example.com';
  const displayName = userInfo.data.name ?? email;

  const sessionId = uuidv4();
  sessionStore.set(sessionId, { tokens, email, displayName });

  res.cookie('sessionId', sessionId, { httpOnly: true });
  res.redirect(config.clientOrigin);
});

router.get('/status', (req: Request, res: Response) => {
  const activeSessionId = req.cookies?.['sessionId'] ?? null;
  const accounts = sessionStore.list();
  const authenticated = accounts.some(a => a.sessionId === activeSessionId);
  res.json({ authenticated, accounts, activeSessionId });
});

router.post('/logout', (req: Request, res: Response) => {
  const sessionId = req.cookies?.['sessionId'];
  if (sessionId) {
    sessionStore.delete(sessionId);
    res.clearCookie('sessionId');
  }
  res.json({ ok: true });
});

router.delete('/session/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  if (!sessionStore.get(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  sessionStore.delete(sessionId);
  if (req.cookies?.['sessionId'] === sessionId) {
    res.clearCookie('sessionId');
  }
  res.json({ ok: true });
});

router.post('/switch', (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId || !sessionStore.get(sessionId)) {
    res.status(400).json({ error: 'Unknown session' });
    return;
  }
  res.cookie('sessionId', sessionId, { httpOnly: true });
  res.json({ ok: true });
});

export default router;
