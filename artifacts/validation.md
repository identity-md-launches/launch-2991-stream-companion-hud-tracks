# HUD v2.4 build and interface review

Completed 2026-11-08. **Complete for the repository build/export scope.** The new version's live publication is handled after submission and was not performed or verified here. This report is worker-side evidence, not independent certification.

| Area | Result |
| --- | --- |
| Required static deliverables | Source, unchanged manifest/lockfile/configuration, complete `dist/`, README and DESIGN present |
| Named HUD features | Themes, guide dialogs and local viewer prediction lifecycle implemented; existing read-only HUD retained |
| Build / typecheck / unit tests | Pass / pass / 19 of 19 pass |
| Browser validation | 28 passing checks, including 17 axe scans; no application script errors or missing local assets |
| Product and main action at 390 | Yes; stream action y=234–278, prediction action y=170–214 |
| Pinned taste@1 probe | 16 of 16 pass on the final export |
| Copy / share metadata | Recoverable source errors and local-only prediction scope; title, favicon, description, og:title and og:image present |
| Publication | After submission, target `squeekside-squeekchain-stream-co.imd.site`; new live version unverified |

## Scope and assumptions

The local source was an existing React/TypeScript/Vite read-only monitor. It already had Sepolia/SqueekCore readers, wheel telemetry validation, stream routing, data settings, pause/refresh, and source details. It did not contain theme toggles or viewer polls. This build adds the named v2.4 surfaces without replacing the original interface, dependency set, RPC/ABI, pinned contract, or chain. The package's existing version field is preserved; the product identifies itself as HUD v2.4 in the interface and document metadata.

The supplied project has no shared voting service or host identity. The useful static implementation is explicitly browser-local: a custom question, two choices, 1/2/5/10-minute window, one editable ballot, automatic or manual voting closure, manual one-time outcome, JSON record download, and confirmed replacement. No viewer totals, stakes, rewards, or verified outcomes are fabricated. Network-wide voting is outside this implementation. Settings and polls can synchronize between same-origin tabs via storage events; simultaneous writes are last-write-wins, not a distributed voting protocol.

The appearance choices are Dark/Light/System mode, Mint/Violet/Amber accent, reduced motion and transparent stream background. The existing mint wheel and hamster are the visual identity. Guide topics cover monitoring, OBS setup, and predictions. The site remains English and read-only, so wallet-connectors guidance is not applicable: no wallet, signatures, chain transactions, or deployment changes were introduced.

## Actual verification

1. Installed the existing `package-lock.json` with `npm ci --prefix test/scratch/build --cache test/scratch/npm-cache --no-audit --no-fund`. No runtime dependency was added. All installation/cache/browser artifacts remain inside disposable `test/scratch/`.
2. Ran `node scripts/build-isolated.mjs --reuse-install` after the final source change. It copied the exact current source and unchanged configuration, deleted the staged export, ran `npm run typecheck` (`tsc --noEmit`), `npm test`, `npm run build`, copied the clean result into root `dist/`, then ran `npm run check:export` and `npm run check:http`. All passed. There were two non-fatal Zod comment-annotation warnings from Rollup; they do not alter application behavior. [Build record](build-results.json).
3. All **19 unit tests** passed: 13 original data tests, plus six poll tests for validation, immutable vote replacement, exact deadline/reload boundaries, manual closure and one-time resolution, expired unvoted polls, and corrupt stored records. Chain tests cover wrong-network/deployment rejection, consistent confirmed state, certified gaps, stale/future measurements, unsafe URLs, source failure, and retry delay parsing.
4. `node scripts/check-http.mjs` fetched all **7 referenced assets** at `/preview/squeekside/`, with no root-asset or SPA fallback. It checks relative JS/CSS/font URLs, including fonts referenced from CSS. The first invocation inherited a loopback proxy problem; an explicit local HTTP agent fixed the test transport. The final unmodified invocation passes. The export check also verifies the 1200 × 630 share image, local asset existence, symlink exclusion, and byte budgets.
5. Ran `PLAYWRIGHT_BROWSERS_PATH=test/scratch/playwright-browsers node scripts/check-browser.mjs`. The script serves actual `dist/` at a subpath and owns/cleans up its HTTP server and Chromium session. It returned **28 passing checks**, including **17 axe-core 4.11.1 scans** with zero violations against the selected WCAG A/AA tags. [Full results](interaction-results.json). Network inputs in this suite are **controlled test fixtures**, including fresh/stale/error wheel responses and unavailable contract responses. They are never bundled into runtime assets. Two expected HTTP error console messages occurred during the deliberate source-failure case; no application exceptions or failed local resources occurred.
6. Browser interactions covered pause/resume, refresh while paused, both activity views, all guide topics, modal Tab containment/Escape/focus return, all six color palettes on the monitor and appearance dialog, System mode changes, saved appearance, both reduced-motion mechanisms, poll creation/validation/vote change/reload/closure/outcome/download/replacement, timer expiry accelerated by Playwright's clock (no minute-long wait), real browser clipboard access, fullscreen, transparent root and body, saved data interval/defaults, retry recovery, and creation/voting with blocked storage. Both local font faces reported `loaded`.
7. Layout checks passed at **320, 390, 768, 1000 and 1440 CSS pixels**, including appearance, guide and prediction dialogs. At 390 × 844, the title is y=99–134, Viewer predictions y=170–214, Open stream view y=234–278, and the wheel illustration y≈590–711 in the controlled source-error state. The first screen was inspected in the screenshot. A 32px root-font test at 390 also passed document/dialog horizontal reflow checks. This is text enlargement, not browser-native zoom.
8. Ran the original pinned probe, unmodified:

   ```sh
   IMD_PLAYWRIGHT=test/scratch/tools/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=test/scratch/playwright-browsers node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
   ```

   It exited 0 with **16/16 passing checks**. [Probe output](taste-results.json). Default monitor results: no horizontal scroll, text overlap, floating controls over text or clipped text at 320/390/1440; solid-background text passes 4.5:1 (3:1 for large text); at most six intended font sizes, two font families and three weights; no tracked kickers, repeated copy, shadow/border card stacking, or `transition: all`. The 390 first-screen prose count is 18 words. Its unmocked wheel feed was unavailable, so the separate controlled telemetry test established reduced motion with a genuinely running wheel animation.
9. A separate real call to the production data loaders reached Sepolia and the pinned SqueekCore, with no fixtures. The wheel API identified a different SqueekCore deployment and was rejected. [Time-stamped source read](live-read.json). These are observations from that time, not promises about third-party uptime.

## Better Interface coverage

The pinned workflow, core principles in all six domains, and documentation method were read and applied. Their original notices/licenses remain in `NOTICE.md`, `public/licenses/Design-guidance.txt`, and `dist/licenses/`.

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native buttons/links/forms/radios/dialogs, labels and inline errors, stable status regions, pressed state, visible focus, keyboard guide flow, stream skip link, motion guards; axe scans of monitor, appearance variants, guide, voting/results and data settings | No screen-reader session, voice control, physical touch or comprehensive accessibility certification |
| Layout — Checked | Existing monitor hierarchy retained; first-screen actions; five viewport widths; modal scroll/reflow; 200% root-text enlargement; original probe's default-font overlap/clipping checks | Native zoom, RTL/pseudo-localization and physical devices unverified; English is the implemented locale |
| Writing — Checked | Explicit local-only poll scope; manual outcome and storage limitations; clear create/save/close/confirm/download actions; guide instructions adjacent to the relevant controls; recoverable missing-source text | No audience comprehension study; no claim of shared multi-user voting |
| Typography — Checked | Six-size token scale; local Inter and IBM Plex Mono loaded; numbers separated from prose; long question/choice wrapping; inputs at 16px; default probe typography checks | Every possible user-authored string, fallback font/OS and browser zoom combination not tested |
| Colors — Checked | Role tokens across six palettes; measured default solid-background text contrast from taste; axe scans of each monitor/appearance palette; radio/check/pressed labels accompany colors | Translucent backgrounds over arbitrary OBS scenes, decorative art and every OS control style not measured |
| UI details — Checked | Flat panels, matching existing icons, pressed/selected/disabled/loading/empty/error states; local persistence and blocked-storage fallback; live/reduced animation states; theme changes suppress transitions | Animation-panel replay at 10% speed and native forced-colors rendering not performed |

## Findings and corrections

Source locations below refer to the final files; observations describe the defects found before correction.

| Severity / domain | Source | Finding and correction | Recheck |
| --- | --- | --- | --- |
| High / requirements | `src/App.tsx:485`, `src/Appearance.tsx:45`, `src/Guides.tsx:4`, `src/Predictions.tsx:10` | Named v2.4 theme and prediction functions were absent. Added them to the existing HUD, with a visible version and guide topics. Kept predictions explicitly local because no shared service exists. | Theme controls and complete poll lifecycle pass; metadata and first-screen probe pass |
| Medium / accessibility | `src/Dialog.tsx:20` | Repeated Tab could leave the modal controls. Added explicit wrapping at first/last controls while retaining native background inertness and Escape/focus return. | Eight consecutive Tab steps remain within the guide; Escape returns to its trigger; visible ring inspected |
| Medium / accessibility | `src/Predictions.tsx:21` | Creating/replacing a poll or moving from voting to results removes the focused control. The new state focuses its heading or question input inside the open dialog. | State lifecycle exercised in Chromium; focus-management code reviewed |
| Medium / layout | `src/styles.css:596`, `src/styles.css:1591` | Fresh wheel values overflowed to 478px in a 390px viewport at 32px root text. Replaced rigid stats columns with an adaptive minimum and allowed units to wrap. | Same fresh-data enlargement now has no horizontal document/dialog overflow |
| Medium / UI | `src/App.tsx:376`, `src/features.css:120` | Setting body transparency alone left the root canvas opaque. Apply transparency to root and body only in stream view, preserving opaque panels. | Computed root alpha is zero in stream mode; selection persists after reload; normal background returns on exit |
| Low / accessibility | `src/App.tsx:220`, `src/Predictions.tsx:88` | Wrapping field hints also became part of input names, repeating descriptions and changing names on validation. Added explicit label IDs while retaining described-by errors/hints. | Exact-name field interactions and invalid-field focus pass |
| Medium / writing | `src/App.tsx:551`, `src/App.tsx:589` | Failure copy could describe a missing first read as stale or imply cached core data when only blocks were available. Distinguish unavailable reads and explicitly retain Sepolia blocks on partial failure. | Source-failure/retry scenarios and final probe render pass |
| Low / navigation | `src/App.tsx:426` | The skip anchor changed the hash and could leave stream view. It now moves focus/scroll to main without changing the route. | Keyboard skip retains `#stream` and focuses main |

No confirmed high/medium finding remains within the implemented repository scope. The design idea remains a quiet instrument panel: a schematic wheel and small hamster identify the product, with data and controls taking priority over explanation.

## Screenshots inspected

These come from the final export's controlled interaction suite, not from a live shared voting service. Values visible in them are test inputs.

- [390px monitor and first action](screenshots/mobile-390.png)
- [1440px monitor](screenshots/desktop-1440.png)
- [Light violet appearance controls](screenshots/appearance-light.png)
- [Guide with visible keyboard focus](screenshots/keyboard-guide.png)
- [Saved local prediction](screenshots/poll-vote.png)
- [Manually resolved local result](screenshots/poll-result.png)

The original probe's unmocked screenshots were also viewed in `test/scratch/taste/shots/`; scratch evidence is not shipped. Runtime assets and these selected review screenshots remain in the submission budget.

## Remaining limitations

- The supplied browser service answered **“Socket path too long”** at Chromium launch. Local Playwright Chromium successfully loaded the actual served export and provided the rendered evidence above. WebKit answered that required system libraries were missing; Safari behavior is not verified.
- Browser-direct public RPC/API availability is not guaranteed by a successful shell read. The current API's different deployment is rejected, so genuine wheel speed/distance/projections remain unverified. No pinned address or chain configuration was changed to force a match.
- No shared viewer tally or host authority exists in a static local poll. The UI and exported JSON state this. A separate shared service would be needed for cross-visitor results.
- Physical devices, native zoom, screen readers, forced colors, real OBS composition, concurrent-tab conflict handling and native browser storage quota exhaustion are not fully verified. Blocked-storage behavior was tested by making writes throw in the browser.
- No publish command, onchain operation, repository push or live-host replacement was performed. Source/export are ready for the managed submission publisher; publication itself remains after this review.
