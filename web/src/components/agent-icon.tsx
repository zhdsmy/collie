import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { AGENT_BRANDS } from "@/components/agent-icon-data";

// Resolve a Herdr-detected agent name (`pane.agent`) to a brand key, tolerating variants like
// "claude-code" / "opencode-dev". Mirrors the matching in lib/agent-commands.ts.
function brandKey(agent: string): string | undefined {
  const k = agent.toLowerCase().trim();
  if (AGENT_BRANDS[k]) return k;
  if (k.startsWith("claude")) return "claude";
  if (k.startsWith("codex")) return "codex";
  if (k.startsWith("opencode")) return "opencode";
  if (k === "pi" || k.startsWith("pi-") || k.startsWith("pi.")) return "pi";
  return undefined;
}

/**
 * A square "app icon" tile for an agent, rendered as inline SVG (CSP-safe). The tile carries its own
 * brand background and a theme-aware inset edge, so black brand tiles remain distinct from Collie's
 * dark terminal surface. Falls back to a neutral initials tile for unknown agents. Size comes from
 * `className` (e.g. `size-9`).
 */
export function AgentIcon({
  agent,
  className,
}: {
  agent: string | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const brand = agent ? AGENT_BRANDS[brandKey(agent) ?? ""] : undefined;

  if (!brand) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[22%] border bg-muted text-[0.5em] font-semibold uppercase leading-none text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={agent ? t("common.agentIconNamed", { agent }) : t("common.agentIcon")}
      >
        {initials(agent ?? "")}
      </span>
    );
  }

  const stroke = brand.mode === "stroke";
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={t("common.agentLogo", { agent })}
    >
      <rect width="24" height="24" rx="5.3" fill={brand.bg} />
      <rect
        x="0.35"
        y="0.35"
        width="23.3"
        height="23.3"
        rx="4.95"
        fill="none"
        stroke="var(--agent-icon-border)"
        strokeWidth="0.7"
      />
      {/* Inset the 24×24 mark to ~62% so every logo carries uniform app-icon padding. */}
      <g
        transform="translate(4.6 4.6) scale(0.617)"
        fill={stroke ? "none" : brand.fg}
        stroke={stroke ? brand.fg : undefined}
        strokeWidth={stroke ? 2 : undefined}
        strokeLinecap={stroke ? "square" : undefined}
      >
        <path d={brand.d} />
      </g>
    </svg>
  );
}
