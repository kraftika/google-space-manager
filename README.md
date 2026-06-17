# Google Space Manager

A React + Express app that connects to your Google Drive and shows which folders and files are using the most storage space.

## Features

- Sign in with Google (OAuth 2.0)
- Full Drive scan with folder size rollup
- Interactive tree view — click into folders to drill down
- File type breakdown by extension and category
- Sort by size or name (ascending / descending)
- Filter between files you own and all files
- Storage quota bar
- Multi-account support — add and switch between Google accounts

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Express, TypeScript, ts-node-dev |
| Auth | Google OAuth 2.0 (googleapis) |
| Sessions | SQLite (better-sqlite3) |
| Drive API | Google Drive API v3 |

## Quick start

### 1. Clone and install

```bash
git clone <repo-url>
cd google-space-manager
npm install
```

### 2. Configure environment

```bash
cp .env .env.local
```

Edit `.env.local` with your Google Cloud credentials:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:3001/auth/callback
SESSION_SECRET=any-random-string
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services
2. Enable the **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Web application type) with `http://localhost:3001/auth/callback` as an authorized redirect URI
4. Go to **OAuth consent screen** → **Audience** tab:
   - Set publishing status to **Testing**
   - Add your Gmail address as a test user
5. Go to **Data access** tab → **Add or remove scopes** — add:
   - `.../auth/drive.readonly`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

### 4. Run

```bash
npm run dev
```

Open **http://localhost:5173**, sign in with Google, and the app will scan your Drive.

## Project structure

```
.
├── client/               # React frontend (Vite)
│   └── src/
│       ├── api/          # API client
│       ├── components/   # UI components
│       ├── screens/      # Page-level screens
│       ├── state/        # App state (useReducer + context)
│       └── types/        # Shared TypeScript types
├── server/               # Express backend
│   └── src/
│       ├── auth/         # Google OAuth routes and client
│       ├── drive/        # Drive API scanner and routes
│       ├── middleware/   # Session auth middleware
│       └── session/      # SQLite session store
├── .env                  # Empty template — safe to commit
├── .env.local            # Real credentials — gitignored
└── sessions.db           # SQLite session file — gitignored
```

## Notes

- Sessions persist across server restarts (SQLite-backed)
- Logging in with the same Google account replaces the existing session
- OAuth tokens expire after 7 days in Testing mode — just sign in again
