import { useEffect, useRef, useState, type ReactNode } from "react";
import { Frame, Glass, GlassContainer, LiquidCanvas } from "@liquid-dom/react";

export default function LiquidDomGlass({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((old) => old.width === width && old.height === height ? old : { width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full" data-slot="liquid-dom-glass">
      {!failed && "gpu" in navigator && size.width > 0 && size.height > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]" aria-hidden>
          <LiquidCanvas
            style={{ width: "100%", height: "100%" }}
            canvasStyle={{ width: "100%", height: "100%" }}
            frameloop="demand"
            maxDpr={2}
            onError={() => setFailed(true)}
          >
            <GlassContainer blur={12}>
              <Frame width={size.width} height={size.height}>
                <Glass cornerRadius={30} />
              </Frame>
            </GlassContainer>
          </LiquidCanvas>
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
