import { Router, Response } from 'express';
import { createSessionClient, isInvalidGrant } from '../auth/oauthClient';
import { sessionStore } from '../session/store';
import { sessionAuth, AuthenticatedRequest } from '../middleware/sessionAuth';
import { searchMessages, trashMessages, TEMPLATES } from './scanner';

const router = Router();

function handleApiError(res: Response, sessionId: string, err: unknown, failCode: string): void {
  if (isInvalidGrant(err)) {
    sessionStore.delete(sessionId);
    res.status(401).json({ error: 'REAUTH_REQUIRED', message: 'Your session expired. Please sign in again.' });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  const isScope = message.includes('insufficient') || message.includes('403') || message.includes('PERMISSION_DENIED');
  res.status(isScope ? 403 : 500).json({
    error: isScope ? 'INSUFFICIENT_SCOPE' : failCode,
    message,
  });
}

router.get('/templates', (_req, res: Response) => {
  res.json(TEMPLATES);
});

router.get('/search', sessionAuth, async (req, res: Response) => {
  const { sessionId, tokens } = (req as AuthenticatedRequest).session;
  const template = req.query['template'] as string;
  const pageToken = req.query['pageToken'] as string | undefined;

  if (!template) {
    res.status(400).json({ error: 'MISSING_TEMPLATE', message: 'template query param required' });
    return;
  }

  try {
    const auth = createSessionClient(sessionId, tokens);
    const result = await searchMessages(auth, template, pageToken);
    res.json(result);
  } catch (err: unknown) {
    handleApiError(res, sessionId, err, 'SEARCH_FAILED');
  }
});

router.post('/trash', sessionAuth, async (req, res: Response) => {
  const { sessionId, tokens } = (req as AuthenticatedRequest).session;
  const { messageIds } = req.body as { messageIds?: string[] };

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    res.status(400).json({ error: 'MISSING_IDS', message: 'messageIds array required' });
    return;
  }

  try {
    const auth = createSessionClient(sessionId, tokens);
    await trashMessages(auth, messageIds);
    res.json({ ok: true, count: messageIds.length });
  } catch (err: unknown) {
    handleApiError(res, sessionId, err, 'TRASH_FAILED');
  }
});

export default router;
