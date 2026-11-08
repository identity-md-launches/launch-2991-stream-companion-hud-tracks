# Squeekside HUD v2.4 design system

## Overview

Squeekside is a quiet, dark instrument panel for people watching or streaming Squeekchain. A mint wheel schematic and a small pixel hamster carry the visual identity. The monitor puts the stream-view action above three readouts: wheel progress, SqueekCore rounds, and Sepolia's head. The activity table is secondary.

The implementation lives in `src/styles.css`, the component patterns in `src/App.tsx`, and the local illustration in `src/WheelScene.tsx`. The interface is English and defaults to the original dark mint theme. `src/features.css` extends the semantic tokens with Light/Dark/System modes and Mint/Violet/Amber accents, controlled by `src/Appearance.tsx`. It also defines the new appearance, guide, and prediction patterns. All variants keep the existing density and local illustration. The brand is an assignment design choice, not an assertion of official affiliation.

## Colors

Base definitions are the `:root` custom properties in `src/styles.css`. `src/features.css` is loaded afterwards and overrides them using `data-theme` and `data-accent` on the root. There is one switching mechanism; System mode resolves to the same light/dark attributes.

| Token | Value | Job |
| --- | --- | --- |
| `--bg-page` | `#0c1015` | Page and stream chrome |
| `--bg-panel` | `#12191f` | Main panels, table, dialogs |
| `--bg-inset` | `#0f161c` | Table headers, inputs, panel footers |
| `--bg-hover` | `#1e2b31` | Neutral hover/selected controls |
| `--bg-selected` | `#22332f` | Latest-block label and normal notifications |
| `--text-primary` | `#edf2f3` | Headings, values, input contents |
| `--text-secondary` | `#a0afb8` | Body copy and labels |
| `--text-muted` | `#92a1ab` | Provenance, captions, footnotes |
| `--border` / `--border-strong` | `#28343d` / `#40515d` | Structural dividers / input boundaries |
| `--accent` / `--accent-hover` | `#66e2c4` / `#91efda` | Primary action, progress, connected state |
| `--accent-ink` | `#10251f` | Text/icons on mint action backgrounds |
| `--warning` / `--warning-bg` | `#e9bb77` / `#30281d` | Stale/unavailable sources and recovery notices |
| `--danger` | `#f0a2a2` | Invalid field hints and boundaries |
| `--focus` | `#a1f5df` | 2px focus outline, 4px offset |

Mint status is always accompanied by a label and dot; a filled mint surface identifies the primary action. Warning text states the actual condition. A warning notification uses a help icon, while an acknowledgement uses a check. The wheel's additional brown/cream SVG colors describe the hamster, not application states.

Light-mode overrides (unlisted tokens retain their base values):

| Role/token | Light value |
| --- | --- |
| `--bg-page`, `--bg-panel`, `--bg-inset` | `#f2f5f4`, `#ffffff`, `#edf2f0` |
| `--bg-hover`, `--bg-selected` | `#e0e9e5`, `#d7eee5` |
| `--text-primary`, `--text-secondary`, `--text-muted` | `#142822`, `#435c53`, `#52685f` |
| `--border`, `--border-strong` | `#ccd7d2`, `#748b80` |
| `--accent`, `--accent-hover`, `--accent-ink` | `#14664c`, `#0c513b`, `#ffffff` |
| `--warning`, `--warning-bg`, `--danger`, `--focus` | `#77501b`, `#fff0d9`, `#a02f38`, `#14664c` |

Accent overrides, in the order accent / hover / ink / selected background / focus:

| Variant | Values |
| --- | --- |
| Dark violet | `#c3a8ff` / `#dac8ff` / `#24163e` / `#2d263b` / `#dac8ff` |
| Dark amber | `#f1c778` / `#ffdda1` / `#30220a` / `#332c20` / `#ffdda1` |
| Light violet | `#67419d` / `#50307d` / `#ffffff` / `#eee5fa` / `#67419d` |
| Light amber | `#7b520b` / `#644108` / `#ffffff` / `#f7e9cf` / `#7b520b` |

Wheel structure, meter fills, table hover, network icon and utility colors use semantic tokens. The hamster retains its illustrative brown/cream palette. Selection is indicated by pressed state, checkmark or native radio in addition to color. Theme switches suppress transitions for a frame. Source warnings retain their own text labels regardless of the selected accent.

The current contrast evidence is in `artifacts/validation.md` and the automated probe/audit results. The decorative SVG, translucent backdrop over arbitrary stream footage, and OS-specific rendering are not represented by a blanket contrast claim.

## Typography

Two local WOFF2 files in `public/fonts/` eliminate external font requests:

- **Inter** (`inter-latin.woff2`), variable face declared 400–700: prose, labels, headings, controls, and wordmark. Used weights are 400, 600, and 700. Fallback is Arial/sans-serif.
- **IBM Plex Mono** (`plex-mono-latin.woff2`), regular 400: `.numeric` counters, timers, IDs, and code. Fallback is Consolas/monospace. It is not used for prose.

Both faces were observed loaded in Chromium. Their licenses are in `public/licenses/`.

| Token | Size at the default 16px root | Use |
| --- | --- | --- |
| `--text-xs` | 12px | Data labels, table, provenance |
| `--text-sm` | 14px | Descriptions and action labels |
| `--text-base` | 16px | Panel headings, fields, small values |
| `--text-lg` | 20px | Brand, dialogs, compact values |
| `--text-xl` | 28px | Page heading and key counters |
| `--text-display` | 40px | Desktop next-block number |

Body line height is 1.5; headings are 1.25, and short numerical readouts use 1.1–1.3. The page heading uses −0.035em tracking; the desktop block number uses −0.055em. Smaller numeric text uses −0.025em. `.numeric` enables tabular figures. Inputs use 16px. Headings balance, prose uses pretty wrapping, addresses/URLs and long numeric values wrap instead of truncating. Table cells can wrap during text enlargement.

## Layout

The declared spacing palette is 4, 8, 12, 16, 20, 24, 32, 40, and 48px (`--space-1` through `--space-12`, with the indices implemented in `:root`). Component rules use explicit matching pixel values and 10/14/18/22px optical adjustments. Reuse the existing component rule when extending a pattern; the spacing variables are available for new rules.

The header is capped at 1440px, the ordinary main shell at 1360px, and the stream shell at 1600px. Main desktop gutters are 40px, reducing to 28, 20, and 16px. The desktop monitor uses `minmax(0, 1.57fr) minmax(0, 1fr)` with a 20px gap; the right column stacks the round and Sepolia panels. Data follows DOM reading order on small screens.

Implemented breakpoints:

- **Above 1500px:** stream wheel art gains space.
- **At 1200px:** remove the brand description, tighten gutters, use smaller block numerals.
- **At 1000px:** the wheel/readout stack within its panel, hide activity UTC time, and simplify supporting captions.
- **At 700px:** one monitor column; the wheel and readout sit side by side inside their panel, primary actions fill the available row, navigation/UTC utility disappear, table gas/explorer columns hide. Block links remain available.
- **At 360px:** tighter gutters, spacing, and type for the smallest supported width. Mobile block columns allocate 42% to height, 34% to transactions, and the remainder to age.

Header, action, connection, progress, and round rows can wrap as text grows. Wheel stats use `repeat(auto-fit, minmax(min(100%, 4.5rem), 1fr))`, and units wrap below values when needed. This keeps fresh readings in bounds during text enlargement. The poll form has two choice columns on desktop and one below 700px; long questions/choices wrap without ellipsis. Dialogs scroll within `100svh` and keep all actions reachable. Root-font enlargement to 32px at a 390px viewport was checked for horizontal overflow and modal reflow. The pinned probe checks text overlap at the default font size at 320/390/1440. This is distinct from native zoom. Default-width checks cover 320, 390, 768, 1000, and 1440px. At 390 × 844 the title, stream action, prediction action and wheel illustration are on the first screen; exact measured rectangles are in `artifacts/interaction-results.json`. The header hides the network utility text on phones to preserve room for the palette and data-settings controls. The two shortcut actions wrap above the primary action row.

## Elevation & Depth

The interface uses flat tonal layers with 1px structural borders and no panel shadows. Panels do not contain nested card surfaces. Inputs use the inset background and a stronger boundary. Native modal dialogs have a dark translucent `::backdrop`, 5px backdrop blur, and the browser top layer. Fixed chrome is limited to the keyboard skip link. Notifications are in normal document flow and stay until dismissed.

## Shapes

`--radius-sm: 6px` is used for buttons, inputs, and notices; `--radius-md: 10px` for the activity table; `--radius-lg: 12px` for panels. Dialogs use 16px, the brand tile 9px (8px on mobile), and selected segmented options 4px. The next-block meter is square and segmented; ordinary progress meters have a 2px radius. The SVG wheel and pixel hamster are decorative and hidden from the accessibility tree.

## Components

| Component or pattern | Source | Behavior |
| --- | --- | --- |
| `Brand`, `Wheel` | `src/App.tsx` | One home link, wordmark, and shared wheel icon; compact in stream mode |
| `Status` | `src/App.tsx` | `live`, `warning`, or `muted`; text and dot carry the state together |
| `Meter` | `src/App.tsx` | Accessible progressbar with optional segments; unknown values have “Unavailable” text and no numeric value |
| `OutLink` | `src/App.tsx` | Arrow, descriptive label, new-tab announcement, `noopener noreferrer` |
| `.button`, `.icon-button`, `.text-button` | `src/styles.css` | One filled primary action; neutral secondary controls; focus, hover, press, and disabled states |
| `Dialog` | `src/Dialog.tsx` | Shared native `showModal()`, Escape/close/backdrop dismissal, explicit Tab/Shift+Tab wrapping, browser-managed background inertness and focus return |
| `SettingsDialog` | `src/App.tsx` | Labeled URL/select fields, submit-time validation, field-specific hints/errors, first invalid field focus, restore defaults |
| `.segmented` | `src/App.tsx` / `src/styles.css` | Two ordinary buttons with `aria-pressed`; keyboard Tab/Enter or Space, not an ARIA tab widget |
| `.activity-table` | `src/App.tsx` / `src/styles.css` | Semantic captions/headers, block links, certified round rows, responsive columns, explicit unavailable/empty/retry state |
| `WheelScene` | `src/WheelScene.tsx` | Local SVG; spokes turn only with a fresh positive RPM reading and active polling |
| `AppearanceDialog`, `useAppearance` | `src/Appearance.tsx` | Three mode buttons and three accent buttons expose `aria-pressed`; native motion/transparency checkboxes; immediate changes with storage status and restore action |
| `Guides` | `src/Guides.tsx` | Three topic buttons with pressed state; monitor, OBS and prediction instructions in a shared modal |
| `Predictions` | `src/Predictions.tsx` | Empty/create, open vote, closed voting, manually resolved and replacement-confirmation states; native radio groups, inline errors, stable polite status region, JSON download and focus on state changes |
| `useBrowserState` | `src/browserState.ts` | Optional local storage with schema validation, visit-only fallback and same-origin storage-event synchronization |
| Poll state functions | `src/predictions.ts` | Deadline-aware voting; manual close; one-time resolution; no network, stakes, rewards or shared tally |
| `usePolling` | `src/hooks.ts` | Serial reads, cancellation, 18s timeout, retry backoff, last-success retention on errors and pause |

Motion is opt-in under `prefers-reduced-motion: no-preference`. Buttons transition only named properties for 150ms and press to scale 0.96; the wheel and refresh icon use explicit rotations. Reduced motion removes the endless animations; the explicit Reduce motion control can additionally stop them even when the OS allows motion. Values/status labels still explain the state without movement. The native forced-colors fallback is retained, with selected outlines on the new choices. See the validation report for rendered coverage limits.

## Do's and Don'ts

- Reuse `.main-shell`, `.panel`, `.panel-heading`, `Status`, and the typography tokens for another view; keep the main action above its content on mobile.
- Keep settled chain state separate from provisional device data. Add a missing source as unknown with a recovery action. Never seed a “live” value.
- Use `.numeric` for changing counters. Preserve full critical values with wrapping and descriptive explorer links.
- Keep accent-filled actions singular within a view. Use neutral controls for pause, settings, refresh, and navigation.
- Preserve native buttons, links, dialogs, and visible labels. Let notification errors announce politely without stealing focus.
- Keep the working HUD above explanations; avoid tracked capital kickers, decorative gradients, panel shadows, external fonts, or a wallet flow. Maintain an explicit local-only label for predictions and manual outcomes.
- Use `Dialog` for another guide or utility, `choice-button` for pressed settings, and the existing field/error pattern for a form. Never use the accent alone to convey selection.
- A new page should use a hash view and the existing shell, place its task and primary action first, reuse the six-size scale, then check 320/390/768/1440, enlarged text, keyboard paths, and source-failure states.
