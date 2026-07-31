import { ensureForegroundLocationPermission } from "./location-control.js";

export function breadcrumbLocationTaskOptions(locationApi) {
  return {
    accuracy: locationApi.Accuracy.High,
    distanceInterval: 5,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "HuntIntel breadcrumb active",
      notificationBody: "Tap the app to pause or stop tracking.",
    },
  };
}

export function sarLocationTaskOptions(locationApi) {
  return {
    accuracy: locationApi.Accuracy.High,
    timeInterval: 15000,
    distanceInterval: 15,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "HuntIntel live SAR sharing",
      notificationBody: "Your location is being shared with the authorized SAR team.",
      notificationColor: "#58764e",
    },
    pausesUpdatesAutomatically: true,
  };
}

export async function startUserInitiatedLocationTask(locationApi, taskName, options) {
  const permission = await ensureForegroundLocationPermission(locationApi);
  if (permission.status !== "granted") {
    return { status: permission.status, permission };
  }

  if (!options?.foregroundService?.notificationTitle || !options?.foregroundService?.notificationBody) {
    throw new Error("A visible foreground-service notification is required for location tracking.");
  }

  await locationApi.startLocationUpdatesAsync(taskName, options);
  return { status: "started", permission };
}

export async function stopLocationTaskIfStarted(locationApi, taskName) {
  if (!await locationApi.hasStartedLocationUpdatesAsync(taskName)) return false;
  await locationApi.stopLocationUpdatesAsync(taskName);
  return true;
}
