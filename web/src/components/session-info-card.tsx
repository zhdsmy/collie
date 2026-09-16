import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight, History, Terminal, Wrench, Plug, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapse, COLLAPSE_MS } from "@/components/ui/collapse";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SessionInfo, SessionInfoText } from "@/lib/blocks";
import { MarkdownText } from "@/components/markdown-text";

const GROUP_ICONS = { tools: Wrench, mcp: Plug, skills: Sparkles };

/** Presentation only: expanding history never sends keys or focuses the agent's input. */
export function SessionInfoCard({ info, children, renderText, query, currentMatch }: {
  info: Exclude<SessionInfo, { kind: "startup-tail" }>;
  children: ReactNode;
  renderText: (value: SessionInfoText) => ReactNode;
  query: string;
  currentMatch: number;
}) {
  useLocale();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const title = t(info.kind === "startup" ? "chat.startupPreview.title" : "chat.historyPreview.title");
  const summary = info.kind === "startup"
    ? t("chat.startupPreview.summary", { version: info.version, tools: info.tools, skills: info.skills })
    : info.session && [info.session.title, t("chat.historyPreview.messages", { count: info.session.userMessages })].filter(Boolean).join(" · ");
  const Icon = info.kind === "startup" ? Terminal : History;
  // Find must never report a match that the folded history hides.
  useEffect(() => { if (query.trim()) setOpen(true); }, [query, currentMatch]);
  useEffect(() => {
    if (!open || !query.trim()) return;
    // Collapse mounts after this render, then expands over two frames and its shared duration.
    const timer = window.setTimeout(() => {
      bodyRef.current?.querySelector('[data-find-match="current"]')?.scrollIntoView({ block: "center", behavior: "auto" });
    }, COLLAPSE_MS + 32);
    return () => window.clearTimeout(timer);
  }, [open, query, currentMatch]);
  // Resolve the live UI token: font-sans is inlined by Tailwind, and the parent can use a terminal font.
  return (
    <Card className="my-1.5 min-w-0 gap-0 overflow-hidden p-0 [font-family:var(--font-sans)] shadow-none">
      <Button type="button" variant="ghost" aria-expanded={open} aria-controls={bodyId}
        aria-label={title} aria-describedby={summary ? `${bodyId}-summary` : undefined}
        onClick={() => setOpen(!open)} className="h-auto min-h-11 w-full justify-start gap-2 px-3 py-2 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 whitespace-normal text-left">
          <span className="block">{title}</span>
          {summary && <span id={`${bodyId}-summary`} className="mt-0.5 block text-xs font-normal text-muted-foreground wrap-anywhere">{summary}</span>}
        </span>
        <ChevronRight className={cn("ml-auto size-4 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
      </Button>
      <Collapse open={open}>
        <div ref={bodyRef} id={bodyId} role="region" aria-label={title}
          className="max-h-[min(45dvh,28rem)] min-w-0 space-y-3 overflow-auto overscroll-contain border-t border-border px-3 py-3 text-sm leading-relaxed wrap-anywhere">
          {info.kind === "startup" && <>
            <dl className="space-y-2">
              {info.details.fields.map(({ label, value }) => (
                <div key={`${label}:${value.start}`} className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-x-2">
                  <dt className="text-xs text-muted-foreground">{t(`chat.sessionInfo.${label}`)}</dt>
                  <dd className={cn("min-w-0 font-content text-xs", label === "model" && "font-medium text-foreground")}>{renderText(value)}</dd>
                </div>
              ))}
            </dl>
            {info.details.groups.map((group) => {
              const GroupIcon = GROUP_ICONS[group.kind];
              return <section key={group.kind} aria-label={t(`chat.sessionInfo.${group.kind}`)} className="min-w-0 space-y-2 border-t border-border pt-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                  <GroupIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {t(`chat.sessionInfo.${group.kind}`)}
                </h3>
                <dl className="space-y-2.5">
                  {group.items.map(({ name, detail }) => <div key={name.start} className="min-w-0 space-y-0.5">
                    <dt className="font-content text-xs font-medium">{renderText(name)}</dt>
                    {detail && <dd className="font-content text-xs text-muted-foreground">{renderText(detail)}</dd>}
                  </div>)}
                </dl>
                {group.notes.map((note) => <p key={note.start} className="font-content text-xs text-muted-foreground">{renderText(note)}</p>)}
              </section>;
            })}
            {info.details.notes.length > 0 && <div className="space-y-2 border-t border-border pt-3">
              {info.details.notes.map((note) => <p key={note.start} className={cn("font-content text-xs", note.text.includes("⚠") ? "text-status-blocked" : "text-muted-foreground")}>{renderText(note)}</p>)}
            </div>}
          </>}
          {info.kind === "history" && info.messages && <>
            {info.session && <dl className="space-y-1.5 text-xs text-muted-foreground">
              <div><dt className="inline">{t("chat.sessionInfo.session")} · </dt><dd className="inline">{info.session.id}</dd></div>
              {info.session.totalMessages !== undefined && <div><dt className="inline">{t("chat.sessionInfo.totalMessages")} · </dt><dd className="inline tabular-nums">{info.session.totalMessages}</dd></div>}
            </dl>}
            {info.messages.map(({ role, content }) => <section key={content.start} className="min-w-0 space-y-1.5 border-t border-border pt-3">
              <h3 className="text-xs font-semibold text-muted-foreground">{role === "assistant" ? "Hermes" : t(role === "tools" ? "chat.sessionInfo.toolActivity" : `chat.sessionInfo.${role}`)}</h3>
              {query.trim() || role !== "assistant"
                ? <div className="font-content whitespace-pre-wrap text-sm leading-relaxed">{renderText(content)}</div>
                : <MarkdownText text={content.text} />}
            </section>)}
          </>}
          {children}
        </div>
      </Collapse>
    </Card>
  );
}
