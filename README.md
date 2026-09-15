# Pulse — live polling (static prototype)

Front-end only. All data lives in the visitor's own browser (`localStorage`), so it is
useful for a single-machine demo. Real multi-device collection needs a backend — see
"Limitation" below.

## Deploy to GitHub Pages

1. Create a new **empty** repo on your personal GitHub account (no README, no .gitignore).
   Call it `pulse`.

2. In this folder, run — replacing `YOUR-USERNAME`:

```bash
git init
git add .
git commit -m "Pulse live polling prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pulse.git
git push -u origin main
```

3. In the repo: **Settings → Pages → Build and deployment**
   - Source: `Deploy from a branch`
   - Branch: `main`, folder: `/ (root)` → Save

4. Wait ~1 minute, then open `https://YOUR-USERNAME.github.io/pulse/`

The QR code in Present mode automatically encodes whatever URL the app is served from,
plus `#join=<code>`, so it will point at your Pages URL with no code changes.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Entry point; redirects to the app, preserving `#join=` |
| `Polling Platform.dc.html` | The whole app: admin, presentation, participant views |
| `qr.js` | Self-contained QR encoder (no CDN dependency) |
| `support.js` | Runtime required by the app file |
| `supabase-config.js` | Your Supabase URL + anon key (edit this) |
| `supabase-schema.sql` | Run once in the Supabase SQL editor |

Keep them all at the repo root.

## Multi-device sync with Supabase

Without Supabase the app runs local-only: each device keeps its own copy, so a phone's
answer never reaches the presenter screen. To make it real:

1. Go to supabase.com, sign in, **New project**. Pick any name and region close to you,
   set a database password (you won't need it again), and wait ~2 min for provisioning.
2. **SQL Editor → New query** → paste all of `supabase-schema.sql` → **Run**.
   It creates `sessions`, `participants`, `responses` and opens anon access.
3. **Project Settings → API** → copy **Project URL** and the **anon public** key.
4. Paste both into `supabase-config.js`:

```js
window.SUPABASE = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJhbGciOi..."
};
```

5. Commit and push. The header should read **live · synced via Supabase**; if something
   is wrong it shows the Supabase error instead.

The presenter screen polls every 2 seconds, so answers appear within ~2s of submission.

### Security note

The anon key is public by design, and the policies in the schema allow anyone with your
Pages URL to read and write these three tables. That is appropriate for an internal
research session. Don't collect confidential data, and run `Clear answers` (or drop the
session) when you're done.
