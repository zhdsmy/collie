import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, MessageSquarePlus } from "lucide-react";

import type { PromptFamily, PromptFeedbackPurpose, PromptModel, PromptOption } from "@/lib/blocks";
import { FEEDBACK_MAX_LENGTH } from "@/lib/prompt-action";
import { OptionButton, OptionGroupCaption, PromptPanel } from "@/components/option-button";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/** What a tap on this block asks for: an option's keystroke plan, or feedback typed on the phone. */
export type PromptBlockAction =
  | { kind: "option"; option: PromptOption }
  | { kind: "feedback"; text: string };

export interface PromptSelectBlockProps {
  /** The detected dialog: question (screen-reader label) + selectable options as buttons. */
  prompt: PromptModel;
  /**
   * Injected send handler (from AgentChat). Presentational contract: this component NEVER touches
   * the network — it just reflects the sending state while the handler runs the race guard and
   * sends the option's keys (or drives the feedback choreography). Returning/throwing simply clears
   * the busy state.
   */
  onAction: (action: PromptBlockAction) => boolean | void | Promise<boolean | void>;
  /** Read-only device or a gone pane: buttons still render (for context) but can't be pressed. */
  disabled?: boolean;
}

// Family-aware caption above the options — orients the reader ("the terminal is asking you
// something") without repeating the question, which stays in the raw scrollback just above.
// A function, not a module-level object, so it re-reads the current locale on every call — a
// component that calls `useLocale()` re-renders on a language switch and this is called fresh.
function familyCaption(family: PromptFamily): string {
  switch (family) {
    case "select":
      return t("prompt.family.select");
    case "permission":
      return t("prompt.family.permission");
    case "trust":
      return t("prompt.family.trust");
    case "plan":
      return t("prompt.family.plan");
  }
}

interface FeedbackCopy {
  offer: string | null;
  editorLabel: string;
  placeholder: string;
  help: string;
  send: string;
  sending: string;
  focused: string;
  typedPrefix: string;
}

// Copy is purpose-aware: Claude's plan-approval input is deny-with-feedback; Grok's `z` row is
// a custom answer. Missing purpose is Claude (the only row submitPromptFeedback will type into).
// A function (not a module-level object) for the same locale-freshness reason as familyCaption.
function feedbackCopyFor(purpose: PromptFeedbackPurpose): FeedbackCopy {
  if (purpose === "free-text") {
    // No phone composer: the Claude plan-feedback send path is the wrong recipe for this row.
    return {
      offer: null,
      editorLabel: "",
      placeholder: "",
      help: "",
      send: "",
      sending: "",
      focused: t("prompt.feedback.freeText.focused"),
      typedPrefix: t("prompt.feedback.freeText.typedPrefix"),
    };
  }
  return {
    offer: t("prompt.feedback.planChange.offer"),
    editorLabel: t("prompt.feedback.planChange.editorLabel"),
    placeholder: t("prompt.feedback.planChange.placeholder"),
    help: t("prompt.feedback.planChange.help"),
    send: t("prompt.feedback.planChange.send"),
    sending: t("prompt.feedback.planChange.sending"),
    focused: t("prompt.feedback.planChange.focused"),
    typedPrefix: t("prompt.feedback.planChange.typedPrefix"),
  };
}

const APPROVAL_COMMAND_PREVIEW_LENGTH = 160;

function ApprovalContext({ approval }: { approval: NonNullable<PromptModel["approval"]> }) {
  const [expanded, setExpanded] = useState(false);
  const command = approval.command;
  const compactCommand = command.replace(/\s+/g, " ").trim();
  const longCommand = command.includes("\n") || command.length > APPROVAL_COMMAND_PREVIEW_LENGTH;
  const preview = longCommand
    ? `${compactCommand.slice(0, APPROVAL_COMMAND_PREVIEW_LENGTH)}…`
    : command;
  const commandText = `$ ${command}`;
  const commandDetailsId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2">
      <dl className="grid min-w-0 gap-1.5 text-xs">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <dt className="font-medium text-muted-foreground">{t("prompt.approval.environment")}</dt>
          <dd className="min-w-0 break-words font-content text-foreground">{approval.environment}</dd>
        </div>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <dt className="font-medium text-muted-foreground">{t("prompt.approval.reason")}</dt>
          <dd className="min-w-0 break-words font-content text-foreground">{approval.reason}</dd>
        </div>
      </dl>

      <div className="min-w-0 border-t border-border/60 pt-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("prompt.approval.command")}</span>
          {longCommand ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={commandDetailsId}
              onClick={() => setExpanded((open) => !open)}
              className="min-h-11 shrink-0 px-1.5 text-[11px] text-primary"
            >
              {expanded ? t("prompt.approval.hideCommand") : t("prompt.approval.showCommand")}
              <ChevronDown
                aria-hidden="true"
                className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          ) : null}
        </div>
        {!expanded ? (
          <code className="mt-1 block min-w-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
            {`$ ${preview}`}
          </code>
        ) : null}
        <Collapse open={expanded}>
          <div id={commandDetailsId} role="region" aria-label={t("prompt.approval.command")}>
            <code className="mt-1 block min-w-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {commandText}
            </code>
          </div>
        </Collapse>
      </div>

      {approval.persistentOptions.length > 0 ? (
        <div className="min-w-0 border-t border-border/60 pt-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t("prompt.approval.persistentOptions")}
          </div>
          <div className="mt-1 grid gap-1">
            {approval.persistentOptions.map((option) => (
              <div key={option} className="break-words font-content text-xs text-muted-foreground">
                {option}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Native, tappable rendering of a single-choice dialog. Every visible string — the option
// label and its description — is a React text node (the XSS boundary is unchanged; nothing is ever
// set as innerHTML). Real <button>s, so they're keyboard-focusable and screen-reader-announced; the
// group is labelled by the question. Ordinary dialogs keep that question in the raw scrollback just
// above; Codex approvals place their native context in this card. Each row leads with its terminal-
// menu digit (KeyBadge) so the mapping is
// visible. One option can be in flight at a time — its spinner shows and the rest lock, preventing a
// double-send.
//
// A dialog carrying an inline text input (the plan approval's "Tell Claude what to change") adds two
// surfaces below the options, and one state in which the options themselves are dead:
//
//   * FOCUSED — `❯` is on the input row, so the terminal routes every digit into it as a character
//     and no button on this dialog can fire (issue #95: they used to render as ordinary buttons and
//     silently type into the desktop user's sentence). Everything locks behind a banner; polling
//     clears it the moment the pointer moves off. Same treatment as PreviewSelectBlock's note field.
//   * TEXT ALREADY IN THE BOX — the options answer normally, but Collie will not type: re-entering a
//     non-empty field puts the caret at position 0, so our words would be prepended to theirs. The
//     affordance is replaced by a read-only card showing what is in there.
//
// Only the empty, unfocused state offers the composer, whose Send drives digit → focus → type →
// Enter and lands as DENY-with-feedback (the agent re-plans) — which is what the button says.
export function PromptSelectBlock({ prompt, onAction, disabled }: PromptSelectBlockProps) {
  useLocale();
  const [sending, setSending] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Focused from an effect rather than with `autoFocus`: the attribute only acts on the very first
  // mount of the element, so re-opening the editor after a cancel would leave the field unfocused —
  // and it gives assistive tech no chance to announce the surrounding panel first.
  const editorRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editorOpen) editorRef.current?.focus();
  }, [editorOpen]);

  const [draft, setDraft] = useState("");
  const feedback = prompt.feedback;
  const terminalFocused = feedback?.focused ?? false;
  const locked = Boolean(disabled) || sending !== null || terminalFocused;
  const feedbackCopy = feedback
    ? feedbackCopyFor(feedback.purpose === "free-text" ? "free-text" : "plan-change")
    : null;

  async function press(id: string, action: PromptBlockAction): Promise<boolean> {
    if (locked) return false;
    setSending(id);
    try {
      // A handler that returns nothing is taken at its word (the presentational tests inject one);
      // only an explicit `false` means "didn't send".
      return (await onAction(action)) !== false;
    } finally {
      setSending(null);
    }
  }

  async function sendFeedback() {
    const text = draft.trim();
    if (text.length === 0) return;
    // The editor closes only on a send that actually landed. A refused one (the guard saw the dialog
    // move) would otherwise throw away up to FEEDBACK_MAX_LENGTH characters someone thumb-typed on a
    // phone — the longest text this app ever asks anyone to type — with no way to get them back.
    if (await press("feedback", { kind: "feedback", text })) setEditorOpen(false);
  }

  const busyIcon = (
    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label={t("prompt.sendingAria")} />
  );

  return (
    <PromptPanel ariaLabel={prompt.question}>
      {prompt.approval ? <ApprovalContext approval={prompt.approval} /> : null}
      <OptionGroupCaption>{familyCaption(prompt.family)}</OptionGroupCaption>
      <div className="flex flex-col gap-1">
        {prompt.options.map((option, index) => {
          const id = `opt-${index}`;
          const busy = sending === id;
          return (
            <OptionButton
              key={index}
              tone={busy ? "busy" : "default"}
              keyLabel={option.keyLabel ?? option.keys[0]}
              label={option.label}
              description={option.description}
              disabled={locked}
              onClick={() => press(id, { kind: "option", option })}
              trailing={
                busy ? (
                  <Loader2
                    className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
                    aria-label={t("prompt.sendingAria")}
                  />
                ) : null
              }
            />
          );
        })}
      </div>

      {/* The inline text input, in whichever of its states this screen is in. OUR OWN send comes
          first: the choreography focuses the row and fills it, so from the moment Send is pressed the
          screen is briefly indistinguishable from "someone at the terminal is typing" — and saying
          that to the person who just pressed the button would be a lie about their own action. */}
      {feedback && feedbackCopy && sending === "feedback" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {busyIcon}
          {feedbackCopy.sending}
        </div>
      ) : feedback && feedbackCopy && terminalFocused ? (
        <div className="rounded-lg border border-dashed border-status-working/50 px-3 py-2 text-xs text-status-working">
          {feedbackCopy.focused}
          {feedback.text ? (
            <span className="font-content text-muted-foreground"> ({feedback.text})</span>
          ) : null}
        </div>
      ) : feedback && feedbackCopy && feedback.text !== "" ? (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <MessageSquarePlus
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-label={t("prompt.feedback.typedAria")}
          />
          <span className="min-w-0 flex-1 text-xs text-foreground/90">
            {feedbackCopy.typedPrefix}
            <span className="font-content">{feedback.text}</span>
          </span>
        </div>
      ) : feedback && feedbackCopy && feedbackCopy.offer && editorOpen ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
          <label
            htmlFor="plan-feedback-text"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <MessageSquarePlus className="size-3.5 shrink-0" />
            {feedbackCopy.editorLabel}
          </label>
          <textarea
            id="plan-feedback-text"
            ref={editorRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={FEEDBACK_MAX_LENGTH}
            rows={3}
            aria-label={t("prompt.feedback.planChange.textAria")}
            placeholder={feedbackCopy.placeholder}
            className="w-full resize-none rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">{feedbackCopy.help}</p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={sending !== null}
              onClick={() => setEditorOpen(false)}
              className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors active:bg-muted disabled:opacity-60"
            >
              {t("prompt.feedback.cancel")}
            </button>
            <button
              type="button"
              disabled={locked || draft.trim().length === 0}
              onClick={() => void sendFeedback()}
              className="flex items-center gap-1.5 rounded-md border border-primary/60 bg-primary/15 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors active:bg-primary/25 disabled:opacity-60"
            >
              {sending === "feedback" ? busyIcon : null}
              {feedbackCopy.send}
            </button>
          </div>
        </div>
      ) : feedback && feedbackCopy && feedbackCopy.offer ? (
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            setDraft("");
            setEditorOpen(true);
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors active:bg-muted disabled:opacity-60"
        >
          <MessageSquarePlus className="size-3.5 shrink-0" />
          {feedbackCopy.offer}
        </button>
      ) : null}
    </PromptPanel>
  );
}
