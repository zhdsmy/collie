import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Pencil, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import { commandsFor, type AgentCommand } from "@/lib/agent-commands";
import { canonicalAgent, rowsFor } from "@/lib/operator-scope";
import { fetchClaudeCommands, type ClaudeCommand } from "@/lib/api";
import type { Scope } from "@/lib/scope";
import type { OperatorCommand } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

interface CommandPaletteProps {
  onClose: () => void;
  agent: string | undefined | null;
  disabled?: boolean;
  /** The pane the palette types into; its machine is asked which skills Claude Code would load there. */
  paneId?: string;
  scope?: Scope;
  /** The operator's own rows (`commands.toml`); they replace the catalog on panes they address. */
  mine?: readonly OperatorCommand[];
  /** On-disk skills already read for this pane by the composer. */
  found?: readonly ClaudeCommand[];
  /** Insert "/cmd " into the composer for the user to complete (arg-taking commands). */
  onInsert: (text: string) => void;
  /** Send "/cmd" immediately and submit (no-arg commands). */
  onSubmit: (text: string) => void;
}

/**
 * Reads the skills and commands the pane's agent would load off disk whenever `active` turns on
 * and no operator `commands.toml` rows replace the palette for this pane (ADR 0018).
 */
export function useClaudeCommands(
  active: boolean,
  agent: string | undefined | null,
  paneId: string | undefined,
  scope?: Scope,
  mine: readonly OperatorCommand[] = [],
): readonly ClaudeCommand[] {
  const [state, setState] = useState<{ key: string; rows: readonly ClaudeCommand[] }>({
    key: "",
    rows: [],
  });
  const family = canonicalAgent(agent?.toLowerCase().trim() ?? "");
  // A pane with no agent (a plain shell) has nothing to load; every agent pane asks, and the bridge
  // answers an empty list for one it has no loader for.
  const readsFound = family !== "";
  const hasOperatorRows = rowsFor(mine, agent, (row) => row.command).length > 0;
  const host = scope?.host ?? "";
  const session = scope?.session ?? "";
  const targetKey = `${host}\0${session}\0${paneId ?? ""}\0${family}`;

  // Asked on every open, because a skill installed a minute ago should be there; a failed read
  // (an older bridge, a crew member) clears any stale rows from an earlier open and keeps the catalog.
  useEffect(() => {
    if (!active || !readsFound || hasOperatorRows || paneId === undefined) return;
    const ac = new AbortController();
    const requestScope: Scope = {};
    if (host !== "") requestScope.host = host;
    if (session !== "") requestScope.session = session;
    const run = async () => {
      try {
        const rows = await fetchClaudeCommands(paneId, requestScope, ac.signal);
        if (!ac.signal.aborted) setState({ key: targetKey, rows });
      } catch {
        if (!ac.signal.aborted) setState({ key: targetKey, rows: [] });
      }
    };
    void run();
    return () => ac.abort();
  }, [active, readsFound, hasOperatorRows, paneId, host, session, targetKey]);

  return !hasOperatorRows && state.key === targetKey ? state.rows : [];
}

export function CommandPalette({
  onClose,
  agent,
  disabled,
  paneId,
  scope,
  mine,
  found: foundProp,
  onInsert,
  onSubmit,
}: CommandPaletteProps) {
  useLocale();
  const fetched = useClaudeCommands(foundProp === undefined, agent, paneId, scope, mine);
  const all = commandsFor(agent, mine, foundProp ?? fetched);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const { pending, confirm, reset } = usePendingConfirm();

  const showAllPresets = canonicalAgent(agent?.toLowerCase().trim() ?? "") === "codex";
  const q = query.trim().toLowerCase();
  const list = q
    ? all.filter(
        (c) =>
          c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      )
    : all.filter((c) => showAllPresets || c.common);

  function pick(c: AgentCommand) {
    if (disabled) return;
    if (c.takesArg) {
      onInsert(`${c.command} `);
      onClose();
      return;
    }
    if (c.dangerous && !confirm(c.command)) return; // first tap arms the confirm
    reset();
    onSubmit(c.command);
    onClose();
  }

  return (
    <div className="flex max-h-[60dvh] min-h-0 flex-col">
      {/* Five rows at rest; on short keyboard viewports only the list shrinks. */}
      <ul ref={listRef} aria-label={t("commands.title")} className="h-80 min-h-0 overflow-y-auto overscroll-contain">
        {list.length === 0 && (
          <li className="flex h-full items-center justify-center px-3 text-center text-sm text-muted-foreground">
            {t("commands.empty", { query })}
          </li>
        )}
        {list.map((c) => {
          const isPending = pending === c.command;
          return (
            <li key={c.command}>
              <Button
                variant="ghost"
                type="button"
                disabled={disabled}
                onClick={() => pick(c)}
                className={cn(
                  "h-16 w-full min-w-0 justify-start gap-3 rounded-none px-3 py-2 text-left whitespace-normal transition-colors",
                  isPending ? "bg-destructive/10" : "hover:bg-accent",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate font-mono text-sm font-semibold",
                        c.dangerous ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {c.command}
                    </span>
                    {c.takesArg && (
                      <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{c.argHint}</span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{c.description}</p>
                </div>
                {isPending ? (
                  <span className="shrink-0 text-xs font-medium text-destructive">{t("commands.confirm")}</span>
                ) : c.takesArg ? (
                  <Pencil className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="shrink-0 border-t border-rule pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              reset();
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            aria-label={t("commands.search.placeholder", { count: all.length })}
            placeholder={t("commands.search.placeholder", { count: all.length })}
            className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
      </div>
    </div>
  );
}
