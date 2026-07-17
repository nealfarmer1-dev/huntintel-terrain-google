// @ts-nocheck -- Terrain DTO optional fields are runtime-validated by analysis-results helpers.
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FieldRecordsScreen } from "./FieldRecordsScreen";
import { NavigationPanel } from "./NavigationPanel";
import { entityGeometry, featureGroup, groupTerrainFeatures, navigationTarget, relatedWaypointIds, selectedEntity, sortResultEntities } from "./analysis-results";

const TABS = [["waypoints", "Waypoints"], ["features", "Terrain Features"], ["navigation", "Field Navigation"], ["records", "Notes & Attachments"]];

function Button({ label, onPress, selected = false, disabled = false, role = "button" }: any) {
  return <Pressable accessibilityRole={role} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[s.button, selected && s.selectedButton, disabled && s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}

function Detail({ entity, type, analysis, onSelect, onNavigate }: any) {
  if (!entity) return <View style={s.detail}><Text style={s.meta}>Select a {type === "waypoint" ? "waypoint" : "terrain feature"} to view its full details.</Text></View>;
  const geometry = entityGeometry(entity); const target = navigationTarget(entity);
  const related = type === "terrainFeature" ? relatedWaypointIds(entity.id, analysis.waypoints || []) : [];
  return <View style={s.detail} accessibilityLiveRegion="polite">
    <Text style={s.eyebrow}>SELECTED {type === "waypoint" ? "WAYPOINT" : "TERRAIN FEATURE"}</Text>
    <Text style={s.title}>{entity.title || entity.properties?.definitionLabel || entity.featureType || entity.id}</Text>
    <Text style={s.meta}>{entity.reason || entity.explanation || entity.properties?.confidenceReason || "No additional reasoning was returned."}</Text>
    <Text style={s.metric}>Score {Number(entity.score || 0).toFixed(1)} · Confidence {Number(entity.confidence || 0).toFixed(2)}</Text>
    <Text style={s.meta}>{geometry ? `Map geometry: ${geometry.type}` : "No map geometry is available for this result."}</Text>
    {!!related.length && <Text style={s.meta}>Explicitly related waypoints: {related.length}</Text>}
    <View style={s.row}><Button label="Show on map" disabled={!geometry} onPress={() => onSelect(type, entity.id, true)} /><Button label="Navigate" disabled={!target} onPress={() => onNavigate(entity)} /></View>
    {!target && <Text style={s.meta}>Navigation requires a valid point coordinate; no target was fabricated.</Text>}
  </View>;
}

export function AnalysisResultsTabs({ analysis, analysisJobId, resultsUi, setResultsUi, onSelect, onNavigate, navigationTargetEntity }: any) {
  const selected = selectedEntity(resultsUi, analysis);
  const waypoints = sortResultEntities(analysis.waypoints || [], resultsUi.waypointSort);
  const visibleWaypoints = waypoints.slice(0, resultsUi.waypointLimit);
  const groups = groupTerrainFeatures(analysis.features || []);

  const activate = (tab: string) => setResultsUi((current: any) => ({ ...current, activeResultsTab: tab }));
  const waypointPanel = <View style={s.panel}>
    <View style={s.row}><Button label="Priority / score" selected={resultsUi.waypointSort === "score"} onPress={() => setResultsUi((current: any) => ({ ...current, waypointSort: "score" }))} /><Button label="Confidence" selected={resultsUi.waypointSort === "confidence"} onPress={() => setResultsUi((current: any) => ({ ...current, waypointSort: "confidence" }))} /><Button label="Type" selected={resultsUi.waypointSort === "type"} onPress={() => setResultsUi((current: any) => ({ ...current, waypointSort: "type" }))} /></View>
    {visibleWaypoints.length ? visibleWaypoints.map((waypoint: any) => <Pressable key={waypoint.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === waypoint.id }} onPress={() => onSelect("waypoint", waypoint.id, true)} style={[s.resultRow, selected?.id === waypoint.id && s.selectedRow]}><View style={s.flex}><Text style={s.resultTitle}>{waypoint.title || waypoint.waypointType}</Text><Text style={s.meta}>{waypoint.waypointType || "waypoint"} · {waypoint.reason || "Waypoint recommendation."}</Text></View><Text style={s.score}>{Number(waypoint.score || 0).toFixed(1)}</Text></Pressable>) : <Text style={s.meta}>No waypoints returned.</Text>}
    {visibleWaypoints.length < waypoints.length && <Button label={`Show ${Math.min(20, waypoints.length - visibleWaypoints.length)} more`} onPress={() => setResultsUi((current: any) => ({ ...current, waypointLimit: current.waypointLimit + 20 }))} />}
    <Detail entity={resultsUi.selectedEntityType === "waypoint" ? selected : null} type="waypoint" analysis={analysis} onSelect={onSelect} onNavigate={onNavigate} />
  </View>;

  const featurePanel = <View style={s.panel}>
    <View style={s.row}><Button label="Priority / score" selected={resultsUi.featureSort === "score"} onPress={() => setResultsUi((current: any) => ({ ...current, featureSort: "score" }))} /><Button label="Confidence" selected={resultsUi.featureSort === "confidence"} onPress={() => setResultsUi((current: any) => ({ ...current, featureSort: "confidence" }))} /><Button label="Type" selected={resultsUi.featureSort === "type"} onPress={() => setResultsUi((current: any) => ({ ...current, featureSort: "type" }))} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}><Button label="Show all" selected={!resultsUi.activeCategoryFilter} onPress={() => setResultsUi((current: any) => ({ ...current, activeCategoryFilter: null }))} />{groups.map((group: any) => <Button key={group.id} label={`${group.label} (${group.items.length})`} selected={resultsUi.activeCategoryFilter === group.id} onPress={() => setResultsUi((current: any) => ({ ...current, activeCategoryFilter: group.id }))} />)}</ScrollView>
    {groups.length ? groups.map((group: any) => { const expanded = resultsUi.expandedFeatureGroups.includes(group.id); const items = sortResultEntities(group.items, resultsUi.featureSort); return <View key={group.id} style={s.group}><Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={s.groupHeader} onPress={() => setResultsUi((current: any) => { const next = new Set(current.expandedFeatureGroups); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return { ...current, expandedFeatureGroups: [...next] }; })}><Text style={s.resultTitle}>{group.label}</Text><Text style={s.score}>{items.length}</Text></Pressable>{expanded && items.map((feature: any) => <Pressable key={feature.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === feature.id }} onPress={() => onSelect("terrainFeature", feature.id, true)} style={[s.resultRow, selected?.id === feature.id && s.selectedRow]}><View style={s.flex}><Text style={s.resultTitle}>{feature.properties?.definitionLabel || feature.featureType || "Terrain feature"}</Text><Text style={s.meta}>{feature.explanation || feature.properties?.confidenceReason || "Terrain finding."}</Text></View><Text style={s.score}>{Number(feature.score || 0).toFixed(1)}</Text></Pressable>)}</View>; }) : <Text style={s.meta}>No terrain features returned.</Text>}
    <Detail entity={resultsUi.selectedEntityType === "terrainFeature" ? selected : null} type="terrainFeature" analysis={analysis} onSelect={onSelect} onNavigate={onNavigate} />
  </View>;

  return <View style={s.container}>
    <Text style={s.heading}>Interactive Results</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs} accessibilityRole="tablist">{TABS.map(([id, label]) => <Button key={id} role="tab" label={id === "waypoints" ? `${label} (${analysis.waypoints?.length || 0})` : id === "features" ? `${label} (${analysis.features?.length || 0})` : label} selected={resultsUi.activeResultsTab === id} onPress={() => activate(id)} />)}</ScrollView>
    <View style={resultsUi.activeResultsTab === "waypoints" ? undefined : s.hidden}>{waypointPanel}</View>
    <View style={resultsUi.activeResultsTab === "features" ? undefined : s.hidden}>{featurePanel}</View>
    <View style={resultsUi.activeResultsTab === "navigation" ? undefined : s.hidden}><NavigationPanel key={analysisJobId} analysisJobId={analysisJobId} waypoints={waypoints} selectedTarget={navigationTargetEntity} onSelectTarget={(waypoint:any)=>{onSelect("waypoint",waypoint.id,false);onNavigate(waypoint)}} /></View>
    <View style={resultsUi.activeResultsTab === "records" ? undefined : s.hidden}><FieldRecordsScreen key={analysisJobId} analysisJobId={analysisJobId} waypoints={waypoints.map(({ id, title }: any) => ({ id, title }))} /></View>
  </View>;
}

const s = StyleSheet.create({
  container: { marginTop: 16, gap: 10 },
  heading: { color: "#f0f3ea", fontSize: 22, fontWeight: "800" },
  tabs: { gap: 8, paddingVertical: 4 },
  panel: { gap: 10 },
  hidden: { display: "none" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  button: { backgroundColor: "#283329", borderWidth: 1, borderColor: "#3d4b3b", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999 },
  selectedButton: { backgroundColor: "#d0a65d", borderColor: "#fff2a8" },
  disabled: { opacity: .45 },
  buttonText: { color: "#f0f3ea", fontWeight: "700" },
  resultRow: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#344333", backgroundColor: "#111812" },
  selectedRow: { borderWidth: 3, borderColor: "#fff2a8" },
  flex: { flex: 1, gap: 3 },
  resultTitle: { color: "#f0f3ea", fontWeight: "800" },
  meta: { color: "#aab7a5", lineHeight: 19 },
  score: { color: "#f0d293", fontWeight: "900", fontSize: 16 },
  metric: { color: "#f0d293", fontWeight: "700" },
  detail: { gap: 8, padding: 14, borderWidth: 1, borderColor: "#344333", borderRadius: 16, backgroundColor: "#0d130e" },
  eyebrow: { color: "#d0a65d", fontSize: 11, letterSpacing: 1.4 },
  title: { color: "#f0f3ea", fontWeight: "800", fontSize: 19 },
  group: { borderWidth: 1, borderColor: "#344333", borderRadius: 14, overflow: "hidden", gap: 7 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", padding: 13, backgroundColor: "#202b21" },
});
