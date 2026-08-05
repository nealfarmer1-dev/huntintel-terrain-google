import React, { useEffect, useState } from "react";
import { BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SecondaryButton, nativeTheme } from "./NativeUi";
import {
  GETTING_STARTED_ARTICLES,
  PRIVACY_URL,
  PUBLIC_SUPPORT_URL,
  SUPPORT_ACTIONS,
  SUPPORT_EMAIL,
  SUPPORT_FAQS,
  SUPPORT_VIDEO,
  TERMS_URL,
  TROUBLESHOOTING_ITEMS,
  createSupportMailto,
  toggleExpandedId,
  tryOpenExternalUrl,
} from "./support-content";

export function HelpSupportScreen({ onClose }: { onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);

  const openUrl = async (url: string, type: "mail" | "video" | "web" | "legal") => {
    setLinkError("");
    const opened = await tryOpenExternalUrl(Linking, url);
    if (opened) return;
    setLinkError(type === "mail"
      ? `A mail application could not be opened. Copy or type ${SUPPORT_EMAIL} to contact support.`
      : type === "video"
        ? "The video could not be opened on this device. Try the public Help & Support page instead."
        : "This link could not be opened on this device. Try again when a browser is available.");
  };

  const toggle = (id: string) => setExpandedId((current) => toggleExpandedId(current, id));

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>HuntIntel Support</Text><Text accessibilityRole="header" style={styles.title}>HuntIntel Terrain Intelligence Help &amp; Support</Text></View>
        <SecondaryButton label="Back" accessibilityLabel="Close Help and Support" onPress={onClose} />
      </View>
      <Text style={styles.subtitle}>Get help creating and using terrain analyses, managing offline field tools, recording breadcrumbs, working with teams, and using Live SAR features.</Text>
      <Text style={styles.body}>Start with the quick answers and walkthrough below. For account-specific help, bug reports, purchase questions, or feature requests, contact HuntIntel Support.</Text>

      {!!linkError && <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBanner}><Text style={styles.errorText}>{linkError}</Text></View>}

      <SupportSection title="Contact and Support Actions">
        <Text style={styles.body}>Email</Text><Text selectable style={styles.email}>{SUPPORT_EMAIL}</Text>
        <Text style={styles.meta}>The address remains visible so you can copy or type it if a mail application is unavailable.</Text>
        {SUPPORT_ACTIONS.map((action) => <SupportButton key={action.id} label={action.label} accessibilityHint={`Opens a prefilled email to ${SUPPORT_EMAIL}`} onPress={() => { void openUrl(createSupportMailto(action), "mail"); }} />)}
      </SupportSection>

      <SupportSection title="Quick Start">
        <Text style={styles.cardTitle}>{SUPPORT_VIDEO.title}</Text>
        <Text style={styles.body}>{SUPPORT_VIDEO.description}</Text>
        <SupportButton label="Watch Creating a Terrain Analysis" accessibilityHint="Opens the video in YouTube or a browser" primary onPress={() => { void openUrl(SUPPORT_VIDEO.url, "video"); }} />
        <SupportButton label="Open Public Help Website" accessibilityHint="Opens terrain.huntintelapp.com in a browser" onPress={() => { void openUrl(PUBLIC_SUPPORT_URL, "web"); }} />
        <Text selectable style={styles.url}>{PUBLIC_SUPPORT_URL}</Text>
      </SupportSection>

      <SupportSection title="Getting Started">
        {GETTING_STARTED_ARTICLES.map((article) => <ExpandableItem
          key={article.id}
          id={`article-${article.id}`}
          title={article.title}
          expanded={expandedId === `article-${article.id}`}
          onToggle={toggle}
        >
          {article.steps?.map((step, index) => <Text key={step} style={styles.body}>{index + 1}. {step}</Text>)}
          {article.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}
        </ExpandableItem>)}
      </SupportSection>

      <SupportSection title="Frequently Asked Questions">
        {SUPPORT_FAQS.map((faq) => <ExpandableItem
          key={faq.id}
          id={`faq-${faq.id}`}
          title={faq.question}
          expanded={expandedId === `faq-${faq.id}`}
          onToggle={toggle}
        ><Text style={styles.body}>{faq.answer}</Text></ExpandableItem>)}
      </SupportSection>

      <SupportSection title="Before Contacting Support">
        {TROUBLESHOOTING_ITEMS.map((item) => <View key={item} style={styles.bulletRow}><Text style={styles.bullet}>✓</Text><Text style={styles.bulletText}>{item}</Text></View>)}
      </SupportSection>

      <SupportSection title="Safety and Field Use" warning>
        <Text style={styles.body}>HuntIntel Terrain provides planning and decision-support information. Terrain data, map layers, GPS readings, AI-generated analysis, waypoints, distances, bearings, and offline content may contain errors, delays, or incomplete information.</Text>
        <Text style={styles.body}>Always verify property access, land ownership, boundaries, weather, hazards, terrain conditions, regulations, and emergency procedures using authoritative sources.</Text>
        <Text style={styles.body}>HuntIntel Terrain does not replace professional judgment, navigation equipment, emergency services, incident command, or search-and-rescue training.</Text>
        <Text style={styles.body}>For an emergency in the United States, contact 911 or the appropriate local emergency authority.</Text>
      </SupportSection>

      <SupportSection title="Developer Contact">
        <Text style={styles.cardTitle}>HuntIntel LLC</Text>
        <Text style={styles.body}>Support email:</Text><Text selectable style={styles.email}>{SUPPORT_EMAIL}</Text>
        <Text style={styles.body}>Use this email for application support, account questions, purchase assistance, bug reports, general feedback, and feature requests.</Text>
      </SupportSection>

      <SupportSection title="Legal">
        <SupportButton label="Terms of Use" accessibilityHint="Opens in a browser" onPress={() => { void openUrl(TERMS_URL, "legal"); }} />
        <SupportButton label="Privacy Policy" accessibilityHint="Opens in a browser" onPress={() => { void openUrl(PRIVACY_URL, "legal"); }} />
      </SupportSection>
    </ScrollView>
  </SafeAreaView>;
}

type SupportChild = React.ReactElement | false | null | undefined | SupportChild[];
type SupportChildren = SupportChild;

function SupportSection({ title, warning = false, children }: { title: string; warning?: boolean; children: SupportChildren }) {
  return <View style={[styles.section, warning && styles.warningSection]}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function SupportButton({ label, accessibilityHint, onPress, primary = false }: { label: string; accessibilityHint: string; onPress: () => void; primary?: boolean }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={accessibilityHint}
    onPress={onPress}
    style={({ pressed }) => [styles.button, primary && styles.primaryButton, pressed && styles.pressed]}
  ><Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text></Pressable>;
}

function ExpandableItem({ id, title, expanded, onToggle, children }: { id: string; title: string; expanded: boolean; onToggle: (id: string) => void; children: SupportChildren }) {
  return <View style={styles.expandable}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={`${expanded ? "Collapses" : "Expands"} this help item`}
      accessibilityState={{ expanded }}
      onPress={() => onToggle(id)}
      style={({ pressed }) => [styles.expandableHeader, pressed && styles.pressed]}
    ><Text style={styles.expandableTitle}>{title}</Text><Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.expandableIcon}>{expanded ? "−" : "+"}</Text></Pressable>
    {expanded && <View style={styles.expandableBody}>{children}</View>}
  </View>;
}

const radius = Platform.OS === "ios" ? 20 : 16;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: nativeTheme.background },
  page: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 52, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { marginBottom: 7, color: nativeTheme.accent, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { color: nativeTheme.text, fontSize: 30, fontWeight: "900" },
  subtitle: { color: nativeTheme.text, fontSize: 18, lineHeight: 26, fontWeight: "700" },
  section: { gap: 10, padding: 18, borderRadius: radius, backgroundColor: nativeTheme.surface, borderWidth: 1, borderColor: nativeTheme.border },
  warningSection: { borderColor: "#6b5937", backgroundColor: "#211f16" },
  sectionTitle: { marginBottom: 2, color: nativeTheme.text, fontSize: 21, fontWeight: "900" },
  cardTitle: { color: nativeTheme.text, fontSize: 17, fontWeight: "800" },
  body: { color: nativeTheme.muted, fontSize: 15, lineHeight: 22 },
  meta: { color: nativeTheme.muted, fontSize: 13, lineHeight: 19 },
  email: { color: nativeTheme.accent, fontSize: 17, lineHeight: 24, fontWeight: "800" },
  url: { color: nativeTheme.muted, fontSize: 12, lineHeight: 18 },
  errorBanner: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#6c392f", backgroundColor: "#291c18" },
  errorText: { color: "#f0a394", lineHeight: 21 },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: Platform.OS === "ios" ? 14 : 12, borderWidth: 1, borderColor: "#3b4b3a", backgroundColor: "#283329" },
  primaryButton: { borderColor: "#e5c682", backgroundColor: nativeTheme.accent },
  buttonText: { color: nativeTheme.text, fontWeight: "800", textAlign: "center" },
  primaryButtonText: { color: "#19140d" },
  pressed: { opacity: 0.76 },
  expandable: { overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: nativeTheme.border, backgroundColor: "#111714" },
  expandableHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  expandableTitle: { flex: 1, minWidth: 0, color: nativeTheme.text, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  expandableIcon: { color: nativeTheme.accent, fontSize: 22, fontWeight: "500" },
  expandableBody: { gap: 9, padding: 14, borderTopWidth: 1, borderTopColor: nativeTheme.border },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: { width: 18, color: nativeTheme.success, fontWeight: "900" },
  bulletText: { flex: 1, minWidth: 0, color: nativeTheme.muted, lineHeight: 21 },
});
