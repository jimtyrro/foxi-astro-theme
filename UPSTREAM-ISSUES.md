# AstroAdmin — upstream issue/PR drafts

Drafts for https://github.com/cloudshipco/astroadmin/issues.
**Status column updated 2026-08-06 after verifying each claim against the
upstream package source (v1.3.0, latest) and the existing issue tracker.**

## Verification summary

| Draft | Verdict | Why |
|---|---|---|
| #1 frontmatter corruption | **Already filed — do not re-file** | upstream #31 (dates truncated), #32 (required fields deleted), #33 (spurious `body` key) cover exactly what we observed. Action: comment on #32/#33 with our repro, subscribe. |
| #2 Bun `.env` `$` expansion | **Valid, not covered** | confirmed by experiment; `docs/requirements.md` documents Bun as the runtime but no doc anywhere mentions escaping. File it. |
| #3 config errors silent | **Withdrawn — claim was wrong** | tested: a syntactically broken `astroadmin.config.js` prints `❌ Failed to load astroadmin.config.js: Expected identifier but found end of file` and refuses to start. Our earlier confusion was the *missing-brace file we wrote*, never actually run against the server with a visible console. A `doctor` command remains a nice-to-have but isn't a bug; not worth filing alone. |
| Docs legacy collections API | **Valid, not covered** | `best-practices.md`, `content-collections.md`, `inline-editing.md` all still use `type: 'data'` (Astro ≤4 API, removed in Astro 6). File it. |
| Schema-aware forms (#4), ordering (#5), labels (#6), template-page scaffold (#8), publish gate (#9) | Feature suggestions, not covered in tracker | File if wanted, lower priority. Related: #34 (primitive arrays corrupted), #30 (nullable/union schemas) overlap #4. |
| — | **Bonus: comment on upstream #28 "Astro 7 support"** | we run astroadmin 1.3.0 against Astro 7.1.6 — login, collection listing, entry editing all work. A "works for me on 7.1.6, with these caveats" comment is a cheap, useful contribution. |

Note on "did our fixes resolve these": no — our fixes were local workarounds
(escaped `.env`, repaired `security.md`). The upstream package behavior is
unchanged; only the verdicts above changed (what's worth filing).

---

## Issue A — Documented `.env` example breaks under Bun ($ expansion)

AstroAdmin runs under Bun (`#!/usr/bin/env bun` in `bin/cli.js`; Bun is listed
as the runtime in `docs/requirements.md`). Bun auto-loads `.env` and performs
`$VAR` expansion **even inside single quotes**. The docs tell users to set:

```ini
ADMIN_PASSWORD_HASH='$argon2id$v=19$m=65536,t=2,p=1$...'
```

Bun expands `$argon2id`, `$v`, `$m`, … as variable references and the server
receives a mangled hash. `Bun.password.verify` then fails every login with
"Invalid credentials" despite the correct password.

Repro:
```
$ bun -e "console.log(process.env.ADMIN_PASSWORD_HASH)"
"=19=65536,t=2,p=1/..."        # $-segments swallowed
```

### Suggested fix (PR direction)
Preferred: stop relying on Bun's implicit `.env` loading — load it explicitly
with `dotenv` (no expansion by default) in `bin/cli.js` before anything reads
`process.env`. Runtime-independent behavior, no doc caveats needed.
Minimum: document the workaround — escape every `$` as `\$`:

```ini
ADMIN_PASSWORD_HASH='\$argon2id\$v=19\$m=65536,t=2,p=1\$...\$...'
```

---

## Issue B — Docs use the legacy Astro ≤4 collections API

`docs/inline-editing.md`, `docs/configuration.md`, `docs/best-practices.md`,
and `docs/content-collections.md` all show
`defineCollection({ type: 'data', ... })` in `src/content/config.ts`.
Astro 5+ projects use the Content Layer API in `src/content.config.ts`, and
Astro 6 removed legacy collections entirely — following the docs on a current
Astro project produces a config that cannot be mixed with the loader-based
collections a modern project already has. Please document the loader form:

```ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const pages = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), description: z.string() })
})
```

(Related to #28 "Astro 7 support" — doc updates are part of that story.)

---

## Comment draft for upstream #32 / #33 (frontmatter corruption — our repro)

> Hit this in the wild on 1.3.0: editing a blog entry rewrote frontmatter
> lossy — required `image` field dropped (#32), `pubDate: 2024-05-05T05:00:00Z`
> stringified to `'2024-05-05'` (#31), and a spurious `body: >` key added
> containing the markdown body (#33). Next `astro build` failed with
> `InvalidContentEntryDataError`. Happy to test a fix.

## Comment draft for upstream #28 (Astro 7 support)

> Data point: astroadmin 1.3.0 against Astro 7.1.6 — login, collection
> listing/entry API, and editing of glob-loader collections (`blog`,
> `pages`, `faq` data collections) all work. Site builds and dev-serves fine.
> Only caveat encountered is unrelated to v7 (frontmatter round-trip, #31–33).
