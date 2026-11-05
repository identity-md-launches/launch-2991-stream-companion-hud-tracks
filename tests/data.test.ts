import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionResult } from "viem";
import {
  CORE_ADDRESS,
  DEFAULT_SETTINGS,
  DataError,
  coreAbi,
  expandRoundPage,
  loadChain,
  loadTelemetry,
  parseTelemetry,
  percentOf,
  roundClock,
  telemetryFresh,
  validateCore,
  validateSettings,
  type CoreConfig,
  type CoreState,
} from "../src/data";

// Synthetic input lives only in tests. The production app has no demo data.
const config: CoreConfig = {
  streamId: `0x${"ab".repeat(32)}`,
  genesisTimestamp: 1791847800n,
  roundDuration: 600n,
  maxWorkPerRound: 10000n,
  maxRoundsPerBatch: 16,
  guardian: CORE_ADDRESS,
  reporter: CORE_ADDRESS,
  initialWorkPerThousandBlocks: 10875,
  targetBlocksPerActiveRound: 40n,
  difficultySmoothingRounds: 30n,
  blockUnitsPerBlock: 1_000_000_000n,
};
const state: CoreState = {
  settledThroughRound: 1973n,
  cumulativeWork: 148986n,
  cumulativeBlockUnits: 13095604188187n,
  blockHeight: 13095n,
  blockProgress: 604188187n,
  workPerThousandBlocks: 11266,
  authorizationNonce: 1657n,
  paused: false,
};
const identity = {
  schemaVersion: 1,
  status: "available",
  chain: { chainId: "11155111" },
  identities: { core: CORE_ADDRESS },
};
const measuredAt = "2026-11-05T10:00:00.000Z";
const status = {
  schemaVersion: 1,
  generatedAt: measuredAt,
  measurement: {
    freshness: "online",
    observedAt: measuredAt,
    receivedAt: measuredAt,
    staleAfterSeconds: 120,
    cumulativeWorkUnits: "150000",
    coreStatus: "ACTIVE",
    rpmMilli: 65000,
    speedMmPerSecond: 1127,
    distanceMm: 3455808,
  },
  builder: {
    status: "available",
    projected: {
      blockHeight: "13100",
      blockProgress: "500000000",
      cumulativeBlockUnits: "13100500000000",
    },
    queued: { openRoundWorkUnits: "308" },
  },
  oracle: { state: "accepted" },
};

test("round clock handles genesis, the second before closure, and exact rollover", () => {
  const genesisMs = Number(config.genesisTimestamp) * 1000;
  assert.deepEqual(roundClock(config, genesisMs - 1000), {
    round: 0n,
    remaining: 1,
    percent: 0,
  });
  assert.deepEqual(roundClock(config, genesisMs), {
    round: 1n,
    remaining: 600,
    percent: 0,
  });
  assert.deepEqual(roundClock(config, genesisMs + 599_000), {
    round: 1n,
    remaining: 1,
    percent: 99.83,
  });
  assert.deepEqual(roundClock(config, genesisMs + 600_000), {
    round: 2n,
    remaining: 600,
    percent: 0,
  });
});
test("block progress preserves bigint precision and clamps a visual percentage", () => {
  assert.equal(percentOf(604188187n, 1_000_000_000n), 60.4);
  assert.equal(percentOf(10n ** 30n + 1n, 2n * 10n ** 30n), 50);
  assert.equal(percentOf(200n, 100n), 100);
  assert.equal(percentOf(1n, 0n), 0);
});
test("rejects state whose derived height/progress does not match block units", () => {
  assert.doesNotThrow(() => validateCore(state, config));
  assert.throws(
    () =>
      validateCore({ ...state, blockHeight: state.blockHeight + 1n }, config),
    DataError,
  );
  assert.throws(
    () => validateCore(state, { ...config, blockUnitsPerBlock: 0n }),
    DataError,
  );
});
test("round history includes only certified zero-work gaps and uses cumulative deltas", () => {
  const rows = expandRoundPage(
    4n,
    7n,
    { cumulativeWork: 100n, cumulativeBlockUnits: 200n },
    [{ roundId: 6n, cumulativeWork: 110n, cumulativeBlockUnits: 300n }],
  );
  assert.deepEqual(rows, [
    { round: 7n, work: 0n, units: 0n },
    { round: 6n, work: 10n, units: 100n },
    { round: 5n, work: 0n, units: 0n },
  ]);
  assert.throws(
    () =>
      expandRoundPage(
        4n,
        5n,
        { cumulativeWork: 100n, cumulativeBlockUnits: 200n },
        [{ roundId: 5n, cumulativeWork: 99n, cumulativeBlockUnits: 201n }],
      ),
    DataError,
  );
});
test("wheel input parses integer counters and rejects inconsistent projection", () => {
  const parsed = parseTelemetry(status, identity);
  assert.equal(parsed.measurement?.cumulativeWorkUnits, 150000n);
  assert.throws(
    () =>
      parseTelemetry(
        {
          ...status,
          builder: {
            ...status.builder,
            projected: { ...status.builder.projected, blockHeight: "20000" },
          },
        },
        identity,
      ),
    DataError,
  );
});
test("rejects wrong deployment, wrong chain, unsupported schema, malformed readings, and unavailability", () => {
  assert.throws(() =>
    parseTelemetry(status, { ...identity, identities: { core: "different" } }),
  );
  assert.throws(() =>
    parseTelemetry(status, { ...identity, chain: { chainId: "1" } }),
  );
  assert.throws(() =>
    parseTelemetry({ ...status, schemaVersion: 9 }, identity),
  );
  assert.throws(() =>
    parseTelemetry(
      { ...status, measurement: { ...status.measurement, rpmMilli: -1 } },
      identity,
    ),
  );
  assert.throws(() =>
    parseTelemetry(status, {
      schemaVersion: 1,
      status: "unavailable",
      reason: "indexer_unavailable",
    }),
  );
});
test("null readings and explicitly unavailable projections remain unknown, not zero", () => {
  const parsed = parseTelemetry(
    {
      ...status,
      measurement: null,
      builder: { status: "unavailable", reason: "no_measurement" },
    },
    identity,
  );
  assert.equal(parsed.measurement, null);
  assert.equal(parsed.builder.status, "unavailable");
  assert.equal(telemetryFresh(parsed, Date.parse(measuredAt)), false);
});
test("freshness expires, honors explicit stale flags, and rejects future readings", () => {
  const parsed = parseTelemetry(status, identity);
  assert.equal(telemetryFresh(parsed, Date.parse(measuredAt) + 119_000), true);
  assert.equal(telemetryFresh(parsed, Date.parse(measuredAt) + 121_000), false);
  assert.equal(telemetryFresh(parsed, Date.parse(measuredAt) - 61_000), false);
  assert.equal(
    telemetryFresh(
      parseTelemetry(
        {
          ...status,
          measurement: { ...status.measurement, freshness: "stale" },
        },
        identity,
      ),
      Date.parse(measuredAt),
    ),
    false,
  );
});
test("settings normalize trailing slashes; reject unsafe URLs and unsupported polling rates", () => {
  assert.deepEqual(
    validateSettings({ ...DEFAULT_SETTINGS, api: `${DEFAULT_SETTINGS.api}/` }),
    DEFAULT_SETTINGS,
  );
  for (const rpc of [
    "http://example.com",
    "javascript:alert(1)",
    "https://u:p@example.com",
    "https://example.com?key=secret",
    "https://example.com#fragment",
  ]) {
    assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, rpc }));
  }
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, interval: 1 }));
});
test("RPC reads keep a usable chain head when the contract is unavailable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    const hashOf = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;
    const block = request.method === "eth_getBlockByNumber"
      ? request.params[0] === "latest" ? 100n : BigInt(request.params[0])
      : 100n;
    const result =
      request.method === "eth_chainId"
        ? "0xaa36a7"
        : request.method === "eth_call"
          ? "0x"
          : {
              number: `0x${block.toString(16)}`,
              hash: hashOf(block),
              parentHash: hashOf(block - 1n),
              timestamp: "0x6aec4b00",
              transactions: [],
              gasUsed: "0x1",
              gasLimit: "0x100",
              baseFeePerGas: "0x14",
            };
    return Response.json({ jsonrpc: "2.0", id: request.id, result });
  };
  try {
    const result = await loadChain(DEFAULT_SETTINGS, AbortSignal.timeout(1000));
    assert.equal(result.blocks.length, 6);
    assert.equal(result.core, null);
    assert.match(result.coreError ?? "", /SqueekCore could not be read/);
  } finally {
    globalThis.fetch = original;
  }
});
test("rejects an RPC on the wrong network before displaying its result", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    return Response.json({
      id: request.id,
      result:
        request.method === "eth_chainId"
          ? "0x1"
          : {
              number: "0x64",
              hash: `0x${"ab".repeat(32)}`,
              parentHash: `0x${"cd".repeat(32)}`,
              timestamp: "0x6aec4b00",
              transactions: [],
              gasUsed: "0x1",
              gasLimit: "0x100",
            },
    });
  };
  try {
    await assert.rejects(
      () => loadChain(DEFAULT_SETTINGS, AbortSignal.timeout(1000)),
      /not Sepolia/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("rate limits carry the Retry-After delay into polling; challenge HTML is rejected", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "90" },
      });
    await assert.rejects(
      () => loadTelemetry(DEFAULT_SETTINGS, AbortSignal.timeout(1000)),
      (error: unknown) =>
        error instanceof DataError && error.retryAfterSeconds === 90,
    );
    globalThis.fetch = async () =>
      new Response("<html>challenge</html>", {
        headers: { "content-type": "text/html" },
      });
    await assert.rejects(
      () => loadTelemetry(DEFAULT_SETTINGS, AbortSignal.timeout(1000)),
      /did not return JSON/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("contract calls are pinned 12 blocks behind the tip and return a consistent certified ledger", async () => {
  const original = globalThis.fetch;
  const calls: { method: string; params: unknown[] }[] = [];
  const hashOf = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    calls.push(request);
    let result: unknown;
    if (request.method === "eth_chainId") result = "0xaa36a7";
    else if (request.method === "eth_call") {
      const selector = request.params[0].data.slice(0, 10);
      // Selectors identify the public view calls; every answer is encoded from test state.
      const { encodeFunctionData } = await import("viem");
      if (selector === encodeFunctionData({ abi: coreAbi, functionName: "state" }).slice(0, 10)) {
        result = encodeFunctionResult({ abi: coreAbi, functionName: "state", result: state });
      } else if (selector === encodeFunctionData({ abi: coreAbi, functionName: "configuration" }).slice(0, 10)) {
        result = encodeFunctionResult({ abi: coreAbi, functionName: "configuration", result: config });
      } else {
        const position = { cumulativeWork: state.cumulativeWork, cumulativeBlockUnits: state.cumulativeBlockUnits, workPerThousandBlocks: state.workPerThousandBlocks };
        result = encodeFunctionResult({ abi: coreAbi, functionName: "roundPage", result: { certifiedThroughRound: state.settledThroughRound, start: position, end: position, rounds: [] } });
      }
    } else {
      const block = request.params[0] === "latest" ? 100n : BigInt(request.params[0]);
      result = { number: `0x${block.toString(16)}`, hash: hashOf(block), parentHash: hashOf(block - 1n), timestamp: "0x6aec4b00", transactions: [], gasUsed: "0x1", gasLimit: "0x100" };
    }
    return Response.json({ id: request.id, result });
  };
  try {
    const snapshot = await loadChain(DEFAULT_SETTINGS, AbortSignal.timeout(1000));
    assert.equal(snapshot.core?.state.cumulativeBlockUnits, state.cumulativeBlockUnits);
    assert.equal(snapshot.core?.atBlock, 88n);
    assert.equal(snapshot.core?.rounds.length, 6);
    assert.equal(snapshot.core?.rounds[0].round, 1973n);
    const reads = calls.filter(c => c.method === "eth_call");
    assert.equal(reads.length, 3);
    assert.ok(reads.every(c => c.params[1] === "0x58"));
    assert.equal(snapshot.coreError, null);
  } finally { globalThis.fetch = original; }
});
