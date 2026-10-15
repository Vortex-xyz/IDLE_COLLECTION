import { useEffect, useRef } from "react";
import { renderBattle } from "@/game/draw";
import { getMonster } from "@/game/data";
import { slotPos } from "@/game/layout";
import { cancelArm, dismissTip, getSnapshot, onFrame, openSlot, subscribe } from "@/game/world";
import { useSyncExternalStore } from "react";

export function Battle({ active }: { active: boolean }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const aspect = 360 / 640;
      let w = rect.width;
      let h = rect.height;
      if (w / h > aspect) w = h * aspect;
      else h = w / aspect;
      const ox = (rect.width - w) / 2;
      const oy = (rect.height - h) / 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.left = `${ox}px`;
      canvas.style.top = `${oy}px`;
      const scale = w / 360;
      for (let i = 0; i < 9; i += 1) {
        const button = slotRefs.current[i];
        if (!button) continue;
        const p = slotPos(i);
        const size = Math.max(44, 62 * scale);
        button.style.width = `${size}px`;
        button.style.height = `${size}px`;
        button.style.left = `${ox + p.x * scale - size / 2}px`;
        button.style.top = `${oy + p.y * scale - size / 2}px`;
      }
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    const stop = onFrame(() => {
      if (wrap.offsetParent === null) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      ctx.setTransform((cssW / 360) * dpr, 0, 0, (cssH / 640) * dpr, 0, 0);
      renderBattle(ctx);
    });
    return () => {
      ro.disconnect();
      stop();
    };
  }, [active]);

  const armedName = snap.armedId ? getMonster(snap.armedId)?.name : null;

  return (
    <div ref={wrapRef} className="relative h-full touch-none bg-ink">
      <canvas ref={canvasRef} className="absolute" />
      {Array.from({ length: 9 }, (_, i) => {
        const id = snap.grid[i];
        const name = id ? getMonster(id)?.name : null;
        return (
          <button
            key={i}
            type="button"
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className="absolute rounded-full focus-visible:outline-2 focus-visible:outline-gold"
            aria-label={name ? `Ring ${i + 1}, ${name}` : `Empty ring ${i + 1}`}
            onClick={() => openSlot(i)}
          />
        );
      })}
      {armedName && (
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-3 border border-line bg-ink-2 px-3 py-2">
          <p className="text-sm text-parchment">Tap a ring to bind {armedName}</p>
          <button type="button" className="h-11 px-3 text-sm text-gold" onClick={cancelArm}>
            Cancel
          </button>
        </div>
      )}
      {snap.tip && !armedName && (
        <div className="absolute inset-x-3 bottom-3 z-10 border border-line bg-ink-2 p-3">
          <p className="text-sm leading-relaxed text-parchment">
            Your gutter slime holds the center ring. Summon more, then tap an empty ring to bind them. They attack on their own.
          </p>
          <button
            type="button"
            className="mt-3 h-11 bg-gold px-4 text-sm font-semibold text-ink transition-transform duration-150 active:scale-[0.96]"
            onClick={dismissTip}
          >
            Understood
          </button>
        </div>
      )}
    </div>
  );
}
