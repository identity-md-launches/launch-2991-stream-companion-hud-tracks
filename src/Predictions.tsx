import { useEffect, useRef, useState, type FormEvent } from "react";
import { BarChart3, Check, Download, Timer } from "lucide-react";
import { z } from "zod";
import Dialog from "./Dialog";
import { useBrowserState } from "./browserState";
import { closePoll, createPoll, parsePoll, pollStatus, PREDICTION_KEY, resolvePoll, voteOnPoll, type Poll, type PollDraft } from "./predictions";

const DEFAULT_DRAFT: PollDraft = { question: "", first: "Yes", second: "Not yet", minutes: 2 };

export default function Predictions({ open, close, now }: { open: boolean; close: () => void; now: number }) {
  const [poll, setPoll, saved] = useBrowserState<Poll | null>(PREDICTION_KEY, null, parsePoll);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<0 | 1 | null>(null);
  const [outcome, setOutcome] = useState<0 | 1 | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmNew, setConfirmNew] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const status = poll ? pollStatus(poll, now) : null;
  useEffect(() => {
    if (!open) return;
    // Creation, expiry, resolution and replacement remove focused controls.
    // Keep the keyboard at the new state inside the dialog.
    if (poll) headingRef.current?.focus();
    else formRef.current?.querySelector<HTMLInputElement>("#poll-question")?.focus();
  }, [open, poll?.id, status]);
  useEffect(() => {
    setSelection(poll?.vote ?? null);
    setOutcome(null);
    setConfirmNew(false);
  }, [poll?.id, poll?.vote]);
  useEffect(() => { if (!open) { setConfirmNew(false); setNotice(""); } }, [open]);

  function create(event: FormEvent) {
    event.preventDefault();
    try {
      const next = createPoll(draft, Date.now(), crypto.randomUUID());
      setPoll(next); setErrors({}); setNotice("Poll opened. Choose your prediction below.");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const next: Record<string, string> = {};
        for (const issue of error.issues) next[String(issue.path[0])] = issue.message;
        setErrors(next);
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      } else setNotice("Unable to create a poll. Open this page over HTTPS and try again.");
    }
  }
  function vote(event: FormEvent) {
    event.preventDefault();
    if (!poll || selection === null) {
      setNotice("Choose an answer before saving your prediction.");
      formRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
      return;
    }
    try { setPoll(voteOnPoll(poll, selection, Date.now())); setNotice("Prediction recorded for this browser."); }
    catch (error) { setNotice((error as Error).message); }
  }
  function resolve(event: FormEvent) {
    event.preventDefault();
    if (!poll || outcome === null) {
      setNotice("Choose the outcome before confirming it.");
      formRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
      return;
    }
    try {
      setPoll(resolvePoll(poll, outcome, Date.now()));
      setNotice("Outcome recorded manually. The result is saved with this poll.");
    } catch (error) { setNotice((error as Error).message); }
  }
  function download() {
    if (!poll) return;
    const contents = JSON.stringify({
      product: "Squeekchain HUD v2.4", scope: "This browser only. No shared tally or rewards. Outcome selected manually.",
      exportedAt: new Date().toISOString(), poll: { ...poll, status: pollStatus(poll, Date.now()) },
    }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "squeekside-prediction.json";
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Prediction record downloaded.");
  }
  return <Dialog open={open} close={close} title="Viewer predictions" wide>
    <p className="dialog-intro">One prediction per poll in this browser. No shared viewer tally, stakes, or rewards.</p>
    {!poll ? <form onSubmit={create} ref={formRef} noValidate>
      <h3>Start a prediction poll</h3>
      <label className="field" htmlFor="poll-question"><span id="poll-question-label">Question</span>
        <input id="poll-question" aria-labelledby="poll-question-label" name="question" maxLength={160} value={draft.question}
          placeholder="Will the wheel finish a block this round?"
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          aria-invalid={Boolean(errors.question)} aria-describedby="question-hint" />
        <span id="question-hint" className={errors.question ? "field-error" : "field-hint"}>
          {errors.question ?? "8–160 characters. Choose an outcome you can check on the stream."}
        </span>
      </label>
      <div className="poll-fields">
        {([['first', 'First choice'], ['second', 'Second choice']] as const).map(([key, label]) =>
          <label className="field" key={key} htmlFor={`poll-${key}`}><span id={`poll-${key}-label`}>{label}</span>
            <input id={`poll-${key}`} aria-labelledby={`poll-${key}-label`} name={key} maxLength={60} value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} />
            {errors[key] && <span className="field-error" id={`${key}-error`}>{errors[key]}</span>}
          </label>)}
      </div>
      <label className="field" htmlFor="poll-window">Voting window
        <select id="poll-window" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) as PollDraft['minutes'] })}>
          {[1, 2, 5, 10].map((minutes) => <option key={minutes} value={minutes}>{minutes} {minutes === 1 ? "minute" : "minutes"}</option>)}
        </select>
      </label>
      <div className="dialog-actions"><button type="submit" className="button button-primary"><BarChart3 size={17} aria-hidden="true" />Open poll</button></div>
    </form> : <>
      <div className="poll-heading">
        <h3 ref={headingRef} tabIndex={-1}>{poll.question}</h3>
        <span className="poll-state"><Timer size={15} aria-hidden="true" />
          {status === "open" ? <><span className="numeric">{Math.max(0, Math.ceil((poll.closesAt - now) / 1000))}s</span> to vote</> : status === "closed" ? "Voting closed" : "Outcome recorded"}
        </span>
      </div>
      {status === "open" ? <form ref={formRef} onSubmit={vote}>
        <fieldset className="choice-group poll-choices"><legend>Choose your prediction</legend>
          {poll.choices.map((label, index) => <label className="poll-choice" key={index}>
            <input type="radio" name="prediction" value={index} checked={selection === index} onChange={() => setSelection(index as 0 | 1)} />
            <span>{label}</span>{poll.vote === index && <span className="vote-label"><Check size={15} aria-hidden="true" />Saved</span>}
          </label>)}
        </fieldset>
        <div className="dialog-actions">
          <button className="button button-primary" type="submit">{poll.vote === null ? "Save prediction" : "Update prediction"}</button>
          <button className="button button-secondary" type="button" onClick={() => { setPoll(closePoll(poll)); setNotice("Voting closed. You can now choose the outcome."); }}>Close voting</button>
        </div>
      </form> : <>
        <div className="poll-results" aria-label="Results in this browser">
          <p className="field-hint">{poll.vote === null ? "No prediction was saved in this browser." : "1 prediction saved in this browser."}</p>
          {poll.choices.map((label, index) => <div key={index} className="poll-result">
            <div><span>{label}{poll.outcome === index && <strong className="outcome-label"> · Outcome</strong>}</span><span className="numeric">{poll.vote === index ? "1 · 100%" : "0 · 0%"}</span></div>
            <div className="meter" aria-hidden="true"><span style={{ width: poll.vote === index ? "100%" : "0%" }} /></div>
          </div>)}
        </div>
        {status === "closed" ? <form ref={formRef} onSubmit={resolve}>
          <fieldset className="choice-group poll-choices"><legend>Which outcome happened?</legend>
            {poll.choices.map((label, index) => <label className="poll-choice" key={index}>
              <input type="radio" name="outcome" value={index} checked={outcome === index} onChange={() => setOutcome(index as 0 | 1)} /><span>{label}</span>
            </label>)}
          </fieldset>
          <p className="field-hint">Check the stream first. This manual outcome cannot be changed.</p>
          <div className="dialog-actions"><button className="button button-primary" type="submit">Confirm outcome</button></div>
        </form> : <p className="poll-verdict">
          <Check size={18} aria-hidden="true" />
          {poll.vote === null ? "No prediction entered." : poll.vote === poll.outcome ? "Your prediction matched the outcome." : "Your prediction did not match the outcome."}
          <span>Outcome selected manually, not verified by the chain.</span>
        </p>}
      </>}
      <div className="poll-record-actions">
        <button className="button button-secondary" onClick={download}><Download size={16} aria-hidden="true" />Download record</button>
        <button className="text-button" onClick={() => setConfirmNew(true)}>Start another poll</button>
      </div>
      {confirmNew && <div className="replace-poll">
        <p>Replace this poll and its saved prediction? Download the record first if you want to keep it.</p>
        <div className="dialog-actions">
          <button className="button button-secondary" onClick={() => setConfirmNew(false)}>Keep this poll</button>
          <button className="button button-secondary" onClick={() => { setPoll(null); setDraft(DEFAULT_DRAFT); setErrors({}); setNotice("Previous poll removed. Create a new poll below."); setConfirmNew(false); }}>Replace poll</button>
        </div>
      </div>}
    </>}
    <div className="poll-notice" role="status">{notice}</div>
    {!saved && <p className="field-error">Storage unavailable. Download the record before leaving; this poll only lasts for this visit.</p>}
  </Dialog>;
}
