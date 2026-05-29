# Drive List — Google Drive Storage Analyzer: Implementation Plan

## Context
Building a local-only tool that connects to Google Drive via OAuth, scans the entire Drive, and presents a collapsible size-sorted tree so the user can find what's eating their storage quota. All answers confirmed via interview. Runs on localhost only — no deployment, no Google app verification needed.

---

## Project Structure

```
/Users/greenpi/work/drive-list/
├── package.json                  ← root, workspaces + concurrently
├── .env                          ← GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc. (gitignored)
├── .gitignore
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              ← Express app, mounts routes, listens on :3001
│       ├── config.ts             ← Reads + validates env vars, throws on missing
│       ├── auth/
│       │   ├── oauthClient.ts    ← Creates OAuth2Client (google-auth-library)
│       │   └── routes.ts         ← /auth/login, /auth/callback, /auth/logout, /auth/status, /auth/switch
│       ├── session/
│       │   └── store.ts          ← In-memory Map<sessionId, {tokens, email, displayName}>
│       ├── drive/
│       │   ├── routes.ts         ← /api/drive/scan (protected by sessionAuth middleware)
│       │   ├── scanner.ts        ← Paginated files.list loop + separate trash pass
│       │   ├── treeBuilder.ts    ← Flat list → nested tree, recursive size sum, sort largest-first
│       │   └── categories.ts     ← mimeType → category, buildCategoryBreakdown()
│       └── middleware/
│           └── sessionAuth.ts    ← Reads sessionId cookie, attaches tokens to req or 401
│
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts            ← Proxy /auth/* and /api/* to localhost:3001
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx               ← State machine router (loading-auth | login | scanning | main | error)
        ├── api/client.ts         ← Typed fetch wrappers for all server endpoints
        ├── types/drive.ts        ← DriveNode, QuotaInfo, CategoryBreakdown, ScanResult, AuthStatus
        ├── state/useAppState.ts  ← Central hook: auth state, scan state, owner filter, active tab
        ├── screens/
        │   ├── LoginScreen.tsx
        │   ├── LoadingScreen.tsx
        │   ├── ErrorScreen.tsx
        │   └── MainScreen.tsx    ← Header + TrashBanner + tabs (tree | breakdown)
        └── components/
            ├── AccountSwitcher.tsx
            ├── QuotaBar.tsx
            ├── TrashBanner.tsx
            ├── OwnerToggle.tsx
            ├── TreeView/
            │   ├── TreeView.tsx       ← Renders root children, passes parentMaxBytes
            │   ├── TreeNode.tsx       ← Recursive collapsible row with size bar
            │   └── SizeBar.tsx        ← Proportional bar relative to parent max
            └── FileTypeBreakdown/
                ├── Breakdown.tsx      ← Category list with drill-down state
                └── CategoryRow.tsx
```

---

## Phase 1 — Google Cloud Setup (user does this once)

1. Create a Google Cloud project at console.cloud.google.com
2. Enable **Google Drive API** in APIs & Services > Library
3. Configure **OAuth consent screen**: External, Testing mode. Add test user emails.
4. Create **OAuth 2.0 credential**: Web application type
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:3001/auth/callback`
5. Create `.env` at project root:
   ```
   GOOGLE_CLIENT_ID=<client-id>
   GOOGLE_CLIENT_SECRET=<client-secret>
   REDIRECT_URI=http://localhost:3001/auth/callback
   SESSION_SECRET=<random-32-char-string>
   ```

---

## Phase 2 — Project Scaffolding

### Root `package.json`
- `workspaces: ["server", "client"]`
- `scripts.dev`: `concurrently -n server,client -c cyan,green "npm run dev -w server" "npm run dev -w client"`
- `devDependencies`: `concurrently`

### Server packages
- `dependencies`: `express`, `googleapis`, `google-auth-library`, `cookie-parser`, `cors`, `uuid`, `dotenv`
- `devDependencies`: `typescript`, `ts-node-dev`, `@types/express`, `@types/cookie-parser`, `@types/cors`, `@types/uuid`, `@types/node`
- `scripts.dev`: `ts-node-dev --respawn --transpile-only src/index.ts`

### Client packages
- `dependencies`: `react`, `react-dom`, `lucide-react` (icons)
- `devDependencies`: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`
- `scripts.dev`: `vite`

---

## Phase 3 — Server Implementation

### `config.ts`
Read env vars. Throw at startup if `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `REDIRECT_URI`, or `SESSION_SECRET` are missing.

### `session/store.ts`
In-memory `Map<string, { tokens, email, displayName }>`. Exports `get`, `set`, `delete`, `list`. No persistence — intentionally ephemeral.

### `auth/oauthClient.ts`
Returns an `OAuth2Client` instance. Scopes: `drive.readonly` + `userinfo.email`.

### `auth/routes.ts`
- **GET `/auth/login`** — Generate OAuth URL with `access_type: offline`, `prompt: consent`. Set a short-lived CSRF nonce cookie. Redirect to Google.
- **GET `/auth/callback`** — Validate CSRF nonce. Exchange `code` for tokens. Fetch user email via `oauth2.userinfo.get`. Store in session map with `uuid()` key. Set `HttpOnly` `sessionId` cookie. Redirect to `http://localhost:5173`.
- **GET `/auth/status`** — Return `{ authenticated, accounts: [{sessionId, email, displayName}], activeSessionId }`.
- **POST `/auth/logout`** — Delete session entry, clear cookie.
- **POST `/auth/switch`** — Accept `{ sessionId }` body. Swap the `sessionId` cookie to the requested account. Client re-triggers scan after switching.

### `middleware/sessionAuth.ts`
Read `sessionId` cookie → look up in store → attach `req.session` or respond 401.

### `drive/scanner.ts`
```
async function scan(driveClient):
  allFiles = []
  pageToken = undefined
  do:
    res = await drive.files.list({
      q: 'trashed = false',
      fields: 'nextPageToken, files(id,name,size,mimeType,parents,ownedByMe,shared)',
      pageSize: 1000,
      pageToken
    })
    allFiles.push(...res.data.files)
    pageToken = res.data.nextPageToken
  while (pageToken)

  // Trash pass (size sum only, not included in tree)
  trashSizeBytes = 0
  do:
    res = await drive.files.list({ q: 'trashed = true', fields: 'nextPageToken, files(size)', pageSize: 1000, pageToken })
    trashSizeBytes += res.data.files.reduce((s, f) => s + parseInt(f.size || '0'), 0)
    pageToken = res.data.nextPageToken
  while (pageToken)

  return { allFiles, trashSizeBytes }
```
Any thrown error propagates to the route handler (no internal retry — client Retry button restarts).

### `drive/treeBuilder.ts`
```
function build(files):
  nodeMap = new Map(files.map(f => [f.id, { ...f, sizeBytes: parseInt(f.size||'0'), children: [], isGoogleWorkspace: isGWorkspace(f.mimeType) }]))

  roots = []
  for node of nodeMap.values():
    parentId = node.parents?.[0]
    parent = parentId ? nodeMap.get(parentId) : null
    if parent: parent.children.push(node)
    else: roots.push(node)

  function computeSize(node):
    if node.mimeType === 'application/vnd.google-apps.folder':
      node.sizeBytes = node.children.reduce((s, c) => s + computeSize(c), 0)
    return node.sizeBytes

  function sortChildren(node):
    node.children.sort((a, b) => b.sizeBytes - a.sizeBytes)
    node.children.forEach(sortChildren)

  roots.forEach(computeSize)
  roots.forEach(sortChildren)

  // Wrap in synthetic root
  return { id: 'root', name: 'My Drive', children: roots, sizeBytes: roots.reduce((s,r)=>s+r.sizeBytes,0) }
```

### `drive/categories.ts`
- `CATEGORY_MAP`: object mapping category name → array of mimeType prefixes/exact strings
- Categories: `Video`, `Images`, `Documents`, `Audio`, `Archives`, `Google Workspace`, `Other`
- `getCategory(mimeType)`: returns category name
- `buildCategoryBreakdown(files)`: group by category → by extension, summing `sizeBytes` and counting files. Returns `{ [category]: { totalBytes, fileCount, extensions: { [ext]: { bytes, count } } } }`

### `drive/routes.ts`
**GET `/api/drive/scan`** (protected):
1. Construct `drive` client from `req.session.tokens`
2. Call `scanner.scan(drive)`
3. Call `treeBuilder.build(allFiles)`
4. Call `buildCategoryBreakdown(allFiles)`
5. Call `drive.about.get({ fields: 'storageQuota' })`
6. Return `{ tree, categories, quota, trashSizeBytes }`
7. On any error: `res.status(500).json({ error: 'SCAN_FAILED', message: err.message })`

---

## Phase 4 — Client Implementation

### `vite.config.ts`
Proxy `/auth` and `/api` to `http://localhost:3001`. Port: `5173`.

### `types/drive.ts`
```typescript
interface DriveNode { id, name, mimeType, sizeBytes, ownedByMe, shared, isGoogleWorkspace, children: DriveNode[] }
interface QuotaInfo { limit, usage, usageInDrive, usageInDriveTrash }
interface CategoryBreakdown { [category: string]: { totalBytes, fileCount, extensions: { [ext]: { bytes, count } } } }
interface ScanResult { tree: DriveNode, categories: CategoryBreakdown, quota: QuotaInfo, trashSizeBytes: number }
interface AuthStatus { authenticated: boolean, accounts: {sessionId, email, displayName}[], activeSessionId: string }
```

### `api/client.ts`
- `getAuthStatus()` — GET `/auth/status`
- `triggerLogin()` — `window.location.href = '/auth/login'`
- `switchAccount(sessionId)` — POST `/auth/switch` with `{ sessionId }`
- `logout()` — POST `/auth/logout`
- `scanDrive()` — GET `/api/drive/scan`
All throw on non-OK HTTP responses (client displays ErrorScreen).

### `state/useAppState.ts`
State machine with these states: `'loading-auth' | 'login' | 'scanning' | 'main' | 'error'`

On mount: call `getAuthStatus()`. If authenticated → call `scanDrive()`. Expose:
- `appState`, `authStatus`, `scanResult`, `errorMessage`
- `ownerFilter: 'owned' | 'all'` + `setOwnerFilter()`
- `activeTab: 'tree' | 'breakdown'` + `setActiveTab()`
- `login()`, `logout()`, `switchAccount(id)`, `retry()`
- `filteredTree` (computed): when `ownerFilter === 'owned'`, recursively prune nodes where `ownedByMe === false` and no owned descendants exist; recompute folder sizes after pruning.

### `App.tsx`
```
switch appState:
  'loading-auth' | 'scanning' → <LoadingScreen message={...} />
  'login'   → <LoginScreen onLogin={login} />
  'error'   → <ErrorScreen message={errorMessage} onRetry={retry} />
  'main'    → <MainScreen />
```

### Screen & Component details

**`LoginScreen`** — Centered: app name, tagline, "Sign in with Google" button.

**`LoadingScreen`** — Full-screen spinner + message prop. Scanning message: "Scanning your Drive, this may take a moment…"

**`ErrorScreen`** — Error message + Retry button (calls `onRetry()`).

**`MainScreen`** — Layout:
- Header: app title | `<AccountSwitcher />` | `<QuotaBar />`
- `<TrashBanner />` (only if `trashSizeBytes > 0`)
- Tab bar: "Storage Tree" | "File Types" + `<OwnerToggle />` (tree tab only)
- Tab content: `<TreeView />` or `<Breakdown />`

**`AccountSwitcher`** — Dropdown of all accounts + "+ Add account" item. Clicking an account: `switchAccount(id)` → re-scan. "+ Add account" → `login()`.

**`QuotaBar`** — Progress bar: `usageInDrive / limit`. Text: "X GB of Y GB used". Amber >80%, red >95%.

**`TrashBanner`** — Callout: "Your Trash contains X GB — empty it in Google Drive to reclaim space."

**`OwnerToggle`** — Two-state pill toggle: "Files I Own" / "All Files". Tooltip on hover explaining the quota implication.

**`TreeView`** — Renders `filteredTree.children` as a list. Passes `filteredTree.sizeBytes` as `parentMaxBytes` to children.

**`TreeNode`** — Recursive. Props: `node`, `parentMaxBytes`, `depth`.
- Indent by `depth * 16px`
- Chevron (folder) or no chevron (file), toggles `isExpanded` state
- Icon based on mimeType (folder, video, image, doc, etc.)
- Name
- `<SizeBar proportional={node.sizeBytes / parentMaxBytes} />`
- Size label: `formatSize(node.sizeBytes)` or `"0 B†"` for `isGoogleWorkspace`
- When `isExpanded`: render children as `<TreeNode>` with `parentMaxBytes = node.sizeBytes`
- Default: root-level folders collapsed, everything else collapsed

**`SizeBar`** — A `<div>` with `width: proportional * maxBarWidth`. Two color tokens: folder = blue, file = teal. CSS transition on width.

**`Breakdown`** — `selectedCategory` state (null = list view). List view: all categories sorted by totalBytes desc, each as `<CategoryRow>`. Detail view: extension rows + Back button.

**`CategoryRow`** — Category icon + name + formatted total + file count. Clickable → sets selected category.

---

## Phase 5 — Utility Functions

**`utils/formatSize.ts`** — `formatSize(bytes: number): string`. Returns "0 B", "1.2 KB", "3.4 MB", "14.2 GB", etc.

**Google Workspace footnote** — Files with `isGoogleWorkspace: true` render "0 B†" with a footnote at the tree bottom: "† Google Docs, Sheets, and Slides are stored in Google's format and don't count toward your quota."

---

## Verification (end-to-end)

1. `npm run dev` → server logs "Listening on 3001", client opens at localhost:5173
2. Login screen appears → `/auth/status` returns `{ authenticated: false }`
3. Click "Sign in with Google" → Google consent → redirect back → scanning screen appears
4. Tree appears with folders sorted largest-first; expanding a folder shows its children also sorted largest-first
5. Quota bar matches `drive.google.com/settings/storage`
6. Trash banner shows correct size if trash is non-empty
7. Toggle "Files I Own" → shared-only items disappear, folder sizes recompute
8. "File Types" tab → categories sorted by size → click a category → extension breakdown
9. "+ Add account" → OAuth for second account → account switcher updates → switching re-scans
10. Simulate API failure (bad token) → error screen with Retry button → Retry restarts scan

---

## Key Decisions

- **Single-response scan**: all files fetched server-side before sending. Simpler client state machine; trade-off is a longer wait on large Drives.
- **Client-side owner filter**: server always returns full tree with `ownedByMe` flags; client filters + recomputes. No round-trip on toggle.
- **In-memory sessions**: never written to disk. Server restart requires re-auth. Appropriate for a local single-user tool.
- **Vite proxy**: client uses relative URLs; cookies work on localhost without cross-origin complications.
- **Size bars relative to parent**: every level is readable regardless of depth.
