import { Portrait } from "@/components/game/portrait";
import { GEM_SUMMON_COST, PITY_GEM, PITY_GOLD, getMonster } from "@/game/data";
import { formatDuration, formatNum } from "@/game/format";
import type { Rarity } from "@/game/types";
import { startAd, summon, type Snapshot } from "@/game/world";

function rarityClass(r: Rarity): string {
  if (r === "legendary") return "text-gold";
  if (r === "epic") return "text-ember";
  if (r === "rare") return "text-moss";
  return "text-parchment-dim";
}

function RateBar({ rates }: { rates: Record<Rarity, number> }) {
  const parts: { key: Rarity; className: string }[] = [
    { key: "common", className: "bg-parchment-dim" },
    { key: "rare", className: "bg-moss" },
    { key: "epic", className: "bg-ember" },
    { key: "legendary", className: "bg-gold" },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden bg-ink">
        {parts.map((p) => (
          <div key={p.key} className={p.className} style={{ width: `${rates[p.key] * 100}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-parchment-dim">
        {parts.map((p) => `${p.key} ${(rates[p.key] * 100).toFixed(1)}%`).join(" · ")}
      </p>
    </div>
  );
}

const RING = ["slime", "imp", "wolf", "golem", "wraith", "hydra", "drake", "lich"];

export function Summon({ snap }: { snap: Snapshot }) {
  const goldReady = snap.gold >= snap.summonCost;
  const gemReady = snap.gems >= snap.gemCost;
  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="relative mx-auto mb-4 size-64">
        <div className="spin-slow absolute inset-2 rounded-full border-2 border-dashed border-gold" />
        <div className="absolute inset-12 flex items-center justify-center rounded-full border border-line bg-ink-2">
          <p className="font-display text-xs tracking-widest text-gold">BIND</p>
        </div>
        {RING.map((id, i) => {
          const angle = (i / RING.length) * Math.PI * 2 - Math.PI / 2;
          const owned = Boolean(snap.owned[id]);
          return (
            <img
              key={id}
              src={`/art/monsters/${id}.png`}
              alt=""
              draggable={false}
              className={`absolute size-14 -translate-x-1/2 -translate-y-1/2 object-contain ${owned ? "" : "opacity-35"}`}
              style={{
                left: `${50 + Math.cos(angle) * 40}%`,
                top: `${50 + Math.sin(angle) * 40}%`,
              }}
            />
          );
        })}
      </div>
      <p className="mb-4 text-center text-sm leading-relaxed text-parchment-dim">
        Duplicates raise a star, up to five. Past that they turn into gems. Pity guarantees a legendary.
      </p>
      <button
        type="button"
        disabled={!goldReady}
        className="mb-2 h-14 w-full bg-gold text-base font-semibold text-ink transition-transform duration-150 active:scale-[0.96] disabled:opacity-40"
        onClick={() => summon("gold")}
      >
        Summon · {formatNum(snap.summonCost)} gold
      </button>
      <p className="mb-4 text-center text-xs text-parchment-dim">
        Pity {snap.pityGold}/{PITY_GOLD}
      </p>
      <RateBar rates={snap.ratesGold} />
      <button
        type="button"
        disabled={!gemReady}
        className="mt-5 mb-2 h-14 w-full border border-gold bg-ink-2 text-base font-semibold text-gold transition-transform duration-150 active:scale-[0.96] disabled:opacity-40"
        onClick={() => summon("gem")}
      >
        Greater summon · {GEM_SUMMON_COST} gems
      </button>
      <p className="mb-4 text-center text-xs text-parchment-dim">
        Pity {snap.pityGem}/{PITY_GEM}
      </p>
      <RateBar rates={snap.ratesGem} />
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={snap.cd.summon > 0}
          className="h-14 border border-line bg-panel px-2 text-sm text-parchment disabled:opacity-40"
          onClick={() => startAd("summon")}
        >
          {snap.cd.summon > 0 ? `Free bind ${formatDuration(snap.cd.summon)}` : snap.iap.noAds ? "Free bind" : "Free bind (ad)"}
        </button>
        <button
          type="button"
          disabled={snap.cd.gems > 0}
          className="h-14 border border-line bg-panel px-2 text-sm text-parchment disabled:opacity-40"
          onClick={() => startAd("gems")}
        >
          {snap.cd.gems > 0 ? `+25 gems ${formatDuration(snap.cd.gems)}` : snap.iap.noAds ? "+25 gems" : "+25 gems (ad)"}
        </button>
      </div>
      {snap.history.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {snap.history.map((row, i) => {
            const def = getMonster(row.id);
            return (
              <li key={`${row.id}-${i}`} className="flex items-center gap-3 border border-line bg-ink-2 px-2 py-1">
                <Portrait id={row.id} size={44} />
                <span className="text-sm text-parchment">{def?.name}</span>
                <span className={`ml-auto text-xs capitalize ${rarityClass(row.rarity)}`}>{row.rarity}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
