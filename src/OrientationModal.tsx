import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { TERRAIN_ORIENTATION_STEPS } from "./orientation";

type Destination = "new" | "library" | null;
type Props = { visible: boolean; onComplete: (destination: Destination) => void | Promise<void> };

export function OrientationModal({ visible, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const step = TERRAIN_ORIENTATION_STEPS[index];
  const last = index === TERRAIN_ORIENTATION_STEPS.length - 1;
  const finish = async (destination: Destination = null) => { setIndex(0); await onComplete(destination); };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { void finish(); }}>
    <View style={styles.overlay}><View style={styles.card}>
      <View style={styles.topRow}><View style={styles.iconBadge}><Text style={styles.icon}>{step.icon}</Text></View><Pressable accessibilityRole="button" onPress={() => { void finish(); }} style={styles.skip}><Text style={styles.skipText}>Skip</Text></Pressable></View>
      <Text style={styles.kicker}>{step.kicker}</Text><Text style={styles.title}>{step.title}</Text><Text style={styles.body}>{step.body}</Text>
      {step.bullets.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
      <View accessibilityLabel={`Step ${index + 1} of ${TERRAIN_ORIENTATION_STEPS.length}`} style={styles.dots}>{TERRAIN_ORIENTATION_STEPS.map((item, dot) => <View key={item.title} style={[styles.dot, dot === index && styles.dotActive]} />)}</View>
      {last && <View style={styles.destinations}><Button label="Start New Analysis" primary onPress={() => { void finish("new"); }} /><Button label="Open My Analyses" onPress={() => { void finish("library"); }} /></View>}
      <View style={styles.actions}><Button label="Previous" disabled={index === 0} onPress={() => setIndex((current) => Math.max(0, current - 1))} /><Button label={last ? "Finish" : "Next"} primary onPress={() => { if (last) void finish(); else setIndex((current) => current + 1); }} /></View>
    </View></View>
  </Modal>;
}

function Button({ label, onPress, primary = false, disabled = false }: any) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}><Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  overlay:{flex:1,justifyContent:"center",padding:20,backgroundColor:"rgba(0,0,0,.74)"},
  card:{borderRadius:24,borderWidth:1,borderColor:"#31412d",backgroundColor:"#111714",padding:20},
  topRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  iconBadge:{width:50,height:50,borderRadius:18,backgroundColor:"#1f2a17",borderWidth:1,borderColor:"#33412e",alignItems:"center",justifyContent:"center"},
  icon:{color:"#d0a65d",fontSize:24,fontWeight:"900"},skip:{minHeight:42,paddingHorizontal:14,justifyContent:"center"},skipText:{color:"#c6d0c4",fontWeight:"900"},
  kicker:{color:"#8fa18f",fontSize:12,fontWeight:"900",textTransform:"uppercase",marginBottom:8},title:{color:"#fff",fontSize:28,fontWeight:"900",lineHeight:33,marginBottom:12},body:{color:"#c6d0c4",fontSize:16,lineHeight:23,marginBottom:8},bullet:{color:"#aebbaa",fontSize:14,lineHeight:21},
  dots:{flexDirection:"row",gap:8,marginTop:24,marginBottom:20},dot:{width:8,height:8,borderRadius:999,backgroundColor:"#33412e"},dotActive:{width:24,backgroundColor:"#8eab77"},
  destinations:{gap:10,marginBottom:12},actions:{flexDirection:"row",justifyContent:"space-between",gap:12},button:{flex:1,minHeight:50,borderRadius:14,borderWidth:1,borderColor:"#33412e",alignItems:"center",justifyContent:"center",paddingHorizontal:16},primary:{backgroundColor:"#d0a65d",borderColor:"#d0a65d"},disabled:{opacity:.35},buttonText:{color:"#e7eee1",fontWeight:"900"},primaryText:{color:"#19140d"}
});

