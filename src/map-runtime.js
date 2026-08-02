export const TERRAIN_MAP_FAILURE_MESSAGE = "The terrain map could not be loaded.";
export const MINIMAL_TERRAIN_MAP_HTML = "<!doctype html><html><body><p>Terrain map test</p></body></html>";

const SAFE_EVENTS = new Set([
  "terrain_map_mount_started",
  "terrain_map_mount_ready",
  "terrain_map_html_failed",
  "terrain_map_webview_failed",
  "terrain_map_content_process_terminated",
  "terrain_map_retry",
  "terrain_map_error_boundary",
  "terrain_map_message_ignored",
]);

const SAFE_MAP_BUILD_STAGES = new Set([
  "builder_validation",
  "input_preparation",
  "relationship_conversion",
  "waypoint_preparation",
  "safe_json_serialization",
  "final_html_assembly",
  "html_validation",
  "build_html",
]);
const MAP_BUILD_ERROR_STAGES = new WeakMap();

const MAP_INPUT_DIAGNOSTIC_FIELDS = Object.freeze([
  "polygon",
  "features",
  "relationships",
  "waypoints",
  "basemap",
  "terrainOverlay",
  "labelsVisible",
  "layerPreferences",
  "editable",
  "userLocation",
  "userLocationEnabled",
  "camera",
  "initialAnalysisFit",
]);

function sanitizeDiagnosticText(value, maximumLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\b(?:pk|sk)\.[A-Za-z0-9._-]{8,}\b/gi, "<redacted-token>")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/g, "<redacted-token>")
    .replace(/https?:\/\/[^\s)]+/gi, "<redacted-url>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>")
    .replace(/[-+]?\d{1,3}\.\d{3,}\s*,\s*[-+]?\d{1,3}\.\d{3,}/g, "<redacted-coordinates>")
    .replace(/(?:<!doctype\s+html|<html|<script)[\s\S]*/gi, "<redacted-html>")
    .replace(/(["'])(?:(?!\1).){49,}\1/g, "<redacted-value>")
    .slice(0, maximumLength);
}

function sanitizedException(error) {
  const candidate = error && (typeof error === "object" || typeof error === "function") ? error : null;
  const nameCandidate = sanitizeDiagnosticText(candidate?.name || typeof error, 80);
  const name = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(nameCandidate) ? nameCandidate : "Error";
  const message = sanitizeDiagnosticText(candidate?.message || "Non-Error value thrown", 320)
    .replace(/\s+/g, " ")
    .trim();
  const stack = String(candidate?.stack || "")
    .split("\n")
    .slice(0, 8)
    .map((line) => sanitizeDiagnosticText(line, 240)
      .replace(/(?:file:\/\/)?\/(?:[^\s():]+\/)+[^\s():]+/g, "<path>"))
    .filter(Boolean);
  return { name, message, stack };
}

function normalizedMapBuildStage(stage) {
  const candidate = String(stage || "");
  return SAFE_MAP_BUILD_STAGES.has(candidate) ? candidate : "build_html";
}

function mapBuildStageFor(error) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return "build_html";
  return normalizedMapBuildStage(error.mapBuildStage || MAP_BUILD_ERROR_STAGES.get(error));
}

function coarseValueMetadata(value) {
  return {
    typeof: typeof value,
    isNull: value === null,
    isArray: Array.isArray(value),
    ...(Array.isArray(value) ? { length: value.length } : {}),
  };
}

export function coarseMapInputMetadata(input) {
  const metadata = { input: coarseValueMetadata(input) };
  if (!input || typeof input !== "object") return metadata;
  for (const field of MAP_INPUT_DIAGNOSTIC_FIELDS) {
    try {
      metadata[field] = coarseValueMetadata(input[field]);
    } catch {
      metadata[field] = { typeof: "unavailable", isNull: false, isArray: false };
    }
  }
  return metadata;
}

export function runMapBuildStage(stage, operation) {
  try {
    return operation();
  } catch (error) {
    const safeStage = normalizedMapBuildStage(stage);
    if (error && (typeof error === "object" || typeof error === "function")) {
      try {
        if (!error.mapBuildStage) error.mapBuildStage = safeStage;
      } catch {
        MAP_BUILD_ERROR_STAGES.set(error, safeStage);
      }
      if (!error.mapBuildStage) MAP_BUILD_ERROR_STAGES.set(error, safeStage);
      throw error;
    }
    const normalized = new Error("Non-Error value thrown during map construction");
    normalized.name = "NonErrorThrown";
    normalized.mapBuildStage = safeStage;
    throw normalized;
  }
}

export function terrainMapDiagnostic(event, metadata = {}) {
  if (!SAFE_EVENTS.has(event)) return;
  const safe = {
    event,
    platform: metadata.platform === "ios" ? "ios" : metadata.platform === "android" ? "android" : "unknown",
    stage: String(metadata.stage || "unknown").slice(0, 40),
    category: String(metadata.category || "none").slice(0, 60),
    setupActive: Boolean(metadata.setupActive),
  };
  if (event === "terrain_map_html_failed") {
    safe.exception = sanitizedException(metadata.error);
    safe.input = coarseMapInputMetadata(metadata.input);
  }
  console.info(`[terrain-map] ${JSON.stringify(safe)}`);
}

export function safeBuildMapSource(buildHtml, input, options = {}) {
  try {
    if (typeof buildHtml !== "function") {
      const error = new TypeError("MAP_BUILDER_UNAVAILABLE");
      error.mapBuildStage = "builder_validation";
      throw error;
    }
    const html = buildHtml(input);
    if (typeof html !== "string" || !/<html[\s>]/i.test(html) || !html.trim()) {
      const error = new TypeError("MAP_HTML_INVALID");
      error.mapBuildStage = "html_validation";
      throw error;
    }
    return { ok: true, source: { html }, code: null, userMessage: null };
  } catch (error) {
    terrainMapDiagnostic("terrain_map_html_failed", {
      platform: options.platform,
      stage: mapBuildStageFor(error),
      category: "MAP_HTML_BUILD_FAILED",
      setupActive: options.setupActive,
      error,
      input,
    });
    return {
      ok: false,
      source: null,
      code: "MAP_HTML_BUILD_FAILED",
      userMessage: TERRAIN_MAP_FAILURE_MESSAGE,
    };
  }
}

export function parseTerrainMapMessage(data) {
  try {
    const value = JSON.parse(String(data));
    if (!value || typeof value !== "object" || typeof value.type !== "string") {
      return { ok: false, code: "MAP_MESSAGE_INVALID" };
    }
    return { ok: true, message: value };
  } catch {
    return { ok: false, code: "MAP_MESSAGE_INVALID" };
  }
}

export function createMapRetryController() {
  let inFlight = false;
  return {
    begin() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    finish() {
      inFlight = false;
    },
    isInFlight() {
      return inFlight;
    },
  };
}
