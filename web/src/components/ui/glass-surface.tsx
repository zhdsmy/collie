import { lazy, Suspense, type ReactNode } from "react";
import LiquidGlass from "liquid-glass-react";

import type { NavGlass } from "@/hooks/use-dash-prefs";

const LiquidDomGlass = lazy(() => import("@/components/ui/liquid-dom-glass"));

export function GlassSurface({ variant, children }: { variant: NavGlass; children: ReactNode }) {
  if (variant === "dom") {
    return (
      <Suspense fallback={children}>
        <LiquidDomGlass>{children}</LiquidDomGlass>
      </Suspense>
    );
  }

  return (
    <div className="relative h-[66px] w-full">
      <LiquidGlass
        className="[&>.glass]:w-full [&>.glass>div:last-child]:w-full"
        cornerRadius={30}
        displacementScale={48}
        blurAmount={0.1}
        saturation={115}
        aberrationIntensity={1}
        elasticity={0}
        padding="0"
        style={{ position: "absolute", left: "50%", top: "50%", width: "100%" }}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}
