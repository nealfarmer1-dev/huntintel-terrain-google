import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("../src/PasswordField.tsx", import.meta.url), "utf8");
const account = await readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8");

test("password field starts hidden and exposes an independent accessible eye toggle", () => {
  assert.match(component, /useState\(false\)/);
  assert.match(component, /secureTextEntry={!passwordVisible}/);
  assert.match(component, /passwordVisible \? "eye-off-outline" : "eye-outline"/);
  assert.match(component, /passwordVisible \? "Hide password" : "Show password"/);
  assert.match(component, /accessibilityRole="button"/);
  assert.match(component, /accessibilityState={{ checked: passwordVisible }}/);
  assert.match(component, /setPasswordVisible\(\(visible\) => !visible\)/);
  assert.match(component, /paddingRight: 58/);
  assert.match(component, /width: 48/);
  assert.match(component, /top: "50%"/);
  assert.match(component, /transform: \[{ translateY: -24 }\]/);
  assert.equal((component.match(/<Ionicons/g) || []).length, 1);
});

test("controlled values and password-manager metadata stay on each input", () => {
  assert.match(component, /<TextInput[\s\S]*{\.\.\.props}[\s\S]*secureTextEntry/);
  assert.match(account, /textContentType="password" autoComplete="current-password"/);
  assert.match(account, /textContentType="newPassword" autoComplete="new-password"/);
  assert.match(account, /placeholder="Confirm password"/);
  assert.match(account, /placeholder="Confirm new password"/);
  assert.match(account, /password !== confirmPassword/);
  assert.match(account, /newPassword !== confirmPassword/);
  assert.doesNotMatch(account, /label={showPasswords \?/);
  assert.match(account, /accessibilityRole="link"[\s\S]*Forgot Password\?/);
  assert.doesNotMatch(account, /<Button label="Forgot Password"/);
  assert.match(account, /forgotPasswordLink:{alignSelf:"flex-end",minHeight:44/);
});
