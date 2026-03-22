# Admin Panel & Resource Guards

## Overview

Add a server-side rendered admin panel at `/admin` for managing sessions, uploaded files, and monitoring resource usage. Add resource guards to prevent exceeding Fly.io free plan limits.

## Authentication

- `ADMIN_PASSWORD` env var (set via `fly secrets set`)
- `GET /admin` renders a login form
- `POST /admin/login` validates password using `crypto.timingSafeEqual`, sets a signed cookie (`admin_token`) containing a random session token stored in server memory
- All `/admin/*` routes check the cookie; invalid/missing redirects to login
- Token is ephemeral (in-memory) — server restart logs out, acceptable for single-user admin
- `POST /admin/logout` clears the cookie
- Cookie options: `httpOnly`, `secure` in production (`NODE_ENV=production`), `sameSite: 'strict'`
- No new dependencies — uses Node `crypto` and manual cookie parsing (`req.headers.cookie`)
- If `ADMIN_PASSWORD` is not set, admin routes are disabled (not mounted) and a warning is logged at startup. The app runs normally without admin.

## Admin Routes

```
GET  /admin              → login page (or redirect to dashboard if authenticated)
POST /admin/login        → validate password, set cookie, redirect to dashboard
GET  /admin/dashboard    → overview: disk usage, session count, upload count, limits
GET  /admin/sessions     → session list with delete/bulk cleanup actions
GET  /admin/files        → uploaded files with previews and delete
POST /admin/sessions/:id/delete   → delete a session + its map file
POST /admin/sessions/cleanup      → bulk delete sessions older than N days
POST /admin/files/:filename/delete → delete an uploaded file + clear map reference
POST /admin/logout       → clear cookie, redirect to login
```

## Admin Dashboard

Three stat cards showing current usage against limits:

- **Disk Usage** — total size of uploads directory vs `MAX_STORAGE_MB`, with progress bar
- **Sessions** — count of active sessions vs `MAX_SESSIONS`, with progress bar
- **Uploaded Files** — count of files, noting how many are orphaned

Quick actions: "Delete sessions older than 7 days" and "Delete orphaned files".

## Session Management Page

- Table with columns: Code, Created (relative time), Map (Yes/No), Tokens (count), Grid (mode + size), Action (Delete button)
- Bulk cleanup bar at top: dropdown to select age threshold (1/3/7/14/30 days) + Delete button
- Rows older than 7 days highlighted with a red-tinted background
- Delete confirms via `confirm()` dialog
- Deleting a session also deletes its map file from the uploads directory

## File Management Page

- Card grid showing each uploaded file: thumbnail (served as `<img>` from `/uploads/`), filename, file size, associated session code (or "Orphaned")
- Orphaned files (on disk but not referenced by any session map) highlighted in red
- "Delete all orphaned" button at top
- Individual delete per file with `confirm()` dialog
- Deleting an active file clears the map reference from its session

### Orphan Detection

Scan uploads directory, cross-reference each filename against all session map `imageUrl` values (stripping the `/uploads/` prefix from `imageUrl` for comparison). Any file not referenced by a session is orphaned.

Note: the existing auto-cleanup in `index.ts` deletes old sessions but does not delete their map files, which creates orphans. Fix the auto-cleanup to also delete map files when removing sessions.

## Resource Guards

### Disk Usage Guard

- Before multer processes an upload, middleware calculates total size of uploads directory (`fs.readdirSync` + `statSync`)
- Uses `Content-Length` header as a conservative approximation of file size (includes multipart overhead, so slightly overestimates — acceptable)
- If current total + `Content-Length` > `MAX_STORAGE_MB` → reject with 507 and `{ error: "Storage limit reached" }`
- Check happens before multer saves the file to avoid write-then-delete

### Session Limit Guard

- Before creating a session, check `state.sessions.size`
- If count >= `MAX_SESSIONS` → reject with 507 and `{ error: "Session limit reached" }`

### Client Error Handling

- `handleCreate` in `App.tsx`: check response status, `alert()` error message on 507
- `handleUploadMap` in `App.tsx`: check response status, `alert()` error message on 507

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | (no default — admin disabled if unset) | Admin login password |
| `MAX_STORAGE_MB` | `1000` | Max total upload storage in MB |
| `MAX_SESSIONS` | `50` | Max concurrent sessions |

## Server File Changes

### New files

- `server/src/admin.ts` — admin routes, auth middleware, HTML template functions

### Modified fi

- `server/src/index.ts` — mount admin routes **before** the static file serving and catch-all `*` route (which serves the React SPA). Admin routes must take priority over the catch-all.
- `server/src/routes.ts` — add resource guard middleware to upload and session creation routes
- `server/src/state.ts` — expose `sessionCount` getter and `listSessions()` for admin views
- `client/src/App.tsx` — add error handling for 507 responses on session create and map upload

## HTML Rendering

Server-side rendered using template literal functions in `admin.ts`. A shared `renderLayout(title: string, content: string): string` function wraps page content with:
- Page shell with nav links (Dashboard, Sessions, Files, Logout)
- Inline CSS matching the app's dark fantasy theme (gold accents, dark backgrounds)
- No templating engine or additional dependencies

## Testing

- Unit tests for resource guard logic (disk size calculation, session count check)
- Unit tests for orphan detection
- Integration tests for admin auth flow (login, cookie, protected routes)
- Integration tests for admin CRUD operations (delete session, delete file, bulk cleanup)
