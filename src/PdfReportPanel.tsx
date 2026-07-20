import React, { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { fetchPdfReportDownload, generatePdfReport } from "./api";
import { safeLocalPdfFilename, togglePdfOption } from "./pdf-report";

const INITIAL={includeFieldNotes:false,includeAttachments:false,includeBreadcrumbs:false};

function IncludedRow({label,checked=true}:{label:string;checked?:boolean}) {
 return <View style={s.includedRow}><View style={[s.checkBadge,!checked&&s.checkBadgeOff]}><Text style={[s.checkText,!checked&&s.checkTextOff]}>{checked?"✓":""}</Text></View><Text style={[s.includedText,!checked&&s.includedTextOff]}>{label}</Text></View>;
}

export function PdfReportPanel({analysisJobId}:{analysisJobId:string}) {
 const[options,setOptions]=useState<any>(INITIAL),[artifact,setArtifact]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const{width}=useWindowDimensions(),wide=width>=720;
 const generate=async()=>{setBusy(true);setMessage("Generating a private PDF report…");try{const result=await generatePdfReport(analysisJobId,options);if(result.artifact?.analysisJobId!==analysisJobId)throw new Error("PDF artifact did not match the current analysis.");setArtifact(result.artifact);setMessage(result.reused?"The current report version was reused.":"PDF report generated.");}catch(error){setMessage(error instanceof Error?error.message:"PDF generation failed.");}finally{setBusy(false)}};
 const share=async()=>{let uri="";setBusy(true);setMessage("Preparing a secure download…");try{const result=await fetchPdfReportDownload(analysisJobId,artifact.exportId);uri=`${FileSystem.cacheDirectory}${safeLocalPdfFilename(result.filename)}`;await FileSystem.downloadAsync(result.downloadUrl,uri);if(!await Sharing.isAvailableAsync())throw new Error("Sharing is unavailable on this device.");await Sharing.shareAsync(uri,{mimeType:"application/pdf",UTI:"com.adobe.pdf",dialogTitle:"Share HuntIntel PDF Report"});setMessage("PDF shared from temporary app storage.");}catch(error){setMessage(error instanceof Error?error.message:"PDF download failed.");}finally{if(uri)await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});setBusy(false)}};
 const option=(key:string,labels:string[])=>{const checked=Boolean(options[key]);return <Pressable accessibilityRole="checkbox" accessibilityLabel={`Include ${labels.join(" and ")}`} accessibilityState={{checked}} style={s.optionGroup} onPress={()=>setOptions((current:any)=>togglePdfOption(current,key))}>{labels.map((label)=><IncludedRow key={label} label={label} checked={checked}/>)}</Pressable>;};

 return <View style={s.panel}><View style={[s.content,wide&&s.contentWide]}>
  <View style={s.overview}><Text style={s.eyebrow}>VERSIONED PRIVATE ARTIFACT</Text><Text style={s.title}>PDF Report</Text><Text style={s.meta}>Create a polished report from this saved analysis. Optional field records remain separate from HTIE Engine Findings.</Text><View style={s.actions}><Pressable style={[s.primary,busy&&s.disabled]} disabled={busy} onPress={generate}><Text style={s.primaryText}>{busy?"Working…":"Generate PDF"}</Text></Pressable>{artifact?.status==="ready"&&<Pressable style={[s.button,busy&&s.disabled]} disabled={busy} onPress={share}><Text style={s.buttonText}>Download / Share</Text></Pressable>}</View>{message?<Text style={s.status}>{message}</Text>:null}{artifact?<Text style={s.status}>Status: {artifact.status}{artifact.sizeBytes?` · ${Math.ceil(artifact.sizeBytes/1024)} KiB`:""}</Text>:null}</View>
  <View style={s.included}><Text style={s.includedTitle}>Included in PDF</Text><View style={s.includedList}><IncludedRow label="HTIE Terrain Analysis Report"/><IncludedRow label="Terrain Features"/><IncludedRow label="Waypoints"/>{option("includeFieldNotes",["Personal Notes","Visit Status"])}{option("includeAttachments",["Attachment Metadata & Thumbnails"])}{option("includeBreadcrumbs",["Breadcrumb Summary"])}</View></View>
 </View></View>;
}

const s=StyleSheet.create({
 panel:{backgroundColor:"#0f140f",padding:18,borderRadius:18,borderWidth:1,borderColor:"#2d3a2d",marginTop:12},
 content:{gap:20},contentWide:{flexDirection:"row",alignItems:"flex-start",gap:24},overview:{flex:0.9,minWidth:0},included:{flex:1.1,minWidth:0,padding:16,borderRadius:16,borderWidth:1,borderColor:"#2d3a2d",backgroundColor:"#0b100c"},
 eyebrow:{color:"#d0a65d",fontSize:11,letterSpacing:1.5,fontWeight:"800"},title:{color:"#f0f3ea",fontSize:24,fontWeight:"800",marginTop:5,marginBottom:9},meta:{color:"#9cab97",lineHeight:20},
 actions:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:18},button:{backgroundColor:"#243025",borderRadius:999,paddingHorizontal:16,paddingVertical:12},primary:{backgroundColor:"#d0a65d",borderRadius:999,paddingHorizontal:16,paddingVertical:12},disabled:{opacity:.5},buttonText:{color:"#f0f3ea",fontWeight:"700"},primaryText:{color:"#1f180f",fontWeight:"800"},status:{color:"#9cab97",lineHeight:19,marginTop:10},
 includedTitle:{color:"#e6c27a",fontSize:16,fontWeight:"800",marginBottom:14},includedList:{gap:10},includedRow:{flexDirection:"row",alignItems:"flex-start",gap:10,minWidth:0},checkBadge:{width:22,height:22,borderRadius:999,borderWidth:1,borderColor:"#6f9368",backgroundColor:"#1c2a1d",alignItems:"center",justifyContent:"center",marginTop:1},checkBadgeOff:{borderColor:"#354235",backgroundColor:"transparent"},checkText:{color:"#89b37f",fontSize:13,fontWeight:"900",lineHeight:16},checkTextOff:{color:"transparent"},includedText:{flex:1,color:"#f0f3ea",fontSize:15,lineHeight:21},includedTextOff:{color:"#849080"},optionGroup:{gap:10,padding:8,margin:-8,borderRadius:12}
});
