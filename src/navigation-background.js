import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { queueOfflineOperation } from "./offline";
export const BREADCRUMB_TASK="huntintel-terrain-active-breadcrumb";
export const ACTIVE_KEY="terrain.activeBreadcrumb.v1";
if(!TaskManager.isTaskDefined(BREADCRUMB_TASK))TaskManager.defineTask(BREADCRUMB_TASK,async({data,error})=>{
  if(error)return;const active=JSON.parse((await SecureStore.getItemAsync(ACTIVE_KEY))||"null");if(!active||active.status!=="active")return;
  for(const item of data?.locations||[]){const c=item.coords;const point={clientPointId:Crypto.randomUUID(),sequenceNumber:Number(active.nextSequence||0),latitude:c.latitude,longitude:c.longitude,accuracyMeters:c.accuracy,altitudeMeters:c.altitude,headingDegrees:c.heading,speedMps:c.speed,recordedAt:new Date(item.timestamp).toISOString()};active.nextSequence=point.sequenceNumber+1;await SecureStore.setItemAsync(ACTIVE_KEY,JSON.stringify(active));try{await queueOfflineOperation(active.analysisJobId,"breadcrumb.batch",{breadcrumbId:active.id,breadcrumb:active,points:[point]});}catch{const key="terrain.pendingBreadcrumbFallback.v1";const values=JSON.parse((await SecureStore.getItemAsync(key))||"[]");values.push({analysisJobId:active.analysisJobId,breadcrumbId:active.id,point});await SecureStore.setItemAsync(key,JSON.stringify(values.slice(-500)));}}
});
