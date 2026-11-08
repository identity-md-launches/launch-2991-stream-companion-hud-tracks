import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { closePoll, createPoll, parsePoll, pollStatus, resolvePoll, voteOnPoll } from "../src/predictions";

const draft = { question: "Will the next block settle?", first: "Yes", second: "Not yet", minutes: 1 as const };
const start = 1_000_000;
const fresh = () => createPoll(draft, start, randomUUID());

test("poll creation trims input and rejects ambiguous or empty choices", () => {
  assert.equal(createPoll({ ...draft, question: `  ${draft.question}  ` }, start, randomUUID()).question, draft.question);
  assert.throws(() => createPoll({ ...draft, second: " YES " }, start, randomUUID()));
  assert.throws(() => createPoll({ ...draft, first: " " }, start, randomUUID()));
  assert.throws(() => createPoll({ ...draft, question: "Short" }, start, randomUUID()));
});
test("one editable local vote replaces the previous choice without mutating the original", () => {
  const poll = fresh();
  const voted = voteOnPoll(poll, 0, start + 1);
  const changed = voteOnPoll(voted, 1, start + 2);
  assert.equal(poll.vote, null);
  assert.equal(voted.vote, 0);
  assert.equal(changed.vote, 1);
});
test("deadline closes at the exact boundary and rejects late votes including after reload", () => {
  const poll = fresh();
  assert.equal(pollStatus(poll, poll.closesAt - 1), "open");
  assert.equal(pollStatus(poll, poll.closesAt), "closed");
  const restored = parsePoll(JSON.parse(JSON.stringify(poll)))!;
  assert.throws(() => voteOnPoll(restored, 0, restored.closesAt), /Voting has closed/);
  assert.throws(() => voteOnPoll(restored, 0, restored.closesAt + 60_000));
});
test("manual close locks votes and allows one irreversible outcome", () => {
  const poll = voteOnPoll(fresh(), 1, start + 1);
  assert.throws(() => resolvePoll(poll, 1, start + 2), /Close voting/);
  const closed = closePoll(poll);
  assert.throws(() => voteOnPoll(closed, 0, start + 2));
  const resolved = resolvePoll(closed, 1, start + 3);
  assert.equal(resolved.outcome, 1);
  assert.equal(resolved.vote, 1);
  assert.equal(closePoll(resolved).status, "resolved");
  assert.throws(() => resolvePoll(resolved, 0, start + 4));
});
test("expired polls can be resolved without a saved vote", () => {
  const poll = fresh();
  const resolved = resolvePoll(poll, 0, poll.closesAt);
  assert.equal(resolved.vote, null);
  assert.equal(resolved.status, "resolved");
});
test("malformed persisted polls fail validation instead of becoming results", () => {
  const poll = fresh();
  assert.equal(parsePoll(null), null);
  assert.throws(() => parsePoll({ ...poll, vote: 2 }));
  assert.throws(() => parsePoll({ ...poll, status: "resolved", outcome: null }));
  assert.throws(() => parsePoll({ ...poll, closesAt: start - 1 }));
  assert.throws(() => parsePoll({ ...poll, question: "x".repeat(161) }));
});
