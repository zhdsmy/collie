import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Keyboard,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  sanitizePickerSearchQuery,
  type PickerIntent,
  type PickerModel,
  type PickerOption,
} from "@/lib/harness/picker-model";
import { t } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import { MIRROR_INVERT, MIRROR_SPACE, styleFor } from "@/components/mirror-space";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { ListGroup } from "@/components/ui/list-group";
import { OptionButton, PromptPanel, QuestionHeading } from "@/components/option-button";

const listPanelClass = "max-h-[calc(var(--card-dock-max-height,55dvh)-2rem)] [&>[data-slot=prompt-header]]:shrink-0 [&>[data-slot=prompt-actions]]:shrink-0 [&>[data-slot=prompt-footer]]:shrink-0";
const scrollableListClass = "-mr-1 min-h-0 overflow-y-auto overscroll-y-contain pr-3 [scrollbar-gutter:stable] [scrollbar-width:thin]";

function centerPointedOption(list: HTMLDivElement | null): void {
  const row = list?.querySelector<HTMLElement>('[data-pointed="true"], [aria-current="true"]');
  if (!list || !row) return;
  const frame = list.getBoundingClientRect();
  const item = row.getBoundingClientRect();
  list.scrollTop += (item.top + item.bottom - frame.top - frame.bottom) / 2;
}

export interface PickerBlockProps {
  /** Parsed native picker; the terminal remains the source of all staged state. */
  picker: PickerModel;
  /** Race-guarded handler owned by AgentChat; this component only raises intents. */
  onAction: (intent: PickerIntent) => void | Promise<void>;
  /** Read-only device or gone pane: preserve the picker, but disable every control. */
  disabled?: boolean;
}

function Spinner({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Loader2
      className={cn(
        "shrink-0 animate-spin text-muted-foreground",
        size === "md" ? "mt-0.5 size-4" : "size-3.5",
      )}
      aria-label={t("dialog.sendingAria")}
    />
  );
}

function PointerMark({ pointed }: { pointed: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex w-4 shrink-0 items-center justify-center",
        pointed ? "text-primary" : "text-transparent",
      )}
    >
      <ChevronRight className="size-4" strokeWidth={2.5} />
    </span>
  );
}

function CurrentMark() {
  return (
    <Check
      className="mt-0.5 size-4 shrink-0 text-primary"
      aria-label={t("dialog.picker.currentAria")}
    />
  );
}

function OptionCopy({ option }: { option: PickerOption }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="font-content block text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
        {option.label}
      </span>
      {option.description ? (
        <span className="font-content block break-words text-xs font-normal leading-snug text-muted-foreground">
          {option.description}
        </span>
      ) : null}
    </span>
  );
}

function Preview({ lines }: { lines: PickerModel["preview"] }) {
  if (lines.length === 0) return null;
  return (
    <div
      data-slot="picker-preview"
      role="region"
      aria-label={t("dialog.picker.previewAria")}
      className="min-w-0 rounded-lg border border-border bg-muted/20 px-2 py-1.5"
    >
      <pre
        className={cn(
          "m-0 min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain font-mono text-[10px] leading-[1.3] whitespace-pre",
          MIRROR_SPACE,
          MIRROR_INVERT,
        )}
      >
        {lines.map((line, lineIndex) => (
          <span key={lineIndex}>
            {lineIndex > 0 ? "\n" : null}
            {line.segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} style={styleFor(segment)}>
                {segment.text}
              </span>
            ))}
          </span>
        ))}
      </pre>
    </div>
  );
}

function Footer({ footer }: { footer: string }) {
  if (!footer) return null;
  return (
    <div
      data-slot="picker-footer"
      role="note"
      aria-label={t("dialog.picker.footerAria")}
      className="min-w-0 px-1 pt-0.5 text-muted-foreground"
    >
      <pre className="m-0 overflow-x-auto font-mono text-[10px] leading-tight whitespace-pre-wrap break-words">
        {footer}
      </pre>
    </div>
  );
}

function KeyboardHelp({ footer }: { footer: string }) {
  if (!footer) return null;
  return (
    <details className="group min-w-0 border-t border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-1 text-xs text-muted-foreground marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <Keyboard aria-hidden className="size-3.5" />
        {t("dialog.picker.footerAria")}
        <ChevronRight aria-hidden className="ml-auto size-3.5 group-open:rotate-90" />
      </summary>
      <Footer footer={footer} />
    </details>
  );
}

function BrowseControls({ locked, onPress }: { locked: boolean; onPress: (direction: "up" | "down") => void }) {
  return (
    <div data-slot="picker-browse" className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={locked}
        aria-label={t("dialog.picker.browseUp")}
        title={t("dialog.picker.browseUp")}
        onClick={() => onPress("up")}
        className="size-11"
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={locked}
        aria-label={t("dialog.picker.browseDown")}
        title={t("dialog.picker.browseDown")}
        onClick={() => onPress("down")}
        className="size-11"
      >
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}

function SearchField({
  query,
  disabled,
  onChange,
  onSubmit,
  onClear,
  sessions = false,
}: {
  query: string;
  disabled: boolean;
  onChange: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  sessions?: boolean;
}) {
  return (
    <form
      data-slot="picker-search"
      role="search"
      className="flex min-w-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t(sessions ? "dialog.sessions.search" : "dialog.picker.searchPlaceholder")}
          aria-label={t(sessions ? "dialog.sessions.search" : "dialog.picker.searchAria")}
          className={cn(
            "h-10 w-full rounded-md border border-input bg-transparent pl-9 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            query ? "pr-10" : "pr-3",
          )}
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={t("dialog.picker.clearSearch")}
            title={t("dialog.picker.clearSearch")}
            onClick={onClear}
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={t(sessions ? "dialog.sessions.searchAction" : "dialog.picker.apply")}
        title={t(sessions ? "dialog.sessions.searchAction" : "dialog.picker.apply")}
        className={cn("h-10 shrink-0 gap-1.5 whitespace-nowrap", sessions ? "w-10 px-0" : "px-3")}
      >
        <Search aria-hidden className="size-4" />
        {sessions ? null : t("dialog.picker.apply")}
      </Button>
    </form>
  );
}

function ReorderControls({
  option,
  canMoveUp,
  canMoveDown,
  locked,
  busy,
  onMove,
}: {
  option: PickerOption;
  canMoveUp: boolean;
  canMoveDown: boolean;
  locked: boolean;
  busy: boolean;
  onMove: (direction: "up" | "down") => void;
}) {
  if (!option.orderable) return null;
  const disabled = locked;
  return (
    <div data-slot="picker-reorder" className="flex items-center justify-end gap-0.5 px-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || !canMoveUp}
        aria-label={t("dialog.picker.moveUpAria", { label: option.label })}
        title={t("dialog.picker.moveUpAria", { label: option.label })}
        onClick={() => onMove("up")}
        className="size-11 text-muted-foreground"
      >
        {busy ? <Spinner /> : <ArrowUp className="size-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || !canMoveDown}
        aria-label={t("dialog.picker.moveDownAria", { label: option.label })}
        title={t("dialog.picker.moveDownAria", { label: option.label })}
        onClick={() => onMove("down")}
        className="size-11 text-muted-foreground"
      >
        {busy ? <Spinner /> : <ArrowDown className="size-3.5" />}
      </Button>
    </div>
  );
}

function MultipleOption({
  option,
  locked,
  busy,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMove,
}: {
  option: PickerOption;
  locked: boolean;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  return (
    <div className={cn(
      "min-w-0 border-l-2 transition-colors",
      option.pointed || busy ? "border-l-primary/60 bg-primary/5" : "border-l-transparent",
    )}>
      <button
        type="button"
        role="checkbox"
        aria-checked={option.checked}
        aria-current={option.pointed ? "true" : undefined}
        disabled={locked}
        onClick={onToggle}
        className="flex min-h-11 w-full min-w-0 items-start gap-2 px-2.5 py-1.5 text-left active:bg-primary/10 disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className={cn(
            "mt-px flex size-4 shrink-0 items-center justify-center rounded border",
            option.checked ? "border-primary bg-primary/20 text-primary" : "border-muted-foreground bg-background",
          )}
        >
          {option.checked ? <Check className="size-3" /> : null}
        </span>
        <OptionCopy option={option} />
        {busy ? <Spinner size="md" /> : option.current ? <CurrentMark /> : null}
      </button>
      <div inert={!option.pointed} aria-hidden={!option.pointed}>
        <Collapse open={option.pointed && option.orderable}>
          <ReorderControls
            option={option}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            locked={locked}
            busy={busy}
            onMove={onMove}
          />
        </Collapse>
      </div>
    </div>
  );
}

function SingleOption({
  option,
  locked,
  busy,
  onChoose,
  compact = false,
}: {
  option: PickerOption;
  locked: boolean;
  busy: boolean;
  onChoose: () => void;
  compact?: boolean;
}) {
  const tone = busy ? "busy" : option.current ? "selected" : "default";
  const separator = option.description.lastIndexOf(" · ");
  return (
    <div data-pointed={option.pointed} className={cn("grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-stretch gap-1", compact && "shrink-0 [&>button]:py-1 [&>button>span>span]:leading-tight")}>
      <PointerMark pointed={option.pointed} />
      <OptionButton
        tone={tone}
        label={compact ? <span className="block truncate" title={option.label}>{option.label}</span> : option.label}
        description={compact && separator >= 0 ? (
          <span className="flex min-w-0 gap-1" title={option.description}>
            <span className="min-w-0 truncate">{option.description.slice(0, separator)}</span>
            <span className="shrink-0">{option.description.slice(separator)}</span>
          </span>
        ) : option.description}
        disabled={locked}
        onClick={onChoose}
        trailing={busy ? <Spinner size="md" /> : option.current ? <CurrentMark /> : null}
      />
    </div>
  );
}

/** Localize only the display copy; the guard still sees the exact native row and date. */
function sessionMeta(description: string) {
  const [age = "", ...details] = description.split(" · ");
  const match = /^(\d+)([smhd]) ago$/.exec(age);
  const unit = match?.[2];
  const seconds = unit === "d" ? 86400 : unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  return {
    age: match ? timeAgo(-Number(match[1]) * seconds * 1000, 0)
      : age === "now" ? t("time.justNow") : age,
    detail: details.join(" · "),
  };
}

function SessionPicker({ picker, locked, sending, search, onPress }: {
  picker: PickerModel;
  locked: boolean;
  sending: string | null;
  search: ReactNode;
  onPress: (id: string, intent: PickerIntent) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const pointedId = picker.options.find((option) => option.pointed)?.id;
  useEffect(() => {
    centerPointedOption(listRef.current);
  }, [pointedId, picker.query]);
  const title = t(picker.sessionAction === "fork" ? "dialog.sessions.forkTitle" : "dialog.sessions.title");
  return (
    <PromptPanel
      ariaLabel={title}
      className={listPanelClass}
      header={<>
        <QuestionHeading>{title}</QuestionHeading>
        <p className="font-content text-xs leading-snug text-muted-foreground">
          {t(picker.sessionAction === "fork" ? "dialog.sessions.forkHint" : "dialog.sessions.hint")}
        </p>
      </>}
      actions={<>
        <div className="mr-auto">
          <BrowseControls locked={locked || picker.options.length === 0} onPress={(direction) => onPress(`navigate:${direction}`, { kind: "navigate", direction })} />
        </div>
        <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => onPress("cancel", { kind: "cancel" })}>
          {t("dialog.cancel")}
        </Button>
      </>}
      footer={<>{search}<KeyboardHelp footer={picker.footer} /></>}
    >
      {picker.options.length ? (
        <div ref={listRef} data-slot="session-options" className={cn("max-h-72 min-w-0 rounded-md border border-border divide-y divide-border", scrollableListClass)}>
          {picker.options.map((option) => {
            const meta = sessionMeta(option.description);
            const busy = sending === `option:${option.id}`;
            return (
              <button
                key={option.id}
                type="button"
                aria-current={option.pointed ? "true" : undefined}
                aria-label={option.label}
                title={option.label}
                disabled={locked}
                onClick={() => onPress(`option:${option.id}`, { kind: "choose", id: option.id })}
                className={cn(
                  "flex min-h-14 w-full min-w-0 items-center gap-2 border-l-2 py-2 pl-2.5 pr-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:bg-primary/10 disabled:opacity-60",
                  option.pointed || busy ? "border-l-primary bg-primary/5" : "border-l-transparent bg-card hover:bg-secondary/50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span data-slot="session-title" className="font-content line-clamp-2 text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                    {option.label}
                  </span>
                  {meta.detail ? <span className="font-content mt-0.5 block truncate text-xs text-muted-foreground" title={meta.detail}>{meta.detail}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-content text-[11px] font-normal text-muted-foreground tabular-nums">{meta.age}</span>
                  {busy ? <Spinner /> : <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="py-5 text-center text-sm text-muted-foreground">{t("dialog.picker.noResults")}</p>
      )}
    </PromptPanel>
  );
}

export function PickerBlock({ picker, onAction, disabled }: PickerBlockProps) {
  useLocale();
  const [sending, setSending] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState(picker.query ?? "");

  // A draft belongs to this picker stage. Polls that keep the same terminal query must not erase
  // characters typed locally before the operator submits the search form.
  useEffect(() => {
    setQueryDraft(picker.query ?? "");
  }, [picker.identity, picker.query]);

  const locked = Boolean(disabled) || sending !== null;
  const filtered = picker.query !== null && picker.query.length > 0;
  const agents = picker.identity === "agents:command-center";
  const compact = agents || picker.identity.startsWith("agents:claude:");
  const listRef = useRef<HTMLDivElement>(null);
  const pointed = picker.options.find((option) => option.pointed);
  useEffect(() => {
    centerPointedOption(listRef.current);
  }, [picker.identity, pointed?.id, picker.query]);

  async function press(id: string, intent: PickerIntent): Promise<void> {
    if (locked) return;
    setSending(id);
    try {
      await onAction(intent);
    } finally {
      setSending(null);
    }
  }

  function canMove(index: number, direction: "up" | "down"): boolean {
    const option = picker.options[index];
    if (!option?.orderable || filtered) return false;
    const target = picker.options[index + (direction === "up" ? -1 : 1)];
    return target?.orderable === true;
  }

  function applySearch(): void {
    if (locked) return;
    const normalized = sanitizePickerSearchQuery(queryDraft);
    setQueryDraft(normalized);
    void press("search", { kind: "search", query: normalized });
  }

  function chooseOption(option: PickerOption): void {
    void press(`option:${option.id}`, { kind: "choose", id: option.id });
  }

  const search = picker.query !== null ? (
    <SearchField
      sessions={picker.sessionAction !== undefined}
      query={queryDraft}
      disabled={locked}
      onChange={setQueryDraft}
      onSubmit={applySearch}
      onClear={() => {
        setQueryDraft("");
        void press("search", { kind: "search", query: "" });
      }}
    />
  ) : null;

  if (picker.sessionAction) {
    return <SessionPicker picker={picker} locked={locked} sending={sending} search={search} onPress={(id, intent) => void press(id, intent)} />;
  }

  const OptionsGroup = picker.kind === "multiple" ? ListGroup : "div";
  const heading = <>
    <QuestionHeading>{picker.title}</QuestionHeading>
    {picker.description.map((line, index) => (
      <p key={index} className="font-content break-words text-xs font-normal leading-snug text-muted-foreground">
        {line}
      </p>
    ))}
  </>;
  const actions = <>
    <div className="mr-auto">
      <BrowseControls
        locked={locked || picker.options.length === 0}
        onPress={(direction) => void press(`navigate:${direction}`, { kind: "navigate", direction })}
      />
    </div>
    {agents ? (
      <Button type="button" variant="outline" size="icon" className="size-11 text-destructive"
        disabled={locked || !pointed}
        aria-label={t("dialog.agents.deleteAria", { label: pointed?.label ?? "" })}
        title={t("dialog.agents.deleteAria", { label: pointed?.label ?? "" })}
        onClick={() => pointed && void press("delete", { kind: "delete", id: pointed.id })}>
        {sending === "delete" ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
      </Button>
    ) : null}
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11 whitespace-normal"
      disabled={locked}
      onClick={() => void press("cancel", { kind: "cancel" })}
    >
      {t("dialog.cancel")}
    </Button>
    {picker.kind === "multiple" ? (
      <Button
        type="button"
        variant="default"
        size="sm"
        className="min-h-11 whitespace-normal"
        disabled={locked}
        onClick={() => void press("confirm", { kind: "confirm" })}
      >
        {sending === "confirm" ? <Spinner /> : null}
        {t("dialog.picker.confirm")}
      </Button>
    ) : null}
  </>;

  return (
    <PromptPanel
      ariaLabel={picker.title}
      className={listPanelClass}
      header={heading}
      actions={actions}
      footer={<KeyboardHelp footer={picker.footer} />}
    >
      {search}

      {picker.options.length > 0 ? (
        <OptionsGroup ref={listRef} data-slot="picker-options" className={cn("flex min-w-0 flex-col", scrollableListClass, picker.kind === "single" && "gap-1", compact ? "max-h-59" : "max-h-72")}>
          {picker.options.map((option, index) => {
            const busy = sending === `option:${option.id}` || sending === `move:${option.id}`;
            if (picker.kind === "single") {
              return (
                <SingleOption
                  key={option.id}
                  option={option}
                  locked={locked}
                  busy={busy}
                  compact={compact}
                  onChoose={() => chooseOption(option)}
                />
              );
            }
            return (
              <MultipleOption
                key={option.id}
                option={option}
                locked={locked}
                busy={busy}
                canMoveUp={canMove(index, "up")}
                canMoveDown={canMove(index, "down")}
                onToggle={() => void press(`option:${option.id}`, { kind: "toggle", id: option.id })}
                onMove={(direction) => void press(`move:${option.id}`, { kind: "move", id: option.id, direction })}
              />
            );
          })}
        </OptionsGroup>
      ) : picker.identity !== "agents:help" ? (
        <p data-slot="picker-empty" className="py-4 text-center text-sm text-muted-foreground">
          {t("dialog.picker.noResults")}
        </p>
      ) : null}

      <Preview lines={picker.preview} />
    </PromptPanel>
  );
}
