## What changed

<!-- one paragraph: behavior, not file list -->

## Checklist (check what applies)

- [ ] `npm run verify` is green (`npm test` + tarball probe)
- [ ] `locales/*.json` touched? `node scripts/build-dicts.mjs --check` passes
  (or ran the builder and committed the regenerated `client.js` block)
- [ ] `README.md` touched? mirrored into all nine `translations/README-*.md`
- [ ] `CHANGELOG.md` touched? mirrored into all nine `translations/CHANGELOG-*.md`
  with identical `## [x.y.z]` version titles
- [ ] screenshots re-rendered? `assets/` total still within the 1536 kB unpacked
  budget (`npm run test:package` proves it)
- [ ] DSH behavior touched? `scripts/dsh-compat.mjs` or the Compat workflow run,
  README compat table updated

## Screenshots / VERDICT paste

<!-- dashboard shots, or the compat harness VERDICT block -->
