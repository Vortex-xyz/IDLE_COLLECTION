extends Control
# Placeholder art. Replace the draw_* functions with sprites from Assets/.
# Coordinates are a 360x640 virtual screen stretched over this control.

const COLS := [76, 180, 284]
const ROWS := [252, 348, 444]

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_STOP

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == BUTTON_LEFT:
		var local := event.position
		var virtual := _to_virtual(local)
		for i in range(9):
			var c := Vector2(COLS[i % 3], ROWS[int(i / 3)])
			if virtual.distance_to(c) < 34.0:
				if GameManager.armed != "":
					GameManager.place(i, GameManager.armed)
				else:
					GameManager.place(i, _cycle(i))
				accept_event()
				return

func _cycle(slot: int):
	# Tap a ring to cycle owned monsters, then empty. The web build uses a picker.
	var ids := GameManager.owned.keys()
	ids.sort()
	var current = GameManager.grid[slot]
	var idx := ids.find(current)
	if current == null or idx < 0:
		return ids[0] if ids.size() > 0 else null
	if idx + 1 < ids.size():
		return ids[idx + 1]
	return null

func _process(_delta: float) -> void:
	update()

func _to_virtual(p: Vector2) -> Vector2:
	var s := rect_size
	if s.x < 2 or s.y < 2:
		return p
	return Vector2(p.x / s.x * 360.0, p.y / s.y * 640.0)

func _draw() -> void:
	var s := rect_size
	if s.x < 2:
		return
	draw_rect(Rect2(Vector2.ZERO, s), Color("#101614"))
	var sx := s.x / 360.0
	var sy := s.y / 640.0
	# Stair. Replace with Assets/bg_stair.png.
	draw_rect(Rect2(116 * sx, 0, 128 * sx, 548 * sy), Color("#18211e"))
	draw_rect(Rect2(118 * sx, 0, 2 * sx, 548 * sy), Color("#e2b356"))
	draw_rect(Rect2(240 * sx, 0, 2 * sx, 548 * sy), Color("#e2b356"))
	var font := get_font("font", "Label")
	for i in range(9):
		var c := Vector2(COLS[i % 3] * sx, ROWS[int(i / 3)] * sy)
		var id = GameManager.grid[i]
		var col := Color("#e2b356") if id != null else Color("#3c4c44")
		draw_arc(c, 26.0 * sx, 0, TAU, 24, col, 2.0, true)
		if id != null:
			_draw_monster(id, c, sx)
			if font:
				draw_string(font, c + Vector2(-20, 36) * sx, str(id), Color("#f3ead7"))
	for e in GameManager.enemies:
		var p := Vector2(e["x"] * sx, e["y"] * sy)
		_draw_enemy(e["kind"], p, sx)
		var bw := 28.0 * sx
		draw_rect(Rect2(p.x - bw / 2.0, p.y - 28.0 * sy, bw, 4), Color("#24302b"))
		var pct: float = clamp(float(e["hp"]) / max(1.0, float(e["max_hp"])), 0.0, 1.0)
		draw_rect(Rect2(p.x - bw / 2.0, p.y - 28.0 * sy, bw * pct, 4), Color("#3e8f6e"))
	for pr in GameManager.projectiles:
		draw_circle(Vector2(pr["x"] * sx, pr["y"] * sy), 3.0 * sx, _tint(str(pr["color"])))
	# Vault / chest placeholder. Replace with a chest sprite.
	var chest := Vector2(180 * sx, 590 * sy)
	draw_rect(Rect2(chest.x - 28 * sx, chest.y - 16 * sy, 56 * sx, 28 * sy), Color("#8d6424"))
	draw_rect(Rect2(chest.x - 28 * sx, chest.y - 16 * sy, 56 * sx, 4 * sy), Color("#e2b356"))
	var vpct: float = 0.0
	if GameManager.vault_max > 0:
		vpct = clamp(GameManager.vault_hp / GameManager.vault_max, 0.0, 1.0)
	draw_rect(Rect2(130 * sx, 552 * sy, 100 * sx, 6 * sy), Color("#24302b"))
	draw_rect(Rect2(130 * sx, 552 * sy, 100 * sx * vpct, 6 * sy), Color("#d4653a") if vpct < 0.35 else Color("#3e8f6e"))
	if font and GameManager.banner_life > 0.0:
		draw_string(font, Vector2(140 * sx, 140 * sy), GameManager.banner, Color("#e2b356"))

func _tint(id: String) -> Color:
	if id == "slime" or id == "hydra":
		return Color("#3e8f6e")
	if id == "imp" or id == "drake":
		return Color("#d4653a")
	if id == "rat" or id == "lich" or id == "wolf":
		return Color("#e2b356")
	return Color("#b7ab96")

func _draw_monster(id: String, c: Vector2, sx: float) -> void:
	# ART: replace this circle with Assets/monsters/<id>.png
	draw_circle(c, 14.0 * sx, _tint(id))
	draw_circle(c + Vector2(-4, -2) * sx, 2.0 * sx, Color("#f3ead7"))
	draw_circle(c + Vector2(4, -2) * sx, 2.0 * sx, Color("#f3ead7"))

func _draw_enemy(kind: String, p: Vector2, sx: float) -> void:
	# ART: replace with Assets/enemies/<kind>.png
	var col := Color("#efe6d2")
	if kind == "boss":
		draw_circle(p, 16.0 * sx, Color("#d4653a"))
	elif kind == "knight":
		draw_rect(Rect2(p.x - 8 * sx, p.y - 12 * sx, 16 * sx, 20 * sx), col)
	elif kind == "runner":
		draw_circle(p, 8.0 * sx, Color("#d4653a"))
	else:
		draw_circle(p, 9.0 * sx, col)
