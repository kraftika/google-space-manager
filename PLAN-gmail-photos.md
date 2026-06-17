# Plan: Gmail Search Tab + Google Photos Tab

## Context

Two new tabs added to the existing Google Space Manager app (which already has Drive storage analysis). Goal: manage and reclaim space across Gmail attachments and Google Photos.

Key decisions:
- **Email deletion**: Move to Trash (recoverable), uses `gmail.modify` scope
- **Photos deletion**: Permanent delete via `mediaItems.batchDelete`, uses `photoslibrary` scope (full, not readonly)
- **Scope upgrade**: All scopes requested at login upfront — no per-tab re-auth flow
- **403 error**: Show inline banner with re-login button → `triggerLogin()` redirects immediately to Google login
- **Gmail volume**: Server-side pagination with "Load more" button
- **Account switch**: Clear Gmail + Photos results, stay on current tab (require new search)

---

## Implementation Status

| Area | Status |
|------|--------|
| OAuth scopes in `oauthClient.ts` | ✅ Done — full `photoslibrary` scope set |
| `server/src/gmail/scanner.ts` | ✅ Done |
| `server/src/gmail/routes.ts` | ✅ Done |
| `server/src/index.ts` — register routes | ✅ Done |
| `server/src/photos/` | ✅ Done (`scanner.ts`, `routes.ts`) |
| Client types, API, state, components, CSS | ✅ Done |

All code type-checks (server + client `tsc --noEmit` clean). Remaining: the Google Cloud Console steps below + re-login are user actions required before runtime verification.

---

## Changes Required

### 1. OAuth Scopes — `server/src/auth/oauthClient.ts`

**Change** `photoslibrary.readonly` → `photoslibrary` (full scope needed for delete):

```ts
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/photoslibrary',   // full, not .readonly
];
```

The user also needs to:
- Enable **Gmail API** and **Photos Library API** in Google Cloud Console
- Add both scopes to the OAuth consent screen **Data access** tab
- Re-login to get tokens with the new scopes

---

### 2. Server: Register Routes — `server/src/index.ts`

```ts
import gmailRoutes from './gmail/routes';
import photosRoutes from './photos/routes';

app.use('/api/gmail', gmailRoutes);
app.use('/api/photos', photosRoutes);
```

---

### 3. Server: Photos — `server/src/photos/`

**`scanner.ts`**

```ts
interface PhotoItem {
  id: string;
  filename: string;
  productUrl: string;
  baseUrl: string;         // thumbnail URL (expires ~1hr)
  creationTime: string;    // ISO string from mediaMetadata.creationTime
  width: number;
  height: number;
  isVideo: boolean;
}

interface PhotosResult {
  items: PhotoItem[];
  nextPageToken?: string;
}
```

- `listPhotos(auth, pageToken?)`: `GET https://photoslibrary.googleapis.com/v1/mediaItems` via `auth.request()` (Photos Library API is not in `googleapis` npm package — direct REST via OAuth2Client). `pageSize: 50`.
- `deletePhotos(auth, mediaItemIds: string[])`: `POST https://photoslibrary.googleapis.com/v1/mediaItems:batchDelete` with body `{ mediaItemIds }`.

**`routes.ts`** — registered at `/api/photos`

- `GET /list?pageToken=<token>` — returns paginated photo items
- `POST /delete` — body `{ mediaItemIds: string[] }` — calls `deletePhotos`

Both routes use `sessionAuth` middleware. On 403 from the Photos API, return `{ error: 'INSUFFICIENT_SCOPE', message }` with HTTP 403.

---

### 4. New Types — client side

**`client/src/types/gmail.ts`**
```ts
export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  sizeEstimate: number; // bytes
}

export interface GmailSearchResult {
  messages: GmailMessage[];
  nextPageToken?: string;
  template: string;
}
```

**`client/src/types/photos.ts`**
```ts
export interface PhotoItem {
  id: string;
  filename: string;
  productUrl: string;
  baseUrl: string;
  creationTime: string;
  width: number;
  height: number;
  isVideo: boolean;
}

export interface PhotosResult {
  items: PhotoItem[];
  nextPageToken?: string;
}
```

---

### 5. API Client — `client/src/api/client.ts`

Add a `ScopeError` class so components can detect 403 scope errors and show the inline banner:

```ts
export class ScopeError extends Error {
  constructor() { super('Insufficient scope'); this.name = 'ScopeError'; }
}
```

Update `apiFetch` to throw `ScopeError` when the response body is `{ error: 'INSUFFICIENT_SCOPE' }`.

New exports:
```ts
export const getGmailTemplates = () => apiFetch<Record<string, { label: string; query: string; group: string }>>('/api/gmail/templates');
export const searchGmail = (template: string, pageToken?: string) => ...
export const trashEmails = (messageIds: string[]) => ...
export const listPhotos = (pageToken?: string) => ...
export const deletePhotos = (mediaItemIds: string[]) => ...
```

---

### 6. State — `client/src/state/useAppState.ts`

**Extend `ActiveTab`**: `'tree' | 'breakdown' | 'gmail' | 'photos'`

**Add to `AppData`**:
```ts
gmailResult: GmailSearchResult | null;
gmailLoading: boolean;
gmailSelectedIds: Set<string>;
gmailScopeError: boolean;
photosResult: PhotosResult | null;       // accumulated across "load more"
photosLoading: boolean;
photosSelectedIds: Set<string>;
photosScopeError: boolean;
photosSortOption: PhotosSortOption;     // 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'
```

**Add context methods**:
- `searchGmail(template)` — clears existing results, fetches fresh, sets `gmailLoading`
- `loadMoreGmail()` — appends next page using `gmailResult.nextPageToken`
- `trashSelected()` — calls `trashEmails(gmailSelectedIds)`, removes trashed IDs from list
- `toggleEmailSelection(id)`, `selectAllEmails()`, `clearEmailSelection()`
- `loadPhotos()` — initial load (resets results)
- `loadMorePhotos()` — appends next page
- `deleteSelectedPhotos()` — calls `deletePhotos(photosSelectedIds)`, removes deleted IDs from list
- `togglePhotoSelection(id)`, `selectAllPhotos()`, `clearPhotoSelection()`
- `setPhotosSortOption(opt)`

**Account switch behavior**: When `switchAccount` or `removeAccount` runs, reset all Gmail and Photos state to initial (clear results, selections, errors).

**`filteredPhotos`** — memoized sort of `photosResult.items` by `photosSortOption`.

**Scope error handling**: Catch `ScopeError` in `searchGmail`, `loadPhotos`, etc. → set `gmailScopeError = true` or `photosScopeError = true`.

---

### 7. Frontend Components

**`client/src/components/GmailSearch/GmailSearch.tsx`**
- Template dropdown grouped by "By size" / "By age" (fetched from `/api/gmail/templates`)
- Shows `gmailLoading` spinner while searching
- If `gmailScopeError`: inline banner "Gmail permissions required" with "Re-authenticate" button → `triggerLogin()`
- Email list: rows with checkbox, from, subject, date, size estimate
- "Select all" checkbox in header row
- Sticky action bar when items selected: "Move X to Trash"
- "Load more" button if `nextPageToken` exists

**`client/src/components/GmailSearch/EmailRow.tsx`**
- checkbox + from + subject + date + formatted size

**`client/src/components/PhotosList/PhotosList.tsx`**
- Sort control: date-desc, date-asc, name-asc, name-desc
- If `photosScopeError`: inline banner "Photos permissions required" with "Re-authenticate" button → `triggerLogin()`
- Thumbnail grid with checkbox overlay on each card
- Each card: thumbnail, filename, date, dimensions, video badge
- "Select all" + sticky action bar when items selected: "Delete X photos"
- "Load more" button if `nextPageToken` exists

**`client/src/screens/MainScreen.tsx`**
- Tab bar: `Storage Tree | File Types | Gmail | Photos`
- `SortToggle`/`OwnerToggle` only shown on `tree` tab

---

### 8. CSS — `client/src/index.css`

New classes following existing variable conventions:
- `.gmail-panel`, `.email-list`, `.email-row`, `.email-row-selected`
- `.email-actions-bar` (sticky bottom bar)
- `.template-select`
- `.photos-grid`, `.photo-card`, `.photo-card-selected`, `.photo-thumb`, `.video-badge`
- `.photo-checkbox` (overlay on thumbnail)
- `.photos-actions-bar` (sticky bottom bar)
- `.load-more-btn`
- `.scope-error-banner`

---

## Google Cloud Console Steps (user action required)

1. Enable **Gmail API**
2. Enable **Google Photos Library API**
3. Add scopes to OAuth consent screen → Data access:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/photoslibrary`
4. Re-login to get tokens with new scopes

---

## Verification

1. `npm run dev` — both server and client start without errors
2. Re-login to grant Gmail + Photos scopes
3. **Gmail tab**: select template → emails list → select some → "Move to Trash" → emails removed from list, appear in Gmail Trash
4. **Gmail load more**: next page appended to list
5. **Photos tab**: thumbnails load, sort works, select some → "Delete X photos" → removed from list
6. **Photos load more**: next page appended
7. **Drive tab**: unchanged, still works
8. **Account switch**: Gmail + Photos results cleared, stay on current tab; new search/load needed
9. **403 scope error**: banner appears on affected tab; clicking "Re-authenticate" triggers login redirect
