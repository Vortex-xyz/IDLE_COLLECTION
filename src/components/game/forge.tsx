import { upgradeCost } from "@/game/balance";
import { PRESTIGE_WAVE, UPGRADES, getUpgrade } from "@/game/data";
import { formatNum } from "@/game/format";
import { askRebirth, buyIap, buyUpgrade, startAd, type Snapshot } from "@/game/world";
import { formatDuration } from "@/game/format";

export function Forge({ snap }: { snap: Snapshot }) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h2 className="font-display text-xl text-gold">The forge</h2>
      <p className="mt-1 mb-4 text-sm text-parchment-dim">
        Damage {snap.dmgMult.toFixed(2)}× · Gold {snap.goldMult.toFixed(2)}× · Heroes turned back {formatNum(snap.kills)}
      </p>
      <ul className="flex flex-col gap-3">
        {UPGRADES.map((u) => {
          const level = snap.upgrades[u.id];
          const maxed = level >= u.max;
          const cost = upgradeCost(u.id, level);
          return (
            <li key={u.id} className="border border-line bg-ink-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base">{u.name}</h3>
                <span className="text-xs text-parchment-dim">
                  {level}/{u.max}
                </span>
              </div>
              <p className="mt-1 text-sm text-parchment-dim">{getUpgrade(u.id).blurb}</p>
              <button
                type="button"
                disabled={maxed || snap.gold < cost}
                className="mt-3 h-11 w-full bg-gold text-sm font-semibold text-ink disabled:opacity-40"
                onClick={() => buyUpgrade(u.id)}
              >
                {maxed ? "Maxed" : `Raise · ${formatNum(cost)} gold`}
              </button>
            </li>
          );
        })}
      </ul>

      <section className="mt-6 border border-gold bg-ink-2 p-3">
        <h3 className="font-display text-lg text-gold">Rebirth</h3>
        <p className="mt-1 text-sm leading-relaxed text-parchment-dim">
          Rebirths: {snap.prestige}. Each one keeps stars, gems, and the bestiary, and adds 8% damage and 6% gold forever. Reach wave {PRESTIGE_WAVE}.
        </p>
        <button
          type="button"
          disabled={!snap.canRebirth}
          className="mt-3 h-12 w-full border border-gold text-sm font-semibold text-gold disabled:opacity-40"
          onClick={askRebirth}
        >
          {snap.canRebirth ? `Rebirth ${snap.prestige + 1}` : `Locked until wave ${PRESTIGE_WAVE}`}
        </button>
      </section>

      <section className="mt-6">
        <h3 className="font-display text-lg text-parchment">Demo coffers</h3>
        <p className="mt-1 mb-3 text-sm text-parchment-dim">Placeholders. Nothing is charged. In a store build these would be real purchases.</p>
        <div className="grid grid-cols-1 gap-2">
          <button type="button" className="h-12 border border-line bg-panel text-sm" onClick={() => buyIap("noads")} disabled={snap.iap.noAds}>
            {snap.iap.noAds ? "Ads already removed" : "Remove ads"}
          </button>
          <button type="button" className="h-12 border border-line bg-panel text-sm" onClick={() => buyIap("x2")} disabled={snap.iap.dmg2x}>
            {snap.iap.dmg2x ? "Eternal greed owned" : "Eternal greed · 2× damage"}
          </button>
          <button type="button" className="h-12 border border-line bg-panel text-sm" onClick={() => buyIap("g500")}>
            Pouch · 500 gems
          </button>
          <button type="button" className="h-12 border border-line bg-panel text-sm" onClick={() => buyIap("g1200")}>
            Coffer · 1,200 gems
          </button>
          <button type="button" className="h-12 border border-line bg-panel text-sm" onClick={() => buyIap("g3000")}>
            Dragon hoard · 3,000 gems
          </button>
          <button
            type="button"
            disabled={snap.cd.skip > 0}
            className="h-12 border border-line bg-panel text-sm disabled:opacity-40"
            onClick={() => startAd("skip")}
          >
            {snap.cd.skip > 0 ? `Time skip ${formatDuration(snap.cd.skip)}` : "Time skip 30 min (ad)"}
          </button>
        </div>
      </section>
    </div>
  );
}
