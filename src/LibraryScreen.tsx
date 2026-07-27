import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { pendingStatusLabel } from "./payment-recovery";
import { EmptyState } from "./NativeUi";

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
type Props = { library: Library | null; pendingAnalyses?:any[]; loading: boolean; error: string; offlinePackages?: any[]; offlineStatus?: string; downloadingId?: string; onPage: (page: number) => void; onOpen: (id: string) => void; onResumePending?:(item:any)=>void; onNew: () => void; onDelete: (ids: string[]) => Promise<boolean>; onReturnCurrent?: () => void; onDownload?: (id: string) => void; onCancel?: () => void; onSync?: (id: string) => void; onRemove?: (id: string) => void };

const PREVIEW_HEIGHT = 96;
const PREVIEW_PADDING = 8;

function BoundaryPreview({ polygon }: { polygon: LibraryItem["mapPreview"] }) {
  const ring = polygon?.coordinates?.[0] || [];
  const [previewWidth, setPreviewWidth] = useState(0);
  const valid = ring.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  const last = valid[valid.length - 1];
  const points = valid.length > 1 && valid[0][0] === last[0] && valid[0][1] === last[1] ? valid.slice(0, -1) : valid;
  if (points.length < 3) return <View style={styles.preview}><Text style={styles.meta}>Map preview unavailable</Text></View>;
  const lons = points.map((point) => point[0]); const lats = points.map((point) => point[1]);
  const bounds = { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  const drawableWidth = Math.max(1, previewWidth - PREVIEW_PADDING * 2);
  const drawableHeight = PREVIEW_HEIGHT - PREVIEW_PADDING * 2;
  const projected = points.map(([lon, lat]) => ({
    left: PREVIEW_PADDING + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1)) * drawableWidth,
    top: PREVIEW_PADDING + (1 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1))) * drawableHeight,
  }));
  return <View style={styles.preview} onLayout={(event) => setPreviewWidth(event.nativeEvent.layout.width)}>
    {previewWidth > 0 && projected.map((point, index) => {
      const next = projected[(index + 1) % projected.length];
      const width = Math.hypot(next.left - point.left, next.top - point.top);
      const angle = Math.atan2(next.top - point.top, next.left - point.left);
      return <View key={`edge-${index}`} style={[styles.boundaryEdge, { left: (point.left + next.left - width) / 2, top: (point.top + next.top) / 2 - 1, width, transform: [{ rotate: `${angle}rad` }] }]} />;
    })}
    {previewWidth > 0 && projected.map((point, index) => <View key={`vertex-${index}`} style={[styles.vertex, { left: point.left - 4, top: point.top - 4 }]} />)}
  </View>;
}

export function LibraryScreen({ library, pendingAnalyses=[], loading, error, offlinePackages = [], offlineStatus, downloadingId, onPage, onOpen, onResumePending, onNew, onDelete, onReturnCurrent, onDownload, onCancel, onSync, onRemove }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => { const available = new Set((library?.items || []).filter((item) => item.accessRole === "owner").map((item) => item.analysisJobId)); setSelected((current) => new Set([...current].filter((id) => available.has(id)))); }, [library?.page, library?.items]);
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const remove = async (ids: string[]) => { if (await onDelete(ids)) setSelected(new Set()); };
  return <View style={styles.card}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>Saved terrain intelligence</Text><Text style={styles.title}>My Analyses</Text><Text style={styles.count}>Saved Analyses: {library?.ownedTotal || 0} / {library?.limit || 150}</Text></View><View style={styles.actions}>{onReturnCurrent && <Button label="Return to Current Analysis" onPress={onReturnCurrent} />}<Button label="New Analysis" onPress={onNew} /></View></View>
    <Text style={styles.meta}>Engine findings, geometries, reports, and waypoints are read-only.</Text>
    {!!error && <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button label="Retry" onPress={() => onPage(library?.page || 1)} /></>}
    {!!offlineStatus && <Text style={styles.meta}>{offlineStatus}</Text>}
    {!!pendingAnalyses.length&&<View style={styles.pending}><Text style={styles.itemTitle}>Pending Analyses</Text>{pendingAnalyses.map(item=><View key={item.draft.draftId} style={styles.pendingItem}><Text style={styles.itemTitle}>{item.draft.analysisName||"Terrain Analysis"}</Text><Text style={styles.meta}>{pendingStatusLabel(item)}</Text><Text style={styles.meta}>{Number(item.draft.acreage).toLocaleString()} acres · Payment confirmed</Text><Button label="Resume or retry analysis" primary onPress={()=>onResumePending?.(item)}/></View>)}</View>}
    {!loading && selected.size > 0 && <View accessibilityLiveRegion="polite" style={styles.selectionBar}><Text style={styles.selectionText}>{selected.size} {selected.size === 1 ? "analysis" : "analyses"} selected for deletion</Text><View style={styles.selectionActions}><Button label="Clear Selection" onPress={() => setSelected(new Set())} /><Button label={`Delete Selected (${selected.size})`} danger onPress={() => { void remove([...selected]); }} /></View></View>}
    {loading ? <View accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color="#d0a65d" /><Text style={styles.meta}>Loading analyses…</Text></View> : !library?.items.length ? <EmptyState title="No analyses yet" message="Create your first terrain analysis to keep maps, findings, reports, and waypoints ready for the field." actionLabel="Create Analysis" onAction={onNew} /> : library.items.map((item) => <View key={item.analysisJobId} style={styles.analysisCard}>
      <BoundaryPreview polygon={item.mapPreview} />
      <View style={styles.body}><View style={styles.heading}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.badge}>{item.accessRole}</Text></View>
      <Text style={styles.meta}>{item.analysisMode.split("_").join(" ")} · {item.acreage == null ? "Acreage unavailable" : `${item.acreage.toLocaleString()} acres`}</Text>
      <Text style={styles.meta}>{item.status} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Date unavailable"}</Text>
      <Text style={styles.finding}>{item.topFinding || "Deterministic terrain analysis ready for review."}</Text><Text style={styles.meta}>{item.waypointCount} waypoints</Text>
      {item.accessRole === "owner" && <View style={styles.actions}><Button label={selected.has(item.analysisJobId) ? "Selected for Deletion" : "Select for Deletion"} selected={selected.has(item.analysisJobId)} accessibilityHint="Adds or removes this analysis from bulk deletion" onPress={() => toggle(item.analysisJobId)} /><Button label="Delete Analysis" danger onPress={() => { void remove([item.analysisJobId]); }} /></View>}<Button label="Open Analysis" primary onPress={() => onOpen(item.analysisJobId)} />{(() => { const saved: any = offlinePackages.find((value: any) => value.analysisJobId === item.analysisJobId); const downloading = downloadingId === item.analysisJobId; return <><Text style={styles.meta}>{saved ? `Offline v${saved.packageVersion} · ${saved.pending?.length || 0} pending · ${saved.progress}%` : "Online only"}</Text><Button label={downloading ? "Cancel Download" : saved ? "Resume / Update" : "Download for Offline"} onPress={() => downloading ? onCancel?.() : onDownload?.(item.analysisJobId)} />{saved && <><Button label="Sync Pending Changes" onPress={() => onSync?.(item.analysisJobId)} /><Button label="Remove Download" onPress={() => onRemove?.(item.analysisJobId)} /></>}</>; })()}</View>
    </View>)}
    {!!library && library.totalPages > 1 && <View style={styles.pager}><Button label="Previous" disabled={library.page <= 1} onPress={() => onPage(library.page - 1)} /><Text style={styles.meta}>Page {library.page} of {library.totalPages}</Text><Button label="Next" disabled={library.page >= library.totalPages} onPress={() => onPage(library.page + 1)} /></View>}
  </View>;
}
function Button({ label, onPress, primary, danger, selected, disabled, accessibilityHint }: any) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{disabled:Boolean(disabled),selected:Boolean(selected)}} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, danger && styles.danger, selected && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({
  card: { backgroundColor: "#182019", borderRadius: 24, padding: 18, gap: 14, borderWidth: 1, borderColor: "#31412d", width: "100%", maxWidth: 900, alignSelf: "center" },
  heading: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  eyebrow: { color: "#d0a65d", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 11 },
  title: { color: "#f0f3ea", fontWeight: "800", fontSize: 25 }, count: { color: "#d0a65d", fontWeight: "700", marginTop: 6 }, actions: { gap: 8, alignItems: "stretch" },
  analysisCard: { overflow: "hidden", borderRadius: 18, backgroundColor: "#0f140f", borderWidth: 1, borderColor: "#344333" },
  pending:{gap:10,backgroundColor:"#24251a",borderColor:"#d0a65d",borderWidth:1,borderRadius:16,padding:14},pendingItem:{gap:6,borderTopColor:"#4a4933",borderTopWidth:1,paddingTop:10},
  preview: { height: PREVIEW_HEIGHT, backgroundColor: "#263726", position: "relative", overflow: "hidden" },
  boundaryEdge: { position: "absolute", height: 2, borderRadius: 1, backgroundColor: "#e6c27a" },
  vertex: { position: "absolute", width: 8, height: 8, borderRadius: 8, backgroundColor: "#e6c27a", borderWidth: 1, borderColor: "#6e5124" },
  body: { padding: 14, gap: 8 }, itemTitle: { color: "#f0f3ea", fontWeight: "700", fontSize: 17, flex: 1 },
  badge: { color: "#8ab182", textTransform: "capitalize", fontSize: 12 }, meta: { color: "#9cab97" }, finding: { color: "#e3e8dd" }, error: { color: "#d68375" },
  button: { backgroundColor: "#283329", borderRadius: 12, minHeight: 48, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#3b4b3a" }, primary: { backgroundColor: "#d0a65d", borderColor: "#e5c682" }, danger: { backgroundColor: "#713c35", borderColor: "#a65c50" }, selected: { borderColor: "#e5c682", borderWidth: 2 }, disabled: { opacity: .4 }, pressed: { opacity: .76, transform: [{ scale: .985 }] }, buttonText: { color: "#f5f2e9", fontWeight: "700", textAlign: "center" }, primaryText: { color: "#19140d" },
  selectionBar: { gap: 10, padding: 12, borderRadius: 14, backgroundColor: "#2b251b", borderWidth: 1, borderColor: "#705c39" }, selectionText: { color: "#f0d293", fontWeight: "800" }, selectionActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  loading: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 12 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
});
