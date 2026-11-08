import { useState } from "react";
import Dialog from "./Dialog";

export default function Guides({ open, close }: { open: boolean; close: () => void }) {
  const [topic, setTopic] = useState<"monitor" | "stream" | "predictions">("monitor");
  return <Dialog open={open} close={close} title="HUD guide" wide>
    <p className="dialog-intro">Squeekchain HUD v2.4 · A read-only companion for watching the wheel.</p>
    <div className="segmented guide-topics" aria-label="Guide topics">
      {([['monitor', 'Monitor'], ['stream', 'Stream setup'], ['predictions', 'Predictions']] as const).map(([id, title]) =>
        <button key={id} aria-pressed={topic === id} className={topic === id ? "is-selected" : ""}
          onClick={() => setTopic(id)}>{title}</button>)}
    </div>
    <div className="guide-content">
      {topic === "monitor" && <>
        <h3>Read the wheel</h3>
        <p>Wheel speed and distance come from the device feed. A turning wheel means a fresh, positive speed reading. Missing or stale readings appear as unavailable.</p>
        <h3>Follow settlement</h3>
        <p>Live projections are provisional. Settled progress comes from SqueekCore, read 12 Sepolia blocks behind the tip. The round countdown is an estimate from this browser’s clock.</p>
        <h3>Control your view</h3>
        <p>Pause stops automatic network reads and the wheel animation. Refresh reads once, even while paused. Use Customize appearance for colors and motion, or Data settings to change sources.</p>
        <p>No wallet is needed. The HUD never sends transactions.</p>
      </>}
      {topic === "stream" && <>
        <h3>Add the HUD to OBS</h3>
        <ol>
          <li>Select <strong>Open stream view</strong>, then <strong>Copy stream URL</strong>.</li>
          <li>Add a Browser source in OBS and paste the URL. Start with a 1440 × 1080 canvas, then resize to fit your scene.</li>
          <li>Open Customize appearance inside that browser source to choose colors or a transparent page background.</li>
        </ol>
        <p>The URL opens stream view. Appearance and predictions are saved separately in each browser, including OBS. They are not transferred by copying the URL.</p>
        <h3>Keep the signal clear</h3>
        <p>Panels remain opaque over transparent scenes. Fullscreen is optional. Use Exit stream view to return to network history.</p>
      </>}
      {topic === "predictions" && <>
        <h3>Make a prediction</h3>
        <ol>
          <li>Open <strong>Viewer predictions</strong>. Create a question, two distinct choices, and a voting window.</li>
          <li>Choose an answer and select <strong>Save prediction</strong>. You can change it until voting closes.</li>
          <li>Close voting or let the timer finish. Select an outcome and confirm it after checking the stream.</li>
        </ol>
        <p>Predictions are for this browser only: one editable vote per poll, no shared viewer tally, stakes, or rewards. Outcomes are chosen manually and are not verified by the chain.</p>
        <p>Download the local record before starting another poll. Poll deadlines keep running when live data is paused or the page is closed.</p>
      </>}
    </div>
  </Dialog>;
}
