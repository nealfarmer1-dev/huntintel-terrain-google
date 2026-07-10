export const SAMPLE_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-86.7912, 32.6036],
    [-86.7805, 32.6036],
    [-86.7805, 32.6128],
    [-86.7912, 32.6128],
    [-86.7912, 32.6036],
  ]],
};

const EARTH_RADIUS_METERS = 6_378_137;
const SQUARE_METERS_PER_ACRE = 4_046.8564224;

export function buildPolygonFromPoints(points) {
  if (points.length < 3) {
    return null;
  }

  const coordinates = points.map((point) => [point.longitude, point.latitude]);
  coordinates.push([points[0].longitude, points[0].latitude]);

  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}

export function calculateApproximateAcreage(polygon) {
  const ring = polygon.coordinates[0];
  let areaAccumulator = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[index + 1];
    areaAccumulator +=
      ((lon2 - lon1) * Math.PI) / 180 *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }

  return Math.abs(areaAccumulator * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS * 0.5) / SQUARE_METERS_PER_ACRE;
}

export function samplePoints() {
  return SAMPLE_POLYGON.coordinates[0].slice(0, -1).map(([longitude, latitude]) => ({ longitude, latitude }));
}

export function projectCoordinate(coordinate, bounds, width, height) {
  const [longitude, latitude] = coordinate;
  const lonRange = bounds.maxLon - bounds.minLon || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;

  return {
    left: ((longitude - bounds.minLon) / lonRange) * width,
    top: height - ((latitude - bounds.minLat) / latRange) * height,
  };
}

export function getBounds(polygon, waypoints = [], features = []) {
  const coordinates = [...polygon.coordinates[0]];
  for (const feature of features) {
    if (feature.geometry?.coordinates) {
      coordinates.push(feature.geometry.coordinates);
    }
  }
  for (const waypoint of waypoints) {
    if (waypoint.geometry?.coordinates) {
      coordinates.push(waypoint.geometry.coordinates);
    }
  }

  return {
    minLon: Math.min(...coordinates.map((point) => point[0])),
    maxLon: Math.max(...coordinates.map((point) => point[0])),
    minLat: Math.min(...coordinates.map((point) => point[1])),
    maxLat: Math.max(...coordinates.map((point) => point[1])),
  };
}
