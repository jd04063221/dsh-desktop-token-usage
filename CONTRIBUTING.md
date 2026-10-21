# Contributing

Single-maintainer plugin, but drive-by fixes (especially translations) are welcome.

## Prerequisites

- Node >= 22 (`engines.node`). The CI matrix tests 22.19.0, 24 and 26.
- No browser needed: `npm test` fakes the DOM. Re-rendering `assets/` needs
  headless Chrome (see `scripts/render-shots.mjs`).

## Checks before a PR

```
npm ci
npm run verify   # npm test + tarball probe; must be green
```

Plus, when you touched the matching area:

| You changed | Run this | Why |
|---|---|---|
| `locales/*.json` | `node scripts/build-dicts.mjs --check` (or without `--check` to fix) | dictionaries are inlined into `client.js`; CI also runs the check explicitly |
| screenshots | re-render via `scripts/render-shots.mjs`, then keep `assets/` small | `test:package` fails the run when the unpacked tarball exceeds 1536 kB |
| `CHANGELOG.md` | mirror the edit into all nine `translations/CHANGELOG-*.md` | `test/i18n.test.mjs` asserts identical version sequences |
| `README.md` | mirror into all nine `translations/README-*.md` | same assertion, plus the link-switcher test |
| DSH compat table | `node scripts/dsh-compat.mjs <dir> <label>` or the Compat workflow | paste the VERDICT block into the README table |

## Screenshots and package size

Six PNGs are ~600 kB of a ~700 kB tarball. After re-rendering, compress before committing:

```
# lossy is fine for dashboard shots; keep the README-embedded set under ~700 kB total
npx -y imagemin-cli assets/*.png --out-dir=assets
```

Or with oxipng (lossless): `oxipng -o max assets/*.png`. If the budget check in
`scripts/verify-package.mjs` still fails, do not bump the number silently: say so
in the PR.

## Translations

- Source of truth is `locales/en.json`. Every other `locales/<id>.json` must carry
  the same keys, exactly its own CLDR plural categories, and the same `{placeholders}`.
- `locale/*.json` are DSH manifest stubs (`meta` only). Never paste dictionary keys there;
  `test/i18n.test.mjs` has a dedicated guard for this exact mistake.
- npm ships only the Chinese document pair (`translations/README-zh.md`,
  `translations/CHANGELOG-zh.md`); the other sixteen documents are GitHub-only.
  Do not widen `files` without revisiting the policy comment in `verify-package.mjs`.

## Versioning (matches the maintainer local workflow)

- Three-part versions only, no letter suffixes, no prerelease on `main`.
- During development the version carries `-rc.N`; the suffix is dropped before push.
- The CHANGELOG section is titled with the target version while unreleased,
  dated on push day. `node scripts/prepare-release.mjs <version>` automates this.
