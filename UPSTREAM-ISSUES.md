# AstroAdmin — upstream issues: status and patches

**Update 2026-08-06 — verification + local implementation.**

Patched clone lives at `~/astro/projects/astroadmin-patched` (base: astroadmin
1.3.1). Run it against this site with:

```bash
bun ~/astro/projects/astroadmin-patched/bin/cli.js dev   # from THIS directory
```

| # | Item | Status |
|---|------|--------|
| 1 | Frontmatter round-trip corruption | **Not patched** — upstream tracks it as #31/#32/#33/#34 and is actively committing on it; a unilateral fix would collide. Comment drafts below. |
| 2 | Bun `.env` `$` expansion | **Implemented** — branch `fix/env-dollar-expansion`: `hash-password` prints a paste-ready escaped `.env` line; startup warns when the hash lacks the `$argon2` prefix. Both halves verified live. |
| 3 | Silent config errors | **Withdrawn** — tested, broken config fails loudly. My earlier claim was wrong. |
| 4 | Schema-aware widgets | **Already exists upstream** — enum selects, boolean checkboxes, date inputs all present in ui/form-generator.js. Claim was stale. |
| 5 | Entry ordering | Filed as suggestion (below) — needs maintainer design agreement before a PR. |
| 6 | Entry labels | **Implemented** — branch `feat/entry-labels`: `entryLabels` map in `GET /api/collections` (labelField config, then title/name/question/label), dropdown prefers labels. Verified live: FAQ entries show question text. |
| 7 | Docs on legacy collections API | **Implemented** — branch `docs/content-layer-api`: inline-editing.md rewritten to glob loaders, pointer note in content-collections.md. |
| 8 | Template-page scaffold | Suggestion only — too design-heavy for a drive-by PR. |
| 10 | Image previews broken for `public/` assets | **Implemented** — branch `fix/serve-public-assets`: admin only served `public/images` under `/images`; root-relative paths like `/blog/cover.png` broke. Now mirrors Astro by serving all of `public/` (after admin UI assets, index off). Verified in browser: cover image renders in the picker. |
| 9 | Pre-publish schema gate | Suggestion only — overlaps upstream's active work on #31–34. |

Combined branch `patched` = main + #2 + #6 + #10 (what we run locally).
Upstream test suite is red on a clean tree (their own issues #2/#38) —
identical failures with and without our patches, i.e. no regressions.

---

# Original drafts (kept for reference)


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

---

## Issue C — schema-parser resolves bare `zod` from the project root; breaks under strict/isolated installers (pnpm, nub)

**Symptom:** on a strict/isolated `node_modules` layout, editing a collection's
schema in `content.config.ts` (adding a nested field) silently didn't appear
in the admin. No error surfaced in the UI — the collection just fell back to
being treated as schema-less.

**Root cause** (found via server log, `console.error` output not otherwise
surfaced):

```
🔄 Parsing content schemas from config.ts...
✘ [ERROR] Could not read from file: node_modules/zod/index.js
❌ Failed to parse schemas: Failed to bundle config.ts: Build failed with 1 error:
astro-content-shim:astro:content:2:18: ERROR: Could not read from file: .../node_modules/zod/index.js
Could not load schemas for pages; treating as glob: Failed to bundle config.ts: ...
```

`server/utils/schema-parser.js` bundles the project's `content.config.ts`
with esbuild to extract the zod schema. Our config imports `z` from
`astro/zod` (the documented, current API) — a real, declared dependency
(`astro`). But `astro/zod` itself re-exports the `zod` package internally,
and esbuild's bundler, running with the **project root** as its resolution
root, needs to resolve the bare specifier `zod` from there. Under npm's flat
`node_modules`, `zod` (a transitive dependency of `astro`) gets hoisted to
the top level by accident and resolution succeeds. Under an isolated/strict
installer (pnpm, **nub**), `astro`'s own dependencies live inside `astro`'s
private store slot, not hoisted to the project root — so `zod` isn't
resolvable from where esbuild is looking, and the whole schema parse fails.

**Impact:** any project using a strict package manager gets silently
degraded schema support — nested fields, enums, etc. don't show up, with no
error surfaced to the user (only to the server console, which most people
don't watch).

**Our fix (workaround, not root cause):** declared `zod` as an explicit
`devDependency` in the project so any installer places it at the top level
regardless of hoisting behavior:

```bash
nub add -D zod@^4.3.6   # match astro's zod version
```

This works, but every project using AstroAdmin under a strict installer
needs to know to do this — it shouldn't be necessary.

### Suggested fix (PR direction)

1. **Bundle `astro-content-shim` with `zod` marked external** and resolve it
   *relative to the installed `astro` package* (e.g.
   `require.resolve('zod', { paths: [require.resolve('astro')] })`) instead
   of from the project root. This is the same fix pattern their own
   `astro-content-shim` already uses for `astro:content` — extend it to
   `zod`.
2. **Surface the failure to the UI**, not just server logs — a collection
   silently degrading to schema-less is a hard bug to notice; a banner or
   `entryLabels`-style warning in the collections API response would have
   saved real debugging time here.
3. Add to the `doctor`-style preflight (draft in Issue 3, withdrawn as a bug
   but still a good feature): verify `content.config.ts` parses under the
   *installed* package manager's actual resolution — this exact failure mode
   is precisely what a preflight check should catch before a user goes
   looking for a missing form field.

---

## Issue D — image-field detection is name-only, false-positives on non-image fields

`ui/form-generator.js#isImageField` treats any field whose name equals or
ends with one of `['image', 'logo', 'ogImage', 'src', 'icon', 'avatar',
'photo', 'thumbnail', 'banner', 'background']` as an image field, rendering
the image-picker widget (Browse Library / Upload New / preview thumbnail)
regardless of the zod schema's actual type.

**Repro:** a schema field named `icon` holding an icon-set identifier string
(e.g. `z.string()` with value `"rocket"`, used with `astro-icon`'s `<Icon
name={icon}>`, not a file path) gets forced into the image picker. The
preview tries to load `"rocket"` as an image URL — broken-image icon, no way
to just type the string value directly without renaming the field.

**Workaround applied:** renamed the field to `iconName` in our schema, since
it no longer matches the name-list (`endsWith('icon')` is false for
`iconname`). Works, but anyone who prefers the name `icon` for this
extremely common non-image use (icon-set identifiers) hits this with no
recourse except renaming.

### Suggested fix (PR direction)
1. Prefer the zod schema's actual shape when available: an `enum` of known
   icon names, or a schema `.describe('icon-name')` marker, should route to
   a plain text/select input, not the image picker — falling back to the
   name heuristic only when no better signal exists.
2. Failing that, expose a config-level override (`collections.<name>.fields`
   in `astroadmin.config.js`) so a specific field can be pinned to a widget
   type regardless of its name — this is the more general fix and would
   also help issue #4 (schema-aware widgets/enums).
