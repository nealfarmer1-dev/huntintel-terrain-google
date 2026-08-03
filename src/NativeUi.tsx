import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export const nativeTheme = {
  background: "#0d120e",
  surface: "#182019",
  surfaceRaised: "#202a20",
  border: "#334333",
  text: "#f0f3ea",
  muted: "#a8b5a2",
  accent: "#d0a65d",
  success: "#8ab182",
  danger: "#d68375",
};

export function AppLoadingScreen({ message = "Restoring your secure HuntIntel session…" }: { message?: string }) {
  return <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={message}>
    <View style={styles.loadingMark}><Ionicons name="map-outline" size={30} color={nativeTheme.accent} /></View>
    <ActivityIndicator size="large" color={nativeTheme.accent} />
    <Text style={styles.title}>HuntIntel Terrain</Text>
    <Text style={styles.message}>{message}</Text>
  </View>;
}

export function ErrorState({ message, title = "Unable to continue", onRetry, onCancel }: { message: string; title?: string; onRetry?: () => void; onCancel?: () => void }) {
  return <View style={styles.state} accessibilityRole="alert">
    <View style={[styles.stateIcon, styles.errorIcon]}><Ionicons name="alert-circle-outline" size={26} color={nativeTheme.danger} /></View>
    <Text style={styles.stateTitle}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    <View style={styles.actionRow}>{onRetry && <PrimaryButton label="Try Again" onPress={onRetry} />}{onCancel && <SecondaryButton label="Cancel" onPress={onCancel} />}</View>
  </View>;
}

export function EmptyState({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.state}>
    <View style={styles.stateIcon}><Ionicons name="map-outline" size={26} color={nativeTheme.accent} /></View>
    <Text style={styles.stateTitle}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {actionLabel && onAction && <PrimaryButton label={actionLabel} onPress={onAction} />}
  </View>;
}

function ButtonContent({ label, loading, loadingLabel, color }: { label: string; loading?: boolean; loadingLabel?: string; color: string }) {
  return <View style={styles.buttonContent}>{loading && <ActivityIndicator size="small" color={color} />}<Text style={[styles.buttonText, { color }]}>{loading ? loadingLabel || `${label}…` : label}</Text></View>;
}

export function PrimaryButton({ label, onPress, disabled = false, loading = false, loadingLabel, accessibilityLabel, accessibilityHint }: ButtonProps) {
  const inactive = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.button, styles.primary, inactive && styles.disabled, pressed && styles.pressed]}>
    <ButtonContent label={label} loading={loading} loadingLabel={loadingLabel} color="#19140d" />
  </Pressable>;
}

export function SecondaryButton({ label, onPress, disabled = false, loading = false, loadingLabel, accessibilityLabel, accessibilityHint }: ButtonProps) {
  const inactive = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.button, inactive && styles.disabled, pressed && styles.pressed]}>
    <ButtonContent label={label} loading={loading} loadingLabel={loadingLabel} color={nativeTheme.text} />
  </Pressable>;
}

export function DestructiveButton({ label, onPress, disabled = false, loading = false, loadingLabel }: ButtonProps) {
  const inactive = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.button, styles.destructive, inactive && styles.disabled, pressed && styles.pressed]}>
    <ButtonContent label={label} loading={loading} loadingLabel={loadingLabel} color="#fff8f5" />
  </Pressable>;
}

export function SectionCard({ title, caption, children }: { title?: string; caption?: string; children: React.ReactNode }) {
  return <View style={styles.card}>{title && <Text style={styles.cardTitle}>{title}</Text>}{caption && <Text style={styles.cardCaption}>{caption}</Text>}{children}</View>;
}

export function StatusBanner({ message, tone = "neutral" }: { message: string; tone?: "neutral" | "success" | "error" }) {
  return <View accessibilityLiveRegion="polite" style={[styles.banner, tone === "success" && styles.bannerSuccess, tone === "error" && styles.bannerError]}>
    <Ionicons name={tone === "success" ? "checkmark-circle-outline" : tone === "error" ? "alert-circle-outline" : "information-circle-outline"} size={20} color={tone === "success" ? nativeTheme.success : tone === "error" ? nativeTheme.danger : nativeTheme.accent} />
    <Text style={styles.bannerText}>{message}</Text>
  </View>;
}

export function LayerSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" statusBarTranslucent={Platform.OS === "android"} onRequestClose={onClose}>
    <View style={styles.sheetOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close map layers" style={styles.sheetDismiss} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Map Layers</Text><Text style={styles.sheetSubtitle}>Choose what appears on the terrain map.</Text></View><SecondaryButton label="Done" onPress={onClose} /></View>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}

const platformRadius = Platform.select({ ios: 18, android: 16, default: 16 });
const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: nativeTheme.background },
  loadingMark: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: nativeTheme.surface, borderWidth: 1, borderColor: nativeTheme.border, marginBottom: 6 },
  title: { color: nativeTheme.text, fontSize: 24, fontWeight: "800" },
  message: { color: nativeTheme.muted, fontSize: 15, lineHeight: 22, textAlign: "center", flexShrink: 1, maxWidth: 460 },
  state: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10, padding: 24, borderRadius: platformRadius, backgroundColor: nativeTheme.surface, borderWidth: 1, borderColor: nativeTheme.border },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#27271c" },
  errorIcon: { backgroundColor: "#2a1c18" },
  stateTitle: { color: nativeTheme.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 6 },
  button: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 11, borderRadius: Platform.select({ ios: 14, android: 12, default: 12 }), backgroundColor: "#283329", borderWidth: 1, borderColor: "#3a4a39" },
  primary: { backgroundColor: nativeTheme.accent, borderColor: "#e5c682" },
  destructive: { backgroundColor: "#944c42", borderColor: "#bd6b5d" },
  disabled: { opacity: .45 },
  pressed: { opacity: .78, transform: [{ scale: .985 }] },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  card: { gap: 10, padding: 18, borderRadius: platformRadius, backgroundColor: nativeTheme.surface, borderWidth: 1, borderColor: nativeTheme.border },
  cardTitle: { color: nativeTheme.text, fontSize: 18, fontWeight: "800" },
  cardCaption: { color: nativeTheme.muted, fontSize: 14, lineHeight: 20 },
  banner: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "#24251a", borderWidth: 1, borderColor: "#4b4630" },
  bannerSuccess: { backgroundColor: "#17251a", borderColor: "#355239" },
  bannerError: { backgroundColor: "#291c18", borderColor: "#5a3029" },
  bannerText: { flex: 1, color: nativeTheme.text, lineHeight: 20 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.58)" },
  sheetDismiss: { flex: 1 },
  sheet: { maxHeight: "82%", minHeight: 320, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: nativeTheme.border, backgroundColor: "#111714", paddingTop: 8, paddingBottom: Platform.OS === "ios" ? 18 : 8 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#647361", alignSelf: "center", marginBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, gap: 12 },
  sheetTitle: { color: nativeTheme.text, fontSize: 22, fontWeight: "900" },
  sheetSubtitle: { color: nativeTheme.muted, marginTop: 3, maxWidth: 260 },
  sheetContent: { padding: 18, paddingBottom: 32 },
});
