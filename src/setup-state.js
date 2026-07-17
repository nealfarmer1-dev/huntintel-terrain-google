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
