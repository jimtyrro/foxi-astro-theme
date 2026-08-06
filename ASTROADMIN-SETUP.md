# AstroAdmin Setup — Working Configuration

Verified working on this project (2026-08-05). Two non-obvious gotchas are covered in §3 and §6 — read them before changing anything.

## 1. Config file — `astroadmin.config.js` (project root)

Must be named exactly `astroadmin.config.js` (not `.ts`/`.mjs`). Every opened brace must be closed — an earlier breakage was a missing `},` on the `auth` block, which made the whole config fail to parse.

```js
export default {
  preview: {
    url: process.env.PREVIEW_URL || 'http://localhost:4321',
  },
  auth: {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
  },
};
```

Sanity-check it parses:

```bash
node -e "import('./astroadmin.config.js').then(m=>console.log(JSON.stringify(m.default)))"
```

## 2. Generate credentials

```bash
# prints an argon2id hash — keep the password it was made from
npx astroadmin hash-password 'YOUR-PASSWORD'

# session secret
openssl rand -hex 32

# upload target for images (must exist)
mkdir -p public/images
```

## 3. `.env` — the Bun `$`-expansion gotcha ⚠️

AstroAdmin runs under **Bun** (CLI shebang is `#!/usr/bin/env bun`). Bun's `.env` parser expands `$VAR` **even inside single quotes**, so a pasted argon2 hash (`$argon2id$v=19$m=...`) gets silently mangled — every `$...` segment is swallowed as a variable reference. Symptom: **"Invalid credentials" on every login** despite the correct password.

Fix: escape **every** `$` as `\$`:

```ini
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='\$argon2id\$v=19\$m=65536,t=2,p=1\$...\$...'
SESSION_SECRET=<64 hex chars from openssl rand -hex 32>
```

Verify the hash survives loading (must print the full hash with all `$` intact):

```bash
bun -e "console.log(process.env.ADMIN_PASSWORD_HASH)"
```

Current login for this project: user `admin`, password `e0vB175GTUgYUzF` (change by regenerating the hash per §2 and re-escaping).

## 4. Run

```bash
# terminal 1 — Astro site (needed for the preview iframe)
npm run dev          # http://localhost:4321

# terminal 2 — admin panel
npx astroadmin dev   # http://localhost:4000 (or --port XXXX)
```

Log in at the admin URL with the credentials above.

## 5. Verify login end-to-end

```bash
curl -X POST http://localhost:4000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR-PASSWORD"}'
# expect: {"success":true,"user":"admin"}
```

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid credentials` with correct password | Bun ate the `$` segments of the hash | escape `$` → `\$` in `.env` (§3), restart |
| Config seems ignored | file not named exactly `astroadmin.config.js`, or syntax error | run the §1 parse check |
| `.env` changes have no effect | server not restarted | restart `npx astroadmin dev` |
| Preview iframe blank | Astro dev server not running / wrong port | start `npm run dev`, match `preview.url` |
| Image upload fails | missing directory | `mkdir -p public/images` |
| "This is a template page" | page content is hardcoded in `.astro`, not in a content collection | expected; only collection-backed content (blog posts here) is inline-editable — see `docs/inline-editing.md` in the astroadmin repo |

Note: blog posts (`src/content/blog/*.md`) are editable out of the box. Static pages (home, contact, pricing, FAQ…) are hardcoded template pages in this theme and show the "template page" notice until converted to content collections.

## 7. Worth reporting upstream

The official `docs/configuration.md` shows `ADMIN_PASSWORD_HASH='$argon2id$...'` without mentioning Bun's `$` expansion — their own documented example breaks under their own runtime. Suggest they add the `\$` escaping note.
