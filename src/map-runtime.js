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

export function terrainMapDiagnostic(event, metadata = {}) {
  if (!SAFE_EVENTS.has(event)) return;
  const safe = {
    event,
    platform: metadata.platform === "ios" ? "ios" : metadata.platform === "android" ? "android" : "unknown",
    stage: String(metadata.stage || "unknown").slice(0, 40),
    category: String(metadata.category || "none").slice(0, 60),
    setupActive: Boolean(metadata.setupActive),
  };
  console.info(`[terrain-map] ${JSON.stringify(safe)}`);
}

export function safeBuildMapSource(buildHtml, input, options = {}) {
  try {
    if (typeof buildHtml !== "function") throw new TypeError("MAP_BUILDER_UNAVAILABLE");
    const html = buildHtml(input);
    if (typeof html !== "string" || !/<html[\s>]/i.test(html) || !html.trim()) {
      throw new TypeError("MAP_HTML_INVALID");
    }
    return { ok: true, source: { html }, code: null, userMessage: null };
  } catch {
    terrainMapDiagnostic("terrain_map_html_failed", {
      platform: options.platform,
      stage: "html",
      category: "MAP_HTML_BUILD_FAILED",
      setupActive: options.setupActive,
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
