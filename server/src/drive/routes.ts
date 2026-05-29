import { Router, Response } from 'express';
import { google } from 'googleapis';
import { createOAuthClient } from '../auth/oauthClient';
import { sessionAuth, AuthenticatedRequest } from '../middleware/sessionAuth';
import { scan } from './scanner';
import { build } from './treeBuilder';
import { buildCategoryBreakdown } from './categories';

const router = Router();

router.get('/scan', sessionAuth, async (req, res: Response) => {
  const { tokens } = (req as AuthenticatedRequest).session;

  try {
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const { allFiles, trashSizeBytes } = await scan(drive);
    const tree = build(allFiles);
    const categories = buildCategoryBreakdown(allFiles);

    const aboutRes = await drive.about.get({ fields: 'storageQuota' });
    const quota = aboutRes.data.storageQuota;

    res.json({ tree, categories, quota, trashSizeBytes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'SCAN_FAILED', message });
  }
});

export default router;
