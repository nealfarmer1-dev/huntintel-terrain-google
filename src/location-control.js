export const LOCATION_PERMISSION_MESSAGE =
  "Location permission is required to center the map on your current position.";
export const LOCATION_UNAVAILABLE_MESSAGE =
  "Your current location is not available yet. Try again in a moment.";

export async function ensureForegroundLocationPermission(locationApi) {
  let permission;
  try {
    permission = await locationApi.getForegroundPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain !== false) {
      permission = await locationApi.requestForegroundPermissionsAsync();
    }
  } catch {
    return { status: "unavailable", canAskAgain: false };
  }

  return permission;
}

export async function acquireCenterLocation(locationApi) {
  const permission = await ensureForegroundLocationPermission(locationApi);

  if (permission.status === "unavailable") {
    return permission;
  }

  if (permission.status !== "granted") {
    return { status: "denied", canAskAgain: permission.canAskAgain !== false, permission };
  }

  let position = null;
  try {
    position = await locationApi.getLastKnownPositionAsync({
      maxAge: 15_000,
      requiredAccuracy: 100,
    });
  } catch {
    // A current GPS fix remains available when no cached position can be read.
  }

  if (!position) {
    try {
      position = await locationApi.getCurrentPositionAsync({
        accuracy: locationApi.Accuracy?.High,
      });
    } catch {
      return { status: "unavailable", permission };
    }
  }

  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { status: "unavailable", permission };
  }

  return {
    status: "granted",
    permission,
    location: {
      latitude,
      longitude,
      accuracy: Number(position.coords.accuracy || 0),
    },
  };
}

export function centerLocationJavaScript(location) {
  return `window.__terrainCenterLocation&&window.__terrainCenterLocation(${JSON.stringify({
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  })});true;`;
}
