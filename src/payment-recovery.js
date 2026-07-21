const KEY = "terrain.pendingGooglePurchase.v1";
export async function savePaymentRecoveryHint(storage,value){await storage.setItemAsync(KEY,JSON.stringify({draftId:value.draftId,attemptId:value.attemptId,productId:value.productId}));}
export async function loadPaymentRecoveryHint(storage){try{const value=JSON.parse((await storage.getItemAsync(KEY))||"null");return value?.draftId&&value?.productId?value:null;}catch{return null;}}
export const clearPaymentRecoveryHint=storage=>storage.deleteItemAsync(KEY);
export function pendingStatusLabel(item){if(item?.nextAction==="submit_analysis")return"Payment confirmed — ready to start";if(item?.nextAction==="resume_processing")return item?.draft?.status==="processing"?"Processing":"Starting analysis";if(item?.draft?.failureCode)return"Needs attention";return"Payment confirmed — ready to start";}
