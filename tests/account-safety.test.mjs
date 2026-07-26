import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAccountActionGuard, runDeleteAccountAction, runSignOutAction } from "../src/account-actions.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

test("sign out reports progress, ignores duplicate taps, clears the session, and resets auth once", async () => {
  const pending = deferred();
  const guard = createAccountActionGuard();
  const busy = [];
  const messages = [];
  let clearCalls = 0;
  let signedOutCalls = 0;
  const options = {
    guard,
    clearSession: async () => { clearCalls += 1; await pending.promise; },
    onSignedOut: async () => { signedOutCalls += 1; },
    setBusy: (value) => busy.push(value),
    setMessage: (value) => messages.push(value),
  };

  const first = runSignOutAction(options);
  assert.deepEqual(await runSignOutAction(options), { status: "ignored" });
  assert.equal(clearCalls, 1);
  assert.equal(signedOutCalls, 0);
  assert.deepEqual(busy, [true]);
  pending.resolve();
  assert.deepEqual(await first, { status: "success" });
  assert.equal(signedOutCalls, 1);
  assert.deepEqual(busy, [true, false]);
  assert.equal(messages.at(-1), "");
});

test("sign-out failure restores controls, shows an error, and keeps authenticated state", async () => {
  const busy = [];
  const messages = [];
  let signedOutCalls = 0;
  const result = await runSignOutAction({
    guard: createAccountActionGuard(),
    clearSession: async () => { throw new Error("Secure session storage is unavailable."); },
    onSignedOut: async () => { signedOutCalls += 1; },
    setBusy: (value) => busy.push(value),
    setMessage: (value) => messages.push(value),
  });

  assert.equal(result.status, "failure");
  assert.equal(signedOutCalls, 0);
  assert.deepEqual(busy, [true, false]);
  assert.match(messages.at(-1), /Secure session storage is unavailable/);
});

test("delete failure preserves the session and delete success clears it exactly once", async () => {
  let clearCalls = 0;
  let signedOutCalls = 0;
  const failure = await runDeleteAccountAction({
    guard: createAccountActionGuard(),
    deleteAccount: async () => { throw new Error("Deletion service unavailable."); },
    clearSession: async () => { clearCalls += 1; },
    onSignedOut: async () => { signedOutCalls += 1; },
    setBusy: () => {},
    setMessage: () => {},
  });
  assert.equal(failure.status, "failure");
  assert.equal(clearCalls, 0);
  assert.equal(signedOutCalls, 0);

  const pending = deferred();
  const guard = createAccountActionGuard();
  let deleteCalls = 0;
  const options = {
    guard,
    deleteAccount: async () => { deleteCalls += 1; await pending.promise; },
    clearSession: async () => { clearCalls += 1; },
    onSignedOut: async () => { signedOutCalls += 1; },
    setBusy: () => {},
    setMessage: () => {},
  };
  const first = runDeleteAccountAction(options);
  assert.deepEqual(await runDeleteAccountAction(options), { status: "ignored" });
  assert.equal(deleteCalls, 1);
  pending.resolve();
  assert.deepEqual(await first, { status: "success" });
  assert.equal(clearCalls, 1);
  assert.equal(signedOutCalls, 1);
});

test("session clearing deletes the single Terrain access-token key", async () => {
  const auth = await readFile(new URL("../src/auth.js", import.meta.url), "utf8");
  assert.match(auth, /ACCESS_TOKEN_KEY = "huntintel\.terrain\.accessToken"/);
  assert.match(auth, /clearSession\(storage = SecureStore\) \{ await storage\.deleteItemAsync\(ACCESS_TOKEN_KEY\); \}/);
});

test("Account UI provides a safe exit, separated actions, and second-tap deletion confirmation", async () => {
  const [account, app] = await Promise.all([
    readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(account, /label=\{Platform\.OS === "ios" \? "Done" : "Back"\} accessibilityLabel="Close Account and return to Terrain"/);
  assert.match(account, /loadingLabel="Signing out…"/);
  assert.match(account, /loadingLabel="Deleting account…"/);
  assert.match(account, /accessibilityState=\{\{ disabled: inactive, busy:Boolean\(loading\) \}\}/);
  assert.match(account, /title="Session"/);
  assert.match(account, /Deleting your account is permanent and removes associated account data\./);
  assert.doesNotMatch(account, /Danger Zone/);
  assert.match(account, /"Permanently Delete Account\?"/);
  assert.match(account, /"Your HuntIntel account and associated data will be permanently deleted\. This action cannot be undone\."/);
  assert.match(account, /\{ cancelable: true, onDismiss:/);
  assert.match(account, /\{ text: "Cancel", style: "cancel"/);
  assert.match(account, /\{ text: "Delete Account", style: "destructive"/);
  assert.match(account, /deleteAccount: \(\) => accountRequest\("", undefined, "DELETE"\)/);
  assert.ok(account.indexOf('title="Session"') < account.indexOf("<View style={styles.dangerZone}>"));
  assert.ok(account.indexOf('label="Sign Out"') < account.indexOf('label="Delete Account"'));
  assert.match(account, /<View style=\{styles\.dangerZone\}>\s*<View style=\{styles\.section\}>/);
  assert.match(account, /dangerZone:\{marginTop:24\}/);

  assert.match(app, /if \(showAccount\) \{ setShowAccount\(false\); return true; \}/);
  assert.match(app, /onSignedOut=\{handleSignedOut\}/);
  assert.match(app, /<AccountScreen key=\{account \? "authenticated-account" : "login"\}/);
  for (const reset of ['setAccount(null)', 'setAuthState("unauthenticated")', 'setShowAccount(false)', 'setScreen("home")', 'setAnalysis(null)', 'setLibrary(null)']) {
    assert.ok(app.includes(reset), `expected authenticated-root reset: ${reset}`);
  }
});
