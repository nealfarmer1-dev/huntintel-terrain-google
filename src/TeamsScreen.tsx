import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createTeam, fetchAnalyses, fetchTeamInvitations, fetchTeamMembers, fetchTeams, inviteTeamMember, removeTeamMember, respondTeamInvitation, revokeTeamAnalysis, shareAnalysisWithTeam, updateTeamMemberRole } from "./api";
import { EmptyState, PrimaryButton, SecondaryButton, StatusBanner } from "./NativeUi";

const roles = ["viewer", "contributor", "coordinator"];

export function TeamsScreen({ onClose }: { onClose: () => void }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (id?: string) => {
    setLoading(true); setFailed(false);
    try {
      const [teamResult, inviteResult, analysisResult] = await Promise.all([fetchTeams(), fetchTeamInvitations(), fetchAnalyses(1, 50)]);
      const nextTeams = teamResult.items || [];
      setTeams(nextTeams);
      setInvites(inviteResult.items || []);
      setAnalyses((analysisResult.items || []).filter((item: any) => item.accessRole === "owner"));
      const nextId = id || selected?.id || nextTeams[0]?.id;
      const nextTeam = nextTeams.find((team: any) => team.id === nextId) || null;
      setSelected(nextTeam);
      setMembers(nextTeam ? (await fetchTeamMembers(nextTeam.id)).items || [] : []);
    } catch {
      setFailed(true);
      setMessage("Teams could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [selected?.id]);

  useEffect(() => { void load(); }, []);

  async function run(key: string, action: () => Promise<void>, success?: string) {
    setBusy(key); setMessage("");
    try {
      await action();
      if (success) setMessage(success);
    } catch {
      setMessage("That team action could not be completed. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return <View style={s.page}>
    <View style={s.header}>
      <View style={s.headerText}><Text style={s.eyebrow}>COLLABORATION</Text><Text style={s.title}>Teams</Text><Text style={s.meta}>Invite verified members, manage roles, and share saved analyses.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close Teams" onPress={onClose} style={({ pressed }) => [s.close, pressed && s.pressed]}><Ionicons name="close" size={24} color="#f0f3ea" /></Pressable>
    </View>

    {loading && <View style={s.loading} accessibilityRole="progressbar"><ActivityIndicator color="#d0a65d" /><Text style={s.meta}>Loading teams…</Text></View>}
    {failed && !loading && <StatusBanner tone="error" message={message} />}
    {failed && !loading && <PrimaryButton label="Retry" onPress={() => { void load(); }} />}
    {!failed && !!message && <StatusBanner message={message} />}

    {!loading && !failed && <>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Create a team</Text>
        <Text style={s.meta}>Give your collaboration space a clear field-ready name.</Text>
        <TextInput accessibilityLabel="Team name" style={s.input} value={name} onChangeText={setName} placeholder="Team name" placeholderTextColor="#7f8d7a" maxLength={120} />
        <PrimaryButton label="Create Team" loading={busy === "create"} disabled={!name.trim()} onPress={() => run("create", async () => { await createTeam({ name: name.trim() }); setName(""); await load(); }, "Team created.")} />
      </View>

      {!!invites.length && <View style={s.section}>
        <Text style={s.sectionTitle}>Invitations</Text>
        {invites.map((invite) => <View key={invite.id} style={s.listRow}>
          <View style={s.flex}><Text style={s.itemTitle}>{invite.teamName || invite.team_name}</Text><Text style={s.meta}>{invite.role} access</Text></View>
          <View style={s.row}><PrimaryButton label="Accept" loading={busy === `accept-${invite.id}`} onPress={() => run(`accept-${invite.id}`, async () => { await respondTeamInvitation(invite.id, "accept"); await load(); })} /><SecondaryButton label="Decline" onPress={() => run(`decline-${invite.id}`, async () => { await respondTeamInvitation(invite.id, "decline"); await load(); })} /></View>
        </View>)}
      </View>}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Your teams</Text>
        {!teams.length ? <EmptyState title="No teams yet" message="Create a team to coordinate members and securely share an analysis." /> :
          <View style={s.chips}>{teams.map((team) => <Pressable key={team.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === team.id }} onPress={() => { void load(team.id); }} style={({ pressed }) => [s.teamChip, selected?.id === team.id && s.teamChipSelected, pressed && s.pressed]}><Text style={[s.teamChipText, selected?.id === team.id && s.teamChipTextSelected]}>{team.name}</Text><Text style={s.chipMeta}>{team.accessRole || team.access_role}</Text></Pressable>)}</View>}
      </View>

      {selected && <>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Invite to {selected.name}</Text>
          <TextInput accessibilityLabel="Verified HuntIntel email" style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Verified HuntIntel email" placeholderTextColor="#7f8d7a" />
          <PrimaryButton label="Invite Viewer" loading={busy === "invite"} disabled={!email.trim()} onPress={() => run("invite", async () => { const result = await inviteTeamMember(selected.id, { email: email.trim(), role: "viewer" }); setEmail(""); setMessage(result.emailSent ? "Invitation sent." : "Invitation created. Email delivery is not currently available."); })} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Share a saved analysis</Text>
          {!analyses.length ? <Text style={s.meta}>Create a saved analysis before sharing it with this team.</Text> : analyses.map((item: any) => <View key={item.analysisJobId} style={s.listRow}>
            <View style={s.flex}><Text style={s.itemTitle}>{item.name || "Terrain Analysis"}</Text><Text style={s.meta}>Owner analysis</Text></View>
            <View style={s.row}><PrimaryButton label="Share" onPress={() => run(`share-${item.analysisJobId}`, async () => { await shareAnalysisWithTeam(selected.id, item.analysisJobId); }, `${item.name || "Analysis"} shared.`)} /><SecondaryButton label="Revoke" onPress={() => run(`revoke-${item.analysisJobId}`, async () => { await revokeTeamAnalysis(selected.id, item.analysisJobId); }, "Analysis access revoked.")} /></View>
          </View>)}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Members</Text>
          {!members.length ? <Text style={s.meta}>No members are listed for this team.</Text> : members.map((member) => {
            const memberId = member.userId || member.user_id;
            return <View key={memberId} style={s.listRow}>
              <View style={s.flex}><Text style={s.itemTitle}>{member.display_name || member.email || "Team member"}</Text><Text style={s.meta}>{member.role}</Text></View>
              {member.role !== "owner" && <View style={s.row}><SecondaryButton label="Change Role" onPress={() => run(`role-${memberId}`, async () => { await updateTeamMemberRole(selected.id, memberId, roles[(roles.indexOf(member.role) + 1) % roles.length]); await load(selected.id); })} /><SecondaryButton label="Remove" onPress={() => run(`remove-${memberId}`, async () => { await removeTeamMember(selected.id, memberId); await load(selected.id); })} /></View>}
            </View>;
          })}
        </View>
      </>}
    </>}
  </View>;
}

const s = StyleSheet.create({
  page: { gap: 16, width: "100%", maxWidth: 840, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  headerText: { flex: 1, gap: 5 },
  eyebrow: { color: "#d0a65d", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#f0f3ea", fontSize: 28, fontWeight: "900" },
  sectionTitle: { color: "#f0f3ea", fontSize: 18, fontWeight: "800" },
  itemTitle: { color: "#f0f3ea", fontSize: 16, fontWeight: "800" },
  meta: { color: "#a8b5a2", lineHeight: 20 },
  close: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#253126", borderWidth: 1, borderColor: "#3a4a39" },
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 12 },
  section: { gap: 12, padding: 18, borderRadius: 18, backgroundColor: "#182019", borderWidth: 1, borderColor: "#334333" },
  input: { minHeight: 48, color: "#f0f3ea", backgroundColor: "#0f140f", borderRadius: 14, borderWidth: 1, borderColor: "#3a4a39", paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  listRow: { gap: 10, padding: 14, borderRadius: 15, backgroundColor: "#111712", borderWidth: 1, borderColor: "#2f3d2f" },
  flex: { flex: 1, gap: 3 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  teamChip: { minHeight: 56, minWidth: 120, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "#252f25", borderWidth: 1, borderColor: "#3a4a39" },
  teamChipSelected: { backgroundColor: "#d0a65d", borderColor: "#e5c682" },
  teamChipText: { color: "#f0f3ea", fontWeight: "800" },
  teamChipTextSelected: { color: "#19140d" },
  chipMeta: { color: "#687366", fontSize: 11, textTransform: "capitalize", marginTop: 2 },
  pressed: { opacity: .76, transform: [{ scale: .985 }] },
});
