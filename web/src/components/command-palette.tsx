import { useRef, useState } from "react";
import { CornerDownLeft, Pencil, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import { commandsFor, type AgentCommand } from "@/lib/agent-commands";
import type { OperatorCommand } from "@/lib/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

interface CommandPaletteProps {
  onClose: () => void;
  agent: string | undefined | null;
  disabled?: boolean;
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
  disabled,
  mine,
  onInsert,
  onSubmit,
}: CommandPaletteProps) {
  useLocale();
  const all = commandsFor(agent, mine);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const { pending, confirm, reset } = usePendingConfirm();

  const q = query.trim().toLowerCase();
  const list = q
    ? all.filter(
        (c) =>
          c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      )
    : all.filter((c) => c.common);

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
    <div className="flex max-h-[45dvh] min-h-0 flex-col border-t border-rule bg-muted/30">
      {/* Three rows at rest; on short keyboard viewports only the list shrinks. */}
      <ul ref={listRef} aria-label={t("commands.title")} className="h-48 min-h-0 overflow-y-auto overscroll-contain">
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
      <div className="shrink-0 border-t border-border px-3 py-2">
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
