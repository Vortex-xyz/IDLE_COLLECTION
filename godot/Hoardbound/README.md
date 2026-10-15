# Hoardbound

Idle tower defense for **Godot 3.6.2**, GDScript only (no C#). You stole the king's vault. Heroes walk down a stair. Monsters on a 3×3 ring fight them automatically.

The browser build of the same game is the playable preview. This folder is the engine project.

## Run

1. Install Godot **3.6.2** (not Godot 4).
2. Import this folder (`project.godot`).
3. Press F5. The main scene is `Scenes/Main.tscn`.
4. The window is a 720×1280 portrait. Battle, Summon, Hoard, and Forge are the bottom tabs.

## Android

The project targets GLES2, which Godot 3.6 can export to Android.

1. Install the Android export templates for 3.6.2 and set the Android SDK in Editor Settings.
2. Project → Export → Add → Android.
3. Set the package name, armv7/arm64, and a portrait orientation (already set on the window).
4. One-line permissions are enough; ads and IAP are hooks only.

## What works

- Endless waves, auto attacks, vault breaches, and retries
- 10 monsters, four rarities, gold and gem banners, pity, stars
- Leveling, 3×3 placement (tap a ring to cycle, or Bind then tap)
- Forge upgrades, rebirth at wave 15, JSON save in `user://`
- Offline gold on the next launch
- Rewarded-ad and IAP buttons that grant demo rewards

## What still needs art and polish

See `Assets/PLACEHOLDERS.txt`.

- Monster, hero, stair, and chest sprites
- A real UI theme and font
- Sound effects where `GameManager.gd` says `SFX:`
- Google Play billing and a rewarded-ad SDK behind `buy_iap` and `grant_ad`
- Balance pass on device, screen-reader labels, and a proper icon

Autoloads, in order: `MonsterDatabase`, `EconomyManager`, `SaveManager`, `GameManager`.
