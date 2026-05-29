# Drive List — Production Deployment Plan

This document covers every change required to move Drive List from a localhost-only dev tool to a production deployment. Changes are grouped by severity.

---

## 1. Hardcoded localhost URLs (breaking — must fix)

### 1a. OAuth callback redirect — `server/src/auth/routes.ts:47`

```ts
// current
res.redirect('http://localhost:5173');

// fix
res.redirect(config.clientOrigin);  // read from env
```

Add `CLIENT_ORIGIN=https://yourdomain.com` to env and expose it via `config.ts`.

### 1b. CORS origin — `server/src/index.ts:10`

```ts
// current
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// fix
app.use(cors({ origin: config.clientOrigin, credentials: true }));
```

### 1c. Google OAuth redirect URI — `.env` + Google Cloud Console

`REDIRECT_URI` is currently `http://localhost:3001/auth/callback`. Update it to the production server URL, e.g. `https://api.yourdomain.com/auth/callback`, and add the same URL to the **Authorized redirect URIs** list in Google Cloud Console → APIs & Services → Credentials.

---

## 2. Google OAuth consent screen (breaking — must fix)

The consent screen is currently in **Testing** mode, which means only explicitly added test users can log in and tokens expire after 7 days.

**Steps:**
1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Click **Publish App** → submit for verification (or keep in Testing and manage users manually for small internal use)
3. Required for public use: add privacy policy and terms of service URLs

If this remains an internal tool, keeping it in Testing mode is acceptable — just add all users as test users manually.

---

## 3. In-memory session store (data loss on restart — must fix for multi-user)

`server/src/session/store.ts` uses a plain `Map`. Every server restart wipes all sessions, forcing all users to re-authenticate.

**Fix options (pick one):**

**A. Redis** (recommended for multi-instance):
```ts
// Replace Map with a Redis client
import { createClient } from 'redis';
const client = createClient({ url: process.env.REDIS_URL });
```

**B. SQLite** (simpler, single-instance):
```ts
import Database from 'better-sqlite3';
// Store sessions in a local file — survives restarts, no external dependency
```

**C. Keep in-memory** — acceptable only if:
- Single server instance (no load balancer)
- Users are OK re-authenticating after deploys
- This remains a personal/internal tool

---

## 4. Cookie security flags (security — must fix for HTTPS)

All `res.cookie()` calls in `server/src/auth/routes.ts` (lines 18, 46, 72) set cookies without `secure` or `sameSite`:

```ts
// current
res.cookie('sessionId', sessionId, { httpOnly: true });

// fix
res.cookie('sessionId', sessionId, {
  httpOnly: true,
  secure: true,          // HTTPS only
  sameSite: 'lax',       // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,  // explicit expiry (7 days)
});
```

Apply the same to `oauth_nonce` cookie. Use an env flag (`NODE_ENV=production`) to conditionally set `secure: true` so local dev still works without HTTPS.

---

## 5. Build pipeline — replace Vite dev server with static files

In development, Vite proxies `/auth` and `/api` to the Express server. In production, Vite is not running — you need to:

**Step 1: Build the client**
```bash
cd client && npm run build   # outputs to client/dist/
```

**Step 2: Serve the built files from Express** — add to `server/src/index.ts`:
```ts
import path from 'path';

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  // SPA fallback — must come after /auth and /api routes
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}
```

This eliminates the need for a separate static file server. The Express server handles both the API and the frontend from one process.

**Step 3: Add build scripts to root `package.json`**
```json
"scripts": {
  "build": "npm run build -w client && npm run build -w server",
  "start": "node server/dist/index.js"
}
```

Add a build script to `server/package.json`:
```json
"build": "tsc"
```

---

## 6. Environment variable management

**Current:** `.env` file loaded via `dotenv` from a relative path (`../../.env`). This path resolves from compiled output in `server/dist/`, which may break depending on deploy layout.

**Fix in `server/src/config.ts`:**
```ts
// Replace path-relative load with process.env directly
// (let the hosting environment inject vars — no dotenv in production)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}
```

**Required env vars in production:**
| Variable | Example |
|---|---|
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `REDIRECT_URI` | `https://api.yourdomain.com/auth/callback` |
| `SESSION_SECRET` | random 32+ char string |
| `CLIENT_ORIGIN` | `https://yourdomain.com` |
| `NODE_ENV` | `production` |
| `PORT` | `3001` (or whatever the host assigns) |

Keep secrets out of version control. Use platform secret management (Railway, Render, Fly secrets; AWS Secrets Manager; etc.).

---

## 7. TypeScript compilation

The server runs via `ts-node-dev` in development, which is not suitable for production (slower start, higher memory).

**Fix:** compile to JS before deploying.

```bash
cd server && npx tsc          # outputs to server/dist/
node server/dist/index.js     # production start command
```

Remove `ts-node-dev` from production dependencies — move it to `devDependencies` (it already is).

---

## 8. Process management

Node.js processes crash. In production, use a process manager to restart on crash and manage logs.

**Options:**
- **PM2**: `pm2 start server/dist/index.js --name drive-list`
- **Docker**: containerise and let the orchestrator restart
- **Managed platform** (Railway, Render, Fly.io): crash-restart is built in

---

## 9. HTTPS / TLS

`secure: true` on cookies requires HTTPS. Options:

- **Reverse proxy** (nginx/Caddy in front of Express): handles TLS termination; Express receives plain HTTP on an internal port
- **Managed platform**: TLS is automatic (Render, Railway, Fly.io all provision certs)
- **Self-signed**: only suitable for private LAN use, not the public internet

---

## 10. Google Drive API quota

The scanner fetches all files in a single synchronous loop. On a large Drive (100k+ files), this can hit the Google Drive API's per-user rate limit (1,000 requests/100 seconds).

**Mitigations:**
- Add exponential backoff on 429/503 responses in `server/src/drive/scanner.ts`
- Consider streaming results to the client rather than buffering everything in memory before responding (longer change — requires breaking the single-response scan assumption from the design)

---

## Summary checklist

| # | Item | Required? | Effort |
|---|---|---|---|
| 1a | Fix hardcoded `localhost:5173` redirect | Yes | Minutes |
| 1b | Fix hardcoded CORS origin | Yes | Minutes |
| 1c | Update OAuth redirect URI | Yes | Minutes |
| 2 | Publish Google OAuth consent screen | Yes (public) / No (internal) | 1–3 days (Google review) |
| 3 | Replace in-memory session store | Recommended | Hours |
| 4 | Add `secure`/`sameSite` cookie flags | Yes | Minutes |
| 5 | Build client + serve from Express | Yes | 30 min |
| 6 | Fix env var loading for production | Yes | Minutes |
| 7 | Compile TypeScript for production | Yes | Minutes |
| 8 | Process manager | Recommended | 30 min |
| 9 | HTTPS / TLS | Yes | Varies by platform |
| 10 | Drive API rate-limit backoff | Recommended | Hours |
