import { Router, Response } from 'express';
import { google } from 'googleapis';
import { createSessionClient, isInvalidGrant } from '../auth/oauthClient';
import { sessionStore } from '../session/store';
import { sessionAuth, AuthenticatedRequest } from '../middleware/sessionAuth';
import { scan } from './scanner';
import { build } from './treeBuilder';
import { buildCategoryBreakdown } from './categories';

const router = Router();

router.get('/scan', sessionAuth, async (req, res: Response) => {
  const { sessionId, tokens } = (req as AuthenticatedRequest).session;

  try {
    const oauth2Client = createSessionClient(sessionId, tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const { allFiles, trashSizeBytes } = await scan(drive);
    const tree = build(allFiles);
    const categories = buildCategoryBreakdown(allFiles);

    const aboutRes = await drive.about.get({ fields: 'storageQuota' });
    const quota = aboutRes.data.storageQuota;

    res.json({ tree, categories, quota, trashSizeBytes });
  } catch (err: unknown) {
    if (isInvalidGrant(err)) {
      sessionStore.delete(sessionId);
      res.status(401).json({
        error: 'REAUTH_REQUIRED',
        message: 'Your session for this account expired. Please sign in again.',
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'SCAN_FAILED', message });
  }
});

export default router;
