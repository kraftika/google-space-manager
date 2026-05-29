import Database from 'better-sqlite3';
import path from 'path';
import { Credentials } from 'google-auth-library';

interface SessionData {
  tokens: Credentials;
  email: string;
  displayName: string;
}

const dbPath = process.env['SESSION_DB_PATH'] ?? path.resolve(__dirname, '../../../sessions.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tokens TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL
  )
`);

export const sessionStore = {
  get: (id: string): SessionData | undefined => {
    const row = db.prepare('SELECT tokens, email, display_name FROM sessions WHERE id = ?').get(id) as
      | { tokens: string; email: string; display_name: string }
      | undefined;
    if (!row) return undefined;
    return { tokens: JSON.parse(row.tokens), email: row.email, displayName: row.display_name };
  },

  set: (id: string, data: SessionData): void => {
    db.prepare('DELETE FROM sessions WHERE email = ?').run(data.email);
    db.prepare('INSERT INTO sessions (id, tokens, email, display_name) VALUES (?, ?, ?, ?)')
      .run(id, JSON.stringify(data.tokens), data.email, data.displayName);
  },

  delete: (id: string): void => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  },

  list: (): Array<{ sessionId: string; email: string; displayName: string }> => {
    const rows = db.prepare('SELECT id, email, display_name FROM sessions').all() as Array<{
      id: string;
      email: string;
      display_name: string;
    }>;
    const seen = new Set<string>();
    return rows
      .filter(r => { if (seen.has(r.email)) return false; seen.add(r.email); return true; })
      .map(r => ({ sessionId: r.id, email: r.email, displayName: r.display_name }));
  },
};
