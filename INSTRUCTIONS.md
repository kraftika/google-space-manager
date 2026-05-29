# Google Space Manager — Setup & Run Instructions

## What this app does

A React + Express app that connects to your Google Drive, scans all files and folders, and shows which directories and files are using the most storage space.

---

## Prerequisites

- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials (already configured in `.env`)

---

## Install dependencies

Run once from the project root:

```bash
npm install
```

This installs dependencies for both the server and client workspaces.

---

## Start in development mode

```bash
npm run dev
```

This starts both processes concurrently:

| Process | URL |
|---|---|
| Express API server | http://localhost:3001 |
| Vite React client | http://localhost:5173 |

Open **http://localhost:5173** in your browser. The client automatically proxies `/auth` and `/api` requests to the Express server.

---

## Environment variables

Copy `.env` (which is committed with empty values) to `.env.local` and fill in your secrets. `.env.local` is git-ignored and takes priority over `.env` at runtime.

```bash
cp .env .env.local
# then edit .env.local with your values
```

Variables used:

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `REDIRECT_URI` | OAuth callback URL (`http://localhost:3001/auth/callback`) |
| `SESSION_SECRET` | Secret used to sign session tokens |
| `CLIENT_ORIGIN` | Frontend URL (`http://localhost:5173`) |

---

## Google OAuth setup

### 1. Enable the Google Drive API

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enabled APIs and make sure **Google Drive API** is enabled.

### 2. Configure scopes (Data access)

Go to APIs & Services → OAuth consent screen → **Data access** tab and click **Add or remove scopes**. Add all three:

- `.../auth/drive.readonly`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

Save when done.

### 3. Switch to Testing mode and add yourself as a test user

The app does not need Google verification for personal use. Keep it in **Testing** mode:

1. Go to APIs & Services → OAuth consent screen → **Audience** tab
2. Under Publishing status, click **Switch to Testing** (if it shows "In production")
3. Once in Testing mode, a **Test users** section appears — click **Add users** and enter your Gmail address
4. Save

> Tokens issued in Testing mode expire after 7 days — just sign in again when they do.

---

## How to use the app

1. Open http://localhost:5173
2. Click **Sign in with Google** and authorize the app to read your Drive
3. The app scans your Drive and displays a breakdown of space usage by folder and file
4. Click into folders to drill down

---

## Troubleshooting

**"Missing required env var" error on server start**
- Make sure `.env` exists at the project root with all five variables set.

**"Insufficient permission" or OAuth error**
- Check that all three scopes are added under Data access in the OAuth consent screen.
- Make sure the app is in **Testing** mode (not "In production") and your Gmail is listed as a test user.
- If it shows "In production", switch back to Testing mode — this avoids the Google verification requirement for personal use.

**Port already in use**
- Something else is running on port 3001 or 5173. Kill the process or change the port in `.env` (`PORT=3002`) and `vite.config.ts`.

**Session lost after server restart**
- Expected in development — the session store is in-memory. Sign in again.

---

## Project structure

```
.
├── client/          # React frontend (Vite + TypeScript)
│   └── src/
│       ├── App.tsx
│       ├── screens/
│       └── components/
├── server/          # Express backend (TypeScript)
│   └── src/
│       ├── auth/    # Google OAuth routes
│       ├── drive/   # Drive API scanner
│       └── index.ts
├── .env             # Environment variables (not committed)
└── sessions.db      # SQLite session store
```
