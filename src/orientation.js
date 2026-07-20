export const TERRAIN_ORIENTATION_KEY = "huntintel.terrain.orientation.completed.v1";

export const TERRAIN_ORIENTATION_STEPS = [
  { icon: "◎", kicker: "Welcome", title: "Terrain Intelligence, Ready in Minutes", body: "HuntIntel Terrain Intelligence uses the HuntIntel Terrain Intelligence Engine (HTIE) to analyze thousands of acres in minutes and identify terrain features and recommended waypoints.", bullets: ["Deterministic terrain analysis", "Actionable findings for planning and field use"] },
  { icon: "✎", kicker: "Step 1", title: "Draw an Area", body: "Draw a property or search area, select an analysis mode or species, name the analysis, then review acreage and pricing before continuing.", bullets: ["Use a true map boundary", "Confirm the analysis setup and acreage"] },
  { icon: "⌁", kicker: "Step 2", title: "Run Terrain Analysis", body: "HTIE deterministically analyzes the saved boundary and generates Terrain Features, Waypoints, Relationships, a Written Report, and PDF-ready findings.", bullets: ["Repeatable engine findings", "Clear map and report outputs"] },
  { icon: "◫", kicker: "Step 3", title: "Review Results", body: "Explore terrain features and waypoints, read explanations, interact with the map, and filter or organize the findings that matter.", bullets: ["Select findings from the map or lists", "Keep manual map control after the initial view"] },
  { icon: "⇩", kicker: "Step 4", title: "Save and Download", body: "Analyses are saved to My Analyses, can be reopened later, downloaded for supported offline use, and exported as a PDF.", bullets: ["Keep field-ready offline packages", "Return to the same saved analysis anytime"] },
  { icon: "⌖", kicker: "Step 5", title: "Take It Into the Field", body: "On mobile, open saved analyses, navigate to terrain-analysis waypoints, view field maps, add personal notes, and review findings while scouting.", bullets: ["Downloaded analyses remain available offline where supported", "My Location remains unavailable on Web"] },
  { icon: "→", kicker: "You’re Ready", title: "Begin Your First Analysis", body: "Draw a new area now or open My Analyses to continue with terrain intelligence you already saved.", bullets: [] },
];

export async function orientationCompleted(storage) {
  return (await storage.getItemAsync(TERRAIN_ORIENTATION_KEY)) === "true";
}

export async function completeOrientation(storage) {
  await storage.setItemAsync(TERRAIN_ORIENTATION_KEY, "true");
}

export async function replayOrientation(storage) {
  await storage.setItemAsync(TERRAIN_ORIENTATION_KEY, "false");
}
