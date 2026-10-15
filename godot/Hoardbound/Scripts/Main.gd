extends Control
# Portrait mobile shell. Panels are built in code so the project opens with one scene.
# Replace fonts/themes later; see Assets/PLACEHOLDERS.txt.

var gold_label: Label
var gem_label: Label
var wave_label: Label
var status_label: Label
var battle: Control
var pages := {}
var hoard_list: VBoxContainer
var forge_list: VBoxContainer
var offline_layer: Control
var offline_label: Label
var reveal_layer: Control
var reveal_label: Label
var settings_layer: Control
var log_label: Label

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Color("#101614")
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fill(bg)
	add_child(bg)

	var root := VBoxContainer.new()
	_fill(root)
	root.margin_left = 12
	root.margin_right = 12
	root.margin_top = 12
	root.margin_bottom = 12
	add_child(root)

	var top := HBoxContainer.new()
	gold_label = _label("0 gold")
	gem_label = _label("0 gems")
	var speed_btn := _button("1x", "_on_speed")
	speed_btn.rect_min_size = Vector2(64, 44)
	var gear := _button("Set", "_on_settings")
	gear.rect_min_size = Vector2(64, 44)
	top.add_child(gold_label)
	top.add_child(gem_label)
	top.add_child(speed_btn)
	top.add_child(gear)
	root.add_child(top)

	wave_label = _label("Wave 1")
	status_label = _label("The stair fills")
	root.add_child(wave_label)
	root.add_child(status_label)

	var stack := Control.new()
	stack.size_flags_vertical = SIZE_EXPAND_FILL
	stack.size_flags_horizontal = SIZE_EXPAND_FILL
	root.add_child(stack)

	battle = preload("res://Scripts/BattleView.gd").new()
	_fill(battle)
	stack.add_child(battle)
	pages["battle"] = battle

	pages["summon"] = _build_summon()
	_fill(pages["summon"])
	stack.add_child(pages["summon"])

	var hoard_scroll := ScrollContainer.new()
	hoard_list = VBoxContainer.new()
	hoard_list.size_flags_horizontal = SIZE_EXPAND_FILL
	hoard_scroll.add_child(hoard_list)
	_fill(hoard_scroll)
	stack.add_child(hoard_scroll)
	pages["hoard"] = hoard_scroll

	var forge_scroll := ScrollContainer.new()
	forge_list = VBoxContainer.new()
	forge_list.size_flags_horizontal = SIZE_EXPAND_FILL
	forge_scroll.add_child(forge_list)
	_fill(forge_scroll)
	stack.add_child(forge_scroll)
	pages["forge"] = forge_scroll

	var tabs := HBoxContainer.new()
	for pair in [["battle", "Battle"], ["summon", "Summon"], ["hoard", "Hoard"], ["forge", "Forge"]]:
		var b := _button(pair[1], "_on_tab")
		b.set_meta("tab", pair[0])
		b.size_flags_horizontal = SIZE_EXPAND_FILL
		b.rect_min_size = Vector2(0, 52)
		tabs.add_child(b)
	root.add_child(tabs)

	log_label = _label("")
	root.add_child(log_label)

	offline_layer = _overlay()
	offline_label = _label("")
	offline_label.autowrap = true
	offline_layer.add_child(offline_label)
	offline_layer.add_child(_button("Collect", "_on_collect"))
	offline_layer.add_child(_button("Double (ad placeholder)", "_on_double"))
	add_child(offline_layer)

	reveal_layer = _overlay()
	reveal_label = _label("")
	reveal_label.autowrap = true
	reveal_layer.add_child(reveal_label)
	reveal_layer.add_child(_button("Continue", "_on_reveal_close"))
	add_child(reveal_layer)

	settings_layer = _overlay()
	var settings_box := VBoxContainer.new()
	settings_box.anchor_left = 0.08
	settings_box.anchor_right = 0.92
	settings_box.anchor_top = 0.12
	settings_box.anchor_bottom = 0.9
	settings_box.add_child(_label("Settings"))
	settings_box.add_child(_button("Remove ads (demo)", "_on_iap_ads"))
	settings_box.add_child(_button("Eternal greed 2x (demo)", "_on_iap_x2"))
	settings_box.add_child(_button("500 gems (demo)", "_on_iap_gems"))
	settings_box.add_child(_button("Free summon (ad)", "_on_ad_summon"))
	settings_box.add_child(_button("25 gems (ad)", "_on_ad_gems"))
	settings_box.add_child(_button("Skip 30 min (ad)", "_on_ad_skip"))
	settings_box.add_child(_button("Rebirth", "_on_rebirth"))
	settings_box.add_child(_button("Reset save", "_on_reset"))
	settings_box.add_child(_button("Close", "_on_settings_close"))
	settings_layer.add_child(settings_box)
	add_child(settings_layer)

	GameManager.connect("changed", self, "_refresh")
	GameManager.connect("toast", self, "_on_toast")
	GameManager.connect("reveal", self, "_on_reveal")
	_show_tab("battle")
	_refresh()
	if not GameManager.pending.empty():
		_show_offline()

func _fill(c: Control) -> void:
	c.anchor_right = 1.0
	c.anchor_bottom = 1.0
	c.margin_left = 0
	c.margin_top = 0
	c.margin_right = 0
	c.margin_bottom = 0

func _label(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_color_override("font_color", Color("#f3ead7"))
	l.size_flags_horizontal = SIZE_EXPAND_FILL
	return l

func _button(text: String, method: String) -> Button:
	var b := Button.new()
	b.text = text
	b.rect_min_size = Vector2(0, 44)
	if method == "_on_tab":
		b.connect("pressed", self, method, [b])
	else:
		b.connect("pressed", self, method)
	return b

func _overlay() -> Control:
	var c := ColorRect.new()
	c.color = Color(0.06, 0.08, 0.07, 0.92)
	_fill(c)
	c.visible = false
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	return c

func _build_summon() -> Control:
	var box := VBoxContainer.new()
	box.add_child(_label("Binding ring"))
	var info := _label("Gold summons cost more as you bind. Duplicates raise stars to 5, then become gems.")
	info.autowrap = true
	box.add_child(info)
	box.add_child(_button("Summon (gold)", "_on_summon_gold"))
	box.add_child(_button("Greater summon (gems)", "_on_summon_gem"))
	return box

func _show_tab(tab: String) -> void:
	for k in pages.keys():
		pages[k].visible = k == tab
	GameManager.tab = tab

func _on_tab(button: Button) -> void:
	_show_tab(str(button.get_meta("tab")))
	_refresh()

func _refresh() -> void:
	gold_label.text = "%s gold" % _fmt(EconomyManager.gold)
	gem_label.text = "%s gems" % EconomyManager.gems
	wave_label.text = "Wave %s   best %s   rebirth %s" % [GameManager.wave, GameManager.highest_wave, GameManager.prestige]
	status_label.text = GameManager.status_text
	_rebuild_hoard()
	_rebuild_forge()

func _fmt(n) -> String:
	var v := float(n)
	if v < 1000.0:
		return str(int(v))
	return str(stepify(v / 1000.0, 0.1)) + "K"

func _rebuild_hoard() -> void:
	for c in hoard_list.get_children():
		c.queue_free()
	for m in MonsterDatabase.monsters:
		var id: String = m["id"]
		var owned: bool = GameManager.owned.has(id)
		var line := "%s (%s)" % [m["name"], m["rarity"]]
		if owned:
			line += "  Lv %s  stars %s" % [GameManager.owned[id]["level"], GameManager.owned[id]["stars"]]
		else:
			line += "  unbound"
		var row := HBoxContainer.new()
		var lab := _label(line)
		lab.autowrap = true
		row.add_child(lab)
		if owned:
			row.add_child(_arg_button("Up", "_on_level_id", id))
			row.add_child(_arg_button("Bind", "_on_arm_id", id))
		hoard_list.add_child(row)

func _rebuild_forge() -> void:
	for c in forge_list.get_children():
		c.queue_free()
	var names := {
		"damage": "Greed's Edge",
		"gold": "Tax Ledger",
		"haste": "War Drums",
		"vault": "Iron Bands",
		"luck": "Crooked Dice",
	}
	for id in ["damage", "gold", "haste", "vault", "luck"]:
		var lv := int(GameManager.upgrades[id])
		var spec: Dictionary = GameManager.UPGRADES[id]
		var cost := int(round(float(spec["base"]) * pow(1.48, lv)))
		var row := HBoxContainer.new()
		row.add_child(_label("%s %s/%s" % [names[id], lv, spec["max"]]))
		var b := _arg_button("Raise %s" % cost if lv < int(spec["max"]) else "Max", "_on_upgrade_id", id)
		b.rect_min_size = Vector2(140, 44)
		row.add_child(b)
		forge_list.add_child(row)
	var note := _label("Rebirth at wave 15. It keeps stars and gems.")
	note.autowrap = true
	forge_list.add_child(note)
	forge_list.add_child(_button("Rebirth", "_on_rebirth"))

func _arg_button(text: String, method: String, arg: String) -> Button:
	var b := Button.new()
	b.text = text
	b.rect_min_size = Vector2(72, 44)
	b.connect("pressed", self, method, [arg])
	return b

func _on_level_id(id: String) -> void:
	GameManager.level_monster(id)

func _on_arm_id(id: String) -> void:
	GameManager.armed = id
	_show_tab("battle")
	log_label.text = "Tap a ring to bind " + id

func _on_upgrade_id(id: String) -> void:
	GameManager.buy_upgrade(id)

func _on_toast(text: String) -> void:
	log_label.text = text

func _on_speed() -> void:
	GameManager.speed = 1.0 if GameManager.speed >= 2.0 else 2.0
	log_label.text = "Speed %sx" % int(GameManager.speed)

func _on_summon_gold() -> void:
	GameManager.summon_banner("gold", false)

func _on_summon_gem() -> void:
	GameManager.summon_banner("gem", false)

func _on_reveal(monster_id: String, is_new: bool, stars: int, gems: int) -> void:
	var m = MonsterDatabase.get_monster(monster_id)
	var name := monster_id if m == null else m["name"]
	var extra := "New." if is_new else ("+%s gems" % gems if gems > 0 else "Star %s" % stars)
	reveal_label.text = "%s\n%s\n%s" % [name, m["rarity"] if m else "", extra]
	reveal_layer.visible = true

func _on_reveal_close() -> void:
	reveal_layer.visible = false

func _show_offline() -> void:
	var p: Dictionary = GameManager.pending
	offline_label.text = "Away %ss\n+%s gold  +%s gems" % [p.get("seconds", 0), p.get("gold", 0), p.get("gems", 0)]
	offline_layer.visible = true

func _on_collect() -> void:
	GameManager.claim_offline(1.0)
	offline_layer.visible = false

func _on_double() -> void:
	GameManager.grant_ad("double")
	offline_layer.visible = false

func _on_settings() -> void:
	settings_layer.visible = true

func _on_settings_close() -> void:
	settings_layer.visible = false

func _on_rebirth() -> void:
	if GameManager.highest_wave < GameManager.PRESTIGE_WAVE:
		log_label.text = "Reach wave %s first" % GameManager.PRESTIGE_WAVE
		return
	GameManager.do_rebirth()
	settings_layer.visible = false

func _on_reset() -> void:
	GameManager.hard_reset()
	settings_layer.visible = false

func _on_iap_ads() -> void:
	GameManager.buy_iap("no_ads")

func _on_iap_x2() -> void:
	GameManager.buy_iap("x2")

func _on_iap_gems() -> void:
	GameManager.buy_iap("g500")

func _on_ad_summon() -> void:
	GameManager.grant_ad("summon")

func _on_ad_gems() -> void:
	GameManager.grant_ad("gems")

func _on_ad_skip() -> void:
	GameManager.grant_ad("skip")

