export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeOptionalUuid(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function buildAnalysisRequestPayload({ analysisName, analysisMode, species, saveResults = true, propertyId = null, polygon }) {
  const trimmedName = String(analysisName || "").trim();
  return {
    analysisMode,
    species,
    saveResults,
    propertyId: normalizeOptionalUuid(propertyId),
    analysisName: trimmedName || undefined,
    polygon,
  };
}

export const USGS_3DEP_WMS_BASE = "https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer";

export function usgs3depTileUrl(layerName) {
  return `${USGS_3DEP_WMS_BASE}?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(layerName)}&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256`;
}

export const MAPBOX_STYLE_OPTIONS = [
  { value: "satellite", label: "Satellite", style: "mapbox://styles/mapbox/satellite-v9" },
  { value: "hybrid", label: "Hybrid", style: "mapbox://styles/mapbox/satellite-streets-v12" },
  { value: "topographic", label: "Topographic", style: "mapbox://styles/mapbox/outdoors-v12" },
  {
    value: "3dep",
    label: "USGS 3DEP",
    style: {
      version: 8,
      sources: {
        "usgs-3dep-elevation": {
          type: "raster",
          tiles: [usgs3depTileUrl("3DEPElevation")],
          tileSize: 256,
          attribution: "USGS 3DEP / The National Map",
        },
      },
      layers: [{ id: "usgs-3dep-elevation", type: "raster", source: "usgs-3dep-elevation", paint: { "raster-opacity": 1 } }],
    },
  },
];

export const USGS_TERRAIN_OVERLAY_OPTIONS = [
  { value: "", label: "None", layer: null },
  { value: "hillshade", label: "Hillshade", layer: "3DEPElevation:Hillshade Multidirectional" },
  { value: "slope", label: "Slope", layer: "3DEPElevation:Slope Map" },
  { value: "aspect", label: "Aspect", layer: "3DEPElevation:Aspect Map" },
];

export function resolveMapboxAccessToken(env = {}) {
  return String(
    env.EXPO_PUBLIC_TERRAIN_MAPBOX_ACCESS_TOKEN ||
    env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_MOBILE ||
    env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN_WEB ||
    ""
  ).trim();
}

export function mapboxStyleFor(value) {
  return MAPBOX_STYLE_OPTIONS.find((option) => option.value === value)?.style || MAPBOX_STYLE_OPTIONS[0].style;
}
