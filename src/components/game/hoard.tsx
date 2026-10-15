import { Portrait } from "@/components/game/portrait";
import { attackInterval, hasteMultiplier, hitDamage } from "@/game/balance";
import { MONSTERS, RARITY_RANK, getMonster } from "@/game/data";
import { formatNum } from "@/game/format";
import { levelCost } from "@/game/balance";
import type { Rarity } from "@/game/types";
import { arm, levelUp, type Snapshot } from "@/game/world";

function rarityClass(r: Rarity): string {
  if (r === "legendary") return "text-gold";
  if (r === "epic") return "text-ember";
  if (r === "rare") return "text-moss";
  return "text-parchment-dim";
}

export function Hoard({ snap }: { snap: Snapshot }) {
  const haste = hasteMultiplier({ upgrades: snap.upgrades });
  const list = [...MONSTERS].sort((a, b) => {
    const ao = snap.owned[a.id] ? 1 : 0;
    const bo = snap.owned[b.id] ? 1 : 0;
    if (ao !== bo) return bo - ao;
    return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
  });
  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="font-display text-xl text-gold">The hoard</h2>
      <p className="mt-1 mb-4 text-sm text-parchment-dim">One of each monster can stand on the rings. Stars stay through rebirth. Levels do not.</p>
      <ul className="flex flex-col gap-3">
        {list.map((def) => {
          const owned = snap.owned[def.id];
          const placed = snap.grid.includes(def.id);
          const hit = owned ? hitDamage(def, owned.level, owned.stars, snap.dmgMult) : def.damage;
          const every = attackInterval(def, owned ? haste : 1);
          const cost = owned ? levelCost(def.id, owned.level) : 0;
          return (
            <li key={def.id} className={`border border-line bg-ink-2 p-3 ${owned ? "" : "opacity-60"}`}>
              <div className="flex gap-3">
                <Portrait id={def.id} size={64} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-base text-parchment">{owned ? def.name : "Unbound"}</h3>
                    <span className={`text-xs capitalize ${rarityClass(def.rarity)}`}>{def.rarity}</span>
                  </div>
                  {owned ? (
                    <>
                      <p className="text-xs text-parchment-dim">
                        Lv {owned.level}
                        {placed ? " · on a ring" : ""}
                      </p>
                      <div className="mt-1 flex gap-1" aria-label={`${owned.stars} of 5 stars`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <span key={i} className={i < owned.stars ? "size-2 bg-gold" : "size-2 bg-line"} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-parchment-dim">{getMonster(def.id)?.name} is still in the dark.</p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-parchment-dim">{def.blurb}</p>
              <p className="mt-1 text-xs text-parchment">
                {Math.round(hit)} dmg · {every.toFixed(2)}s · range {def.range}
              </p>
              {owned && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={snap.gold < cost}
                    className="h-11 flex-1 bg-gold text-sm font-semibold text-ink disabled:opacity-40"
                    onClick={() => levelUp(def.id)}
                  >
                    Level · {formatNum(cost)}
                  </button>
                  <button
                    type="button"
                    className="h-11 flex-1 border border-line text-sm text-parchment"
                    onClick={() => arm(def.id)}
                  >
                    {placed ? "Move" : "Bind"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
