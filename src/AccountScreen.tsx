import React, { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { accountRequest, fetchAccount, fetchStorageQuota } from "./api";
import { clearSession, storeSession } from "./auth";
import { listOfflinePackages } from "./offline";

type Mode = "login" | "register" | "verify" | "forgot" | "reset" | "security";
type Props = {
  user?: any;
  onAuthenticated: (user: any) => void;
  onSignedOut: () => void;
  onClose?: () => void;
  onReplayOrientation?: () => void;
  onOpenDownloads?: () => void;
  onOpenAnalyses?: () => void;
  appVersion?: string;
};

function quotaCopy(quota: any) {
  if (!quota) return "Storage usage unavailable.";
  return `${(Number(quota.usedBytes || 0) / 1073741824).toFixed(2)} of ${(Number(quota.limitBytes || 0) / 1073741824).toFixed(2)} GiB used (${Number(quota.percentUsed || 0)}%).`;
}

export function AccountScreen({ user, onAuthenticated, onSignedOut, onClose, onReplayOrientation, onOpenDownloads, onOpenAnalyses, appVersion = "0.1.1" }: Props) {
  const [mode, setMode] = useState<Mode>(user ? "security" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreementsAccepted, setAgreementsAccepted] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");
  const [quota, setQuota] = useState<any>(null);
  const [downloadCount, setDownloadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchStorageQuota().catch(() => null), listOfflinePackages().catch(() => [])]).then(([nextQuota, downloads]) => { setQuota(nextQuota); setDownloadCount(downloads.length); });
  }, [user]);

  const submit = async () => {
    const paths: Record<string, string> = { login: "/login", register: "/register", verify: "/verify-email", forgot: "/forgot-password", reset: "/reset-password" };
    const body = mode === "reset" ? { token, password: newPassword, confirm_password: newPassword } : mode === "verify" ? { token } : mode === "register" ? { email, password, first_name: firstName, last_name: lastName, terms_accepted: agreementsAccepted, privacy_accepted: agreementsAccepted, waiver_accepted: agreementsAccepted } : { email, password };
    try {
      setMessage("Working…");
      const result = await accountRequest(paths[mode], body);
      await storeSession(result);
      if (mode === "login" || result.token) onAuthenticated((await fetchAccount()).user);
      else { setMessage(mode === "forgot" ? "Check your email for reset instructions." : "Request accepted. Check your email if prompted."); if (mode === "register") setMode("verify"); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account request failed."); }
  };

  const signOut = async () => { await clearSession(); onSignedOut(); };
  const removeAccount = () => Alert.alert("Delete account?", "This permanently deletes your shared HuntIntel account.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { try { await accountRequest("", undefined, "DELETE"); await clearSession(); onSignedOut(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete account."); } } },
  ]);

  if (mode === "security") {
    const displayName = [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(" ") || "HuntIntel member";
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>HuntIntel Terrain Intelligence</Text><Text style={styles.title}>Account</Text></View>{onClose && <Button label="Close" onPress={onClose} />}</View>
      <Section title="Profile"><Text style={styles.value}>{displayName}</Text><Text style={styles.label}>Email</Text><Text style={styles.value}>{user?.email || "Verified HuntIntel account"}</Text></Section>
      <Section title="Storage usage"><Text style={styles.value}>{quotaCopy(quota)}</Text><Text style={styles.meta}>Attachment storage shared by your HuntIntel account.</Text></Section>
      <Section title="Terrain Library"><Button label={`Downloads (${downloadCount})`} onPress={onOpenDownloads} /><Button label="My Analyses" onPress={onOpenAnalyses} /></Section>
      <Section title="Orientation"><Text style={styles.meta}>Replay the Terrain walkthrough at any time.</Text><Button label="Replay Orientation" onPress={onReplayOrientation} /></Section>
      <Section title="Subscription"><Text style={styles.meta}>Subscription management will be available here in a future release.</Text></Section>
      <Section title="About HuntIntel Terrain Intelligence"><Text style={styles.meta}>Deterministic terrain analysis powered by the HuntIntel Terrain Intelligence Engine (HTIE).</Text><Text style={styles.value}>App Version {appVersion}</Text></Section>
      <Section title="Account Security">
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Current password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} />
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} />
        <Button label={showPasswords ? "Hide passwords" : "Show passwords"} onPress={() => setShowPasswords(!showPasswords)} />
        <Button label="Change Password" primary onPress={async () => { try { await accountRequest("/change-password", { current_password: password, new_password: newPassword, confirm_password: newPassword }); setMessage("Password changed."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change password."); } }} />
        <Button label="Sign Out" onPress={signOut} /><Button label="Delete Account" danger onPress={removeAccount} />
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.meta}>{message}</Text>}
      </Section>
    </ScrollView></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.wrap}><View style={styles.card}>
    <Text style={styles.eyebrow}>HuntIntel Terrain</Text><Text style={styles.title}>{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Forgot password" : "Reset password"}</Text>
    {["login", "register", "forgot"].includes(mode) && <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#82907e" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />}
    {["login", "register"].includes(mode) && <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
    {mode === "register" && <><TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor="#82907e" /><TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="#82907e" /><Button label={agreementsAccepted ? "Agreements accepted ✓" : "Accept Terms, Privacy Policy & Waiver"} onPress={() => setAgreementsAccepted(!agreementsAccepted)} /></>}
    {["verify", "reset"].includes(mode) && <TextInput style={styles.input} value={token} onChangeText={setToken} placeholder="Email token" placeholderTextColor="#82907e" autoCapitalize="none" />}
    {mode === "reset" && <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#82907e" secureTextEntry={!showPasswords} />}
    {["login", "register", "reset"].includes(mode) && <Button label={showPasswords ? "Hide password" : "Show password"} onPress={() => setShowPasswords(!showPasswords)} />}
    <Button label="Continue" primary onPress={submit} />
    {mode === "login" && <><Button label="Create Account" onPress={() => setMode("register")} /><Button label="Forgot Password" onPress={() => setMode("forgot")} /></>}
    {mode === "verify" && <Button label="Resend Verification" onPress={async () => { try { await accountRequest("/resend-verification", { email }); setMessage("Verification email requested."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to resend."); } }} />}
    {!["login"].includes(mode) && <Button label="Back to Sign In" onPress={() => setMode("login")} />}
    {mode === "forgot" && <Button label="I have a reset token" onPress={() => setMode("reset")} />}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.meta}>{message}</Text>}
  </View></ScrollView></SafeAreaView>;
}

function Section({ title, children }: any) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Button({ label, onPress, primary, danger }: any) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, primary && styles.primary, danger && styles.danger]}><Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#10140f"},page:{padding:20,gap:14},wrap:{flexGrow:1,justifyContent:"center",padding:22},card:{gap:12,padding:24,borderRadius:24,backgroundColor:"#182019"},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},eyebrow:{color:"#d0a65d",letterSpacing:2,textTransform:"uppercase",fontSize:12},title:{color:"#f0f3ea",fontSize:30,fontWeight:"800"},section:{gap:10,padding:18,borderRadius:20,backgroundColor:"#182019",borderWidth:1,borderColor:"#2d3b2d"},sectionTitle:{color:"#f0f3ea",fontSize:20,fontWeight:"800"},label:{color:"#d0a65d",fontSize:12,textTransform:"uppercase",marginTop:4},value:{color:"#f0f3ea",fontSize:16},input:{color:"#f0f3ea",backgroundColor:"#0f140f",borderRadius:14,padding:14},meta:{color:"#a8b5a2",lineHeight:20},button:{padding:14,borderRadius:14,backgroundColor:"#283329",alignItems:"center"},primary:{backgroundColor:"#d0a65d"},danger:{backgroundColor:"#9b493e"},buttonText:{color:"#f5f2e9",fontWeight:"700"},primaryText:{color:"#19140d"}
});
