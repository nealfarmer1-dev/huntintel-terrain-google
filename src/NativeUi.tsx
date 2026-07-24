import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export function AppLoadingScreen({ message = "Restoring your secure HuntIntel session…" }: { message?: string }) {
  return <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={message}>
    <ActivityIndicator size="large" color="#d0a65d" />
    <Text style={styles.title}>HuntIntel Terrain</Text>
    <Text style={styles.message}>{message}</Text>
  </View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.state} accessibilityRole="alert">
    <Text style={styles.stateTitle}>Something went wrong</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry && <PrimaryButton label="Try Again" onPress={onRetry} />}
  </View>;
}

export function EmptyState({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.state}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.message}>{message}</Text>{actionLabel && onAction && <PrimaryButton label={actionLabel} onPress={onAction} />}</View>;
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, styles.primary, disabled && styles.disabled]}><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

export function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

export function LayerSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.sheetOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close layers" style={styles.sheetDismiss} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Map Layers</Text><SecondaryButton label="Done" onPress={onClose} /></View>
        <ScrollView contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: "#10140f" },
  title: { color: "#f0f3ea", fontSize: 24, fontWeight: "800" },
  message: { color: "#a8b5a2", lineHeight: 21, textAlign: "center", flexShrink: 1 },
  state: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: 10, padding: 20, borderRadius: 16, backgroundColor: "#151d16" },
  stateTitle: { color: "#f0f3ea", fontSize: 18, fontWeight: "800", textAlign: "center" },
  button: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, borderRadius: 14, backgroundColor: "#283329" },
  primary: { backgroundColor: "#d0a65d" }, disabled: { opacity: .45 },
  buttonText: { color: "#f5f2e9", fontWeight: "800" }, primaryText: { color: "#19140d", fontWeight: "900" },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.48)" },
  sheetDismiss: { flex: 1 },
  sheet: { maxHeight: "76%", minHeight: 280, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: "#31412d", backgroundColor: "#111714", paddingTop: 8 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#52624f", alignSelf: "center", marginBottom: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, gap: 12 },
  sheetTitle: { color: "#f0f3ea", fontSize: 22, fontWeight: "900" },
  sheetContent: { padding: 18, paddingBottom: 32 },
});
