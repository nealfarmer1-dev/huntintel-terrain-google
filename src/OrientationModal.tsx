import React, { useState } from "react";
import { Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { TERRAIN_ORIENTATION_STEPS } from "./orientation";

type Destination = "new" | "library" | null;
type Props = { visible: boolean; onComplete: (destination: Destination) => void | Promise<void> };

export function OrientationModal({ visible, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const step = TERRAIN_ORIENTATION_STEPS[index];
  const last = index === TERRAIN_ORIENTATION_STEPS.length - 1;
  const finish = async (destination: Destination = null) => { setIndex(0); await onComplete(destination); };

  return <Modal visible={visible} presentationStyle="fullScreen" animationType="slide" statusBarTranslucent={Platform.OS === "android"} onRequestClose={() => { void finish(); }}>
    <SafeAreaView style={styles.page}>
      <View style={styles.shell}>
      <View style={styles.topRow}><View style={styles.iconBadge}><Text style={styles.icon}>{step.icon}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Skip orientation" onPress={() => { void finish(); }} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}><Text style={styles.skipText}>Skip</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{step.kicker}</Text><Text style={styles.title}>{step.title}</Text><Text style={styles.body}>{step.body}</Text>
        <View style={styles.bulletList}>{step.bullets.map((item) => <View key={item} style={styles.bulletRow}><View style={styles.bulletDot} /><Text style={styles.bullet}>{item}</Text></View>)}</View>
        {last && <View style={styles.readyCard}><Text style={styles.readyTitle}>Choose New Analysis or My Analyses from Home when you finish.</Text></View>}
        <View accessibilityRole="progressbar" accessibilityLabel={`Step ${index + 1} of ${TERRAIN_ORIENTATION_STEPS.length}`} accessibilityValue={{ min: 1, max: TERRAIN_ORIENTATION_STEPS.length, now: index + 1 }} style={styles.dots}>{TERRAIN_ORIENTATION_STEPS.map((item, dot) => <View key={item.title} style={[styles.dot, dot === index && styles.dotActive]} />)}</View>
      </ScrollView>
      <View style={styles.actions}><Button label="Previous" disabled={index === 0} onPress={() => setIndex((current) => Math.max(0, current - 1))} /><Button label={last ? "Finish" : "Next"} primary onPress={() => { if (last) void finish(); else setIndex((current) => current + 1); }} /></View>
      </View>
    </SafeAreaView>
  </Modal>;
}

function Button({ label, onPress, primary = false, disabled = false }: any) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#111714"},
  shell:{flex:1,width:"100%",maxWidth:720,alignSelf:"center"},
  topRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:20,paddingTop:12},
  content:{flexGrow:1,justifyContent:"center",padding:24,paddingBottom:32},
  iconBadge:{width:50,height:50,borderRadius:18,backgroundColor:"#1f2a17",borderWidth:1,borderColor:"#33412e",alignItems:"center",justifyContent:"center"},
  icon:{color:"#d0a65d",fontSize:24,fontWeight:"900"},skip:{minHeight:48,minWidth:48,paddingHorizontal:14,justifyContent:"center",alignItems:"center"},skipText:{color:"#c6d0c4",fontWeight:"900"},
  kicker:{color:"#d0a65d",fontSize:12,fontWeight:"900",letterSpacing:1.4,textTransform:"uppercase",marginBottom:8},title:{color:"#fff",fontSize:28,fontWeight:"900",lineHeight:34,marginBottom:12},body:{color:"#c6d0c4",fontSize:16,lineHeight:24,marginBottom:12},bulletList:{gap:10},bulletRow:{flexDirection:"row",alignItems:"flex-start",gap:12},bulletDot:{width:7,height:7,borderRadius:4,backgroundColor:"#d0a65d",marginTop:7},bullet:{flex:1,color:"#aebbaa",fontSize:15,lineHeight:22},
  readyCard:{padding:16,borderRadius:16,backgroundColor:"#1f2a17",marginTop:16},readyTitle:{color:"#e7eee1",fontSize:16,fontWeight:"800",lineHeight:22},
  dots:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:24},dot:{width:8,height:8,borderRadius:999,backgroundColor:"#33412e"},dotActive:{width:24,backgroundColor:"#8eab77"},
  actions:{flexDirection:"row",justifyContent:"space-between",gap:12,padding:16,paddingBottom:Platform.OS==="ios"?12:20,borderTopWidth:1,borderTopColor:"#2b382b",backgroundColor:"#111714"},button:{flex:1,minHeight:50,borderRadius:Platform.OS==="ios"?14:12,borderWidth:1,borderColor:"#33412e",alignItems:"center",justifyContent:"center",paddingHorizontal:16},primary:{backgroundColor:"#d0a65d",borderColor:"#d0a65d"},disabled:{opacity:.35},pressed:{opacity:.76,transform:[{scale:.985}]},buttonText:{color:"#e7eee1",fontWeight:"900"},primaryText:{color:"#19140d"}
});
