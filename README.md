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
