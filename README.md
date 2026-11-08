# Squeekside · Squeekchain HUD v2.4

A read-only stream companion for Squeekchain: live Sepolia blocks, confirmed SqueekCore rounds, and provisional hamster-wheel mining progress. The interface includes a responsive monitor, stream view, fullscreen, saved appearance controls, HUD guides, local viewer predictions, source settings, pause/resume, manual refresh, and two activity views. It continues the existing React/TypeScript/Vite source in `src/`; the original dependency manifest, lockfile, and build configuration are preserved.

## Install and preview

Use Node.js 22.12+ (validated with Node 24) and npm.

```sh
npm ci
npm run preview
```

Open the local URL printed by Vite. The included `dist/` is already built. `npm run dev` runs the source during development. For access from another device, supply your preferred host explicitly, for example `npm run preview -- --host 0.0.0.0`.

## Rebuild and check

```sh
npm run verify
```

This runs the strict TypeScript check, 19 data/prediction tests, production build, export integrity/size check, and a bounded HTTP subpath test. The individual commands are `npm run typecheck`, `npm test`, `npm run build`, `npm run check:export`, and `npm run check:http`.

`vite.config.ts` sets `base: './'`. Serve **all of `dist/`** from an ordinary static host, including its `assets/`, `fonts/`, `licenses/`, favicon, and share image. No backend, environment file, account, wallet, API key, or route rewriting is needed. Hashes select the monitor (`#monitor`) and stream view (`#stream`). `dist/` is intentionally included in the submission. The delivery target is [squeekside-squeekchain-stream-co.imd.site](https://squeekside-squeekchain-stream-co.imd.site). The managed publisher installs this export after submission; this worker has not published it or verified the new version at that live hostname.

## Using the HUD

- **Open stream view** removes activity history and the navigation links. Copy its URL into an OBS browser source; 1440 × 1080 gives the desktop HUD room to breathe. Fullscreen is optional.
- **Transparent page background** is available in stream view. Data panels remain opaque and readable. This choice is saved in this browser. The root canvas is transparent too, so it composites correctly in OBS.
- **Pause** stops automatic source reads and wheel animation, retaining the last successful data. The estimated round clock and data ages continue. Manual refresh reads once even while paused.
- **Network activity** switches between the latest six Sepolia blocks and six certified SqueekCore rounds. Block links open the Sepolia explorer.
- **Customize appearance** (palette control in the header) offers Dark, Light, or System mode; Mint, Violet, or Amber accents; reduced motion; and stream transparency. All six explicit color combinations include matching text, controls, wheel art, and focus colors. OS reduced motion is always honored.
- **HUD guide** opens Monitor, Stream setup, and Predictions topics. **About the data** explains source provenance and health. Dialogs support keyboard navigation, Escape, backdrop dismissal, and focus return.
- **Viewer predictions** opens a local poll: create a question and two choices, select a 1/2/5/10-minute window, save or change one prediction, close voting, confirm a manual outcome, download the record, and start another poll with replacement confirmation.
- **Settings** changes the public RPC, API base URL, or refresh interval (5, 12, or 30 seconds). Settings stay in this browser's local storage. Invalid saved settings fall back to defaults; unavailable storage still permits settings for the current visit.

## Prediction scope and persistence

Predictions are explicitly **local to this browser**, with one editable vote per poll. The static site does not aggregate viewers, authenticate a host, accept stakes, or award rewards. No shared voting service was present in the supplied source. Creating and resolving a poll are local controls, available to whoever uses that browser. Outcomes are manual, not inferred from telemetry or verified onchain.

The deadline uses an absolute browser timestamp, so pausing data reads, closing the modal, or reloading does not reset it. Deadline expiry locks votes. An outcome can be confirmed once after voting closes. Download the JSON record before replacing a poll; the site keeps only the current poll. Multiple tabs on the same origin synchronize local settings and the poll; simultaneous writes use the browser’s last stored value, not a multi-user transaction protocol.

Appearance, data settings, and the current poll use separate local-storage keys. Browser storage is optional: the interface stays usable with a visible visit-only warning when saving fails. OBS and ordinary browser windows have separate storage. Copy stream URL copies the route, not a poll or appearance preferences.

## What the numbers mean

| Readout | Source and meaning |
| --- | --- |
| Sepolia head | Direct JSON-RPC read; chain ID must be `11155111`. The newest six blocks must form a consistent parent-hash sequence. Tip blocks remain unconfirmed. |
| SqueekCore | Proxy `0x74665daeca35a2303e767e76a2ff1fb6f93e119f`. Configuration, state, and round history are read at one block, 12 blocks behind the tip, with a hash recheck. |
| Current round | Clock estimate from the **onchain** genesis and round duration and this browser's clock. A current round is not a settled round. |
| Settled progress | Earned block units divided by the configured block size; verified against SqueekCore's derived height and progress. It does not use work divided by difficulty. |
| Wheel speed, distance, work | Latest accepted device reading from the public API. Expired, missing, or failed measurements are shown as unknown, never as zero. Distance is the distance reported in that reading, not an inferred session total. |
| Live block projection | Provisional API estimate. The API must identify the pinned Sepolia deployment and supply consistent block units. When unavailable, the HUD explicitly shows **settled** progress instead. |
| Certified round gaps | A missing checkpoint within a certified interval is zero work. Rounds beyond the settled frontier are unknown and never filled with zero. |

Defaults: [PublicNode Sepolia RPC](https://ethereum-sepolia-rpc.publicnode.com), [Squeekchain public API](https://api.squeekchain.com). Protocol references: [SqueekCore](https://docs.squeekchain.com/developers/core/), [API](https://docs.squeekchain.com/developers/api/), and [Squeekchain](https://sepolia.squeekchain.com/). These services and the testnet deployment may change. HTTPS, browser CORS access, and the supported response schema are required for replacement sources. Requests time out after 18 seconds; failures back off, and HTTP `Retry-After` delays are respected.

## Validation and delivery

The current build's actual results and limitations are in [artifacts/validation.md](artifacts/validation.md), with [interaction results](artifacts/interaction-results.json), [the pinned design probe](artifacts/taste-results.json), and a [real source read](artifacts/live-read.json). These are worker-side evidence, not independent certification. [DESIGN.md](DESIGN.md) describes the final tokens and components; [NOTICE.md](NOTICE.md) records attribution.

The worker installs the unchanged lockfile into disposable scaffolding to avoid writing root dependencies:

```sh
node scripts/build-isolated.mjs
```

This copies the exact local source/configuration into `test/scratch/build/`, runs `npm ci`, typecheck, all tests, and a clean production build, then copies the built export to root `dist/` and runs the export and HTTP checks. `--reuse-install` is available for subsequent source iterations after that locked install. Everything in `test/scratch/` is disposable and excluded from the delivered bundle. A normal local checkout can simply use `npm ci` and `npm run verify`.

Optional rendered checks use a separate Playwright/axe installation, without altering the project manifest:

```sh
npm install --prefix test/scratch/tools --cache test/scratch/npm-cache playwright@1.58.2 axe-core@4.11.1
PLAYWRIGHT_BROWSERS_PATH=test/scratch/playwright-browsers node test/scratch/tools/node_modules/playwright/cli.js install chromium
PLAYWRIGHT_BROWSERS_PATH=test/scratch/playwright-browsers node scripts/check-browser.mjs
```

The script serves the real export under `/preview/squeekside/`, exercises interactions and accessibility states with explicitly controlled network fixtures, saves screenshots/results under `test/scratch/browser-results/`, and closes its browser and server. It accepts `--playwright`, `--axe`, and `--out` for alternate tool/output paths. WebKit is attempted if installed; missing browser libraries are reported. The pinned `taste.mjs` guide is an assignment input and is not distributed, so the archived result is supplied separately.

Current external limitations: direct source reads reached Sepolia and the pinned SqueekCore. The wheel API identified a **different SqueekCore deployment**, so its readings were rejected as designed. Real wheel measurements were not verified. The supplied browser service failed to launch; local Playwright Chromium performed the rendered validation instead. WebKit/Safari, physical devices, real OBS composition, screen-reader sessions, and native browser zoom remain unverified. The text-enlargement check uses a 32px root font at a 390px viewport; it is not native zoom. The live site's new version awaits managed publication.
