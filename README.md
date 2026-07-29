# pi-model-favorites

A custom `/m` model picker extension for [pi](https://pi.dev) that pins your
favorite models above a divider and lets you hide models you never use.

## What it does

Replaces the default model picker with one that:

- Pins favorited models to the top, above a divider line.
- Marks the currently active model with a `●`.
- Lets you hide models you don't want to see, with a collapsible "Hidden" section.
- Supports live filtering by model name, id, or provider.

Favorites and hidden models persist to `~/.pi/agent/model-favorites.json`.

## What it looks like

**Main view** — favorites pinned above the divider, current model marked `●`:

```
Select Model
▸ ★ claude-sonnet-4 (anthropic) ●
  ★ glm-5.2 (zai)
──────────────────────────────────────
    claude-haiku-4-5 (anthropic)
    gpt-5 (openai)
    gemini-2.5-pro (google)
↑↓ nav • enter select • f fav • h hide • v hidden • / filter • esc cancel
```

**Filter mode** — press `/` and type to narrow the list:

```
Select Model
▸ ★ claude-sonnet-4 (anthropic) ●
    claude-haiku-4-5 (anthropic)
──────────────────────────────────────
filter: "claude" • enter apply • esc clear
```

**Hidden section** — press `v` to reveal models you've hidden:

```
Select Model
▸ ★ claude-sonnet-4 (anthropic) ●
  ★ glm-5.2 (zai)
──────────────────────────────────────
    claude-haiku-4-5 (anthropic)
    gpt-5 (openai)
─ Hidden (v to collapse) ─
    deepseek-v4-flash (deepseek)
    gemini-2.5-flash (google)
↑↓ nav • enter select • f fav • h hide • v hidden • / filter • esc cancel
```

## Keybindings

| Key   | Action                        |
| ----- | ----------------------------- |
| `f`   | Toggle favorite on the focused model |
| `h`   | Toggle hidden on the focused model   |
| `v`   | Show / collapse the hidden section   |
| `/`   | Start filtering (Esc clears, Enter applies) |
| `↑`/`↓` | Navigate                    |
| `Enter` | Select the focused model    |
| `Esc` | Cancel                        |

## Install

```bash
pi install npm:@aiwayds/pi-model-favorites
```

Then run `/m` inside pi to open the picker.

## License

MIT
