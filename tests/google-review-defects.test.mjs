import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { accountSubmissionValidationMessage, changePasswordValidationMessage } from "../src/account-validation.js";
import { invalidateSessionIfRequired, requestErrorMessage, requestRequiresAuthentication } from "../src/request-auth-policy.js";

test("installed Android product name is correct while package identity is unchanged", async () => {
  const config = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
  const strings = await readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8");
  const gradle = await readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8");

  assert.equal(config.expo.name, "HuntIntel Terrain");
  assert.equal(config.expo.android.package, "com.huntintel.terrainintelligence");
  assert.match(strings, /<string name="app_name">HuntIntel Terrain<\/string>/);
  assert.doesNotMatch(strings, /HuntIntel Terrain Google/);
  assert.match(gradle, /applicationId 'com\.huntintel\.terrainintelligence'/);
});

test("login validation blocks empty email, malformed email, and empty password", () => {
  let requestCalls = 0;
  const submit = (values) => {
    const message = accountSubmissionValidationMessage("login", values);
    if (!message) requestCalls += 1;
    return message;
  };

  assert.equal(submit({ email: "", password: "" }), "Enter your email address.");
  assert.equal(submit({ email: "name@", password: "anything" }), "Enter a valid email address.");
  assert.equal(submit({ email: "hunter@example.com", password: "" }), "Enter your password.");
  assert.equal(requestCalls, 0);
  assert.equal(submit({ email: "hunter@example.com", password: " " }), "");
  assert.equal(submit({ email: "hunter@example.com", password: "secret" }), "");
  assert.equal(requestCalls, 2);
});

test("forgot, reset, and verification validation blocks incomplete requests", () => {
  assert.equal(accountSubmissionValidationMessage("forgot", { email: "" }), "Enter your email address.");
  assert.equal(accountSubmissionValidationMessage("forgot", { email: "name@" }), "Enter a valid email address.");
  assert.equal(accountSubmissionValidationMessage("reset", { token: "", newPassword: "", confirmPassword: "" }), "Enter your reset token.");
  assert.equal(accountSubmissionValidationMessage("reset", { token: "reset-token", newPassword: "", confirmPassword: "" }), "Enter a new password.");
  assert.equal(accountSubmissionValidationMessage("reset", { token: "reset-token", newPassword: "new-secret", confirmPassword: "" }), "Confirm your new password.");
  assert.equal(accountSubmissionValidationMessage("reset", { token: "reset-token", newPassword: "new-secret", confirmPassword: "different" }), "New passwords do not match.");
  assert.equal(accountSubmissionValidationMessage("verify", { token: "" }), "Enter your verification token.");
});

test("public account 401 does not clear a session or invoke the expiry handler", async () => {
  const effects = [];
  const requiresAuthentication = requestRequiresAuthentication("/api/account/login");
  const invalidated = await invalidateSessionIfRequired({
    requiresAuthentication,
    status: 401,
    code: "INVALID_CREDENTIALS",
    error: new Error("Email or password is incorrect."),
    clearSession: async () => { effects.push("clear"); },
    onSessionExpired: () => { effects.push("expired"); },
  });

  assert.equal(requiresAuthentication, false);
  assert.equal(invalidated, false);
  assert.deepEqual(effects, []);
  assert.equal(requestErrorMessage({ path: "/api/account/login", status: 401, serverMessage: "", sessionInvalid: false }), "Email or password is incorrect.");
  assert.equal(requestErrorMessage({ path: "/api/account/login", status: 401, serverMessage: "Invalid credentials.", sessionInvalid: false }), "Invalid credentials.");
});

test("authenticated 401 and structured access revocation still invalidate the session", async () => {
  for (const scenario of [
    { path: "/api/account/session", status: 401, code: "INVALID_SESSION" },
    { path: "/api/account/login", status: 403, code: "ACCOUNT_ACCESS_REVOKED" },
  ]) {
    const effects = [];
    const invalidated = await invalidateSessionIfRequired({
      requiresAuthentication: requestRequiresAuthentication(scenario.path),
      status: scenario.status,
      code: scenario.code,
      error: new Error("expired"),
      clearSession: async () => { effects.push("clear"); },
      onSessionExpired: () => { effects.push("expired"); },
    });
    assert.equal(invalidated, true);
    assert.deepEqual(effects, ["clear", "expired"]);
  }

  for (const path of ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/resend-verification"]) {
    assert.equal(requestRequiresAuthentication(`/api/account${path}`), false);
  }
  assert.equal(requestRequiresAuthentication("/api/account/session"), true);
  assert.equal(requestRequiresAuthentication("/api/account/change-password"), true);
  assert.equal(requestRequiresAuthentication("/api/terrain/features"), true);
});

test("change-password validation blocks missing fields and mismatch without changing a valid payload", () => {
  let requestCalls = 0;
  const submit = (values) => {
    const message = changePasswordValidationMessage(values);
    if (message) return { message };
    requestCalls += 1;
    return {
      path: "/change-password",
      body: {
        current_password: values.currentPassword,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
      },
    };
  };

  assert.equal(submit({ currentPassword: "", newPassword: "", confirmPassword: "" }).message, "Enter your current password.");
  assert.equal(submit({ currentPassword: "current", newPassword: "", confirmPassword: "" }).message, "Enter a new password.");
  assert.equal(submit({ currentPassword: "current", newPassword: "new", confirmPassword: "" }).message, "Confirm your new password.");
  assert.equal(submit({ currentPassword: "current", newPassword: "new", confirmPassword: "different" }).message, "New passwords do not match.");
  assert.equal(requestCalls, 0);
  assert.deepEqual(submit({ currentPassword: " ", newPassword: " ", confirmPassword: " " }), {
    path: "/change-password",
    body: { current_password: " ", new_password: " ", confirm_password: " " },
  });
  assert.deepEqual(submit({ currentPassword: "current", newPassword: "new", confirmPassword: "new" }), {
    path: "/change-password",
    body: { current_password: "current", new_password: "new", confirm_password: "new" },
  });
  assert.equal(requestCalls, 2);
});

test("About version comes from installed native metadata without a stale fallback", async () => {
  const [app, account] = await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Application\.nativeApplicationVersion \|\| "Unavailable"/);
  assert.match(app, /appVersion=\{APP_VERSION\}/);
  assert.doesNotMatch(app, /appVersion="0\.1\.2"/);
  assert.doesNotMatch(account, /appVersion = "0\.1\.2"/);
  assert.match(account, /App Version \{appVersion\}/);
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.dependencies["expo-application"], "~7.0.8");
});

test("Account UI wires validation ahead of unchanged account requests", async () => {
  const account = await readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8");
  assert.ok(account.indexOf("accountSubmissionValidationMessage(mode") < account.indexOf("accountRequest(paths[mode], body)"));
  assert.ok(account.indexOf("changePasswordValidationMessage({") < account.indexOf('accountRequest("/change-password"'));
  assert.match(account, /current_password: password, new_password: newPassword, confirm_password: confirmPassword/);
});
