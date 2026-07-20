import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type LibraryItem = {
  analysisJobId: string;
  name: string;
  analysisMode: string;
  acreage: number | null;
  status: string;
  createdAt: string | null;
  mapPreview: { type: "Polygon"; coordinates: number[][][] } | null;
  topFinding: string | null;
  waypointCount: number;
  accessRole: string;
};

type Library = { items: LibraryItem[]; page: number; pageSize: number; total: number; ownedTotal: number; limit: number; totalPages: number };
type Props = { library: Library | null; loading: boolean; error: string; offlinePackages?: any[]; offlineStatus?: string; downloadingId?: string; onPage: (page: number) => void; onOpen: (id: string) => void; onNew: () => void; onDelete: (ids: string[]) => Promise<boolean>; onReturnCurrent?: () => void; onDownload?: (id: string) => void; onCancel?: () => void; onSync?: (id: string) => void; onRemove?: (id: string) => void };

function BoundaryPreview({ polygon }: { polygon: LibraryItem["mapPreview"] }) {
  const ring = polygon?.coordinates?.[0] || [];
  if (ring.length < 3) return <View style={styles.preview}><Text style={styles.meta}>Map preview unavailable</Text></View>;
  const lons = ring.map((point) => point[0]); const lats = ring.map((point) => point[1]);
  const bounds = { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  return <View style={styles.preview}>{ring.slice(0, -1).map(([lon, lat], index) => {
    const left = 8 + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1)) * 244;
    const top = 82 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * 74;
    return <View key={index} style={[styles.vertex, { left, top }]} />;
  })}</View>;
}

export function LibraryScreen({ library, loading, error, offlinePackages = [], offlineStatus, downloadingId, onPage, onOpen, onNew, onDelete, onReturnCurrent, onDownload, onCancel, onSync, onRemove }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => { const available = new Set((library?.items || []).filter((item) => item.accessRole === "owner").map((item) => item.analysisJobId)); setSelected((current) => new Set([...current].filter((id) => available.has(id)))); }, [library?.page, library?.items]);
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const remove = async (ids: string[]) => { if (await onDelete(ids)) setSelected(new Set()); };
  return <View style={styles.card}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>Saved terrain intelligence</Text><Text style={styles.title}>My Analyses</Text><Text style={styles.count}>Saved Analyses: {library?.ownedTotal || 0} / {library?.limit || 150}</Text></View><View style={styles.actions}>{onReturnCurrent && <Button label="Return to Current Analysis" onPress={onReturnCurrent} />}<Button label="New Analysis" onPress={onNew} /></View></View>
    <Text style={styles.meta}>Engine findings, geometries, reports, and waypoints are read-only.</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!offlineStatus && <Text style={styles.meta}>{offlineStatus}</Text>}
    {!loading && !!library?.items.length && <Button label={`Delete Selected (${selected.size})`} disabled={!selected.size} onPress={() => { void remove([...selected]); }} />}
    {loading ? <Text style={styles.meta}>Loading analyses…</Text> : !library?.items.length ? <Text style={styles.meta}>No saved analyses yet.</Text> : library.items.map((item) => <View key={item.analysisJobId} style={styles.analysisCard}>
      <BoundaryPreview polygon={item.mapPreview} />
      <View style={styles.body}><View style={styles.heading}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.badge}>{item.accessRole}</Text></View>
      <Text style={styles.meta}>{item.analysisMode.split("_").join(" ")} · {item.acreage == null ? "Acreage unavailable" : `${item.acreage.toLocaleString()} acres`}</Text>
      <Text style={styles.meta}>{item.status} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Date unavailable"}</Text>
      <Text style={styles.finding}>{item.topFinding || "Deterministic terrain analysis ready for review."}</Text><Text style={styles.meta}>{item.waypointCount} waypoints</Text>
      {item.accessRole === "owner" && <View style={styles.actions}><Button label={selected.has(item.analysisJobId) ? "Selected" : "Select"} onPress={() => toggle(item.analysisJobId)} /><Button label="Delete" onPress={() => { void remove([item.analysisJobId]); }} /></View>}<Button label="Open Analysis" primary onPress={() => onOpen(item.analysisJobId)} />{(() => { const saved: any = offlinePackages.find((value: any) => value.analysisJobId === item.analysisJobId); const downloading = downloadingId === item.analysisJobId; return <><Text style={styles.meta}>{saved ? `Offline v${saved.packageVersion} · ${saved.pending?.length || 0} pending · ${saved.progress}%` : "Online only"}</Text><Button label={downloading ? "Cancel Download" : saved ? "Resume / Update" : "Download for Offline"} onPress={() => downloading ? onCancel?.() : onDownload?.(item.analysisJobId)} />{saved && <><Button label="Sync Pending Changes" onPress={() => onSync?.(item.analysisJobId)} /><Button label="Remove Download" onPress={() => onRemove?.(item.analysisJobId)} /></>}</>; })()}</View>
    </View>)}
    {!!library && library.totalPages > 1 && <View style={styles.pager}><Button label="Previous" disabled={library.page <= 1} onPress={() => onPage(library.page - 1)} /><Text style={styles.meta}>Page {library.page} of {library.totalPages}</Text><Button label="Next" disabled={library.page >= library.totalPages} onPress={() => onPage(library.page + 1)} /></View>}
  </View>;
}
function Button({ label, onPress, primary, disabled }: any) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({
  card: { backgroundColor: "#182019", borderRadius: 24, padding: 18, gap: 14 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  eyebrow: { color: "#d0a65d", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 11 },
  title: { color: "#f0f3ea", fontWeight: "800", fontSize: 25 }, count: { color: "#d0a65d", fontWeight: "700", marginTop: 6 }, actions: { gap: 8, alignItems: "stretch" },
  analysisCard: { overflow: "hidden", borderRadius: 18, backgroundColor: "#0f140f", borderWidth: 1, borderColor: "#344333" },
  preview: { height: 96, backgroundColor: "#263726", position: "relative", overflow: "hidden" },
  vertex: { position: "absolute", width: 8, height: 8, borderRadius: 8, backgroundColor: "#e6c27a", borderWidth: 1, borderColor: "#6e5124" },
  body: { padding: 14, gap: 8 }, itemTitle: { color: "#f0f3ea", fontWeight: "700", fontSize: 17, flex: 1 },
  badge: { color: "#8ab182", textTransform: "capitalize", fontSize: 12 }, meta: { color: "#9cab97" }, finding: { color: "#e3e8dd" }, error: { color: "#d68375" },
  button: { backgroundColor: "#283329", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }, primary: { backgroundColor: "#d0a65d" }, disabled: { opacity: .4 }, buttonText: { color: "#f5f2e9", fontWeight: "700" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
});
