extends Node
# JSON save in user://hoardbound_save.json. Autosave is triggered by GameManager.

const PATH := "user://hoardbound_save.json"
const BAK := "user://hoardbound_save.bak.json"

func write_save(data: Dictionary) -> void:
	var prev := File.new()
	if prev.file_exists(PATH):
		var dir := Directory.new()
		dir.copy(PATH, BAK)
	var f := File.new()
	if f.open(PATH, File.WRITE) != OK:
		push_error("Hoardbound: could not write save")
		return
	data["last_active"] = int(OS.get_unix_time())
	f.store_string(JSON.print(data))
	f.close()

func read_save() -> Dictionary:
	var f := File.new()
	if f.file_exists(PATH) and f.open(PATH, File.READ) == OK:
		var parsed = JSON.parse(f.get_as_text())
		f.close()
		if parsed.error == OK and typeof(parsed.result) == TYPE_DICTIONARY:
			return parsed.result
	if f.file_exists(BAK) and f.open(BAK, File.READ) == OK:
		var parsed2 = JSON.parse(f.get_as_text())
		f.close()
		if parsed2.error == OK and typeof(parsed2.result) == TYPE_DICTIONARY:
			return parsed2.result
	return {}

func has_save() -> bool:
	var f := File.new()
	return f.file_exists(PATH) or f.file_exists(BAK)
