import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Dialog({ open, close, title, children, wide = false }: {
  open: boolean;
  close: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className={wide ? "dialog dialog-wide" : "dialog"}
      aria-label={title} onCancel={close} onClose={close}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )].filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right ||
          event.clientY < r.top || event.clientY > r.bottom) close();
      }}>
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={`Close ${title}`} onClick={close}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
