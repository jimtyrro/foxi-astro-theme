# AstroAdmin — upstream issue/PR drafts

Ready-to-submit drafts for https://github.com/cloudshipco/astroadmin/issues.
Ordered by severity. #1–3 are bugs we hit in production use; #4–6 are feature suggestions.

---

## Issue 1 — Saving an entry corrupts frontmatter (drops fields, stringifies dates)

**Severity: high — a single admin save broke `astro build`.**

### Reproduction
1. Astro 5+ blog collection, schema requires `image: z.string()` and `pubDate: z.date()`.
2. Entry frontmatter before editing in AstroAdmin:

```yaml
title: 'Security Enhancements now here!'
pubDate: 2024-05-05T05:00:00Z
description: '...'
author: 'Christos P'
image: '/blog/post-03-cover.png'
tags: ['productivity', 'app']
```

3. Open the entry in AstroAdmin, edit body text, save.

### Actual
Frontmatter is rewritten lossy:
- `image` (required by schema) is **dropped entirely**
- `pubDate` is stringified: `'2024-05-05'` — fails `z.date()`
- a spurious `body: >` key appears, containing the markdown body

Next `astro build` fails with `InvalidContentEntryDataError`.

### Expected
- Round-trip is lossless: fields the editor doesn't expose are preserved verbatim.
- Values are serialized according to the collection's zod schema (`z.date()` → unquoted ISO date).
- Body stays body — never lifted into frontmatter.

### Suggested fix (PR direction)
1. Parse frontmatter with a YAML lib that preserves unknown keys; merge edited fields into the parsed object instead of regenerating frontmatter from the form model.
2. After building the write payload, validate it against the collection's zod schema (schemas are already introspected for form generation). Refuse the write — or warn loudly in the UI — if validation fails. This single check would have prevented the breakage.
3. Add a round-trip test: load fixture entry → save unchanged → assert byte-identical frontmatter.

---

## Issue 2 — Documented `.env` example breaks under Bun ($ expansion)

**Severity: high — every login fails with "Invalid credentials" despite correct password.**

AstroAdmin runs under Bun (`#!/usr/bin/env bun` in `bin/cli.js`). Bun auto-loads `.env` and performs `$VAR` expansion **even inside single quotes**. The docs tell users to set:

```ini
ADMIN_PASSWORD_HASH='$argon2id$v=19$m=65536,t=2,p=1$...'
```

Bun expands `$argon2id`, `$v`, `$m`, … as variable references and the server receives a mangled hash. `Bun.password.verify` then fails for every login.

Verified:
```
$ bun -e "console.log(process.env.ADMIN_PASSWORD_HASH)"
"=19=65536,t=2,p=1/..."        # segments swallowed
```

### Suggested fix (PR direction)
Preferred: stop relying on Bun's implicit `.env` loading — load it explicitly with `dotenv` (no expansion by default) in `bin/cli.js` before anything reads `process.env`. Runtime-independent behavior, no doc caveats needed.
Minimum: document the workaround — escape every `$` as `\$`:

```ini
ADMIN_PASSWORD_HASH='\$argon2id\$v=19\$m=65536,t=2,p=1\$...\$...'
```

---

## Issue 3 — No preflight diagnostics; config parse failures are silent

**Severity: medium.**

An `astroadmin.config.js` with a syntax error (in our case an unclosed `auth` brace — easy to introduce when editing the docs' snippet) fails to load with no actionable message. Combined with issue #2, first-run setup needed source diving in the npx cache to debug.

### Suggested fix (PR direction)
Add `npx astroadmin doctor` (and run its checks on `dev` startup):
- config file parses; report file/line on failure
- `.env` loads; `ADMIN_PASSWORD_HASH` starts with literal `$argon2id$` (catches issue #2)
- hash verifies against a prompted test password
- preview URL reachable
- `public/images/` exists
- content collections sync without schema errors

---

## Issue 4 — Form inputs should be schema-aware

The admin introspects zod schemas but renders generic inputs. Suggestions:
- `z.enum([...])` → dropdown (free text today lets users save invalid categories)
- `z.boolean()` → checkbox
- `z.date()` → date picker that writes schema-valid dates (relates to issue #1)
- `z.array(z.object(...))` → repeatable field group

---

## Issue 5 — Entry ordering without filename hacks

For ordered collections (FAQs, changelog) the only ordering mechanism is filename prefixes (`01-….json`). Support an optional conventional `order: z.number()` field: sort the sidebar by it, drag-to-reorder rewrites the field.

---

## Issue 6 — Human-readable entry labels

Sidebar entries display as slugified filenames (`01-what-is-the-cost-of-the-basic-plan`). Add a per-collection `labelField` config hint (or heuristic: first of `title`/`name`/`question`) used for display.

---

## Issue 7 — Docs use the legacy Astro ≤4 collections API

`docs/inline-editing.md` and `docs/configuration.md` show `defineCollection({ type: 'data', ... })` in `src/content/config.ts`. Astro 5+ projects use the Content Layer API in `src/content.config.ts`, and Astro 6 removed legacy collections entirely — following the docs on a current Astro project produces a config that doesn't work and can't be mixed with loader-based collections. Please document the loader form:

```ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const pages = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), description: z.string() })
})
```

---

## Issue 8 — "Template page" notice could scaffold the conversion

Pages not backed by a collection show "This is a template page." Nice improvement: detect candidate content in the page's frontmatter and offer a `astroadmin convert <page>` scaffold (generate JSON entry + patched page), or at minimum deep-link the relevant section of inline-editing.md.

---

## Issue 9 — Gate publish on schema validation

If an entry fails collection schema validation (see issue #1), `publish` currently commits and pushes it, breaking the next site build on the host. Run the equivalent of `astro sync` validation before commit and block the publish with a clear error.
