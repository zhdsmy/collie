import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/**
 * One opt-in on Settings → Experiments: an icon, a name, what it does, the switch, and what is known
 * to be unfinished about it.
 *
 * Every experiment is the same shape, so it is one component: the section's contract is said once at
 * the top of the page (routes/settings-sections.tsx), and each card under it only has to say what
 * it is and what it costs.
 */
export function ExperimentCard({
  icon: Icon,
  title,
  description,
  caveat,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** What is known to be missing, named rather than discovered. */
  caveat: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium">{title}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
      </div>

      {/* The caveat hangs under the header's TEXT — `pl-12` is the card's own `px-4` plus the icon
          gutter above it — so one left edge runs down the card, the shape ZenControl's dependent
          row already uses. */}
      <div className="border-t border-border py-3 pl-12 pr-4">
        <p className="text-xs leading-snug text-muted-foreground">{caveat}</p>
      </div>
    </Card>
  );
}
