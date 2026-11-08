import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  BarChart3,
  Palette,
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Expand,
  Gauge,
  Link2,
  Maximize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { z } from "zod";
import {
  CHAIN_ID,
  CORE_ADDRESS,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadChain,
  loadTelemetry,
  percentOf,
  readSettings,
  roundClock,
  telemetryFresh,
  validateSettings,
  type Settings,
} from "./data";
import { useNow, usePolling } from "./hooks";
import WheelScene from "./WheelScene";
import Dialog from "./Dialog";
import { AppearanceDialog, useAppearance } from "./Appearance";
import Guides from "./Guides";
import Predictions from "./Predictions";

const number = (value: bigint | number | undefined | null) =>
  value == null ? "–" : value.toLocaleString("en-US");
function age(timestamp: number | null | undefined, now: number) {
  if (timestamp == null || !Number.isFinite(timestamp)) return "unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}
function duration(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function Wheel({
  size = 25,
  strokeWidth = 1.8,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="10" r="8" />
      <circle cx="12" cy="10" r="5" />
      <path d="M12 2v3m8 5h-3m-5 8v-3m-8-5h3m1 12 4-4 4 4M7 22h10" />
      <circle cx="12" cy="10" r="1" />
    </svg>
  );
}
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="#monitor" aria-label="Squeekside monitor">
      <span className="brand-mark">
        <Wheel size={25} strokeWidth={1.8} />
      </span>
      <span>
        Squeekside<span className="brand-period">.</span>
      </span>
      {!compact && <span className="brand-description">Stream companion</span>}
    </a>
  );
}
function Status({
  tone = "muted",
  children,
}: {
  tone?: "live" | "warning" | "muted";
  children: ReactNode;
}) {
  return (
    <span className={`status status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
function Meter({
  value,
  label,
  segments = false,
}: {
  value: number | null;
  label: string;
  segments?: boolean;
}) {
  return (
    <div
      className={`meter${segments ? " meter-segments" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(value == null
        ? { "aria-valuetext": "Unavailable" }
        : { "aria-valuenow": value })}
    >
      <span style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}
function OutLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`out-link ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function SettingsDialog({
  open,
  close,
  settings,
  save,
}: {
  open: boolean;
  close: () => void;
  settings: Settings;
  save: (settings: Settings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (open) {
      setDraft(settings);
      setErrors({});
    }
  }, [open, settings]);
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      save(validateSettings(draft));
      close();
    } catch (error) {
      const fields: Record<string, string> = {};
      if (error instanceof z.ZodError)
        for (const issue of error.issues)
          fields[String(issue.path[0])] =
            "Use an HTTPS URL without credentials, a query, or a fragment.";
      setErrors(fields);
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
          ?.focus(),
      );
    }
  }
  return (
    <Dialog open={open} close={close} title="Data settings">
      <p className="dialog-intro">
        Choose public, read-only sources. Settings stay in this browser.
      </p>
      <form ref={formRef} onSubmit={submit} noValidate>
        <label className="field" htmlFor="rpc">
          <span id="rpc-label">Sepolia RPC URL</span>
          <input
            id="rpc"
            aria-labelledby="rpc-label"
            name="rpc"
            type="url"
            autoComplete="off"
            spellCheck={false}
            value={draft.rpc}
            onChange={(e) => setDraft({ ...draft, rpc: e.target.value })}
            aria-invalid={Boolean(errors.rpc)}
            aria-describedby={errors.rpc ? "rpc-error" : "rpc-hint"}
          />
          <span
            className={errors.rpc ? "field-error" : "field-hint"}
            id={errors.rpc ? "rpc-error" : "rpc-hint"}
          >
            {errors.rpc ?? `Must serve Sepolia, chain ${CHAIN_ID}.`}
          </span>
        </label>
        <label className="field" htmlFor="api">
          <span id="api-label">Squeekchain API base URL</span>
          <input
            id="api"
            aria-labelledby="api-label"
            name="api"
            type="url"
            autoComplete="off"
            spellCheck={false}
            value={draft.api}
            onChange={(e) => setDraft({ ...draft, api: e.target.value })}
            aria-invalid={Boolean(errors.api)}
            aria-describedby={errors.api ? "api-error" : "api-hint"}
          />
          <span
            className={errors.api ? "field-error" : "field-hint"}
            id={errors.api ? "api-error" : "api-hint"}
          >
            {errors.api ??
              "The API must allow browser requests and match the pinned SqueekCore."}
          </span>
        </label>
        <label className="field" htmlFor="interval">
          Refresh interval
          <select
            id="interval"
            name="interval"
            value={draft.interval}
            onChange={(e) =>
              setDraft({ ...draft, interval: Number(e.target.value) })
            }
          >
            <option value="5">Every 5 seconds</option>
            <option value="12">Every 12 seconds</option>
            <option value="30">Every 30 seconds</option>
          </select>
        </label>
        <p className="field-hint">
          Failures back off automatically. Rate limits respect the source’s
          retry delay.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setDraft({ ...DEFAULT_SETTINGS });
              setErrors({});
            }}
          >
            Restore defaults
          </button>
          <button className="button button-primary" type="submit">
            Save settings
            <Check size={17} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default function App() {
  const [settings, setSettings] = useState(readSettings);
  const [paused, setPaused] = useState(false);
  const [stream, setStream] = useState(() => location.hash === "#stream");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [tab, setTab] = useState<"blocks" | "rounds">("blocks");
  const [notice, setNotice] = useState("");
  const [appearance, setAppearance, appearanceSaved] = useAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const transparent = appearance.transparent;
  const now = useNow();
  const chainLoader = useCallback(
    (signal: AbortSignal) => loadChain(settings, signal),
    [settings],
  );
  const telemetryLoader = useCallback(
    (signal: AbortSignal) => loadTelemetry(settings, signal),
    [settings],
  );
  const chain = usePolling(chainLoader, settings.interval, paused);
  const telemetry = usePolling(telemetryLoader, settings.interval, paused);
  const core = chain.data?.core;
  const latest = chain.data?.blocks[0];
  const chainStale = Boolean(
    chain.error ||
      (chain.updatedAt && now - chain.updatedAt > 60_000) ||
      (latest && now - latest.timestamp * 1000 > 120_000),
  );
  const feedFresh = Boolean(
    telemetry.data &&
      telemetryFresh(telemetry.data, now) &&
      !telemetry.error &&
      !paused,
  );
  const measurement = feedFresh ? telemetry.data?.measurement : null;
  const projection =
    feedFresh && telemetry.data?.builder.status === "available"
      ? telemetry.data.builder.projected
      : null;
  const spinning = Boolean(measurement && measurement.rpmMilli > 0);
  const progress = projection
    ? percentOf(projection.blockProgress, 1_000_000_000n)
    : core
      ? percentOf(core.state.blockProgress, core.config.blockUnitsPerBlock)
      : null;
  const height = projection?.blockHeight ?? core?.state.blockHeight;
  const clock = core ? roundClock(core.config, now) : null;
  const pending =
    clock && core
      ? clock.round > core.state.settledThroughRound + 1n
        ? clock.round - core.state.settledThroughRound - 1n
        : 0n
      : null;
  const wheelState = paused
    ? "Updates paused"
    : telemetry.loading && !telemetry.data
      ? "Connecting to wheel"
      : feedFresh
        ? spinning
          ? "Wheel is turning"
          : "Wheel is resting"
        : telemetry.data && !telemetry.error
          ? "Wheel feed stale"
          : "Wheel feed unavailable";

  useEffect(() => {
    const update = () => {
      setStream(location.hash === "#stream");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("transparent-page", stream && transparent);
    document.documentElement.classList.toggle("transparent-page", stream && transparent);
    return () => {
      document.body.classList.remove("transparent-page");
      document.documentElement.classList.remove("transparent-page");
    };
  }, [stream, transparent]);
  function saveSettings(next: Settings) {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      setNotice("Settings saved in this browser.");
    } catch {
      setNotice(
        "Settings applied for this visit. Browser storage is unavailable.",
      );
    }
  }
  function refresh() {
    chain.refresh();
    telemetry.refresh();
    setNotice("Refreshing data sources.");
  }
  async function copyStreamUrl() {
    try {
      const url = new URL(location.href);
      url.hash = "stream";
      await navigator.clipboard.writeText(url.href);
      setNotice("Stream view URL copied. Paste it into an OBS browser source.");
    } catch {
      setNotice(
        "Clipboard unavailable. Copy this page’s URL from your address bar.",
      );
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Fullscreen is unavailable in this browser. Stream view still works in the window.",
      );
    }
  }

  return (
    <div
      className={`app${stream ? " stream-layout" : ""}${transparent && stream ? " transparent-layout" : ""}`}
    >
      <a className="skip-link" href="#main" onClick={(event) => {
        event.preventDefault();
        const main = document.getElementById("main");
        main?.focus();
        main?.scrollIntoView({ block: "start" });
      }}>
        Skip to monitor
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand compact={stream} />
          {!stream && (
            <nav className="header-nav" aria-label="Main navigation">
              <a href="#monitor" className="nav-active" aria-current="page">
                Monitor
              </a>
              <button onClick={() => setSourcesOpen(true)}>
                Data sources
                <ArrowUpRight size={14} />
              </button>
            </nav>
          )}
          <div className="header-utilities">
            <span className="network-tag">
              <span className="network-diamond" aria-hidden="true">
                ◇
              </span>
              Sepolia testnet
            </span>
            <span className="utc-clock numeric">
              {new Date(now).toLocaleTimeString("en-GB", { timeZone: "UTC" })}
              <span> UTC</span>
            </span>
            <button className="icon-button" aria-label="Customize appearance" title="Customize appearance" onClick={() => setAppearanceOpen(true)}>
              <Palette size={19} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              aria-label="Open data settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={19} />
            </button>
            {stream && (
              <a
                href="#monitor"
                className="button button-secondary exit-stream"
              >
                <X size={17} />
                Exit stream view
              </a>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="main-shell" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1>Squeekchain HUD <span className="hud-version">v2.4</span></h1>
            <p>Wheel activity, rounds, and Sepolia settlement.</p>
            <div className="hud-shortcuts">
              <button className="text-button" onClick={() => setPredictionsOpen(true)}><BarChart3 size={16} aria-hidden="true" />Viewer predictions</button>
              <button className="text-button" onClick={() => setGuideOpen(true)}><CircleHelp size={16} aria-hidden="true" />HUD guide</button>
            </div>
          </div>
          <div className="page-actions">
            <button
              className={`button button-secondary pause-button${paused ? " selected" : ""}`}
              aria-label={paused ? "Resume live updates" : "Pause live updates"}
              aria-pressed={paused}
              onClick={() => {
                setPaused(!paused);
                setNotice(
                  paused
                    ? "Live updates resumed."
                    : "Live updates paused. The round clock continues.",
                );
              }}
            >
              {paused ? <Play size={17} /> : <Pause size={17} />}
              <span>{paused ? "Resume" : "Pause"}</span>
            </button>
            {stream ? (
              <>
                <button
                  className="button button-primary"
                  onClick={copyStreamUrl}
                >
                  <Copy size={17} />
                  Copy stream URL
                </button>
                <button
                  className="icon-button"
                  aria-label="Toggle fullscreen"
                  onClick={fullscreen}
                >
                  <Maximize2 size={19} />
                </button>
              </>
            ) : (
              <a className="button button-primary" href="#stream">
                <Expand size={17} />
                Open stream view
              </a>
            )}
          </div>
        </div>

        <div className="connection-bar">
          <div className="connection-statuses">
            <Status
              tone={
                paused
                  ? "warning"
                  : chainStale
                    ? "warning"
                    : latest
                      ? "live"
                      : "muted"
              }
            >
              {paused
                ? "Updates paused"
                : chainStale
                    ? latest ? "Sepolia read stale" : "Sepolia unavailable"
                  : latest
                    ? "Sepolia connected"
                    : chain.loading
                      ? "Connecting to Sepolia"
                      : "Sepolia unavailable"}
            </Status>
            <span className="connection-divider" />
            <span className="connection-description">
              {projection
                ? "Live projection + settled state"
                : "Settled state · wheel feed separate"}
            </span>
          </div>
          <button
            className="refresh-control"
            onClick={refresh}
            disabled={chain.loading || telemetry.loading}
            aria-label="Refresh data sources"
          >
            <RefreshCw
              size={14}
              className={chain.loading || telemetry.loading ? "refreshing" : ""}
            />
            <span>
              {chain.updatedAt
                ? `Read ${age(chain.updatedAt, now)}`
                : "Refresh sources"}
            </span>
          </button>
        </div>

        {(chain.error || chain.data?.coreError) && (
          <div className="source-alert" role="status">
            <CircleHelp size={18} />
            <p>
              {chain.error ?? chain.data?.coreError}
              {chain.error && chain.data
                ? " Displaying the last available read."
                : chain.data?.coreError && latest
                  ? " Sepolia blocks are still available."
                  : ""}
            </p>
            <button
              className="text-button"
              onClick={() => setSettingsOpen(true)}
            >
              Check settings
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        <div className="monitor-grid">
          <section className="panel wheel-panel" aria-labelledby="wheel-title">
            <div className="panel-heading">
              <h2 id="wheel-title">
                <Radio size={19} />
                Wheel monitor
              </h2>
              <Status tone={feedFresh ? "live" : "warning"}>
                {wheelState}
              </Status>
            </div>
            <div className="wheel-stage">
              <div className="wheel-illustration">
                <WheelScene spinning={spinning} />
                <div className="wheel-caption">
                  <span className="tiny-square" />
                  Squeektoshi<span className="wheel-model">Wheel 9000</span>
                </div>
              </div>
              <div className="mining-readout">
                <span className="data-label">
                  {projection
                    ? "Projected Squeek block"
                    : "Next settled Squeek block"}
                </span>
                <div className="block-number numeric">
                  {height != null ? `#${number(height + 1n)}` : "–"}
                </div>
                <div className="progress-readout">
                  <span className="numeric">
                    {progress == null ? "–" : `${progress.toFixed(1)}%`}
                  </span>
                  <span>complete</span>
                </div>
                <Meter
                  value={progress}
                  label={
                    projection
                      ? "Projected block progress"
                      : "Settled block progress"
                  }
                  segments
                />
                <span className="projection-label">
                  {projection ? (
                    <Activity size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  {projection
                    ? "Provisional wheel projection"
                    : core
                      ? "From SqueekCore · settled"
                      : "Waiting for SqueekCore"}
                </span>
                <div className="mining-divider" />
                <span className="data-label">Settled Squeek blocks</span>
                <div className="settled-count numeric">
                  {number(core?.state.blockHeight)}
                  <Box size={17} />
                </div>
              </div>
            </div>
            <div className="wheel-stats">
              <div>
                <span className="data-label">
                  <Gauge size={14} />
                  Wheel speed
                </span>
                <strong className="numeric">
                  {measurement ? (measurement.rpmMilli / 1000).toFixed(1) : "–"}
                  <span>rpm</span>
                </strong>
              </div>
              <div>
                <span className="data-label">Distance in reading</span>
                <strong className="numeric">
                  {measurement
                    ? (measurement.distanceMm / 1_000_000).toFixed(2)
                    : "–"}
                  <span>km</span>
                </strong>
              </div>
              <div>
                <span className="data-label">Open round work</span>
                <strong className="numeric">
                  {feedFresh && telemetry.data?.builder.status === "available"
                    ? number(telemetry.data.builder.queued.openRoundWorkUnits)
                    : "–"}
                  <span>units</span>
                </strong>
              </div>
            </div>
            <div className="panel-foot">
              <span>
                <span
                  className={`foot-dot${feedFresh ? " foot-dot-live" : ""}`}
                />
                {feedFresh
                  ? "Sensor readings lead onchain settlement."
                  : paused
                    ? "Resume updates to read the wheel."
                    : "Telemetry unavailable. Settled progress shown."}
              </span>
              <button
                className="text-button"
                onClick={() => setSourcesOpen(true)}
              >
                About the data
                <ArrowUpRight size={14} />
              </button>
            </div>
          </section>

          <div className="side-panels">
            <section
              className="panel round-panel"
              aria-labelledby="round-title"
            >
              <div className="panel-heading">
                <h2 id="round-title">
                  <Timer size={19} />
                  SqueekCore round
                </h2>
                <span className="subtle-label">
                  {core
                    ? `${number(core.config.roundDuration / 60n)} min rounds`
                    : "Awaiting configuration"}
                </span>
              </div>
              <div className="round-summary">
                <div>
                  <span className="data-label">
                    Current round · clock estimate
                  </span>
                  <div className="round-number numeric">
                    {clock ? `#${number(clock.round)}` : "–"}
                  </div>
                </div>
                <div className="countdown">
                  <span className="data-label">
                    {clock?.round === 0n ? "Until genesis" : "Round ends in"}
                  </span>
                  <strong className="numeric">
                    {clock ? duration(clock.remaining) : "–"}
                  </strong>
                </div>
              </div>
              <Meter
                value={clock?.percent ?? null}
                label="Current round elapsed time"
              />
              <dl className="round-details">
                <div>
                  <dt>Last settled round</dt>
                  <dd className="numeric">
                    {core ? `#${number(core.state.settledThroughRound)}` : "–"}
                  </dd>
                </div>
                <div>
                  <dt>Closed rounds awaiting settlement</dt>
                  <dd className="numeric">{number(pending)}</dd>
                </div>
                <div>
                  <dt>Core settlement</dt>
                  <dd>
                    <Status
                      tone={
                        core?.state.paused || chainStale || paused
                          ? "warning"
                          : core
                            ? "live"
                            : "muted"
                      }
                    >
                      {core
                        ? core.state.paused
                          ? "Paused onchain"
                          : chainStale || paused
                            ? "Last read: enabled"
                            : "Enabled"
                        : "Unavailable"}
                    </Status>
                  </dd>
                </div>
              </dl>
              <div className="round-note">
                <Link2 size={14} />
                {core ? (
                  <>
                    Read at Sepolia block{" "}
                    <OutLink
                      href={`https://sepolia.etherscan.io/block/${core.atBlock}`}
                    >
                      {number(core.atBlock)}
                    </OutLink>
                  </>
                ) : (
                  "Waiting for a confirmed Sepolia read."
                )}
              </div>
            </section>

            <section
              className="panel sepolia-panel"
              aria-labelledby="sepolia-title"
            >
              <div className="panel-heading">
                <h2 id="sepolia-title">
                  <span className="ethereum-symbol" aria-hidden="true">
                    ◇
                  </span>
                  Sepolia head
                </h2>
                <OutLink href="https://sepolia.etherscan.io/">Explorer</OutLink>
              </div>
              <div className="sepolia-headline">
                <div className="sepolia-height numeric">
                  {number(latest?.number)}
                </div>
                <Status
                  tone={chainStale ? "warning" : latest ? "live" : "muted"}
                >
                  {latest ? age(latest.timestamp * 1000, now) : "Waiting"}
                </Status>
              </div>
              <div className="sepolia-stats">
                <div>
                  <span className="data-label">Transactions</span>
                  <strong className="numeric">
                    {number(latest?.transactions)}
                  </strong>
                </div>
                <div>
                  <span className="data-label">Gas used</span>
                  <strong className="numeric">
                    {latest
                      ? `${percentOf(latest.gasUsed, latest.gasLimit).toFixed(1)}%`
                      : "–"}
                  </strong>
                </div>
                <span className="block-icon" aria-hidden="true">
                  <Box size={38} strokeWidth={1} />
                </span>
              </div>
            </section>
          </div>
        </div>

        {!stream && (
          <section
            className="activity-section"
            aria-labelledby="activity-title"
          >
            <div className="activity-heading">
              <div className="section-title">
                <Activity size={19} />
                <h2 id="activity-title">Network activity</h2>
                <span className="subtle-label">Most recent first</span>
              </div>
              <div className="segmented" aria-label="Activity data">
                <button
                  aria-pressed={tab === "blocks"}
                  className={tab === "blocks" ? "is-selected" : ""}
                  onClick={() => setTab("blocks")}
                >
                  Sepolia blocks
                </button>
                <button
                  aria-pressed={tab === "rounds"}
                  className={tab === "rounds" ? "is-selected" : ""}
                  onClick={() => setTab("rounds")}
                >
                  Settled rounds
                </button>
              </div>
            </div>
            <div className="activity-table-wrap">
              {tab === "blocks" ? (
                <table className="activity-table">
                  <caption className="sr-only">
                    Six latest Sepolia blocks observed by this browser
                  </caption>
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th className="time-column">Time (UTC)</th>
                      <th>Transactions</th>
                      <th className="gas-column">Gas used</th>
                      <th>Age</th>
                      <th className="explorer-column">
                        <span className="sr-only">Explorer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.data?.blocks.map((block, i) => (
                      <tr key={block.hash}>
                        <td>
                          <a
                            className="block-link numeric"
                            href={`https://sepolia.etherscan.io/block/${block.number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Box size={15} />
                            {number(block.number)}
                            {i === 0 && (
                              <span className="latest-tag">Latest</span>
                            )}
                            <span className="sr-only">
                              {" "}
                              (opens in a new tab)
                            </span>
                          </a>
                        </td>
                        <td className="time-column numeric">
                          {new Date(block.timestamp * 1000).toLocaleTimeString(
                            "en-GB",
                            { timeZone: "UTC" },
                          )}
                        </td>
                        <td className="numeric">
                          {number(block.transactions)}
                        </td>
                        <td className="gas-column">
                          <div className="gas-cell">
                            <span className="numeric">
                              {percentOf(block.gasUsed, block.gasLimit).toFixed(
                                1,
                              )}
                              %
                            </span>
                            <Meter
                              value={percentOf(block.gasUsed, block.gasLimit)}
                              label={`Gas usage of block ${block.number}`}
                            />
                          </div>
                        </td>
                        <td className="numeric age-cell">
                          {age(block.timestamp * 1000, now)}
                        </td>
                        <td className="explorer-column">
                          <OutLink
                            href={`https://sepolia.etherscan.io/block/${block.number}`}
                          >
                            <span className="sr-only">
                              View block {number(block.number)}
                            </span>
                          </OutLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="activity-table round-table">
                  <caption className="sr-only">
                    Six latest certified SqueekCore rounds at the confirmed
                    block
                  </caption>
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Work units</th>
                      <th>Blocks earned</th>
                      <th className="time-column">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {core?.rounds.map((round) => (
                      <tr key={round.round.toString()}>
                        <td className="numeric">
                          <span className="round-cell">
                            <ArrowDownLeft size={15} />#{number(round.round)}
                          </span>
                        </td>
                        <td className="numeric">{number(round.work)}</td>
                        <td className="numeric">
                          {(
                            Number(
                              (round.units * 1000n) /
                                core.config.blockUnitsPerBlock,
                            ) / 1000
                          ).toLocaleString("en-US", {
                            maximumFractionDigits: 3,
                          })}
                        </td>
                        <td className="time-column">
                          <span className="settled-state">
                            <Check size={14} />
                            Settled
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {(tab === "blocks"
                ? !chain.data?.blocks.length
                : !core?.rounds.length) && (
                <div className="table-empty">
                  <Box size={25} />
                  <strong>
                    {tab === "rounds" && core && !core.historyError
                      ? "No settled rounds yet"
                      : (tab === "blocks" && chain.loading) ||
                          (tab === "rounds" && chain.loading)
                        ? "Reading the network…"
                        : "This history is unavailable"}
                  </strong>
                  <p>
                    {tab === "rounds" && core?.historyError
                      ? core.historyError
                      : tab === "rounds" && core && !core.historyError
                        ? "Certified rounds will appear after SqueekCore settles them."
                        : "Refresh the sources or check the connection in Settings."}
                  </p>
                  <button
                    className="button button-secondary"
                    onClick={refresh}
                    disabled={chain.loading || telemetry.loading}
                  >
                    <RefreshCw size={15} />
                    Refresh sources
                  </button>
                </div>
              )}
            </div>
            <div className="activity-foot">
              <span>
                {tab === "blocks"
                  ? (chain.data?.blocksError ??
                    "Chain tip is unconfirmed. SqueekCore reads are 12 blocks behind.")
                  : "Zero-work rows are certified gaps, never unreported rounds."}
              </span>
              <OutLink href="https://docs.squeekchain.com/developers/core/">
                Read the contract docs
              </OutLink>
            </div>
          </section>
        )}

        {stream && (
          <div className="stream-tools">
            <label>
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setAppearance({ ...appearance, transparent: e.target.checked })}
              />
              Transparent page background
            </label>
            <span>
              Use this URL as an OBS browser source. Panels stay opaque.
            </span>
          </div>
        )}
        <div className={`announcement${notice.includes("unavailable") ? " announcement-warning" : ""}`} role="status">
          {notice && (
            <>
              {notice.includes("unavailable") ? <CircleHelp size={15} /> : <Check size={15} />}
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
        <footer className="site-footer">
          <span className="footer-brand">
            <Wheel size={17} />A little hamster. A public record.
          </span>
          <div>
            <span>
              {paused
                ? "Polling paused"
                : `Refresh every ${settings.interval}s`}
            </span>
            <span>Read only</span>
            <span>Testnet</span>
            <button
              className="text-button"
              onClick={() => setSourcesOpen(true)}
            >
              Source details
              <ArrowUpRight size={13} />
            </button>
          </div>
        </footer>
      </main>

      <AppearanceDialog open={appearanceOpen} close={() => setAppearanceOpen(false)} appearance={appearance} change={setAppearance} saved={appearanceSaved} />
      <Guides open={guideOpen} close={() => setGuideOpen(false)} />
      <Predictions open={predictionsOpen} close={() => setPredictionsOpen(false)} now={now} />
      <SettingsDialog
        open={settingsOpen}
        close={() => setSettingsOpen(false)}
        settings={settings}
        save={saveSettings}
      />
      <Dialog
        open={sourcesOpen}
        close={() => setSourcesOpen(false)}
        title="About the data"
        wide
      >
        <p className="dialog-intro">
          The wheel, SqueekCore, and Ethereum report different stages of the
          same work.
        </p>
        <div className="source-list">
          <section>
            <h3>
              <Radio size={18} />
              Live wheel measurements
            </h3>
            <p>
              Speed and distance come from the latest device reading. Live block
              progress is a provisional projection, not a settled block. A
              reading older than its freshness limit is shown as stale.
            </p>
            <code>{settings.api}/v1/status</code>
            <p className="source-health">
              {telemetry.error ??
                (telemetry.data
                  ? `Last fetched ${age(telemetry.updatedAt, now)}. Device reading ${age(Date.parse(telemetry.data.measurement?.receivedAt ?? ""), now)}.`
                  : "No wheel reading received yet.")}
            </p>
            <OutLink href="https://docs.squeekchain.com/developers/api/">
              Official API reference
            </OutLink>
          </section>
          <section>
            <h3>
              <ShieldCheck size={18} />
              Settled SqueekCore state
            </h3>
            <p>
              Reads state, configuration, and the last six certified rounds at
              one Sepolia block, 12 blocks behind the tip. Block progress uses
              earned block units. The round clock follows this browser’s time
              and the onchain schedule.
            </p>
            <span className="data-label">
              Pinned SqueekCore proxy · Sepolia
            </span>
            <code>{CORE_ADDRESS}</code>
            <p className="source-health">
              {chain.data?.coreError ??
                (core
                  ? `Read at block ${number(core.atBlock)}. ${pending != null ? `${number(pending)} closed rounds await settlement.` : ""}`
                  : "No contract state received yet.")}
            </p>
            <OutLink
              href={`https://sepolia.etherscan.io/address/${CORE_ADDRESS}#readProxyContract`}
            >
              Inspect SqueekCore
            </OutLink>
          </section>
          <section>
            <h3>
              <Box size={18} />
              Live Sepolia blocks
            </h3>
            <p>
              The latest six blocks are read directly from a public RPC. Tip
              blocks can reorganize. No transactions are sent and no wallet is
              needed.
            </p>
            <code>{settings.rpc}</code>
            <p className="source-health">
              {chain.error ??
                (chain.updatedAt
                  ? `Last successful read ${age(chain.updatedAt, now)}.`
                  : "Waiting for a Sepolia read.")}
            </p>
          </section>
        </div>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => {
              setSourcesOpen(false);
              setSettingsOpen(true);
            }}
          >
            <Settings2 size={16} />
            Change data settings
          </button>
          <OutLink href="https://sepolia.squeekchain.com/">
            Open Squeekchain
          </OutLink>
        </div>
      </Dialog>
    </div>
  );
}
