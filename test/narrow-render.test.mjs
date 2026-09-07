// Issue #1 reproduction: the /m selector must not kill the TUI on narrow
// terminals. pi-tui treats any rendered line wider than the terminal as fatal
// ("Rendered line 60 exceeds terminal width (73 > 62)"); the old render()
// pushed the footer hint (74 visible columns) and model rows without any
// width guard. This suite loads the extension exactly like pi does (jiti),
// registers it against a fake pi, invokes the /m handler with a fake ctx,
// captures the picker component from ctx.ui.custom, and asserts every line
// render(N) produces is N visible columns or fewer — for the reporter's 62
// columns and beyond.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { visibleWidth } from "@earendil-works/pi-tui";

const here = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(here, { interopDefault: true });

/** Real ANSI sequences, so the ANSI-aware clipping is actually exercised. */
const theme = {
	fg: (color, s) => `\x1b[${30 + (color.length % 6)}m${s}\x1b[0m`,
	bg: (color, s) => `\x1b[4${color.length % 7}m${s}\x1b[0m`,
	bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const MODELS = [
	// A deliberately overflowing row: name + provider suffix far past 62 columns.
	{
		provider: "some-very-long-provider",
		id: "an-extremely-long-model-identifier",
		name: "A Very Long Display Name That Definitely Overflows Sixty Two Columns",
	},
	{ provider: "deepseek", id: "deepseek-chat", name: "DeepSeek Chat" },
	{ provider: "openai", id: "gpt-5", name: "GPT-5" },
];

/** Load the extension, register it, run /m, and return the picker component. */
async function openPicker(piExtras = {}) {
	const mod = await jiti.import(path.join(here, "..", "index.ts"));
	let handler;
	const pi = {
		registerCommand(name, def) {
			handler = def.handler;
		},
		setModel: async () => true,
		...piExtras,
	};
	mod.default(pi);

	let component;
	const ctx = {
		model: MODELS[1],
		modelRegistry: { getAvailable: () => MODELS },
		ui: {
			custom: (factory) =>
				new Promise((resolve) => {
					const done = (value) => resolve(value);
					const tui = { requestRender: () => {} };
					component = factory(tui, theme, {}, done);
				}),
			notify: () => {},
		},
	};
	// NOT awaited to completion: the handler stays pending inside
	// ctx.ui.custom until the user picks (done) — which never happens here.
	// The factory runs synchronously before the handler's first await, so the
	// component is captured by the time the call returns.
	const pending = handler("", ctx);
	pending.catch(() => {}); // no unhandled-rejection noise when it never settles
	if (!component) throw new Error("ctx.ui.custom factory was not invoked synchronously");
	return component;
}

const assertAllLinesFit = (lines, width) => {
	for (const line of lines) {
		assert.ok(
			visibleWidth(line) <= width,
			`line exceeds ${width} columns (${visibleWidth(line)}): ${JSON.stringify(line)}`,
		);
	}
};

describe("/m picker width safety (#1)", () => {
	test("the reporter's 62-column terminal renders without an over-wide line", async () => {
		const component = await openPicker();
		const lines = component.render(62);
		assert.ok(lines.length > 0);
		// The footer hint line (the crash offender in the report) is present but clipped.
		const footer = lines.find((l) => l.includes("nav"));
		assert.ok(footer, "footer hint line rendered");
		assertAllLinesFit(lines, 62);
	});

	test("long model names + provider suffix clip instead of crashing", async () => {
		const component = await openPicker();
		const lines = component.render(62);
		assert.ok(
			lines.some((l) => l.includes("A Very Long Display Name")),
			"the overflowing model row still renders (clipped)",
		);
		assertAllLinesFit(lines, 62);
	});

	test("extreme widths (80 and 1 column) stay safe; 80 keeps the footer intact", async () => {
		const component = await openPicker();
		assertAllLinesFit(component.render(80), 80);
		const wide = component.render(80);
		assert.ok(
			wide.some((l) => l.includes("esc cancel")),
			"at 80 columns the whole footer hint survives",
		);
		assertAllLinesFit(component.render(1), 1);
	});

	test("repeated renders at the same width hit the cache and stay clipped", async () => {
		const component = await openPicker();
		const first = component.render(62);
		const second = component.render(62);
		assert.equal(first, second, "cached lines returned");
		assertAllLinesFit(second, 62);
	});
});
