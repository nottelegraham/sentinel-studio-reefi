// node tests_js/card_test.js <path to reefi-studio-card.js>  (needs jsdom)
const fs = require("fs"); const { JSDOM } = require("jsdom");
const src = fs.readFileSync(process.argv[2], "utf8");
const fail = m => { console.error("FAIL", m); process.exit(1); };
const tick = () => new Promise(r => setTimeout(r, 30));

async function run() {
  // 1. Two lights, no light in YAML: card asks which light, no error.
  let dom = new JSDOM("<body></body>", { runScripts: "outside-only", pretendToBeVisual: true, url: "http://ha.local/" });
  let w = dom.window; w.ResizeObserver = class { observe() {} disconnect() {} };
  const warns = []; w.console.warn = (...a) => warns.push(a.join(" "));
  w.eval(src);
  const El = w.customElements.get("reefi-studio-card"); if (!El) fail("element not defined");
  const el = w.document.createElement("reefi-studio-card");
  el.setConfig({ type: "custom:reefi-studio-card" });
  const calls = [];
  el.hass = { callWS: async m => { calls.push(m.type);
      if (m.type === "reefi/data") { const e = new Error("pick"); e.code = "choose_light"; throw e; }
      if (m.type === "reefi/lights") return { lights: [{ entry_id: "a", title: "35105" }, { entry_id: "b", title: "FF265" }] };
    }, callService: async () => {} };
  w.document.body.appendChild(el); await tick();
  if (!calls.includes("reefi/lights")) fail("did not ask which light: " + calls);
  const txt = el.shadowRoot.textContent;
  if (!/35105/.test(txt) || !/FF265/.test(txt)) fail("light picker not shown");
  // bad config gets a clear message, not a crash
  try { el.setConfig({ light: {} }); fail("bad config accepted"); } catch (e) { if (!/light must be/.test(e.message)) fail(e.message); }

  // 2. An older copy loaded first: newer copy warns instead of silently doing nothing.
  dom = new JSDOM("<body></body>", { runScripts: "outside-only", url: "http://ha.local/" });
  w = dom.window; const w2 = []; w.console.warn = (...a) => w2.push(a.join(" ")); w.console.info = () => {};
  w.eval(src.replace(/const CARD_VERSION = '[^']+'/, "const CARD_VERSION = '0.1.0'").replace(/\n\s*ReefiStudioCard\.version = CARD_VERSION;/, ""));
  w.eval(src);
  if (!w2.some(m => /loaded first/.test(m))) fail("no stale-copy warning: " + w2);
  // 3. Loading the same version twice (resource + integration) is silent.
  dom = new JSDOM("<body></body>", { runScripts: "outside-only", url: "http://ha.local/" });
  w = dom.window; const w3 = []; w.console.warn = (...a) => w3.push(a.join(" ")); w.console.info = () => {};
  w.eval(src); w.eval(src);
  if (w3.length) fail("warned on same version: " + w3);
  console.log("CARD OK"); process.exit(0);
}
run().catch(e => fail(e.stack));
