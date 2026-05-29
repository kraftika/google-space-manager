import { Request, Response, NextFunction } from 'express';
import { Credentials } from 'google-auth-library';
import { sessionStore } from '../session/store';

export interface AuthenticatedRequest extends Request {
  session: {
    sessionId: string;
    tokens: Credentials;
    email: string;
    displayName: string;
  };
}

export function sessionAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.['sessionId'];
  if (!sessionId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  (req as AuthenticatedRequest).session = { sessionId, ...session };
  next();
}
