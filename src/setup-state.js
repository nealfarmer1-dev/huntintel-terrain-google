export const MAX_ANALYSIS_NAME_LENGTH = 120;

export function normalizedAnalysisName(value) {
  return String(value || "").trim();
}

export function analysisNameValidationMessage(value) {
  const name = normalizedAnalysisName(value);
  if (!name) return "Enter a name for this analysis.";
  if (name.length > MAX_ANALYSIS_NAME_LENGTH) return `Analysis name must be ${MAX_ANALYSIS_NAME_LENGTH} characters or fewer.`;
  return "";
}

export function setupConfigurationKey({ analysisName, analysisMode, propertyId = null, polygon }) {
  return JSON.stringify({ analysisName: normalizedAnalysisName(analysisName), analysisMode, propertyId: propertyId || null, polygon });
}

export function quoteMatchesSetup({ purchase, quotedSetupKey, currentSetupKey, now = Date.now() }) {
  if (!purchase?.draft?.draftId || !purchase?.quote?.draftId || purchase.draft.draftId !== purchase.quote.draftId) return false;
  if (!quotedSetupKey || quotedSetupKey !== currentSetupKey) return false;
  const expiresAt = new Date(purchase.quote.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function deriveSetupState({ nameError, polygonValid, quoteLoading, paymentBusy, processing, paymentRequired, paid, quoteCurrent, hadQuote }) {
  if (processing) return "analysis_processing";
  if (paid) return "paid";
  if (paymentBusy) return "payment_in_progress";
  if (paymentRequired) return "payment_required";
  if (quoteLoading) return "quote_loading";
  if (nameError || !polygonValid) return "incomplete";
  if (quoteCurrent) return "quoted";
  if (hadQuote) return "quote_stale";
  return "ready_for_quote";
}

export function purchaseActionPresentation(setupState, polygonValid) {
  if (!polygonValid) {
    return {
      label: "Select 5–2,000 Acres to Continue",
      message: "Area must be between 5 and 2,000 acres before continuing.",
    };
  }
  if (setupState === "quoted") {
    return {
      label: "Review & Purchase",
      message: "One-time Google Play purchase. Your analysis begins after purchase confirmation.",
    };
  }
  if (setupState === "quote_stale") {
    return {
      label: "Confirm Acreage & Price Again",
      message: "The analysis setup changed. Confirm acreage and price again before continuing.",
    };
  }
  return {
    label: "Confirm Acreage & Price First",
    message: "Confirm the server-calculated acreage and price before continuing.",
  };
}
