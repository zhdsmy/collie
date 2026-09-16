import type { ReactNode } from "react";

/** Shared dialog frame. Callers own native content, controls, and submission rules. */
export function PromptPanel({
  ariaLabel,
  header,
  children,
  actions,
  footer,
}: {
  ariaLabel: string;
  header?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="my-1.5 flex flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm"
    >
      {header ? <div data-slot="prompt-header" className="min-w-0 space-y-1 py-1">{header}</div> : null}
      {children}
      {actions ? (
        <div data-slot="prompt-actions" className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 border-t border-border pt-1.5">
          {actions}
        </div>
      ) : null}
      {footer ? <div data-slot="prompt-footer" className="flex min-w-0 flex-col gap-1.5">{footer}</div> : null}
    </div>
  );
}
