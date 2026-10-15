extends Node
# Soft currency (gold) and hard currency (gems), plus multipliers.
# GameManager owns the save blob; this node is the place that mutates currencies
# and announces them so UI does not poll every system by hand.

signal gold_changed(amount)
signal gems_changed(amount)

var gold := 40.0
var gems := 0

func set_gold(value: float) -> void:
	gold = clamp(value, 0.0, 1e15)
	emit_signal("gold_changed", gold)

func set_gems(value: int) -> void:
	gems = int(clamp(value, 0, 1000000000))
	emit_signal("gems_changed", gems)

func add_gold(raw: float, multiplier: float, at_least_one := false) -> int:
	var amt := int(round(raw * multiplier))
	if at_least_one:
		amt = max(1, amt)
	else:
		amt = max(0, amt)
	if amt > 0:
		set_gold(gold + amt)
	return amt

func spend_gold(cost: int) -> bool:
	if gold < cost:
		return false
	set_gold(gold - cost)
	return true

func spend_gems(cost: int) -> bool:
	if gems < cost:
		return false
	set_gems(gems - cost)
	return true

func add_gems(amount: int) -> void:
	set_gems(gems + amount)

func damage_multiplier(upgrade: int, prestige: int, double_damage: bool) -> float:
	var m := pow(1.12, upgrade) * (1.0 + prestige * 0.08)
	if double_damage:
		m *= 2.0
	return m

func gold_multiplier(upgrade: int, prestige: int) -> float:
	return pow(1.12, upgrade) * (1.0 + prestige * 0.06)

func haste_multiplier(upgrade: int) -> float:
	return pow(1.06, upgrade)
