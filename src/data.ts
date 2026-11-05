import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  type Hex,
} from "viem";
import { z } from "zod";

export const CORE_ADDRESS =
  "0x74665daeca35a2303e767e76a2ff1fb6f93e119f" as const;
export const CHAIN_ID = 11155111;
export const DEFAULT_SETTINGS = {
  rpc: "https://ethereum-sepolia-rpc.publicnode.com",
  api: "https://api.squeekchain.com",
  interval: 12,
};
export type Settings = typeof DEFAULT_SETTINGS;
export const SETTINGS_KEY = "squeekside.settings.v1";

export const coreAbi = parseAbi([
  "function configuration() view returns ((bytes32 streamId, uint64 genesisTimestamp, uint64 roundDuration, uint64 maxWorkPerRound, uint16 maxRoundsPerBatch, address guardian, address reporter, uint32 initialWorkPerThousandBlocks, uint64 targetBlocksPerActiveRound, uint64 difficultySmoothingRounds, uint96 blockUnitsPerBlock))",
  "function state() view returns ((uint64 settledThroughRound, uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint64 blockHeight, uint96 blockProgress, uint32 workPerThousandBlocks, uint256 authorizationNonce, bool paused))",
  "function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords) view returns ((uint64 certifiedThroughRound, (uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint32 workPerThousandBlocks) start, (uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint32 workPerThousandBlocks) end, (uint64 roundId, uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint32 workPerThousandBlocks, bytes32 dataHash)[] rounds))",
]);

const hex = z
  .string()
  .regex(/^0x[0-9a-f]+$/i)
  .transform((v) => v as Hex);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/i);
const uint = z.string().regex(/^\d+$/).transform(BigInt);
const timestamp = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid timestamp");
const rpcBlock = z.object({
  number: hex,
  hash,
  parentHash: hash,
  timestamp: hex,
  transactions: z.array(hash),
  gasUsed: hex,
  gasLimit: hex,
  baseFeePerGas: hex.optional(),
});
export type Block = {
  number: bigint;
  hash: string;
  parentHash: string;
  timestamp: number;
  transactions: number;
  gasUsed: bigint;
  gasLimit: bigint;
  baseFee: bigint | null;
};
export type CoreState = ReturnType<typeof decodeState>;
function decodeState(data: Hex) {
  return decodeFunctionResult({ abi: coreAbi, functionName: "state", data });
}
export type CoreConfig = ReturnType<typeof decodeConfig>;
function decodeConfig(data: Hex) {
  return decodeFunctionResult({
    abi: coreAbi,
    functionName: "configuration",
    data,
  });
}
export type RoundRow = { round: bigint; work: bigint; units: bigint };
export type CoreSnapshot = {
  state: CoreState;
  config: CoreConfig;
  atBlock: bigint;
  atHash: string;
  rounds: RoundRow[];
  historyError: string | null;
};
export type ChainSnapshot = {
  blocks: Block[];
  core: CoreSnapshot | null;
  coreError: string | null;
  blocksError: string | null;
  fetchedAt: number;
};

export class DataError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds = 0,
  ) {
    super(message);
  }
}
function safeError(error: unknown, fallback: string) {
  return error instanceof DataError ? error.message : fallback;
}
export function errorMessage(error: unknown) {
  return safeError(
    error,
    "Could not reach this source. Check the URL or try again.",
  );
}

async function jsonFetch(url: string, signal: AbortSignal, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal, credentials: "omit" });
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    const retrySeconds = retry
      ? /^\d+$/.test(retry)
        ? Number(retry)
        : Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
      : 0;
    throw new DataError(
      `Source returned HTTP ${response.status}. Try again or check the source in Settings.`,
      Number.isFinite(retrySeconds) ? retrySeconds : 0,
    );
  }
  if (!response.headers.get("content-type")?.includes("json")) {
    throw new DataError(
      "Source did not return JSON. It may be behind a browser challenge. Try again or change the source in Settings.",
    );
  }
  return response.json() as Promise<unknown>;
}

let rpcId = 0;
export async function rpcCall(
  url: string,
  method: string,
  params: unknown[],
  signal: AbortSignal,
) {
  const id = ++rpcId;
  const json = await jsonFetch(url, signal, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const envelope = z
    .object({
      id: z.literal(id),
      result: z.unknown().optional(),
      error: z.unknown().optional(),
    })
    .parse(json);
  if (envelope.error || envelope.result == null)
    throw new DataError(
      "Sepolia RPC rejected the read. Try another RPC in Settings.",
    );
  return envelope.result;
}

async function getBlock(
  url: string,
  tag: string,
  signal: AbortSignal,
): Promise<Block> {
  const value = rpcBlock.parse(
    await rpcCall(url, "eth_getBlockByNumber", [tag, false], signal),
  );
  const gasLimit = BigInt(value.gasLimit);
  if (!gasLimit)
    throw new DataError(
      "The RPC returned an invalid block. Try another RPC in Settings.",
    );
  return {
    number: BigInt(value.number),
    hash: value.hash,
    parentHash: value.parentHash,
    timestamp: Number(BigInt(value.timestamp)),
    transactions: value.transactions.length,
    gasUsed: BigInt(value.gasUsed),
    gasLimit,
    baseFee: value.baseFeePerGas ? BigInt(value.baseFeePerGas) : null,
  };
}
const blockTag = (n: bigint) => `0x${n.toString(16)}`;

export function validateCore(state: CoreState, config: CoreConfig) {
  if (
    config.roundDuration <= 0n ||
    config.blockUnitsPerBlock <= 0n ||
    state.blockHeight !==
      state.cumulativeBlockUnits / config.blockUnitsPerBlock ||
    state.blockProgress !==
      state.cumulativeBlockUnits % config.blockUnitsPerBlock
  ) {
    throw new DataError(
      "SqueekCore returned inconsistent state. Check the deployment in Data sources.",
    );
  }
}

async function getCore(
  url: string,
  atBlock: bigint,
  signal: AbortSignal,
): Promise<CoreSnapshot> {
  const tag = blockTag(atBlock);
  const read = async (functionName: "state" | "configuration") =>
    hex.parse(
      await rpcCall(
        url,
        "eth_call",
        [
          {
            to: CORE_ADDRESS,
            data: encodeFunctionData({ abi: coreAbi, functionName }),
          },
          tag,
        ],
        signal,
      ),
    );
  const [stateData, configData, anchor] = await Promise.all([
    read("state"),
    read("configuration"),
    getBlock(url, tag, signal),
  ]);
  const state = decodeState(stateData);
  const config = decodeConfig(configData);
  validateCore(state, config);
  let rounds: RoundRow[] = [];
  let historyError: string | null = null;
  try {
    const through = state.settledThroughRound;
    const after = through > 6n ? through - 6n : 0n;
    const data = hex.parse(
      await rpcCall(
        url,
        "eth_call",
        [
          {
            to: CORE_ADDRESS,
            data: encodeFunctionData({
              abi: coreAbi,
              functionName: "roundPage",
              args: [after, through, 6n],
            }),
          },
          tag,
        ],
        signal,
      ),
    );
    const page = decodeFunctionResult({
      abi: coreAbi,
      functionName: "roundPage",
      data,
    });
    if (
      page.certifiedThroughRound !== through ||
      page.end.cumulativeBlockUnits !== state.cumulativeBlockUnits ||
      page.end.cumulativeWork !== state.cumulativeWork ||
      page.end.workPerThousandBlocks !== state.workPerThousandBlocks
    ) {
      throw new DataError(
        "Round history did not match the settled frontier. Try again.",
      );
    }
    rounds = expandRoundPage(after, through, page.start, page.rounds);
  } catch (error) {
    historyError = safeError(
      error,
      "Round history could not be read. Try again.",
    );
  }
  const recheck = await getBlock(url, tag, signal);
  if (recheck.hash !== anchor.hash)
    throw new DataError(
      "A chain reorganization interrupted the read. Try again.",
    );
  return { state, config, atBlock, atHash: anchor.hash, rounds, historyError };
}

export function expandRoundPage(
  after: bigint,
  through: bigint,
  start: { cumulativeWork: bigint; cumulativeBlockUnits: bigint },
  active: readonly {
    roundId: bigint;
    cumulativeWork: bigint;
    cumulativeBlockUnits: bigint;
  }[],
): RoundRow[] {
  let previous = start;
  const rows: RoundRow[] = [];
  for (let round = after + 1n; round <= through; round++) {
    const checkpoint = active.find((r) => r.roundId === round);
    const end = checkpoint ?? previous;
    const work = end.cumulativeWork - previous.cumulativeWork;
    const units = end.cumulativeBlockUnits - previous.cumulativeBlockUnits;
    if (work < 0n || units < 0n)
      throw new DataError(
        "Round history contains inconsistent counters. Try again.",
      );
    rows.push({ round, work, units });
    previous = end;
  }
  return rows.reverse();
}

export async function loadChain(
  settings: Settings,
  signal: AbortSignal,
): Promise<ChainSnapshot> {
  const [id, latest] = await Promise.all([
    rpcCall(settings.rpc, "eth_chainId", [], signal),
    getBlock(settings.rpc, "latest", signal),
  ]);
  if (BigInt(hex.parse(id)) !== BigInt(CHAIN_ID))
    throw new DataError(
      "This RPC is not Sepolia (11155111). Choose a Sepolia RPC in Settings.",
    );
  const [older, core] = await Promise.allSettled([
    Promise.all(
      Array.from(
        { length: Number(latest.number < 5n ? latest.number : 5n) },
        (_, i) =>
          getBlock(
            settings.rpc,
            blockTag(latest.number - BigInt(i + 1)),
            signal,
          ),
      ),
    ),
    getCore(
      settings.rpc,
      latest.number > 12n ? latest.number - 12n : 0n,
      signal,
    ),
  ]);
  const blocks = [latest, ...(older.status === "fulfilled" ? older.value : [])];
  if (blocks.some((b, i) => i > 0 && blocks[i - 1].parentHash !== b.hash)) {
    throw new DataError("Block history changed during the read. Try again.");
  }
  return {
    blocks,
    core: core.status === "fulfilled" ? core.value : null,
    coreError:
      core.status === "rejected"
        ? safeError(
            core.reason,
            "SqueekCore could not be read. The deployment may have changed; see Data sources.",
          )
        : null,
    blocksError:
      older.status === "rejected"
        ? "Older blocks could not be loaded. Try refreshing."
        : null,
    fetchedAt: Date.now(),
  };
}

const projectedSchema = z.object({
  blockHeight: uint,
  blockProgress: uint,
  cumulativeBlockUnits: uint,
});
const telemetrySchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: timestamp,
  measurement: z
    .object({
      freshness: z.enum(["online", "stale"]),
      observedAt: timestamp,
      receivedAt: timestamp,
      staleAfterSeconds: z.number().positive(),
      cumulativeWorkUnits: uint,
      coreStatus: z.string(),
      rpmMilli: z.number().nonnegative(),
      speedMmPerSecond: z.number().nonnegative(),
      distanceMm: z.number().nonnegative(),
    })
    .nullable(),
  builder: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("available"),
      projected: projectedSchema,
      queued: z.object({ openRoundWorkUnits: uint }),
    }),
    z.object({
      status: z.literal("unavailable"),
      reason: z.string().nullish(),
    }),
  ]),
  oracle: z
    .object({ state: z.string(), reason: z.string().nullish() })
    .optional(),
});
export type Telemetry = z.infer<typeof telemetrySchema>;

export function parseTelemetry(status: unknown, identity: unknown): Telemetry {
  const verified = z
    .object({
      schemaVersion: z.literal(1),
      status: z.literal("available"),
      chain: z.object({ chainId: z.literal("11155111") }),
      identities: z.object({ core: z.string() }),
    })
    .parse(identity);
  if (verified.identities.core.toLowerCase() !== CORE_ADDRESS) {
    throw new DataError(
      "The telemetry API uses a different SqueekCore deployment. See Data sources.",
    );
  }
  const telemetry = telemetrySchema.parse(status);
  if (telemetry.builder.status === "available") {
    const p = telemetry.builder.projected;
    if (
      p.blockHeight !== p.cumulativeBlockUnits / 1_000_000_000n ||
      p.blockProgress !== p.cumulativeBlockUnits % 1_000_000_000n
    ) {
      throw new DataError(
        "The wheel projection is inconsistent. Try again later.",
      );
    }
  }
  return telemetry;
}
export async function loadTelemetry(
  settings: Settings,
  signal: AbortSignal,
): Promise<Telemetry> {
  const [status, identity] = await Promise.all([
    jsonFetch(`${settings.api}/v1/status`, signal),
    jsonFetch(`${settings.api}/v1/core`, signal),
  ]);
  try {
    return parseTelemetry(status, identity);
  } catch (error) {
    throw new DataError(
      safeError(
        error,
        "The API response is unavailable or has an unsupported format. Check Data sources or try again.",
      ),
    );
  }
}

export function roundClock(
  config: Pick<CoreConfig, "genesisTimestamp" | "roundDuration">,
  now: number,
) {
  const second = BigInt(Math.floor(now / 1000));
  if (second < config.genesisTimestamp)
    return {
      round: 0n,
      remaining: Number(config.genesisTimestamp - second),
      percent: 0,
    };
  const elapsed = second - config.genesisTimestamp;
  const progress = elapsed % config.roundDuration;
  return {
    round: elapsed / config.roundDuration + 1n,
    remaining: Number(config.roundDuration - progress),
    percent: Number((progress * 10_000n) / config.roundDuration) / 100,
  };
}
export function percentOf(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.max(0, Math.min(100, Number((part * 1000n) / total) / 10));
}
export function telemetryFresh(data: Telemetry, now: number) {
  const m = data.measurement;
  return Boolean(
    m &&
      m.freshness === "online" &&
      now - Date.parse(m.receivedAt) <= m.staleAfterSeconds * 1000 &&
      Date.parse(m.receivedAt) <= now + 60_000,
  );
}
export function validateSettings(value: unknown): Settings {
  const secureUrl = z
    .string()
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.hash &&
        !u.search
      );
    }, "Use an HTTPS URL without credentials, query parameters, or a fragment.")
    .transform((v) => v.replace(/\/+$/, ""));
  return z
    .object({
      rpc: secureUrl,
      api: secureUrl,
      interval: z.union([z.literal(5), z.literal(12), z.literal(30)]),
    })
    .parse(value);
}
export function readSettings(): Settings {
  try {
    return validateSettings(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"),
    );
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
