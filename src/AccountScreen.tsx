import React, { useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { accountRequest, fetchAccount } from "./api";
import { clearSession, storeSession } from "./auth";

type Mode = "login" | "register" | "verify" | "forgot" | "reset" | "security";
type Props = { user?: any; onAuthenticated: (user: any) => void; onSignedOut: () => void; onClose?: () => void };

export function AccountScreen({ user, onAuthenticated, onSignedOut, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(user ? "security" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    const paths: Record<string, string> = { login: "/login", register: "/register", verify: "/verify-email", forgot: "/forgot-password", reset: "/reset-password" };
    const body = mode === "reset" ? { token, newPassword } : mode === "verify" ? { token } : { email, password };
    try {
      setMessage("Working…");
      const result = await accountRequest(paths[mode], body);
      await storeSession(result);
      if (mode === "login" || result.accessToken || result.tokens?.accessToken) {
        onAuthenticated((await fetchAccount()).user);
      } else {
        setMessage(mode === "forgot" ? "Check your email for reset instructions." : "Request accepted. Check your email if prompted.");
        if (mode === "register") setMode("verify");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account request failed."); }
  };

  const signOut = async () => {
    try { await accountRequest("/logout", {}); } finally { await clearSession(); onSignedOut(); }
  };

  const removeAccount = () => Alert.alert("Delete account?", "This permanently deletes your shared HuntIntel account.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
      try { await accountRequest("", undefined, "DELETE"); await clearSession(); onSignedOut(); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete account."); }
    } },
  ]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}><View style={styles.card}>
    <Text style={styles.eyebrow}>HuntIntel Terrain</Text><Text style={styles.title}>{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Forgot password" : mode === "reset" ? "Reset password" : "Account & security"}</Text>
    {["login", "register", "forgot"].includes(mode) && <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#82907e" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />}
    {["login", "register"].includes(mode) && <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
    {["verify", "reset"].includes(mode) && <TextInput style={styles.input} value={token} onChangeText={setToken} placeholder="Email token" placeholderTextColor="#82907e" autoCapitalize="none" />}
    {mode === "reset" && <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} />}
    {["login", "register", "reset", "security"].includes(mode) && <Button label={showPasswords ? "Hide passwords" : "Show passwords"} onPress={() => setShowPasswords(!showPasswords)} />}
    {mode === "security" ? <><Text style={styles.meta}>{user?.email || "Verified HuntIntel account"}</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Current password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} /><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} /><Button label="Change password" primary onPress={async () => { try { await accountRequest("/change-password", { currentPassword: password, newPassword }); setMessage("Password changed."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change password."); } }} /><Button label="Sign out" onPress={signOut} /><Button label="Delete account" danger onPress={removeAccount} />{onClose && <Button label="Back to Terrain" onPress={onClose} />}</> : <Button label="Continue" primary onPress={submit} />}
    {mode === "login" && <><Button label="Create Account" onPress={() => setMode("register")} /><Button label="Forgot Password" onPress={() => setMode("forgot")} /></>}
    {mode === "verify" && <Button label="Resend Verification" onPress={async () => { try { await accountRequest("/resend-verification", { email }); setMessage("Verification email requested."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to resend."); } }} />}
    {!["login", "security"].includes(mode) && <Button label="Back to Sign In" onPress={() => setMode("login")} />}
    {mode === "forgot" && <Button label="I have a reset token" onPress={() => setMode("reset")} />}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.meta}>{message}</Text>}
  </View></ScrollView></SafeAreaView>;
}
function Button({ label, onPress, primary, danger }: any) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, primary && styles.primary, danger && styles.danger]}><Text style={styles.buttonText}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#10140f" }, wrap: { flexGrow: 1, justifyContent: "center", padding: 22 }, card: { gap: 12, padding: 24, borderRadius: 24, backgroundColor: "#182019" }, eyebrow: { color: "#d0a65d", letterSpacing: 2, textTransform: "uppercase" }, title: { color: "#f0f3ea", fontSize: 30, fontWeight: "800" }, input: { color: "#f0f3ea", backgroundColor: "#0f140f", borderRadius: 14, padding: 14 }, meta: { color: "#a8b5a2" }, button: { padding: 14, borderRadius: 999, backgroundColor: "#283329", alignItems: "center" }, primary: { backgroundColor: "#d0a65d" }, danger: { backgroundColor: "#9b493e" }, buttonText: { color: "#f5f2e9", fontWeight: "700" } });
