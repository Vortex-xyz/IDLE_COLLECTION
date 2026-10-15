import { Anvil, LayoutGrid, Settings, Sparkles, Swords } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Battle } from "@/components/game/battle";
import { Forge } from "@/components/game/forge";
import { Hoard } from "@/components/game/hoard";
import { Portrait } from "@/components/game/portrait";
import { Summon } from "@/components/game/summon";
import { setMix } from "@/game/audio";
import { getMonster, MONSTERS } from "@/game/data";
import { formatDuration, formatNum } from "@/game/format";
import type { Rarity, Tab } from "@/game/types";
import {
  askReset,
  claimOffline,
  closeModal,
  getSnapshot,
  hardReset,
  openSettings,
  place,
  rebirth,
  replaceSave,
  serialize,
  setMusic,
  setSfx,
  setTab,
  startAd,
  startLoop,
  subscribe,
  toggleShake,
  toggleSpeed,
  type Snapshot,
} from "@/game/world";

const press = "transition-transform duration-150 ease-out active:scale-[0.96]";

function rarityClass(r: Rarity): string {
  if (r === "legendary") return "text-gold";
  if (r === "epic") return "text-ember";
  if (r === "rare") return "text-moss";
  return "text-parchment-dim";
}

function Header({ snap }: { snap: Snapshot }) {
  const pct = snap.vaultMax > 0 ? Math.max(0, Math.min(1, snap.vaultHp / snap.vaultMax)) : 0;
  return (
    <header className="shrink-0 border-b border-line bg-ink">
      <div className="flex h-12 items-center gap-2 px-3">
        <img src="/art/monsters/slime.png" alt="" className="size-8 object-contain" />
        <p className="flex items-center gap-1 text-sm font-semibold text-gold">
          <img src="/art/ui/coin.png" alt="" className="size-5 object-contain" />
          <span>{formatNum(snap.gold)}</span>
        </p>
        <p className="flex items-center gap-1 text-sm font-semibold text-moss">
          <img src="/art/ui/gem.png" alt="" className="size-5 object-contain" />
          <span>{formatNum(snap.gems)}</span>
        </p>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={`h-11 px-3 text-sm text-parchment ${press}`} onClick={toggleSpeed}>
            {snap.speed}×
          </button>
          <button type="button" className={`flex size-11 items-center justify-center text-parchment ${press}`} aria-label="Settings" onClick={openSettings}>
            <Settings className="size-5" />
          </button>
        </div>
      </div>
      <div className="h-1.5 bg-ink-2">
        <div className={pct < 0.35 ? "h-full bg-ember" : "h-full bg-moss"} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="flex items-center justify-between px-3 py-1 text-xs text-parchment-dim">
        <span className="font-display text-sm text-parchment">Wave {snap.wave}</span>
        <span>{snap.status}</span>
        <span>Best {snap.best}</span>
      </div>
    </header>
  );
}

function Nav({ tab }: { tab: Tab }) {
  const items: { id: Tab; label: string; icon: typeof Swords }[] = [
    { id: "battle", label: "Battle", icon: Swords },
    { id: "summon", label: "Summon", icon: Sparkles },
    { id: "hoard", label: "Hoard", icon: LayoutGrid },
    { id: "forge", label: "Forge", icon: Anvil },
  ];
  return (
    <nav className="dock grid shrink-0 grid-cols-4 border-t border-line bg-ink-2">
      {items.map((item) => {
        const Icon = item.icon;
        const on = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${on ? "text-gold" : "text-parchment-dim"}`}
            onClick={() => setTab(item.id)}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function Backdrop({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-ink/80 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="max-h-[85%] w-full max-w-md overflow-y-auto border border-line bg-panel p-4">{children}</div>
    </div>
  );
}

function Modals({ snap }: { snap: Snapshot }) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (snap.modal.type === "none") return null;

  if (snap.modal.type === "offline" && snap.pending) {
    return (
      <Backdrop>
        <p className="font-display text-xs tracking-widest text-gold">WHILE YOU WERE AWAY</p>
        <h2 className="mt-2 font-display text-2xl text-parchment">{formatDuration(snap.pending.seconds)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-parchment-dim">
          The rings kept working. The stair paid {formatNum(snap.pending.gold)} gold
          {snap.pending.gems > 0 ? ` and ${snap.pending.gems} gems` : ""}.
        </p>
        <button type="button" className={`mt-4 h-12 w-full bg-gold font-semibold text-ink ${press}`} onClick={() => claimOffline(1)}>
          Collect
        </button>
        <button type="button" className={`mt-2 h-12 w-full border border-gold text-gold ${press}`} onClick={() => startAd("double")}>
          {snap.iap.noAds ? "Double (ads removed)" : "Double (ad)"}
        </button>
      </Backdrop>
    );
  }

  if (snap.modal.type === "reveal" && snap.reveal) {
    const def = getMonster(snap.reveal.id);
    return (
      <Backdrop>
        <div className="flex flex-col items-center text-center">
          <Portrait id={snap.reveal.id} size={120} />
          <p className={`mt-2 text-xs capitalize ${def ? rarityClass(def.rarity) : ""}`}>{def?.rarity}</p>
          <h2 className="font-display text-2xl text-parchment">{def?.name}</h2>
          <p className="mt-2 text-sm text-parchment-dim">
            {snap.reveal.isNew && "Newly bound."}
            {!snap.reveal.isNew && snap.reveal.gems > 0 && `Stars are full. Converted to ${snap.reveal.gems} gems.`}
            {!snap.reveal.isNew && snap.reveal.gems === 0 && `Star ${snap.reveal.stars} of 5.`}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-parchment-dim">{def?.blurb}</p>
          <button type="button" className={`mt-4 h-12 w-full bg-gold font-semibold text-ink ${press}`} onClick={closeModal}>
            Continue
          </button>
        </div>
      </Backdrop>
    );
  }

  if (snap.modal.type === "picker") {
    const slot = snap.modal.slot;
    const owned = MONSTERS.filter((m) => snap.owned[m.id]);
    return (
      <Backdrop onClose={closeModal}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-gold">Ring {slot + 1}</h2>
          <button type="button" className="h-11 px-2 text-sm text-parchment-dim" onClick={closeModal}>
            Close
          </button>
        </div>
        {snap.grid[slot] && (
          <button type="button" className="mb-3 h-11 w-full border border-line text-sm" onClick={() => place(slot, null)}>
            Empty this ring
          </button>
        )}
        <ul className="flex flex-col gap-2">
          {owned.map((m) => (
            <li key={m.id}>
              <button type="button" className="flex w-full items-center gap-3 border border-line bg-ink-2 p-2 text-left" onClick={() => place(slot, m.id)}>
                <Portrait id={m.id} size={48} />
                <span>
                  <span className="block text-sm text-parchment">{m.name}</span>
                  <span className="text-xs text-parchment-dim">
                    Lv {snap.owned[m.id]?.level}
                    {snap.grid.includes(m.id) ? " · placed" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Backdrop>
    );
  }

  if (snap.modal.type === "rebirth") {
    return (
      <Backdrop onClose={closeModal}>
        <h2 className="font-display text-xl text-gold">Rebirth?</h2>
        <p className="mt-2 text-sm leading-relaxed text-parchment-dim">
          Gold, monster levels, forge upgrades, and the stair reset. Stars, gems, and unlocked monsters stay. You gain another 8% damage and 6% gold.
        </p>
        <button type="button" className={`mt-4 h-12 w-full bg-gold font-semibold text-ink ${press}`} onClick={rebirth}>
          Rebirth
        </button>
        <button type="button" className="mt-2 h-11 w-full text-sm text-parchment-dim" onClick={closeModal}>
          Not yet
        </button>
      </Backdrop>
    );
  }

  if (snap.modal.type === "reset") {
    return (
      <Backdrop onClose={closeModal}>
        <h2 className="font-display text-xl text-ember">Empty the vault?</h2>
        <p className="mt-2 text-sm text-parchment-dim">This deletes the save on this device. It cannot be undone.</p>
        <button type="button" className={`mt-4 h-12 w-full bg-ember font-semibold text-ink ${press}`} onClick={hardReset}>
          Delete save
        </button>
        <button type="button" className="mt-2 h-11 w-full text-sm text-parchment-dim" onClick={closeModal}>
          Cancel
        </button>
      </Backdrop>
    );
  }

  if (snap.modal.type === "ad") {
    const pct = Math.max(0, Math.min(1, 1 - snap.adLeft / 1.3));
    return (
      <Backdrop>
        <p className="font-display text-xs tracking-widest text-gold">ADVERTISEMENT</p>
        <h2 className="mt-2 font-display text-xl">Placeholder</h2>
        <p className="mt-2 text-sm text-parchment-dim">A rewarded ad would play here. This demo grants the reward when the bar fills.</p>
        <div className="mt-4 h-2 bg-ink">
          <div className="h-full bg-gold" style={{ width: `${pct * 100}%` }} />
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={closeModal}>
      <h2 className="font-display text-xl text-gold">Settings</h2>
      <label className="mt-4 block text-sm text-parchment-dim">
        Effects
        <input type="range" min={0} max={100} value={Math.round(snap.settings.sfx * 100)} aria-label="Effects volume" onChange={(e) => setSfx(Number(e.target.value) / 100)} />
      </label>
      <label className="mt-3 block text-sm text-parchment-dim">
        Music
        <input type="range" min={0} max={100} value={Math.round(snap.settings.music * 100)} aria-label="Music volume" onChange={(e) => setMusic(Number(e.target.value) / 100)} />
      </label>
      <button type="button" className="mt-3 h-11 w-full border border-line text-sm" onClick={toggleShake}>
        Screen shake {snap.settings.shake ? "on" : "off"}
      </button>
      <p className="mt-4 text-sm leading-relaxed text-parchment-dim">
        Summon, place monsters on the nine rings, and clear waves for gold. If a hero reaches the chest, the wave fails. Rebirth at wave 15 keeps stars for permanent multipliers. Leaving the game banks offline gold, up to eight hours.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className="h-11 border border-line text-sm"
          onClick={() => {
            const blob = new Blob([serialize()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "hoardbound-save.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export save
        </button>
        <button type="button" className="h-11 border border-line text-sm" onClick={() => fileRef.current?.click()}>
          Import save
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => replaceSave(text));
            e.target.value = "";
          }}
        />
        <a className="flex h-11 items-center justify-center border border-gold text-sm text-gold" href="/hoardbound-godot-3.6.2.zip" download>
          Download Godot 3.6.2 project
        </a>
        <button type="button" className="h-11 text-sm text-ember" onClick={askReset}>
          Reset progress
        </button>
        <button type="button" className="h-11 text-sm text-parchment-dim" onClick={closeModal}>
          Close
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-parchment-dim">
        The Godot project is the same game in GDScript: autoloads, a 3×3 grid, gacha, idle rewards, rebirth, and JSON saves. Art there is flat color so sprites can replace it.
      </p>
    </Backdrop>
  );
}

export function GameShell() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => startLoop(), []);
  useEffect(() => {
    setMix(snap.settings.sfx, snap.settings.music);
  }, [snap.settings.sfx, snap.settings.music]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "1") setTab("battle");
      if (e.key === "2") setTab("summon");
      if (e.key === "3") setTab("hoard");
      if (e.key === "4") setTab("forge");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-ink text-parchment select-none">
      <Header snap={snap} />
      <main className="relative min-h-0 flex-1">
        <div className={snap.tab === "battle" ? "h-full" : "hidden"}>
          <Battle active={snap.tab === "battle"} />
        </div>
        {snap.tab === "summon" && <Summon snap={snap} />}
        {snap.tab === "hoard" && <Hoard snap={snap} />}
        {snap.tab === "forge" && <Forge snap={snap} />}
      </main>
      <Nav tab={snap.tab} />
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex flex-col items-center gap-2 px-4">
        {snap.toasts.map((t) => (
          <p key={t.id} className="border border-line bg-ink-2 px-3 py-2 text-sm text-parchment">
            {t.text}
          </p>
        ))}
      </div>
      <Modals snap={snap} />
      <p className="sr-only" aria-live="polite">
        Wave {snap.wave}. {snap.status}. Vault {Math.round(snap.vaultHp)} of {snap.vaultMax}.
      </p>
    </div>
  );
}
