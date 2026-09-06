// Smoke test: load the extension entry via jiti (the same loader pi uses)
// and verify the default export is a factory function taking 1 arg (pi).
// No pi runtime required at load time.
const path = require("node:path");
const { createJiti } = require("jiti");

(async () => {
  const jiti = createJiti(__filename, { interopDefault: true });
  const mod = await jiti.import(path.join(__dirname, "index.ts"));
  const exp = mod.default;
  if (typeof exp !== "function") {
    throw new Error(
      `SMOKE FAIL: default export is not a function, got ${typeof exp}`,
    );
  }
  if (exp.length !== 1) {
    throw new Error(
      `SMOKE FAIL: factory should take 1 arg (pi), got ${exp.length}`,
    );
  }
  console.log(`SMOKE OK: default export is a function (arity ${exp.length})`);
  const src = mod.default.toString().slice(0, 200);
  console.log("Factory head:", JSON.stringify(src));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
