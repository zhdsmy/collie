import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CornerDownLeft, Pencil, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { AgentIcon } from "@/components/agent-icon";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import { commandsFor, type AgentCommand } from "@/lib/agent-commands";
import type { OperatorCommand } from "@/lib/types";

interface CommandPaletteProps {
  onClose: () => void;
  agent: string | undefined | null;
  /** The operator's own rows (`commands.toml`); they replace the catalog on panes they address. */
  mine?: readonly OperatorCommand[];
  /** Insert "/cmd " into the composer for the user to complete (arg-taking commands). */
  onInsert: (text: string) => void;
  /** Send "/cmd" immediately and submit (no-arg commands). */
  onSubmit: (text: string) => void;
}

export function CommandPalette({
  onClose,
  agent,
  mine,
  onInsert,
  onSubmit,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const all = commandsFor(agent, mine);
  const [query, setQuery] = useState("");
  const { pending, confirm, reset } = usePendingConfirm();

  const q = query.trim().toLowerCase();
  const descriptionFor = (command: AgentCommand): string =>
    command.descriptionId
      ? t(`commandDescriptions.${command.descriptionId}`, { defaultValue: command.description })
      : command.description;
  const list = q
    ? all.filter(
        (c) =>
          c.command.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          descriptionFor(c).toLowerCase().includes(q),
      )
    : all.filter((c) => c.common);

  function pick(c: AgentCommand) {
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
    <div className="flex h-full min-h-0 flex-col" data-testid="command-palette">
      {agent && (
        <div className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1">
          <AgentIcon agent={agent} className="size-5" />
          <span className="text-sm font-medium">{agent}</span>
        </div>
      )}

      {!q && (
        <p className="shrink-0 px-3 pb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("commands.commonHint", { count: all.length })}
        </p>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1"
        data-testid="command-list"
      >
        <div className="flex flex-col gap-1">
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("commands.noMatch", { query })}
            </p>
          )}
          {list.map((c) => {
            const isPending = pending === c.command;
            return (
              <button
                key={c.command}
                type="button"
                onClick={() => pick(c)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
                  isPending ? "bg-destructive/10" : "hover:bg-accent",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold",
                        c.dangerous ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {c.command}
                    </span>
                    {c.takesArg && (
                      <span className="font-mono text-[11px] text-muted-foreground">{c.argHint}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{descriptionFor(c)}</p>
                </div>
                {isPending ? (
                  <span className="shrink-0 text-xs font-medium text-destructive">
                    {t("commands.confirm")}
                  </span>
                ) : c.takesArg ? (
                  <Pencil className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border/60 bg-muted/20 p-2"
        data-testid="command-search"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commands.search", { count: all.length })}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}
