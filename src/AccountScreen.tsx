import React, { useEffect, useState } from "react";
import * as Location from "expo-location";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { accountRequest, fetchAccount, fetchStorageQuota } from "./api";
import { clearSession, storeSession } from "./auth";
import { listOfflinePackages } from "./offline";
import { PasswordField } from "./PasswordField";

type Mode = "login" | "register" | "verify" | "forgot" | "reset" | "security";
const TERMS_URL = "https://app.huntintelapp.com/legal/terms";
const PRIVACY_URL = "https://app.huntintelapp.com/legal/privacy";
type Props = {
  user?: any;
  onAuthenticated: (user: any) => void;
  onSignedOut: () => void;
  onClose?: () => void;
  onReplayOrientation?: () => void;
  onOpenDownloads?: () => void;
  onOpenAnalyses?: () => void;
  appVersion?: string;
  initialMessage?: string;
};

function quotaCopy(quota: any) {
  if (!quota) return "Storage usage unavailable.";
  return `${(Number(quota.usedBytes || 0) / 1073741824).toFixed(2)} of ${(Number(quota.limitBytes || 0) / 1073741824).toFixed(2)} GiB used (${Number(quota.percentUsed || 0)}%).`;
}

export function AccountScreen({ user, onAuthenticated, onSignedOut, onClose, onReplayOrientation, onOpenDownloads, onOpenAnalyses, appVersion = "0.1.2", initialMessage = "" }: Props) {
  const [mode, setMode] = useState<Mode>(user ? "security" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [locationPermission, setLocationPermission] = useState("Checking…");
  const [quota, setQuota] = useState<any>(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchStorageQuota().catch(() => null), listOfflinePackages().catch(() => [])]).then(([nextQuota, downloads]) => { setQuota(nextQuota); setDownloadCount(downloads.length); });
    Location.getForegroundPermissionsAsync().then((result) => setLocationPermission(result.status === "granted" ? "Allowed while using the app" : result.status === "denied" ? "Not allowed" : "Not requested")).catch(() => setLocationPermission("Unavailable"));
  }, [user]);

  const submit = async () => {
    const paths: Record<string, string> = { login: "/login", register: "/register", verify: "/verify-email", forgot: "/forgot-password", reset: "/reset-password" };
    if (mode === "register" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (mode === "register" && (!termsAccepted || !privacyAccepted)) {
      setMessage("Accept the Terms of Use and Privacy Policy to continue.");
      return;
    }
    if (mode === "reset" && newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    const body = mode === "reset" ? { token, password: newPassword, confirm_password: confirmPassword } : mode === "verify" ? { token } : mode === "register" ? { email, password, confirm_password: confirmPassword, first_name: firstName, last_name: lastName, terms_accepted: termsAccepted, privacy_accepted: privacyAccepted } : { email, password };
    try {
      setBusy(true); setMessage("");
      const result = await accountRequest(paths[mode], body);
      if (result.token) {
        await storeSession(result);
        onAuthenticated((await fetchAccount()).user);
      } else {
        setMessage(mode === "forgot" ? "Check your email for reset instructions." : "Request accepted. Check your email if prompted.");
        if (mode === "register") setMode("verify");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account request failed."); }
    finally { setBusy(false); }
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
      <Section title="Location Permission"><Text style={styles.value}>{locationPermission}</Text><Button label="Open Device Settings" onPress={() => { void Linking.openSettings(); }} /></Section>
      <Section title="Purchases"><Text style={styles.meta}>Recoverable terrain purchases are checked securely at startup and appear in My Analyses.</Text><Button label="Review Purchase Recovery" onPress={onOpenAnalyses} /></Section>
      <Section title="Subscription"><Text style={styles.meta}>Terrain analyses are one-time purchases. No Terrain subscription is currently required.</Text></Section>
      <Section title="Help & Legal"><Button label="Contact Support" onPress={() => { void Linking.openURL("mailto:support@huntintelapp.com"); }} /><Button label="Terms of Use" onPress={() => { void Linking.openURL(TERMS_URL); }} /><Button label="Privacy Policy" onPress={() => { void Linking.openURL(PRIVACY_URL); }} /></Section>
      <Section title="About HuntIntel Terrain Intelligence"><Text style={styles.meta}>Deterministic terrain analysis powered by the HuntIntel Terrain Intelligence Engine (HTIE).</Text><Text style={styles.value}>App Version {appVersion}</Text></Section>
      <Section title="Account Security">
        <PasswordField style={styles.input} value={password} onChangeText={setPassword} placeholder="Current password" placeholderTextColor="#82907e" textContentType="password" autoComplete="current-password" />
        <PasswordField style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#82907e" textContentType="newPassword" autoComplete="new-password" />
        <PasswordField style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor="#82907e" textContentType="newPassword" autoComplete="new-password" />
        <Button label="Change Password" primary onPress={async () => { if (newPassword !== confirmPassword) { setMessage("Passwords do not match."); return; } try { await accountRequest("/change-password", { current_password: password, new_password: newPassword, confirm_password: confirmPassword }); setMessage("Password changed."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change password."); } }} />
        <Button label="Sign Out" onPress={signOut} /><Button label="Delete Account" danger onPress={removeAccount} />
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.meta}>{message}</Text>}
      </Section>
    </ScrollView></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}><View style={styles.card}>
    <Text style={styles.eyebrow}>HuntIntel Terrain</Text><Text style={styles.title}>{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "verify" ? "Verify email" : mode === "forgot" ? "Forgot password" : "Reset password"}</Text>
    {["login", "register", "forgot"].includes(mode) && <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#82907e" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />}
    {["login", "register"].includes(mode) && <PasswordField style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#82907e" textContentType={mode === "login" ? "password" : "newPassword"} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
    {mode === "login" && <Pressable accessibilityRole="link" onPress={() => setMode("forgot")} style={styles.forgotPasswordLink}><Text style={styles.forgotPasswordText}>Forgot Password?</Text></Pressable>}
    {mode === "register" && <PasswordField style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor="#82907e" textContentType="newPassword" autoComplete="new-password" />}
    {mode === "register" && <><TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor="#82907e" /><TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="#82907e" /><View style={styles.agreements}><Text style={styles.agreementsTitle}>Required Agreements</Text><Agreement label="I agree to the Terms of Use." linkLabel="Read Terms of Use" url={TERMS_URL} checked={termsAccepted} onChange={setTermsAccepted} /><Agreement label="I agree to the Privacy Policy." linkLabel="Read Privacy Policy" url={PRIVACY_URL} checked={privacyAccepted} onChange={setPrivacyAccepted} /></View></>}
    {["verify", "reset"].includes(mode) && <TextInput style={styles.input} value={token} onChangeText={setToken} placeholder="Email token" placeholderTextColor="#82907e" autoCapitalize="none" />}
    {mode === "reset" && <><PasswordField style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#82907e" textContentType="newPassword" autoComplete="new-password" /><PasswordField style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor="#82907e" textContentType="newPassword" autoComplete="new-password" /></>}
    <Button label="Continue" primary loading={busy} disabled={mode === "register" && (!termsAccepted || !privacyAccepted)} onPress={submit} />
    {mode === "login" && <Button label="Create Account" onPress={() => setMode("register")} />}
    {mode === "verify" && <Button label="Resend Verification" onPress={async () => { try { await accountRequest("/resend-verification", { email }); setMessage("Verification email requested."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to resend."); } }} />}
    {!["login"].includes(mode) && <Button label="Back to Sign In" onPress={() => setMode("login")} />}
    {mode === "forgot" && <Button label="I have a reset token" onPress={() => setMode("reset")} />}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.meta}>{message}</Text>}
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Section({ title, children }: any) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Agreement({ label, linkLabel, url, checked, onChange }: any) { return <View style={styles.agreement}><Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }} hitSlop={4} onPress={() => onChange(!checked)} style={styles.agreementToggle}><View style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkmark}>{checked ? "✓" : ""}</Text></View><Text style={styles.agreementText}>{label}</Text></Pressable><Pressable accessibilityRole="link" accessibilityLabel={`${linkLabel}, opens in browser`} onPress={() => Linking.openURL(url)} style={styles.legalLink}><Text style={styles.legalLinkText}>{linkLabel}</Text></Pressable></View>; }
function Button({ label, onPress, primary, danger, disabled, loading }: any) { const inactive=Boolean(disabled||loading); return <Pressable accessibilityRole="button" accessibilityState={{ disabled: inactive, busy:Boolean(loading) }} disabled={inactive} onPress={onPress} style={({pressed})=>[styles.button, primary && styles.primary, danger && styles.danger, inactive && styles.disabled, pressed&&styles.pressed]}>{loading&&<ActivityIndicator size="small" color={primary?"#19140d":"#f5f2e9"}/>}<Text style={[styles.buttonText, primary && styles.primaryText]}>{loading?"Working…":label}</Text></Pressable>; }
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#10140f"},keyboard:{flex:1},page:{width:"100%",maxWidth:820,alignSelf:"center",padding:20,paddingBottom:44,gap:14},wrap:{flexGrow:1,justifyContent:"center",padding:22},card:{width:"100%",maxWidth:540,alignSelf:"center",gap:14,padding:24,borderRadius:Platform.OS==="ios"?24:20,backgroundColor:"#182019",borderWidth:1,borderColor:"#2d3b2d"},
  header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},eyebrow:{color:"#d0a65d",letterSpacing:2,textTransform:"uppercase",fontSize:12},title:{color:"#f0f3ea",fontSize:28,fontWeight:"800"},section:{gap:10,padding:18,borderRadius:Platform.OS==="ios"?20:16,backgroundColor:"#182019",borderWidth:1,borderColor:"#2d3b2d"},sectionTitle:{color:"#f0f3ea",fontSize:18,fontWeight:"800"},label:{color:"#d0a65d",fontSize:12,textTransform:"uppercase",marginTop:4},value:{color:"#f0f3ea",fontSize:16},input:{minHeight:48,color:"#f0f3ea",backgroundColor:"#0f140f",borderRadius:14,padding:14,borderWidth:1,borderColor:"#344333",fontSize:16},forgotPasswordLink:{alignSelf:"flex-end",minHeight:44,height:Platform.OS==="android"?48:44,justifyContent:"center",marginTop:-8},forgotPasswordText:{color:"#d0a65d",fontSize:13,fontWeight:"700"},agreements:{gap:14,paddingVertical:8},agreementsTitle:{color:"#d0a65d",fontSize:12,fontWeight:"800",letterSpacing:1.5,textTransform:"uppercase"},agreement:{gap:2},agreementToggle:{minHeight:48,flexDirection:"row",alignItems:"center",gap:12},checkbox:{width:24,height:24,borderWidth:2,borderColor:"#82907e",borderRadius:5,alignItems:"center",justifyContent:"center"},checkboxChecked:{backgroundColor:"#d0a65d",borderColor:"#d0a65d"},checkmark:{color:"#19140d",fontWeight:"900"},agreementText:{flex:1,color:"#f0f3ea",lineHeight:20},legalLink:{minHeight:48,alignSelf:"flex-start",justifyContent:"center",marginLeft:36,paddingHorizontal:4},legalLinkText:{color:"#d0a65d",fontWeight:"700",textDecorationLine:"underline"},meta:{color:"#a8b5a2",lineHeight:20},button:{minHeight:48,paddingHorizontal:16,paddingVertical:12,borderRadius:Platform.OS==="ios"?14:12,backgroundColor:"#283329",borderWidth:1,borderColor:"#3b4b3a",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8},primary:{backgroundColor:"#d0a65d",borderColor:"#e5c682"},danger:{backgroundColor:"#9b493e",borderColor:"#bd6b5d"},disabled:{opacity:.45},pressed:{opacity:.76,transform:[{scale:.985}]},buttonText:{color:"#f5f2e9",fontWeight:"700",textAlign:"center"},primaryText:{color:"#19140d"}
});
