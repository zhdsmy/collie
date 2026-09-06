import * as React from "react";
import { Card as IslandCard } from "animal-island-ui";

import { cn } from "@/lib/utils";
import { useDesignPrefs } from "@/lib/design";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  const island = useDesignPrefs().theme === "animal-island";
  if (island) {
    // The library's decorative `color` prop is narrower than the native div
    // attribute exposed by Collie's historical Card; no call site uses it.
    const { color: _color, ...islandProps } = props;
    return <IslandCard data-slot="card" className={cn("collie-island-card", className)} {...islandProps} />;
  }
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
