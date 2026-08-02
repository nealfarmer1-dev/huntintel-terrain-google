export const INITIAL_TERRAIN_MAP_CENTER = Object.freeze([-84.5, 33.0]);
export const INITIAL_TERRAIN_MAP_ZOOM = 4;

export function safeJson(value, fallback = null) {
  const normalized = value === undefined ? fallback : value;
  const serialized = JSON.stringify(normalized);
  return (typeof serialized === "string" ? serialized : "null").replace(/</g, "\\u003c");
}

export function terrainMapViewport(polygon) {
  const candidate = polygon?.coordinates?.[0]?.[0];
  const hasCoordinate =
    Array.isArray(candidate) &&
    candidate.length >= 2 &&
    Number.isFinite(Number(candidate[0])) &&
    Number.isFinite(Number(candidate[1]));

  return {
    center: hasCoordinate
      ? [Number(candidate[0]), Number(candidate[1])]
      : [...INITIAL_TERRAIN_MAP_CENTER],
    zoom: hasCoordinate ? 13 : INITIAL_TERRAIN_MAP_ZOOM,
  };
}

export function mapBuildCollections({ features, relationships, waypoints } = {}) {
  return {
    features: Array.isArray(features) ? features : [],
    relationships: Array.isArray(relationships) ? relationships : [],
    waypoints: Array.isArray(waypoints) ? waypoints : [],
  };
}
