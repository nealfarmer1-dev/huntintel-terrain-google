import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login screen renders the bundled Terrain icon responsively", async () => {
  const account = await readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8");

  assert.match(account, /require\("\.\.\/assets\/images\/icon\.png"\)/);
  assert.match(account, /useWindowDimensions\(\)/);
  assert.match(account, /mode === "login".*<Image/);
  assert.match(account, /accessibilityLabel="HuntIntel Terrain logo"/);
  assert.match(account, /Math\.min\(logoMaximumSize, Math\.max\(96,/);
  assert.match(account, /Platform\.OS === "ios" \? 152 : 144/);
});
