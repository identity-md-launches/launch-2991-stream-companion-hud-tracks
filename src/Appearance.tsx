import { useEffect } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { z } from "zod";
import Dialog from "./Dialog";
import { useBrowserState } from "./browserState";

export const appearanceSchema = z.object({
  mode: z.enum(["dark", "light", "system"]),
  accent: z.enum(["mint", "violet", "amber"]),
  reduceMotion: z.boolean(),
  transparent: z.boolean(),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const DEFAULT_APPEARANCE: Appearance = {
  mode: "dark", accent: "mint", reduceMotion: false, transparent: false,
};
export const APPEARANCE_KEY = "squeekside.appearance.v2.4";
const parseAppearance = (value: unknown) => appearanceSchema.parse(value);

export function useAppearance() {
  const result = useBrowserState(APPEARANCE_KEY, DEFAULT_APPEARANCE, parseAppearance);
  const [appearance] = result;
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let frame = 0;
    function apply() {
      root.classList.add("theme-changing");
      const mode = appearance.mode === "system" ? media.matches ? "dark" : "light" : appearance.mode;
      root.dataset.theme = mode;
      root.dataset.accent = appearance.accent;
      root.classList.toggle("quiet-motion", appearance.reduceMotion);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0c1015" : "#f2f5f4");
      void root.offsetWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.classList.remove("theme-changing"));
    }
    apply();
    media.addEventListener("change", apply);
    return () => { media.removeEventListener("change", apply); cancelAnimationFrame(frame); };
  }, [appearance]);
  return result;
}

export function AppearanceDialog({ open, close, appearance, change, saved }: {
  open: boolean; close: () => void; appearance: Appearance;
  change: (value: Appearance) => void; saved: boolean;
}) {
  return <Dialog open={open} close={close} title="Customize the HUD">
    <p className="dialog-intro">Make the monitor fit your stream. Changes apply immediately.</p>
    <fieldset className="choice-group">
      <legend>Color mode</legend>
      <div className="choice-row">
        {([['dark', 'Dark', Moon], ['light', 'Light', Sun], ['system', 'System', Monitor]] as const).map(([mode, label, Icon]) =>
          <button key={mode} className="choice-button" aria-pressed={appearance.mode === mode}
            onClick={() => change({ ...appearance, mode })}>
            <Icon size={17} aria-hidden="true" />{label}
          </button>)}
      </div>
    </fieldset>
    <fieldset className="choice-group">
      <legend>Accent color</legend>
      <div className="choice-row">
        {([['mint', 'Mint'], ['violet', 'Violet'], ['amber', 'Amber']] as const).map(([accent, label]) =>
          <button key={accent} className="choice-button" aria-pressed={appearance.accent === accent}
            onClick={() => change({ ...appearance, accent })}>
            <span className={`color-swatch swatch-${accent}`} aria-hidden="true">
              {appearance.accent === accent && <Check size={14} />}
            </span>{label}
          </button>)}
      </div>
    </fieldset>
    <label className="toggle-field">
      <input type="checkbox" checked={appearance.reduceMotion}
        onChange={(e) => change({ ...appearance, reduceMotion: e.target.checked })} />
      <span>Reduce motion<small>Your system’s reduced-motion preference is always respected.</small></span>
    </label>
    <label className="toggle-field">
      <input type="checkbox" checked={appearance.transparent}
        onChange={(e) => change({ ...appearance, transparent: e.target.checked })} />
      <span>Transparent stream background<small>Applies in stream view. Panels keep their background.</small></span>
    </label>
    <p className={saved ? "field-hint" : "field-error"} role="status">
      {saved ? "Appearance saved in this browser." : "Storage unavailable. Appearance applies for this visit only."}
    </p>
    <div className="dialog-actions">
      <button className="button button-secondary" onClick={() => change({ ...DEFAULT_APPEARANCE })}>Restore appearance</button>
      <button className="button button-primary" onClick={close}>Done<Check size={17} aria-hidden="true" /></button>
    </div>
  </Dialog>;
}
