import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import {
  createAnalysisNote,
  createAttachmentUpload,
  deleteAnalysisNote,
  deleteAttachment,
  fetchAnalysisNotes,
  fetchAttachmentDownload,
  fetchAttachments,
  fetchStorageQuota,
  fetchWaypointFieldData,
  finalizeAttachment,
  saveWaypointFieldData,
  updateAnalysisNote,
} from "./api";

const STATUSES = [
  ["not_visited", "Not visited"],
  ["planned", "Planned"],
  ["visited", "Visited"],
  ["confirmed_useful", "Confirmed useful"],
  ["not_useful", "Not useful"],
  ["unable_to_access", "Unable to access"],
] as const;

type Props = {
  analysisJobId: string;
  waypoints: Array<{ id: string; title: string }>;
};

const emptyField = { status: "not_visited", favorite: false, rating: null as number | null, notes: "", visitedAt: null as string | null };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Field record request failed.";
}

function quotaCopy(quota: any) {
  if (!quota) return "Storage usage unavailable.";
  const usage = `${(quota.usedBytes / 1073741824).toFixed(2)} of ${(quota.limitBytes / 1073741824).toFixed(2)} GiB used (${quota.percentUsed}%).`;
  if (quota.warningLevel === "full") return `${usage} Storage is full; existing attachments remain available.`;
  if (quota.warningLevel === "critical") return `${usage} Storage is at least 95% full.`;
  if (quota.warningLevel === "warning") return `${usage} Storage is at least 80% full.`;
  return usage;
}

export function FieldRecordsScreen({ analysisJobId, waypoints }: Props) {
  const [notes, setNotes] = useState<any[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [accessRole, setAccessRole] = useState("viewer");
  const [selectedWaypointId, setSelectedWaypointId] = useState("");
  const [field, setField] = useState<any>(emptyField);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const load = useCallback(async () => {
    if (!analysisJobId) return;
    try {
      const [notesResult, attachmentsResult, quotaResult] = await Promise.all([
        fetchAnalysisNotes(analysisJobId),
        fetchAttachments(analysisJobId),
        fetchStorageQuota(),
      ]);
      setNotes(notesResult.items || []);
      setNoteEdits(Object.fromEntries((notesResult.items || []).map((note: any) => [note.id, note.body])));
      setAttachments(attachmentsResult.items || []);
      setQuota(quotaResult);
      setCanEdit(Boolean(notesResult.canEdit && attachmentsResult.canEdit));
      setAccessRole(notesResult.accessRole || attachmentsResult.accessRole || "viewer");
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [analysisJobId]);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (nextError) { setError(errorMessage(nextError)); }
    finally { setBusy(false); }
  }

  async function selectWaypoint(waypointId: string) {
    setSelectedWaypointId(waypointId);
    if (!waypointId) { setField(emptyField); return; }
    await run(async () => {
      const result = await fetchWaypointFieldData(analysisJobId, waypointId);
      setField(result.fieldData || emptyField);
      setCanEdit(Boolean(result.canEdit));
      setAccessRole(result.accessRole || accessRole);
    });
  }

  async function uploadUri(uri: string, attachmentType: "photo" | "voice_note" | "video", contentType?: string | null, durationSeconds?: number | null) {
    const file = await FileSystem.getInfoAsync(uri, { md5: true, size: true });
    const checksum = file.exists ? file.md5 : null;
    const size = file.exists ? file.size : 0;
    const mime = (contentType || (attachmentType === "photo" ? "image/jpeg" : attachmentType === "video" ? "video/mp4" : "audio/m4a")).toLowerCase();
    if (!file.exists || !size || !checksum) throw new Error("The captured file could not be read or checksummed.");
    const session = await createAttachmentUpload(analysisJobId, {
      attachmentType,
      waypointId: selectedWaypointId || null,
      sizeBytes: size,
      contentType: mime,
      durationSeconds: durationSeconds ?? null,
      checksum,
    });
    try {
      let status = 0;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await FileSystem.uploadAsync(session.uploadUrl, uri, { httpMethod: "PUT", headers: session.requiredHeaders, uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT });
        status = response.status;
        if (status >= 200 && status < 300) break;
      }
      if (status < 200 || status >= 300) throw new Error("Object storage upload failed after retry.");
      await finalizeAttachment(analysisJobId, session.attachment.id, { sizeBytes: size, contentType: mime, checksum });
    } catch (nextError) {
      await deleteAttachment(analysisJobId, session.attachment.id).catch(() => {});
      throw nextError;
    }
    await load();
  }

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Camera permission is required only to take a field photo.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (!result.canceled) await uploadUri(result.assets[0].uri, "photo", result.assets[0].mimeType);
  }

  async function captureVideo() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Camera permission is required only to record field video.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: 300, quality: 0.8 });
    if (!result.canceled) await uploadUri(result.assets[0].uri, "video", result.assets[0].mimeType, result.assets[0].duration ? result.assets[0].duration / 1000 : null);
  }

  async function toggleVoiceRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error("The voice note recording did not produce a file.");
      await uploadUri(recorder.uri, "voice_note", "audio/m4a", recorderState.durationMillis / 1000);
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error("Microphone permission is required only to record a voice note.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  return <View style={styles.section}>
    <Text style={styles.eyebrow}>User Field Records</Text>
    <Text style={styles.title}>Notes, Visits & Attachments</Text>
    <Text style={styles.meta}>Personal records are separate from immutable HTIE Engine Findings. Access role: {accessRole}.</Text>
    <Text style={[styles.quota, ["warning", "critical", "full"].includes(quota?.warningLevel) && styles.warning]}>{quotaCopy(quota)}</Text>
    {!canEdit && <Text style={styles.warning}>This role has read-only access and cannot modify field data.</Text>}
    {!!error && <Text style={styles.error}>{error}</Text>}

    <Text style={styles.subtitle}>General Notes</Text>
    {canEdit && <><TextInput style={[styles.input, styles.multiline]} multiline maxLength={10000} value={noteDraft} onChangeText={setNoteDraft} placeholder="Add a personal analysis note" placeholderTextColor="#748171" />
      <Button label="Add Note" disabled={busy || !noteDraft.trim()} primary onPress={() => run(async () => { await createAnalysisNote(analysisJobId, noteDraft); setNoteDraft(""); await load(); })} /></>}
    {notes.length ? notes.map((note) => <View key={note.id} style={styles.record}>
      <TextInput style={[styles.input, styles.multiline]} multiline maxLength={10000} editable={canEdit} value={noteEdits[note.id] ?? note.body} onChangeText={(value) => setNoteEdits((current) => ({ ...current, [note.id]: value }))} />
      <Text style={styles.meta}>{note.author?.displayName || note.author?.email || "You"} · Updated {new Date(note.updatedAt).toLocaleString()} · Personal</Text>
      {canEdit && <View style={styles.row}><Button label="Save" disabled={busy} onPress={() => run(async () => { await updateAnalysisNote(analysisJobId, note.id, noteEdits[note.id]); await load(); })} /><Button label="Delete" disabled={busy} onPress={() => run(async () => { await deleteAnalysisNote(analysisJobId, note.id); await load(); })} /></View>}
    </View>) : <Text style={styles.meta}>No personal notes.</Text>}

    <Text style={styles.subtitle}>Waypoint Field Data</Text>
    <View style={styles.row}>{waypoints.map((waypoint) => <Button key={waypoint.id} label={waypoint.title} primary={selectedWaypointId === waypoint.id} onPress={() => selectWaypoint(waypoint.id)} />)}</View>
    {!!selectedWaypointId && <View style={styles.record}>
      <Text style={styles.meta}>Status</Text>
      <View style={styles.row}>{STATUSES.map(([value, label]) => <Button key={value} label={label} disabled={!canEdit || busy} primary={field.status === value} onPress={() => setField((current: any) => ({ ...current, status: value }))} />)}</View>
      <View style={styles.row}><Button label={field.favorite ? "★ Favorite" : "☆ Favorite"} disabled={!canEdit || busy} primary={field.favorite} onPress={() => setField((current: any) => ({ ...current, favorite: !current.favorite }))} />{[1, 2, 3, 4, 5].map((rating) => <Button key={rating} label={String(rating)} disabled={!canEdit || busy} primary={field.rating === rating} onPress={() => setField((current: any) => ({ ...current, rating }))} />)}</View>
      <TextInput style={[styles.input, styles.multiline]} multiline maxLength={10000} editable={canEdit} value={field.notes || ""} onChangeText={(notes) => setField((current: any) => ({ ...current, notes }))} placeholder="Personal waypoint notes" placeholderTextColor="#748171" />
      {!!field.updatedAt && <Text style={styles.meta}>Updated {new Date(field.updatedAt).toLocaleString()} · Personal</Text>}
      {canEdit && <Button label="Save Field Data" disabled={busy} primary onPress={() => run(async () => {
        const visited = ["visited", "confirmed_useful", "not_useful"].includes(field.status);
        const result = await saveWaypointFieldData(analysisJobId, selectedWaypointId, { status: field.status, favorite: field.favorite, rating: field.rating, notes: field.notes || null, visitedAt: visited ? field.visitedAt || new Date().toISOString() : null });
        setField(result.fieldData);
      })} />}
    </View>}

    <Text style={styles.subtitle}>Attachments</Text>
    {canEdit && <View style={styles.row}><Button label="Take Photo" disabled={busy || quota?.warningLevel === "full"} onPress={() => run(capturePhoto)} /><Button label={recorderState.isRecording ? "Stop & Upload Voice" : "Record Voice"} disabled={busy || quota?.warningLevel === "full"} primary={recorderState.isRecording} onPress={() => run(toggleVoiceRecording)} /><Button label="Record Video" disabled={busy || quota?.warningLevel === "full"} onPress={() => run(captureVideo)} /></View>}
    <Text style={styles.meta}>Camera or microphone permission is requested only when its capture action is invoked. Defaults: photo 25 MB, voice 100 MB, video 500 MB.</Text>
    {attachments.length ? attachments.map((attachment) => <View key={attachment.id} style={styles.record}>
      <Text style={styles.recordTitle}>{String(attachment.attachmentType).replace("_", " ")} · {(attachment.sizeBytes / 1048576).toFixed(1)} MB</Text>
      <Text style={styles.meta}>{attachment.author?.displayName || attachment.author?.email || "You"} · {new Date(attachment.finalizedAt || attachment.createdAt).toLocaleString()} · Personal</Text>
      <View style={styles.row}><Button label="Open" onPress={() => run(async () => { const result = await fetchAttachmentDownload(analysisJobId, attachment.id); const supported = await Linking.canOpenURL(result.downloadUrl); if (!supported) throw new Error("No application can open this secure attachment URL."); await Linking.openURL(result.downloadUrl); })} />{canEdit && <Button label="Delete" disabled={busy} onPress={() => Alert.alert("Delete attachment?", "This releases its storage quota.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => run(async () => { await deleteAttachment(analysisJobId, attachment.id); await load(); }) }])} />}</View>
    </View>) : <Text style={styles.meta}>No personal attachments.</Text>}
  </View>;
}

function Button({ label, onPress, primary = false, disabled = false }: any) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  section: { marginTop: 14, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#344333", gap: 10 },
  eyebrow: { color: "#d0a65d", textTransform: "uppercase", letterSpacing: 1.5, fontSize: 11 },
  title: { color: "#f0f3ea", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#d0a65d", fontSize: 16, fontWeight: "700", marginTop: 10 },
  meta: { color: "#9cab97", lineHeight: 19 },
  quota: { color: "#8ab182", padding: 10, backgroundColor: "#0f140f", borderRadius: 12 },
  warning: { color: "#e3bd68" },
  error: { color: "#d68375" },
  input: { backgroundColor: "#0f140f", color: "#f0f3ea", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  record: { backgroundColor: "#0f140f", borderRadius: 16, padding: 12, gap: 8 },
  recordTitle: { color: "#f0f3ea", fontWeight: "700", textTransform: "capitalize" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { backgroundColor: "#283329", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  primary: { backgroundColor: "#9b7740" },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#f5f2e9", fontWeight: "700" },
});
