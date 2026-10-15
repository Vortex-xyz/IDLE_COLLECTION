extends Node
# Monster definitions. Swap Data/monsters.json when you add a creature.
# Art is NOT here — see Assets/PLACEHOLDERS.txt and BattleView.gd.

var monsters := []
var by_id := {}

func _ready() -> void:
	_load()

func _load() -> void:
	var f := File.new()
	if f.open("res://Data/monsters.json", File.READ) != OK:
		push_error("Hoardbound: missing Data/monsters.json")
		return
	var parsed = JSON.parse(f.get_as_text())
	f.close()
	if parsed.error != OK:
		push_error("Hoardbound: monster JSON " + parsed.error_string)
		return
	monsters = parsed.result
	by_id.clear()
	for m in monsters:
		by_id[m["id"]] = m

func get_monster(id: String):
	return by_id.get(id, null)

func of_rarity(rarity: String) -> Array:
	var out := []
	for m in monsters:
		if m["rarity"] == rarity:
			out.append(m)
	return out
