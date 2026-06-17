import { Router, Response } from 'express';
import { createOAuthClient } from '../auth/oauthClient';
import { sessionAuth, AuthenticatedRequest } from '../middleware/sessionAuth';
import { searchMessages, trashMessages, TEMPLATES } from './scanner';

const router = Router();

router.get('/templates', (_req, res: Response) => {
  res.json(TEMPLATES);
});

router.get('/search', sessionAuth, async (req, res: Response) => {
  const { tokens } = (req as AuthenticatedRequest).session;
  const template = req.query['template'] as string;
  const pageToken = req.query['pageToken'] as string | undefined;

  if (!template) {
    res.status(400).json({ error: 'MISSING_TEMPLATE', message: 'template query param required' });
    return;
  }

  try {
    const auth = createOAuthClient();
    auth.setCredentials(tokens);
    const result = await searchMessages(auth, template, pageToken);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isScope = message.includes('insufficient') || message.includes('403');
    res.status(isScope ? 403 : 500).json({
      error: isScope ? 'INSUFFICIENT_SCOPE' : 'SEARCH_FAILED',
      message,
    });
  }
});

router.post('/trash', sessionAuth, async (req, res: Response) => {
  const { tokens } = (req as AuthenticatedRequest).session;
  const { messageIds } = req.body as { messageIds?: string[] };

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    res.status(400).json({ error: 'MISSING_IDS', message: 'messageIds array required' });
    return;
  }

  try {
    const auth = createOAuthClient();
    auth.setCredentials(tokens);
    await trashMessages(auth, messageIds);
    res.json({ ok: true, count: messageIds.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isScope = message.includes('insufficient') || message.includes('403');
    res.status(isScope ? 403 : 500).json({
      error: isScope ? 'INSUFFICIENT_SCOPE' : 'TRASH_FAILED',
      message,
    });
  }
});

export default router;
