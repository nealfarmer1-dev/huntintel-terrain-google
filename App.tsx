import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createAnalysis, fetchAnalysis, terrainApiBaseUrl } from "./src/api";
import { buildPolygonFromPoints, calculateApproximateAcreage, getBounds, projectCoordinate, samplePoints } from "./src/terrain";
import type { TerrainAnalysisResponse, TerrainWaypoint } from "./src/terrain-contract";

const MIN_ACRES = 5;
const MAX_ACRES = 5000;
const MAP_WIDTH = 320;
const MAP_HEIGHT = 260;

type Screen = "setup" | "processing" | "results" | "report" | "waypoint";
type MapPoint = { longitude: number; latitude: number };

function sortWaypoints(waypoints: TerrainWaypoint[]) {
  return [...waypoints].sort((left, right) => right.score - left.score);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [analysisName, setAnalysisName] = useState("Weekend Test Property");
  const [savedAnalysisId, setSavedAnalysisId] = useState("");
  const [points, setPoints] = useState<MapPoint[]>(samplePoints());
  const [analysis, setAnalysis] = useState<TerrainAnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedWaypoint, setSelectedWaypoint] = useState<TerrainWaypoint | null>(null);

  const polygon = useMemo(() => buildPolygonFromPoints(points), [points]);
  const acreage = useMemo(() => (polygon ? Number(calculateApproximateAcreage(polygon).toFixed(2)) : 0), [polygon]);
  const isValid = acreage >= MIN_ACRES && acreage <= MAX_ACRES;

  const openSavedAnalysis = async () => {
    if (!savedAnalysisId.trim()) {
      setError("Enter an analysis job ID to reopen a saved analysis.");
      return;
    }

    try {
      setError("");
      setScreen("processing");
      const nextAnalysis = await fetchAnalysis(savedAnalysisId.trim());
      setAnalysis(nextAnalysis);
      setScreen("results");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load saved analysis.");
      setScreen("setup");
    }
  };

  const submit = async () => {
    if (!polygon) {
      setError("Draw three or more points or use the sample polygon.");
      return;
    }

    if (!isValid) {
      setError(`Polygon acreage must stay between ${MIN_ACRES} and ${MAX_ACRES} acres.`);
      return;
    }

    try {
      setError("");
      setScreen("processing");
      const nextAnalysis = await createAnalysis({
        species: "whitetail",
        saveResults: true,
        propertyId: analysisName,
        polygon,
      });
      setAnalysis(nextAnalysis);
      setSavedAnalysisId(nextAnalysis.analysisJobId || "");
      setScreen("results");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Terrain analysis failed.");
      setScreen("setup");
    }
  };

  const addPoint = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const longitude = -87.02 + (event.nativeEvent.locationX / MAP_WIDTH) * 0.36;
    const latitude = 32.45 + ((MAP_HEIGHT - event.nativeEvent.locationY) / MAP_HEIGHT) * 0.22;
    setPoints((current) => [...current, { longitude: Number(longitude.toFixed(6)), latitude: Number(latitude.toFixed(6)) }]);
  };

  const renderMap = () => {
    const nextPolygon = analysis?.summary ? polygon || buildPolygonFromPoints(samplePoints()) : polygon;
    if (!nextPolygon) {
      return null;
    }

    const features = analysis?.features || [];
    const waypoints = sortWaypoints(analysis?.waypoints || []);
    const bounds = getBounds(nextPolygon, waypoints, features);

    return (
      <Pressable style={styles.map} onPress={screen === "setup" ? addPoint : undefined}>
        {nextPolygon.coordinates[0].slice(0, -1).map((coordinate, index) => {
          const marker = projectCoordinate(coordinate, bounds, MAP_WIDTH, MAP_HEIGHT);
          return <View key={`polygon-${index}`} style={[styles.vertex, { left: marker.left - 6, top: marker.top - 6 }]} />;
        })}
        {screen !== "setup" &&
          features.map((feature) => {
            const marker = projectCoordinate(feature.geometry.coordinates, bounds, MAP_WIDTH, MAP_HEIGHT);
            return <View key={feature.id} style={[styles.featureDot, { left: marker.left - 5, top: marker.top - 5 }]} />;
          })}
        {screen !== "setup" &&
          waypoints.map((waypoint) => {
            const marker = projectCoordinate(waypoint.geometry.coordinates, bounds, MAP_WIDTH, MAP_HEIGHT);
            return <View key={waypoint.id} style={[styles.waypointDot, { left: marker.left - 5, top: marker.top - 5 }]} />;
          })}
      </Pressable>
    );
  };

  const waypointCards = sortWaypoints(analysis?.waypoints || []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>HuntIntel Terrain</Text>
        <Text style={styles.title}>Android Emulator MVP</Text>
        <Text style={styles.subtitle}>API gateway: {terrainApiBaseUrl}</Text>

        {screen === "setup" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Analysis Setup</Text>
            <TextInput style={styles.input} value={analysisName} onChangeText={setAnalysisName} placeholder="Property name" placeholderTextColor="#7f8d7a" />
            <Text style={styles.meta}>Species: whitetail</Text>
            <Text style={[styles.meta, isValid ? styles.success : styles.error]}>
              {polygon ? `${acreage.toLocaleString()} acres` : "Tap the terrain canvas to add polygon points."}
            </Text>
            {renderMap()}
            <View style={styles.row}>
              <ActionButton label="Analyze Terrain" onPress={submit} primary disabled={!polygon || !isValid} />
              <ActionButton label="Sample Polygon" onPress={() => setPoints(samplePoints())} />
            </View>
            <View style={styles.row}>
              <ActionButton label="Clear" onPress={() => setPoints([])} />
            </View>
            <TextInput
              style={styles.input}
              value={savedAnalysisId}
              onChangeText={setSavedAnalysisId}
              placeholder="Saved analysis job id"
              placeholderTextColor="#7f8d7a"
            />
            <ActionButton label="Open Saved Analysis" onPress={openSavedAnalysis} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}

        {screen === "processing" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Processing</Text>
            <Text style={styles.meta}>HTIE is generating features, relationships, waypoints, and a deterministic report.</Text>
          </View>
        )}

        {screen === "results" && analysis && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Results</Text>
            <Text style={styles.meta}>Saved analysis: {analysis.analysisJobId || "not persisted"}</Text>
            {renderMap()}
            <Text style={styles.metric}>Approximate acreage: {Number(analysis.summary?.approximateAcreage || acreage).toLocaleString()} acres</Text>
            <Text style={styles.metric}>Features: {analysis.features.length}</Text>
            <Text style={styles.metric}>Waypoints: {analysis.waypoints.length}</Text>
            <View style={styles.row}>
              <ActionButton label="Open Report" onPress={() => setScreen("report")} primary />
              <ActionButton label="Back to Setup" onPress={() => setScreen("setup")} />
            </View>
            <Text style={styles.sectionSubtitle}>Waypoint Detail</Text>
            {waypointCards.map((waypoint) => (
              <Pressable
                key={waypoint.id}
                style={styles.item}
                onPress={() => {
                  setSelectedWaypoint(waypoint);
                  setScreen("waypoint");
                }}
              >
                <Text style={styles.itemTitle}>{waypoint.title}</Text>
                <Text style={styles.meta}>{waypoint.waypointType}</Text>
                <Text style={styles.meta}>Score {waypoint.score.toFixed(1)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {screen === "report" && analysis && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Report</Text>
            <Text style={styles.itemTitle}>{analysis.report.title}</Text>
            <Text style={styles.meta}>{analysis.report.overview}</Text>
            <Text style={styles.sectionSubtitle}>Key Findings</Text>
            {analysis.report.keyFindings.map((finding, index) => (
              <Text key={index} style={styles.meta}>
                • {finding}
              </Text>
            ))}
            <Text style={styles.sectionSubtitle}>Scouting Notes</Text>
            {analysis.report.scoutingNotes.map((note, index) => (
              <Text key={index} style={styles.meta}>
                • {note}
              </Text>
            ))}
            <ActionButton label="Back to Results" onPress={() => setScreen("results")} />
          </View>
        )}

        {screen === "waypoint" && selectedWaypoint && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Waypoint Detail</Text>
            <Text style={styles.itemTitle}>{selectedWaypoint.title}</Text>
            <Text style={styles.meta}>{selectedWaypoint.waypointType}</Text>
            <Text style={styles.meta}>{selectedWaypoint.reason || "Deterministic HTIE waypoint."}</Text>
            <Text style={styles.meta}>Score {selectedWaypoint.score.toFixed(1)}</Text>
            <ActionButton label="Back to Results" onPress={() => setScreen("results")} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.button, primary && styles.buttonPrimary, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.buttonText, primary && styles.buttonPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#10140f",
  },
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#10140f",
  },
  eyebrow: {
    color: "#d0a65d",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: "#f0f3ea",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9cab97",
  },
  card: {
    backgroundColor: "#182019",
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: "#f0f3ea",
    fontSize: 22,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#d0a65d",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  input: {
    backgroundColor: "#0f140f",
    color: "#f0f3ea",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  button: {
    backgroundColor: "#243025",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPrimary: {
    backgroundColor: "#d0a65d",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#f0f3ea",
    fontWeight: "700",
  },
  buttonPrimaryText: {
    color: "#1f180f",
  },
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    borderRadius: 20,
    backgroundColor: "#263126",
    borderWidth: 1,
    borderColor: "#445340",
    overflow: "hidden",
  },
  vertex: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#f0d293",
  },
  featureDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d0a65d",
  },
  waypointDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#7eb07d",
  },
  metric: {
    color: "#f0f3ea",
  },
  meta: {
    color: "#9cab97",
    lineHeight: 20,
  },
  item: {
    backgroundColor: "#0f140f",
    padding: 14,
    borderRadius: 16,
  },
  itemTitle: {
    color: "#f0f3ea",
    fontWeight: "700",
    fontSize: 16,
  },
  error: {
    color: "#d68375",
  },
  success: {
    color: "#8ab182",
  },
});
