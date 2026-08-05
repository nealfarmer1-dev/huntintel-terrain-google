import { acquireCenterLocation } from "./location-control.js";

export function locationFromPosition(position) {
  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, accuracy: Number(position.coords.accuracy || 0), altitude: position.coords.altitude == null ? null : Number(position.coords.altitude), heading: position.coords.heading == null ? null : Number(position.coords.heading), speed: position.coords.speed == null ? null : Number(position.coords.speed), recordedAt: new Date(position.timestamp || Date.now()).toISOString() };
}

export function createForegroundLocationController(locationApi, { onLocation, onError } = {}) {
  let subscription = null, startPromise = null, generation = 0, lastLocation = null;
  const emit = (position, activeGeneration) => { if (activeGeneration !== generation) return false; const location = locationFromPosition(position); if (!location) return false; lastLocation = location; onLocation?.(location); return true; };
  return {
    isRunning: () => Boolean(subscription || startPromise), current: () => lastLocation,
    async start() {
      if (subscription) return { status: "started", location: lastLocation, reused: true };
      if (startPromise) return startPromise;
      const activeGeneration = ++generation;
      startPromise = (async () => {
        const result = await acquireCenterLocation(locationApi);
        if (activeGeneration !== generation) return { status: "canceled" };
        if (result.status !== "granted") return result;
        lastLocation = { ...result.location, recordedAt: new Date().toISOString() }; onLocation?.(lastLocation);
        const next = await locationApi.watchPositionAsync({ accuracy: locationApi.Accuracy?.High, timeInterval: 5000, distanceInterval: 5 }, (position) => emit(position, activeGeneration));
        if (activeGeneration !== generation) { next?.remove?.(); return { status: "canceled" }; }
        subscription = next; return { status: "started", location: lastLocation };
      })().catch((error) => { if (activeGeneration === generation) onError?.(error); return { status: "unavailable" }; }).finally(() => { if (activeGeneration === generation) startPromise = null; });
      return startPromise;
    },
    async refresh() { if (!subscription) return { status: "disabled" }; try { const position = await locationApi.getCurrentPositionAsync({ accuracy: locationApi.Accuracy?.High }); return emit(position, generation) ? { status: "granted", location: lastLocation } : { status: "unavailable" }; } catch (error) { onError?.(error); return { status: "unavailable" }; } },
    stop() { generation += 1; startPromise = null; subscription?.remove?.(); subscription = null; },
  };
}
export function updateLocationJavaScript(location) { return `window.__terrainUpdateLocation&&window.__terrainUpdateLocation(${JSON.stringify(location)});true;`; }
