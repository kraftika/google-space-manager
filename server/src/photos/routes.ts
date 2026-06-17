import { Router, Response } from 'express';
import { createOAuthClient } from '../auth/oauthClient';
import { sessionAuth, AuthenticatedRequest } from '../middleware/sessionAuth';
import { listPhotos, deletePhotos } from './scanner';

const router = Router();

function isScopeError(message: string): boolean {
  return message.includes('insufficient') || message.includes('403') || message.includes('PERMISSION_DENIED');
}

router.get('/list', sessionAuth, async (req, res: Response) => {
  const { tokens } = (req as AuthenticatedRequest).session;
  const pageToken = req.query['pageToken'] as string | undefined;

  try {
    const auth = createOAuthClient();
    auth.setCredentials(tokens);
    const result = await listPhotos(auth, pageToken);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const scope = isScopeError(message);
    res.status(scope ? 403 : 500).json({
      error: scope ? 'INSUFFICIENT_SCOPE' : 'LIST_FAILED',
      message,
    });
  }
});

router.post('/delete', sessionAuth, async (req, res: Response) => {
  const { tokens } = (req as AuthenticatedRequest).session;
  const { mediaItemIds } = req.body as { mediaItemIds?: string[] };

  if (!Array.isArray(mediaItemIds) || mediaItemIds.length === 0) {
    res.status(400).json({ error: 'MISSING_IDS', message: 'mediaItemIds array required' });
    return;
  }

  try {
    const auth = createOAuthClient();
    auth.setCredentials(tokens);
    await deletePhotos(auth, mediaItemIds);
    res.json({ ok: true, count: mediaItemIds.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const scope = isScopeError(message);
    res.status(scope ? 403 : 500).json({
      error: scope ? 'INSUFFICIENT_SCOPE' : 'DELETE_FAILED',
      message,
    });
  }
});

export default router;
