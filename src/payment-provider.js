export const PAYMENT_PLATFORM = "android";
export const PAYMENT_PROVIDER = "google_play";
export const STORE_PRODUCT_IDS = Object.freeze({
  standard_analysis: "com.huntintel.terrainintelligence.analysis.standard",
  large_analysis: "com.huntintel.terrainintelligence.analysis.large",
});

export function productIdForPurchase(purchase = {}) {
  const productId = STORE_PRODUCT_IDS[purchase?.draft?.tierKey];
  if (!productId || (purchase?.quote?.providerProductId && purchase.quote.providerProductId !== productId)) throw new Error("The Google Play product does not match the server pricing tier.");
  return productId;
}

function records(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([provider, metadata]) => typeof metadata === "boolean" ? { provider, enabled: metadata } : { ...metadata, provider: metadata?.provider || provider });
}

export function selectPlatformPaymentProvider(purchase = {}) {
  if (Object.prototype.hasOwnProperty.call(purchase, "availableProviders")) {
    return records(purchase.availableProviders).find((item) => item?.provider === PAYMENT_PROVIDER) || { provider: PAYMENT_PROVIDER, enabled: false };
  }
  const legacy = purchase.provider || purchase.selectedProvider || purchase.paymentProvider || purchase.quote?.provider;
  const value = typeof legacy === "string" ? { provider: legacy, enabled: true } : legacy;
  return value?.provider === PAYMENT_PROVIDER || value?.provider === "development_bypass" ? value : { provider: PAYMENT_PROVIDER, enabled: false };
}
