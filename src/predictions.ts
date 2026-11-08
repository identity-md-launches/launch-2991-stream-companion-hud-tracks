import { z } from "zod";

const label = z.string().trim().min(1).max(60);
export const pollDraftSchema = z.object({
  question: z.string().trim().min(8, "Use at least 8 characters for the question.").max(160),
  first: label,
  second: label,
  minutes: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
}).refine((value) => value.first.toLocaleLowerCase() !== value.second.toLocaleLowerCase(), {
  message: "Give each choice a different name.", path: ["second"],
});
export type PollDraft = z.infer<typeof pollDraftSchema>;
const choice = z.union([z.literal(0), z.literal(1)]);
export const pollSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(8).max(160),
  choices: z.tuple([label, label]),
  createdAt: z.number().int().nonnegative(),
  closesAt: z.number().int().nonnegative(),
  status: z.enum(["open", "closed", "resolved"]),
  vote: choice.nullable(),
  outcome: choice.nullable(),
}).refine((poll) => poll.closesAt > poll.createdAt &&
  ((poll.status === "resolved") === (poll.outcome !== null)));
export type Poll = z.infer<typeof pollSchema>;
export const PREDICTION_KEY = "squeekside.prediction.v2.4";
export function parsePoll(value: unknown): Poll | null { return value === null ? null : pollSchema.parse(value); }

export function createPoll(draft: PollDraft, now: number, id: string): Poll {
  const valid = pollDraftSchema.parse(draft);
  return pollSchema.parse({
    id, question: valid.question, choices: [valid.first, valid.second],
    createdAt: now, closesAt: now + valid.minutes * 60_000,
    status: "open", vote: null, outcome: null,
  });
}
export function pollStatus(poll: Poll, now: number) {
  return poll.status === "open" && now >= poll.closesAt ? "closed" : poll.status;
}
export function voteOnPoll(poll: Poll, vote: 0 | 1, now: number): Poll {
  if (pollStatus(poll, now) !== "open") throw new Error("Voting has closed. Your prediction was not changed.");
  return { ...poll, vote };
}
export function closePoll(poll: Poll): Poll {
  return poll.status === "resolved" ? poll : { ...poll, status: "closed" };
}
export function resolvePoll(poll: Poll, outcome: 0 | 1, now: number): Poll {
  if (pollStatus(poll, now) !== "closed") throw new Error("Close voting before choosing the outcome.");
  return { ...poll, status: "resolved", outcome };
}
