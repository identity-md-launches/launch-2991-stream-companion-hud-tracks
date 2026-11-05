# Squeekside

A read-only stream companion for Squeekchain: live Sepolia blocks, confirmed SqueekCore rounds, and provisional hamster-wheel mining progress. The interface includes a responsive monitor, stream view, fullscreen, an optional transparent page background, source settings, pause/resume, manual refresh, and two activity views.

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

This runs the TypeScript check, 13 data tests, production build, export integrity/size check, and a bounded HTTP subpath test. The individual commands are `npm run typecheck`, `npm test`, `npm run build`, `npm run check:export`, and `npm run check:http`.

`vite.config.ts` sets `base: './'`. Serve **all of `dist/`** from an ordinary static host, including its `assets/`, `fonts/`, `licenses/`, favicon, and share image. No backend, environment file, account, wallet, API key, or route rewriting is needed. Hashes select the monitor (`#monitor`) and stream view (`#stream`). `dist/` is intentionally included in the submission.

## Using the HUD

- **Open stream view** removes activity history and the navigation links. Copy its URL into an OBS browser source; 1440 × 1080 gives the desktop HUD room to breathe. Fullscreen is optional.
- **Transparent page background** is available in stream view. Data panels remain opaque and readable. This choice lasts for the current visit.
- **Pause** stops automatic source reads and wheel animation, retaining the last successful data. The estimated round clock and data ages continue. Manual refresh reads once even while paused.
- **Network activity** switches between the latest six Sepolia blocks and six certified SqueekCore rounds. Block links open the Sepolia explorer.
- **Settings** changes the public RPC, API base URL, or refresh interval (5, 12, or 30 seconds). Settings stay in this browser's local storage. Invalid saved settings fall back to defaults; unavailable storage still permits settings for the current visit.

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

## Actual validation and limitations

Completed on 2026-11-05:

- Production build, strict TypeScript check, **13/13 tests**, export integrity/byte checks, and **7 HTTP asset fetches under `/preview/squeekside/`** passed. The HTTP test deliberately has no SPA or root-asset fallback. Vite reports two harmless dependency-comment annotation warnings from Zod.
- Direct public RPC reads returned live Sepolia blocks, SqueekCore state/configuration, and six certified rounds. See the time-stamped [live read](artifacts/live-read.json); it is evidence, not runtime data.
- Chromium interactions covered pause/resume, stream routing, fullscreen, transparency, activity switching, settings persistence and validation, keyboard modal behavior, retry/recovery, fresh/stale telemetry, and offline/empty states. Controlled-response tests are explicitly marked in [interaction results](artifacts/interaction-results.json); no test data is bundled into the app.
- Rendered review covered 320, 390, 768, and 1440 pixels, plus 200% text size at 390. No horizontal overflow, text overlap, clipping, crowded sub-24px targets, or failing measured text contrast remained. The lowest observed solid-background text contrast was 6.68:1. The main action occupies y=203–247 at 390 × 844.
- **External limitation:** the public wheel API returned a Cloudflare challenge and failed browser CORS requests during validation. Real wheel telemetry could not be confirmed. The shipped HUD displays this condition and continues reading Sepolia/SqueekCore; it contains no fabricated live values.
- **Browser tooling limitation:** the supplied browser could not reach the shell-local preview. Browser checks rendered the built JavaScript/CSS/fonts embedded at a test origin; the separate HTTP check verified the real export's subpath asset requests. The original pinned `taste.mjs` was attempted twice but exited 2 because its Chromium process closed at launch. Its DOM collector was evaluated through the supplied browser for supplemental measurements; this is **not** a passing original probe run.
- WebKit, physical devices, screen-reader sessions, native browser zoom, forced-colors rendering, and an independent end-to-end browser load from a hosted `dist/` URL were not verified. The 200% text test is not native zoom. Actual clipboard access was denied by the test browser; its recovery message worked, and successful URL copying was checked with a controlled clipboard adapter.

See [the six-domain review and fixes](artifacts/validation.md), [rendered measurements](artifacts/rendered-review.json), [DESIGN.md](DESIGN.md), and [notices](NOTICE.md). These are worker-side checks, not independent certification.
