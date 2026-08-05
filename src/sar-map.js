const arrays = (value) => Array.isArray(value) ? value : [];

function positionUserId(position) {
  return position?.userId ?? position?.user_id ?? position?.participantUserId ?? position?.participant_user_id ?? null;
}

export function isCurrentSarParticipant(position, currentUserId = null) {
  if (position?.isCurrentUser === true || position?.is_current_user === true) return true;
  const userId = positionUserId(position);
  return userId != null && currentUserId != null && String(userId) === String(currentUserId);
}

export function sarParticipantLabel(position, currentUserId = null) {
  if (isCurrentSarParticipant(position, currentUserId)) return "You";
  const displayName = String(position?.displayName ?? position?.display_name ?? "").trim();
  if (displayName) return displayName;
  const fullName = [position?.firstName ?? position?.first_name, position?.lastName ?? position?.last_name].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
  return fullName || "Team member";
}

export function sarPositionsFeatureCollection(positions = [], currentUserId = null, now = Date.now(), staleMs = 45_000, presenceMs = 180_000) {
  const features = [];
  for (const [index, position] of arrays(positions).entries()) {
    const latitude = Number(position?.latitude), longitude = Number(position?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const receivedAt = position?.receivedAt ?? position?.received_at ?? position?.recordedAt ?? position?.recorded_at ?? null;
    const receivedTime = receivedAt ? new Date(receivedAt).getTime() : NaN;
    const age = Number.isFinite(receivedTime) ? Math.max(0, now - receivedTime) : Number.POSITIVE_INFINITY;
    const stale = position?.stale ?? age > staleMs;
    const offline = position?.offline ?? age > presenceMs;
    const accuracyMeters = Number(position?.accuracyMeters ?? position?.accuracy_meters ?? position?.accuracy ?? 0);
    const userId = positionUserId(position);
    features.push({
      type: "Feature",
      id: `participant-${index}`,
      geometry: { type: "Point", coordinates: [longitude, latitude] },
      properties: {
        label: sarParticipantLabel(position, currentUserId),
        isCurrentUser: isCurrentSarParticipant(position, currentUserId),
        state: offline ? "offline" : stale ? "stale" : "current",
        stale: Boolean(stale),
        offline: Boolean(offline),
        accuracyMeters: Number.isFinite(accuracyMeters) ? Math.max(0, accuracyMeters) : 0,
        lastUpdated: receivedAt ? String(receivedAt) : "",
        sharingMode: String(position?.sharingMode ?? position?.sharing_mode ?? ""),
        role: String(position?.role ?? position?.accessRole ?? position?.access_role ?? ""),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function sarAssignmentsFeatureCollection(assignments = [], waypoints = []) {
  const waypointById = new Map(arrays(waypoints).map((waypoint) => [String(waypoint?.id ?? ""), waypoint]));
  const features = [];
  for (const assignment of arrays(assignments)) {
    const waypointId = assignment?.waypointId ?? assignment?.waypoint_id;
    const waypoint = waypointId == null ? null : waypointById.get(String(waypointId));
    if (waypoint?.geometry?.type !== "Point" || !Array.isArray(waypoint.geometry.coordinates)) continue;
    const [longitude, latitude] = waypoint.geometry.coordinates.map(Number);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    features.push({
      type: "Feature",
      id: String(assignment?.id ?? `assignment-${features.length}`),
      geometry: { type: "Point", coordinates: [longitude, latitude] },
      properties: {
        id: String(assignment?.id ?? ""),
        waypointId: String(waypointId ?? ""),
        title: String(assignment?.title ?? "SAR assignment"),
        status: String(assignment?.status ?? "assigned"),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function setSarPositionsJavaScript(collection, visible = true) {
  return `window.__terrainSetSarPositions&&window.__terrainSetSarPositions(${JSON.stringify(collection)},${visible ? "true" : "false"});true;`;
}

export function setSarAssignmentsJavaScript(collection) {
  return `window.__terrainSetSarAssignments&&window.__terrainSetSarAssignments(${JSON.stringify(collection)});true;`;
}
