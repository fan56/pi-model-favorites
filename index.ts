import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

type FavoritesConfig = {
	favorites: string[];
	hidden: string[];
};

type Row =
	| { kind: "model"; model: Model<Api> }
	| { kind: "divider" }
	| { kind: "header"; label: string };

const modelKey = (m: Model<Api>): string => `${m.provider}/${m.id}`;

function configPath(): string {
	return join(getAgentDir(), "model-favorites.json");
}

function loadConfig(): FavoritesConfig {
	if (!existsSync(configPath())) {
		return { favorites: [], hidden: [] };
	}
	try {
		const parsed = JSON.parse(readFileSync(configPath(), "utf-8")) as Partial<FavoritesConfig>;
		return {
			favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
			hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
		};
	} catch {
		return { favorites: [], hidden: [] };
	}
}

function saveConfig(config: FavoritesConfig): void {
	try {
		writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf-8");
	} catch {
		// Best-effort: a persistence failure must not crash the picker input loop.
	}
}

function sortModels(models: Model<Api>[]): Model<Api>[] {
	return [...models].sort((a, b) => {
		const byProvider = a.provider.localeCompare(b.provider);
		if (byProvider !== 0) return byProvider;
		return a.name.localeCompare(b.name);
	});
}

function buildRows(
	models: Model<Api>[],
	favSet: Set<string>,
	hiddenSet: Set<string>,
	showHidden: boolean,
): Row[] {
	const isFav = (m: Model<Api>): boolean => favSet.has(modelKey(m));
	const isHid = (m: Model<Api>): boolean => hiddenSet.has(modelKey(m));
	const rows: Row[] = [];
	const favs = models.filter((m) => isFav(m) && !isHid(m));
	for (const m of favs) rows.push({ kind: "model", model: m });
	if (favs.length > 0) rows.push({ kind: "divider" });
	for (const m of models.filter((m) => !isFav(m) && !isHid(m))) rows.push({ kind: "model", model: m });
	const hidden = models.filter(isHid);
	if (showHidden && hidden.length > 0) {
		rows.push({ kind: "header", label: "─ Hidden (v to collapse) ─" });
		for (const m of hidden) rows.push({ kind: "model", model: m });
	}
	return rows;
}

function firstSelectable(rows: Row[]): number {
	const i = rows.findIndex((r) => r.kind === "model");
	return i < 0 ? 0 : i;
}

export default function modelFavorites(pi: ExtensionAPI): void {
	pi.registerCommand("m", {
		description: "Select a model — favorites pinned to the top",
		handler: async (_args, ctx) => {
			const config = loadConfig();
			const favSet = new Set(config.favorites);
			const hiddenSet = new Set(config.hidden);
			const models = sortModels(ctx.modelRegistry.getAvailable());
			const currentKey = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
			let showHidden = false;

			const chosen = await ctx.ui.custom<Model<Api> | null>((tui, theme, _keybindings, done) => {
				let filter = "";
				let filtering = false;
				const matches = (m: Model<Api>): boolean => {
					if (filter === "") return true;
					const q = filter.toLowerCase();
					return (
						m.name.toLowerCase().includes(q) ||
						m.id.toLowerCase().includes(q) ||
						m.provider.toLowerCase().includes(q)
					);
				};
				const computeRows = (): Row[] => buildRows(models.filter(matches), favSet, hiddenSet, showHidden);
				let rows = computeRows();
				let cursor = firstSelectable(rows);
				let version = 0;
				let cached: { version: number; width: number; lines: string[] } | undefined;

				const focusedModel = (): Model<Api> | undefined => {
					const r = rows[cursor];
					return r && r.kind === "model" ? r.model : undefined;
				};
				const focusedKey = (): string | undefined => {
					const m = focusedModel();
					return m ? modelKey(m) : undefined;
				};
				const rebuild = (): void => {
					const keep = focusedKey();
					rows = computeRows();
					cursor =
						keep !== undefined
							? rows.findIndex((r) => r.kind === "model" && modelKey(r.model) === keep)
							: -1;
					if (cursor < 0) cursor = firstSelectable(rows);
				};
				const moveCursor = (delta: number): void => {
					let next = cursor;
					while (next + delta >= 0 && next + delta < rows.length) {
						next += delta;
						if (rows[next].kind === "model") {
							cursor = next;
							return;
						}
					}
				};
				const toggleFavorite = (): void => {
					const m = focusedModel();
					if (!m) return;
					const key = modelKey(m);
					if (favSet.has(key)) {
						favSet.delete(key);
						config.favorites = config.favorites.filter((k) => k !== key);
					} else {
						favSet.add(key);
						config.favorites.push(key);
					}
					saveConfig(config);
					rebuild();
					version++;
					tui.requestRender();
				};
				const toggleHidden = (): void => {
					const m = focusedModel();
					if (!m) return;
					const key = modelKey(m);
					if (hiddenSet.has(key)) {
						hiddenSet.delete(key);
						config.hidden = config.hidden.filter((k) => k !== key);
					} else {
						hiddenSet.add(key);
						config.hidden.push(key);
					}
					saveConfig(config);
					rebuild();
					version++;
					tui.requestRender();
				};

				const render = (width: number): string[] => {
					if (cached && cached.version === version && cached.width === width) {
						return cached.lines;
					}
					const lines: string[] = [theme.fg("accent", theme.bold("Select Model"))];
					const hasSelectable = rows.some((r) => r.kind === "model");
					rows.forEach((r, i) => {
						if (r.kind === "divider") {
							lines.push(theme.fg("border", "─".repeat(Math.max(1, width))));
						} else if (r.kind === "header") {
							lines.push(theme.fg("dim", r.label));
						} else {
							const key = modelKey(r.model);
							const text = `${favSet.has(key) ? "★ " : "  "}${r.model.name} (${r.model.provider})${key === currentKey ? " ●" : ""}`;
							if (i === cursor) {
								lines.push(theme.bg("selectedBg", theme.fg("accent", `▸ ${text}`)));
							} else if (hiddenSet.has(key)) {
								lines.push(theme.fg("dim", `  ${text}`));
							} else {
								lines.push(`  ${text}`);
							}
						}
					});
					if (!hasSelectable) {
						lines.push(theme.fg("dim", "  (no models match)"));
					}
					if (filtering) {
						lines.push(theme.fg("accent", `filter: "${filter}"`) + theme.fg("dim", " • enter apply • esc clear"));
					} else {
						lines.push(theme.fg("dim", "↑↓ nav • enter select • f fav • h hide • v hidden • / filter • esc cancel"));
					}
					cached = { version, width, lines };
					return lines;
				};

				const handleInput = (data: string): void => {
					if (filtering) {
						if (matchesKey(data, Key.escape)) {
							filter = "";
							filtering = false;
						} else if (matchesKey(data, Key.enter)) {
							filtering = false;
						} else if (matchesKey(data, Key.backspace)) {
							filter = filter.slice(0, -1);
						} else if (data.length === 1 && data >= " ") {
							filter += data;
						} else {
							return;
						}
						rebuild();
						version++;
						tui.requestRender();
						return;
					}
					if (data === "/") {
						filtering = true;
						version++;
						tui.requestRender();
						return;
					}
					if (matchesKey(data, Key.up)) {
						moveCursor(-1);
					} else if (matchesKey(data, Key.down)) {
						moveCursor(1);
					} else if (data.toLowerCase() === "f") {
						toggleFavorite();
						return;
					} else if (data.toLowerCase() === "h") {
						toggleHidden();
						return;
					} else if (data.toLowerCase() === "v") {
						showHidden = !showHidden;
						rebuild();
						version++;
						tui.requestRender();
						return;
					} else if (matchesKey(data, Key.enter)) {
						const m = focusedModel();
						if (m) done(m);
						return;
					} else if (matchesKey(data, Key.escape)) {
						done(null);
						return;
					} else {
						return;
					}
					version++;
					tui.requestRender();
				};

				return { render, invalidate: () => { cached = undefined; }, handleInput };
			});

			if (chosen && !(await pi.setModel(chosen))) {
				ctx.ui.notify(`Could not set ${chosen.name} (provider not configured)`, "warning");
			}
		},
	});
}
