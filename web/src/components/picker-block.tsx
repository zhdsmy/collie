import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Loader2,
  Search,
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
import { useLocale } from "@/hooks/use-locale";
import { MIRROR_INVERT, MIRROR_SPACE, styleFor } from "@/components/mirror-space";
import { Button } from "@/components/ui/button";
import { OptionButton, optionSurface, PromptPanel, QuestionHeading } from "@/components/option-button";

export interface PickerBlockProps {
  /** Parsed Codex picker; the terminal remains the source of all staged state. */
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
      <span className="font-content block break-words text-sm font-medium leading-snug text-foreground">
        {option.label}
      </span>
      {option.description ? (
        <span className="font-content block break-words text-xs leading-snug text-muted-foreground">
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
        className="size-8"
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
        className="size-8"
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
}: {
  query: string;
  disabled: boolean;
  onChange: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
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
          placeholder={t("dialog.picker.searchPlaceholder")}
          aria-label={t("dialog.picker.searchAria")}
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
        aria-label={t("dialog.picker.apply")}
        title={t("dialog.picker.apply")}
        className="h-10 shrink-0 gap-1.5 whitespace-nowrap px-3"
      >
        <Search aria-hidden className="size-4" />
        {t("dialog.picker.apply")}
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
    <div data-slot="picker-reorder" className="flex shrink-0 flex-col justify-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || !canMoveUp}
        aria-label={t("dialog.picker.moveUpAria", { label: option.label })}
        title={t("dialog.picker.moveUpAria", { label: option.label })}
        onClick={() => onMove("up")}
        className="size-7"
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
        className="size-7"
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
  const tone = busy ? "busy" : option.checked ? "selected" : "default";
  return (
    <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto] items-stretch gap-1">
      <PointerMark pointed={option.pointed} />
      <button
        type="button"
        role="checkbox"
        aria-checked={option.checked}
        disabled={locked}
        onClick={onToggle}
        className={optionSurface(tone)}
      >
        <span
          aria-hidden
          className={cn(
            "mt-px flex size-4 shrink-0 items-center justify-center rounded border",
            option.checked ? "border-primary bg-primary/20 text-primary" : "border-border bg-background",
          )}
        >
          {option.checked ? <Check className="size-3" /> : null}
        </span>
        <OptionCopy option={option} />
        {busy ? <Spinner size="md" /> : option.current ? <CurrentMark /> : null}
      </button>
      <ReorderControls
        option={option}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        locked={locked}
        busy={busy}
        onMove={onMove}
      />
    </div>
  );
}

function SingleOption({ option, locked, busy, onChoose }: { option: PickerOption; locked: boolean; busy: boolean; onChoose: () => void }) {
  const tone = busy ? "busy" : option.current ? "selected" : "default";
  return (
    <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-stretch gap-1">
      <PointerMark pointed={option.pointed} />
      <OptionButton
        tone={tone}
        label={option.label}
        description={option.description}
        disabled={locked}
        onClick={onChoose}
        trailing={busy ? <Spinner size="md" /> : option.current ? <CurrentMark /> : null}
      />
    </div>
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

  const search = picker.query !== null ? (
    <SearchField
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

  return (
    <PromptPanel ariaLabel={picker.title}>
      <QuestionHeading>{picker.title}</QuestionHeading>
      {picker.description.map((line, index) => (
        <p key={index} className="font-content break-words text-xs leading-snug text-muted-foreground">
          {line}
        </p>
      ))}

      {search}

      {picker.options.length > 0 ? (
        <div data-slot="picker-options" className="flex min-w-0 flex-col gap-1">
          {picker.options.map((option, index) => {
            const busy = sending === `option:${option.id}` || sending === `move:${option.id}`;
            if (picker.kind === "single") {
              return (
                <SingleOption
                  key={option.id}
                  option={option}
                  locked={locked}
                  busy={busy}
                  onChoose={() => void press(`option:${option.id}`, { kind: "choose", id: option.id })}
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
        </div>
      ) : (
        <p data-slot="picker-empty" className="py-4 text-center text-sm text-muted-foreground">
          {t("dialog.picker.noResults")}
        </p>
      )}

      <BrowseControls
        locked={locked || picker.options.length === 0}
        onPress={(direction) => void press(`navigate:${direction}`, { kind: "navigate", direction })}
      />

      <Preview lines={picker.preview} />

      <div className="flex items-center justify-end gap-1.5 border-t border-border/70 pt-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
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
            disabled={locked}
            onClick={() => void press("confirm", { kind: "confirm" })}
          >
            {sending === "confirm" ? <Spinner /> : null}
            {t("dialog.picker.confirm")}
          </Button>
        ) : null}
      </div>

      <Footer footer={picker.footer} />
    </PromptPanel>
  );
}
