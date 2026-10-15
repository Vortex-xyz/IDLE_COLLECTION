extends Node
# Wave combat, summons, placement, rebirth, offline rewards, and ads/IAP hooks.
# UI talks to this autoload. BattleView only reads `enemies`, `projectiles`, `grid`.

signal changed
signal toast(text)
signal offline_ready(seconds, gold, gems)
signal reveal(monster_id, is_new, stars, gems)

const PRESTIGE_WAVE := 15
const PITY_GOLD := 40
const PITY_GEM := 25
const GEM_COST := 45
const AD_CD := {"summon": 600, "gems": 900, "skip": 1200}
const RARITY_COST := {"common": 1.0, "rare": 1.7, "epic": 2.8, "legendary": 5.0}
const DUP_GEMS := {"common": 2, "rare": 8, "epic": 22, "legendary": 60}
const UPGRADES := {
	"damage": {"max": 30, "base": 60},
	"gold": {"max": 30, "base": 60},
	"haste": {"max": 20, "base": 90},
	"vault": {"max": 20, "base": 75},
	"luck": {"max": 10, "base": 220},
}

var wave := 1
var highest_wave := 1
var prestige := 0
var summons := 0
var kills := 0
var pity_gold := 0
var pity_gem := 0
var owned := {}
var grid := []
var upgrades := {}
var settings := {"sfx": true, "shake": true}
var iap := {"no_ads": false, "dmg2x": false}
var ads := {"summon": 0, "gems": 0, "skip": 0}
var pending := {}
var tutorial := false

var enemies := []
var projectiles := []
var phase := "recover"
var recover := 0.8
var status_text := "The stair fills"
var vault_hp := 84.0
var vault_max := 84.0
var banner := ""
var banner_life := 0.0
var hurt := 0.0
var speed := 1.0
var tab := "battle"
var armed := ""
var hold := false

var _plan := []
var _plan_i := 0
var _spawn_cd := 0.3
var _serial := 0
var _slot_cd := []
var _spawned := 0
var _leaks := 0
var _broke := false
var _save_acc := 0.0
var _sim := 0.0

func _ready() -> void:
	randomize()
	_slot_cd.resize(9)
	for i in range(9):
		_slot_cd[i] = 0.0
	load_state()
	set_process(true)

func _notification(what: int) -> void:
	if what == MainLoop.NOTIFICATION_WM_FOCUS_OUT or what == MainLoop.NOTIFICATION_WM_QUIT_REQUEST:
		save_state()

func _process(delta: float) -> void:
	banner_life = max(0.0, banner_life - delta)
	hurt = max(0.0, hurt - delta * 1.3)
	if not hold:
		var step := min(delta, 0.05)
		tick(step)
		if speed >= 2.0:
			tick(step)
	_save_acc += delta
	if _save_acc > 5.0:
		_save_acc = 0.0
		save_state()

func tick(dt: float) -> void:
	_sim += dt
	if phase == "recover":
		recover -= dt
		if recover <= 0.0:
			_begin_wave()
		return
	if _plan_i < _plan.size():
		_spawn_cd -= dt
		if _spawn_cd <= 0.0:
			_spawn(_plan[_plan_i])
			_plan_i += 1
			_spawn_cd = _spawn_interval(wave)
	for i in range(9):
		var id = grid[i]
		if id == null or id == "":
			continue
		_slot_cd[i] -= dt
		if _slot_cd[i] <= 0.0:
			_fire(i, id)
	var pi := 0
	while pi < projectiles.size():
		var p: Dictionary = projectiles[pi]
		var target = p["target"]
		if target != null and target["alive"]:
			p["tx"] = target["x"]
			p["ty"] = target["y"] - 6.0
		var dx: float = p["tx"] - p["x"]
		var dy: float = p["ty"] - p["y"]
		var dist := sqrt(dx * dx + dy * dy)
		var step_d: float = 540.0 * dt
		if dist <= step_d + 10.0:
			if target != null and target["alive"]:
				_hurt(target, p["dmg"], p, true)
			projectiles.remove(pi)
		else:
			p["x"] += dx / max(dist, 0.001) * step_d
			p["y"] += dy / max(dist, 0.001) * step_d
			pi += 1
	var ei := 0
	while ei < enemies.size():
		var e: Dictionary = enemies[ei]
		if not e["alive"]:
			enemies.remove(ei)
			continue
		if e["burn"] > 0.0:
			e["burn"] = e["burn"] - dt
			e["burn_tick"] = e["burn_tick"] + dt
			if e["burn_tick"] >= 0.4:
				var chunk: float = e["burn_dps"] * e["burn_tick"]
				e["burn_tick"] = 0.0
				_hurt(e, chunk, null, false)
		if not e["alive"]:
			enemies.remove(ei)
			continue
		if e["slow"] > 0.0:
			e["slow"] = e["slow"] - dt
		var slow_m := 1.0
		if e["slow"] > 0.0:
			slow_m = e["slow_factor"]
		e["y"] = e["y"] + e["speed"] * slow_m * dt
		e["x"] = 180.0 + e["lane"] * 26.0 + sin(_sim * 1.6 + e["phase"]) * 5.0
		if e["y"] >= 524.0:
			_leak(e)
			enemies.remove(ei)
			if _broke:
				_fail_wave()
				return
			continue
		ei += 1
	if phase == "fight" and _plan_i >= _plan.size() and enemies.empty() and _spawned > 0:
		if _leaks == 0:
			_clear_wave()
		else:
			_soft_fail()

func load_state() -> void:
	var raw: Dictionary = SaveManager.read_save()
	var had: bool = SaveManager.has_save() and not raw.empty()
	_apply_defaults()
	if had:
		_apply_raw(raw)
	_sync_vault(true)
	if had and pending.empty():
		var elapsed := int(OS.get_unix_time()) - int(raw.get("last_active", OS.get_unix_time()))
		if elapsed > 30:
			var reward := offline_reward(elapsed)
			if reward["gold"] > 0 or reward["gems"] > 0:
				pending = {"seconds": min(elapsed, 8 * 3600), "gold": reward["gold"], "gems": reward["gems"]}
				hold = true
	if not pending.empty():
		hold = true
	_reset_field()
	save_state()
	emit_signal("changed")
	if not pending.empty():
		emit_signal("offline_ready", pending["seconds"], pending["gold"], pending["gems"])

func _apply_defaults() -> void:
	EconomyManager.set_gold(40)
	EconomyManager.set_gems(0)
	wave = 1
	highest_wave = 1
	prestige = 0
	summons = 0
	kills = 0
	pity_gold = 0
	pity_gem = 0
	owned = {"slime": {"level": 1, "stars": 0}}
	grid = [null, null, null, null, null, null, null, "slime", null]
	upgrades = {"damage": 0, "gold": 0, "haste": 0, "vault": 0, "luck": 0}
	settings = {"sfx": true, "shake": true}
	iap = {"no_ads": false, "dmg2x": false}
	ads = {"summon": 0, "gems": 0, "skip": 0}
	pending = {}
	tutorial = false

func _apply_raw(raw: Dictionary) -> void:
	EconomyManager.set_gold(float(raw.get("gold", 40)))
	EconomyManager.set_gems(int(raw.get("gems", 0)))
	wave = int(raw.get("wave", 1))
	highest_wave = int(raw.get("highest_wave", wave))
	prestige = int(raw.get("prestige", 0))
	summons = int(raw.get("summons", 0))
	kills = int(raw.get("kills", 0))
	pity_gold = int(raw.get("pity_gold", 0))
	pity_gem = int(raw.get("pity_gem", 0))
	tutorial = bool(raw.get("tutorial", false))
	if raw.has("owned") and typeof(raw["owned"]) == TYPE_DICTIONARY:
		owned = {}
		for id in raw["owned"].keys():
			if MonsterDatabase.get_monster(str(id)) == null:
				continue
			var row = raw["owned"][id]
			owned[str(id)] = {"level": int(row.get("level", 1)), "stars": clamp(int(row.get("stars", 0)), 0, 5)}
	if owned.empty():
		owned = {"slime": {"level": 1, "stars": 0}}
	grid = []
	grid.resize(9)
	var incoming = raw.get("grid", [])
	var seen := {}
	for i in range(9):
		grid[i] = null
		if typeof(incoming) == TYPE_ARRAY and i < incoming.size():
			var id = incoming[i]
			if id != null and owned.has(str(id)) and not seen.has(str(id)):
				grid[i] = str(id)
				seen[str(id)] = true
	if typeof(raw.get("upgrades", null)) == TYPE_DICTIONARY:
		for k in upgrades.keys():
			upgrades[k] = int(raw["upgrades"].get(k, 0))
	if typeof(raw.get("iap", null)) == TYPE_DICTIONARY:
		iap["no_ads"] = bool(raw["iap"].get("no_ads", false))
		iap["dmg2x"] = bool(raw["iap"].get("dmg2x", false))
	if typeof(raw.get("ads", null)) == TYPE_DICTIONARY:
		for k in ads.keys():
			ads[k] = int(raw["ads"].get(k, 0))
	if typeof(raw.get("settings", null)) == TYPE_DICTIONARY:
		settings["sfx"] = bool(raw["settings"].get("sfx", true))
		settings["shake"] = bool(raw["settings"].get("shake", true))
	if typeof(raw.get("pending", null)) == TYPE_DICTIONARY and int(raw["pending"].get("gold", 0)) > 0:
		pending = raw["pending"]

func to_dict() -> Dictionary:
	return {
		"version": 1,
		"gold": EconomyManager.gold,
		"gems": EconomyManager.gems,
		"wave": wave,
		"highest_wave": highest_wave,
		"prestige": prestige,
		"summons": summons,
		"kills": kills,
		"pity_gold": pity_gold,
		"pity_gem": pity_gem,
		"owned": owned,
		"grid": grid,
		"upgrades": upgrades,
		"settings": settings,
		"iap": iap,
		"ads": ads,
		"pending": pending,
		"tutorial": tutorial,
	}

func save_state() -> void:
	SaveManager.write_save(to_dict())

func gold_cost() -> int:
	return 100 + summons * 10

func dmg_mult() -> float:
	return EconomyManager.damage_multiplier(upgrades["damage"], prestige, iap["dmg2x"])

func gold_mult() -> float:
	return EconomyManager.gold_multiplier(upgrades["gold"], prestige)

func _sync_vault(full: bool) -> void:
	var next := int(round((84 + upgrades["vault"] * 28) * (1.0 + prestige * 0.04)))
	if full:
		vault_hp = next
	elif next > vault_max:
		vault_hp += next - vault_max
	vault_max = next
	vault_hp = clamp(vault_hp, 0, vault_max)

func _reset_field() -> void:
	enemies.clear()
	projectiles.clear()
	phase = "recover"
	recover = 0.85
	status_text = "The stair fills"
	_plan = []
	_plan_i = 0
	_spawned = 0
	_leaks = 0
	_broke = false
	_sync_vault(true)

func summon_banner(banner: String, free := false) -> void:
	var cost := gold_cost() if banner == "gold" else GEM_COST
	if not free:
		if banner == "gold" and not EconomyManager.spend_gold(cost):
			emit_signal("toast", "Not enough gold")
			return
		if banner == "gem" and not EconomyManager.spend_gems(cost):
			emit_signal("toast", "Not enough gems")
			return
	var luck := int(upgrades["luck"])
	var cap := PITY_GOLD if banner == "gold" else PITY_GEM
	var pity := pity_gold if banner == "gold" else pity_gem
	var rarity := _roll_rarity(banner, luck)
	if pity + 1 >= cap:
		rarity = "legendary"
	var pool := MonsterDatabase.of_rarity(rarity)
	if pool.empty():
		return
	var picked = pool[randi() % pool.size()]
	if picked["rarity"] == "legendary":
		if banner == "gold":
			pity_gold = 0
		else:
			pity_gem = 0
	elif banner == "gold":
		pity_gold += 1
	else:
		pity_gem += 1
	summons += 1
	var id: String = picked["id"]
	var is_new := false
	var stars := 0
	var gem_gain := 0
	if not owned.has(id):
		owned[id] = {"level": 1, "stars": 0}
		is_new = true
	elif int(owned[id]["stars"]) < 5:
		owned[id]["stars"] = int(owned[id]["stars"]) + 1
		stars = int(owned[id]["stars"])
	else:
		gem_gain = int(DUP_GEMS[picked["rarity"]])
		EconomyManager.add_gems(gem_gain)
		stars = 5
	# SFX: play summon sting here.
	emit_signal("reveal", id, is_new, stars, gem_gain)
	save_state()
	emit_signal("changed")

func level_monster(id: String) -> void:
	if not owned.has(id):
		return
	var lv := int(owned[id]["level"])
	var rarity: String = MonsterDatabase.get_monster(id)["rarity"]
	var cost := int(round(26.0 * pow(lv, 1.4) * float(RARITY_COST[rarity])))
	if not EconomyManager.spend_gold(cost):
		emit_signal("toast", "Not enough gold")
		return
	owned[id]["level"] = lv + 1
	emit_signal("toast", MonsterDatabase.get_monster(id)["name"] + " is level " + str(lv + 1))
	save_state()
	emit_signal("changed")

func buy_upgrade(id: String) -> void:
	var spec: Dictionary = UPGRADES[id]
	var lv := int(upgrades[id])
	if lv >= int(spec["max"]):
		return
	var cost := int(round(float(spec["base"]) * pow(1.48, lv)))
	if not EconomyManager.spend_gold(cost):
		emit_signal("toast", "Not enough gold")
		return
	upgrades[id] = lv + 1
	_sync_vault(false)
	save_state()
	emit_signal("changed")

func place(slot: int, id) -> void:
	if slot < 0 or slot > 8:
		return
	if id != null and id != "":
		if not owned.has(id):
			return
		for i in range(9):
			if grid[i] == id:
				grid[i] = null
		grid[slot] = id
		_slot_cd[slot] = 0.2
	else:
		grid[slot] = null
	armed = ""
	save_state()
	emit_signal("changed")

func claim_offline(mult: float) -> void:
	if pending.empty():
		hold = false
		emit_signal("changed")
		return
	EconomyManager.set_gold(EconomyManager.gold + int(pending["gold"]) * mult)
	EconomyManager.add_gems(int(round(float(pending.get("gems", 0)) * mult)))
	pending = {}
	hold = false
	emit_signal("toast", "Hoard collected")
	save_state()
	emit_signal("changed")

func do_rebirth() -> void:
	if highest_wave < PRESTIGE_WAVE:
		return
	prestige += 1
	EconomyManager.set_gold(0)
	wave = 1
	summons = 0
	pity_gold = 0
	pity_gem = 0
	for id in owned.keys():
		owned[id]["level"] = 1
	upgrades = {"damage": 0, "gold": 0, "haste": 0, "vault": 0, "luck": 0}
	grid = [null, null, null, null, null, null, null, null, null]
	var keep := "slime" if owned.has("slime") else ""
	if keep == "":
		var keys = owned.keys()
		if keys.size() > 0:
			keep = keys[0]
	if keep != "":
		grid[7] = keep
	armed = ""
	_reset_field()
	emit_signal("toast", "Rebirth " + str(prestige))
	save_state()
	emit_signal("changed")

func hard_reset() -> void:
	_apply_defaults()
	hold = false
	armed = ""
	_reset_field()
	save_state()
	emit_signal("changed")
	emit_signal("toast", "The vault was emptied")

func ad_ready(kind: String) -> bool:
	if not AD_CD.has(kind):
		return true
	return int(OS.get_unix_time()) - int(ads[kind]) >= int(AD_CD[kind])

func grant_ad(kind: String) -> void:
	# Monetization hook. A real Android build would play a rewarded ad, then call this.
	if kind == "double":
		claim_offline(2.0)
		return
	if kind != "double" and not ad_ready(kind):
		emit_signal("toast", "Not ready yet")
		return
	if kind == "summon":
		ads["summon"] = int(OS.get_unix_time())
		summon_banner("gold", true)
		return
	if kind == "gems":
		ads["gems"] = int(OS.get_unix_time())
		EconomyManager.add_gems(25)
		emit_signal("toast", "+25 gems")
	elif kind == "skip":
		ads["skip"] = int(OS.get_unix_time())
		var reward := offline_reward(1800)
		EconomyManager.set_gold(EconomyManager.gold + reward["gold"])
		EconomyManager.add_gems(reward["gems"])
		emit_signal("toast", "Time skip")
	save_state()
	emit_signal("changed")

func buy_iap(sku: String) -> void:
	# IAP placeholder. Wire Google Play Billing here; the grant below is the demo.
	if sku == "no_ads":
		iap["no_ads"] = true
	elif sku == "x2":
		iap["dmg2x"] = true
	elif sku == "g500":
		EconomyManager.add_gems(500)
	elif sku == "g1200":
		EconomyManager.add_gems(1200)
	elif sku == "g3000":
		EconomyManager.add_gems(3000)
	emit_signal("toast", "Demo coffer opened — no charge")
	save_state()
	emit_signal("changed")

func offline_reward(elapsed: int) -> Dictionary:
	var dps := _board_dps()
	if dps <= 0.0:
		return {"gold": 0, "gems": 0}
	var plan := _make_plan(wave)
	var hp := 0.0
	var gold_sum := 0.0
	var travel := 0.0
	for kind in plan:
		hp += _max_hp(kind, wave)
		gold_sum += _kill_gold(kind, wave)
		travel += (524.0 - 40.0) / _move_speed(kind, wave)
	var span := travel / plan.size() + max(0, plan.size() - 1) * _spawn_interval(wave)
	var frac := min(1.0, span * dps / max(1.0, hp))
	var clear := frac >= 0.98
	var per := (gold_sum * frac + (_clear_gold(wave) if clear else 0.0)) * gold_mult()
	var time_per := min(span, hp / dps + 1.2) if clear else span
	var attempts := float(min(elapsed, 8 * 3600)) / max(2.5, time_per)
	return {"gold": int(round(per * attempts * 0.72)), "gems": 0}

func _board_dps() -> float:
	var total := 0.0
	var haste := EconomyManager.haste_multiplier(upgrades["haste"])
	for id in grid:
		if id == null or id == "":
			continue
		if not owned.has(id):
			continue
		var m = MonsterDatabase.get_monster(id)
		var hit := _hit(m, int(owned[id]["level"]), int(owned[id]["stars"]))
		var extra := 1.0 + float(m["splash_ratio"]) * 0.75
		var crit := 1.0 + float(m["crit"]) * (float(m["crit_mult"]) - 1.0)
		var interval := max(0.12, float(m["interval"]) / haste)
		total += hit * int(m["shots"]) * crit * extra / interval
	return total

func _hit(m: Dictionary, level: int, stars: int) -> float:
	return float(m["damage"]) * (1.0 + (level - 1) * 0.22) * (1.0 + stars * 0.28) * dmg_mult()

func _roll_rarity(banner: String, luck: int) -> String:
	var leg := (0.06 + luck * 0.008) if banner == "gem" else (0.012 + luck * 0.005)
	var epic := (0.18 + luck * 0.01) if banner == "gem" else (0.07 + luck * 0.008)
	var rare := 0.36 if banner == "gem" else 0.24
	var r := randf()
	if r < leg:
		return "legendary"
	if r < leg + epic:
		return "epic"
	if r < leg + epic + rare:
		return "rare"
	return "common"

func _make_plan(w: int) -> Array:
	var count := min(26, 6 + int(floor((w - 1) * 1.05)))
	var plan := []
	for i in range(count):
		if w >= 8 and i % 6 == 5:
			plan.append("knight")
		elif w >= 4 and i % 4 == 3:
			plan.append("runner")
		else:
			plan.append("squire")
	if w % 10 == 0:
		plan.append("boss")
	return plan

func _spawn_interval(w: int) -> float:
	return max(0.42, 0.92 - (w - 1) * 0.015)

func _max_hp(kind: String, w: int) -> float:
	var mult := {"squire": 1.0, "runner": 0.58, "knight": 1.9, "boss": 10.0}
	return 18.0 * pow(1.168, w - 1) * float(mult[kind])

func _move_speed(kind: String, w: int) -> float:
	var mult := {"squire": 1.0, "runner": 1.72, "knight": 0.74, "boss": 0.55}
	return (38.0 + min(42.0, (w - 1) * 0.85)) * float(mult[kind])

func _kill_gold(kind: String, w: int) -> float:
	var mult := {"squire": 1.0, "runner": 0.8, "knight": 1.55, "boss": 7.0}
	return (4.0 + w * 0.9) * float(mult[kind])

func _clear_gold(w: int) -> float:
	return 24.0 + w * 8.0

func _leak_damage(kind: String, w: int) -> float:
	var base := {"squire": 11.0, "runner": 8.0, "knight": 16.0, "boss": 34.0}
	return float(base[kind]) * (1.0 + (w - 1) * 0.035)

func _begin_wave() -> void:
	phase = "fight"
	_plan = _make_plan(wave)
	_plan_i = 0
	_spawn_cd = 0.28
	_spawned = 0
	_leaks = 0
	_broke = false
	status_text = "On the stair"
	_sync_vault(false)

func _spawn(kind: String) -> void:
	var lane := 0 if kind == "boss" else (_serial % 3) - 1
	_serial += 1
	enemies.append({
		"alive": true,
		"kind": kind,
		"x": 180.0 + lane * 26.0,
		"y": 40.0,
		"lane": lane,
		"phase": randf() * TAU,
		"hp": _max_hp(kind, wave),
		"max_hp": _max_hp(kind, wave),
		"speed": _move_speed(kind, wave),
		"gold": _kill_gold(kind, wave),
		"leak": _leak_damage(kind, wave),
		"slow": 0.0,
		"slow_factor": 1.0,
		"burn": 0.0,
		"burn_dps": 0.0,
		"burn_tick": 0.0,
	})
	_spawned += 1

func _fire(slot: int, id: String) -> void:
	var m = MonsterDatabase.get_monster(id)
	var row = owned.get(id, null)
	if m == null or row == null:
		return
	var pos := _slot_pos(slot)
	var target = _pick_target(pos.x, pos.y, float(m["range"]))
	if target == null:
		_slot_cd[slot] = 0.08
		return
	var dmg := _hit(m, int(row["level"]), int(row["stars"]))
	if randf() < float(m["crit"]):
		dmg *= float(m["crit_mult"])
	var shots := int(m["shots"])
	for s in range(shots):
		projectiles.append({
			"x": pos.x + (s - (shots - 1) / 2.0) * 12.0,
			"y": pos.y - 10.0,
			"tx": target["x"],
			"ty": target["y"],
			"target": target,
			"dmg": dmg,
			"color": id,
			"splash": float(m["splash"]),
			"splash_ratio": float(m["splash_ratio"]),
			"burn": float(m["burn"]),
			"burn_time": float(m["burn_time"]),
			"slow": float(m["slow"]),
			"slow_time": float(m["slow_time"]),
			"gold_on_hit": float(m["gold_on_hit"]),
			"execute": float(m["execute"]),
		})
	_slot_cd[slot] = max(0.12, float(m["interval"]) / EconomyManager.haste_multiplier(upgrades["haste"]))

func _slot_pos(i: int) -> Vector2:
	var cols := [76, 180, 284]
	var rows := [252, 348, 444]
	return Vector2(cols[i % 3], rows[int(i / 3)])

func _pick_target(x: float, y: float, rng: float):
	var best = null
	var best_y := -99999.0
	for e in enemies:
		if not e["alive"]:
			continue
		var dx: float = e["x"] - x
		var dy: float = e["y"] - y
		if dx * dx + dy * dy > rng * rng:
			continue
		if e["y"] > best_y:
			best_y = e["y"]
			best = e
	return best

func _hurt(e: Dictionary, amount: float, source, primary: bool) -> void:
	if not e["alive"] or amount <= 0.0:
		return
	e["hp"] = e["hp"] - amount
	if primary and source != null:
		if source["burn"] > 0.0:
			e["burn"] = max(e["burn"], source["burn_time"])
			e["burn_dps"] = max(e["burn_dps"], amount * source["burn"])
		if source["slow_time"] > 0.0:
			e["slow"] = max(e["slow"], source["slow_time"])
			e["slow_factor"] = source["slow"]
		if source["gold_on_hit"] > 0.0:
			EconomyManager.add_gold(source["gold_on_hit"], gold_mult(), true)
		if source["execute"] > 0.0 and e["hp"] > 0.0 and e["hp"] <= e["max_hp"] * source["execute"]:
			e["hp"] = 0.0
	if e["hp"] <= 0.0:
		e["alive"] = false
		kills += 1
		EconomyManager.add_gold(e["gold"], gold_mult(), false)
		# SFX: coin
		return
	if primary and source != null and source["splash"] > 0.0 and source["splash_ratio"] > 0.0:
		var r2: float = source["splash"] * source["splash"]
		for other in enemies:
			if other == e or not other["alive"]:
				continue
			var dx: float = other["x"] - e["x"]
			var dy: float = other["y"] - e["y"]
			if dx * dx + dy * dy <= r2:
				_hurt(other, amount * source["splash_ratio"], source, false)

func _leak(e: Dictionary) -> void:
	e["alive"] = false
	vault_hp -= e["leak"]
	hurt = 0.7
	_leaks += 1
	if vault_hp <= 0.0:
		_broke = true
	# SFX: breach thud

func _fail_wave() -> void:
	enemies.clear()
	projectiles.clear()
	phase = "recover"
	recover = 2.3
	status_text = "Vault breached"
	banner = "BREACHED"
	banner_life = 1.2
	_broke = false
	_sync_vault(true)
	emit_signal("toast", "Wave %s breached" % wave)
	emit_signal("changed")

func _soft_fail() -> void:
	enemies.clear()
	projectiles.clear()
	phase = "recover"
	recover = 1.8
	status_text = "A hero slipped through"
	banner = "SLIPPED"
	banner_life = 1.1
	emit_signal("toast", "Wave %s failed" % wave)
	emit_signal("changed")

func _clear_wave() -> void:
	var g := EconomyManager.add_gold(_clear_gold(wave), gold_mult(), false)
	var gems := 0
	if wave % 10 == 0:
		gems = 6 + 2 * int(wave / 10)
		EconomyManager.add_gems(gems)
	highest_wave = max(highest_wave, wave)
	wave += 1
	highest_wave = max(highest_wave, wave)
	vault_hp = min(vault_max, vault_hp + vault_max * 0.22)
	phase = "recover"
	recover = 1.45
	status_text = "Wave held"
	banner = "HELD"
	banner_life = 1.0
	emit_signal("toast", "Wave held +%s gold" % g)
	emit_signal("changed")
	# SFX: clear fanfare
