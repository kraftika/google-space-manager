import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

function require_env(name: string): string {
  const val = process.env[name]?.trim();
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  googleClientId: require_env('GOOGLE_CLIENT_ID'),
  googleClientSecret: require_env('GOOGLE_CLIENT_SECRET'),
  redirectUri: require_env('REDIRECT_URI'),
  sessionSecret: require_env('SESSION_SECRET'),
  clientOrigin: require_env('CLIENT_ORIGIN'),
  port: parseInt(process.env['PORT'] ?? '3001', 10),
};
