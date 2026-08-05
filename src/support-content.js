export const SUPPORT_EMAIL = "support@huntintelapp.com";
export const PUBLIC_SUPPORT_URL = "https://terrain.huntintelapp.com/help-support";
export const TERMS_URL = "https://app.huntintelapp.com/legal/terms";
export const PRIVACY_URL = "https://app.huntintelapp.com/legal/privacy";
export const SUPPORT_VIDEO = {
  id: "IkV3SmWBPds",
  title: "Creating a Terrain Analysis",
  description: "Watch a quick walkthrough of naming an analysis, drawing the analysis boundary, confirming acreage and price, and starting a HuntIntel Terrain analysis.",
  url: "https://youtube.com/shorts/IkV3SmWBPds",
};

export const SUPPORT_ACTIONS = [
  {
    id: "contact",
    label: "Contact Support",
    subject: "HuntIntel Terrain Support Request",
    body: "Please describe what you need help with.\n\nName:\nHuntIntel account email:\nPlatform: Web / iPhone / Android\nApp version:\nScreen or feature:\nWhat happened:\nWhat did you expect:\nAdditional details:",
  },
  {
    id: "bug",
    label: "Report a Problem",
    subject: "HuntIntel Terrain Bug Report",
    body: "Please describe the problem.\n\nHuntIntel account email:\nPlatform: Web / iPhone / Android\nApp version:\nDevice and operating system:\nAnalysis name, if relevant:\nSteps to reproduce:\nExpected result:\nActual result:\nDoes the issue happen every time:\nAdditional details:",
  },
  {
    id: "feature",
    label: "Request a Feature",
    subject: "HuntIntel Terrain Feature Request",
    body: "Please describe the feature you would like.\n\nPlatform:\nProblem this would solve:\nSuggested behavior:\nHow this would help:\nAdditional details:",
  },
  {
    id: "purchase",
    label: "Purchase or Account Help",
    subject: "HuntIntel Terrain Purchase or Account Help",
    body: "Please describe the account or purchase issue.\n\nHuntIntel account email:\nPlatform:\nAnalysis name, if relevant:\nApproximate purchase date:\nWhat happened:\nAdditional details:",
  },
];

export const GETTING_STARTED_ARTICLES = [
  {
    id: "first-analysis",
    title: "Create Your First Terrain Analysis",
    steps: [
      "Sign in to HuntIntel Terrain.",
      "Choose New Analysis.",
      "Enter a unique analysis name.",
      "Select the analysis mode that matches your intended use.",
      "Draw the analysis boundary by adding at least three points on the map.",
      "Review the calculated acreage.",
      "Choose Confirm Acreage & Price.",
      "Review the one-time purchase information.",
      "Choose Analyze Terrain to continue.",
      "Open My Analyses to monitor or reopen the completed analysis.",
    ],
    paragraphs: ["Terrain analyses must remain within the acreage limits shown in the app. The exact price is displayed before purchase."],
  },
  { id: "saved-analysis", title: "Open and Review a Saved Analysis", paragraphs: ["Open My Analyses and select the analysis you want to review. The results include the saved boundary, identified terrain features, relationships, waypoints, and the generated report. Selecting a feature or waypoint highlights it on the map and displays its supporting details."] },
  { id: "current-location", title: "Use Current Location and Field Navigation", paragraphs: ["Use the current-location control to center the map on your position. In Field Navigation, select a waypoint to review straight-line distance and direction. Current location can be used even when you are physically outside the saved analysis boundary. Always confirm actual terrain, access, weather, and field conditions before traveling."] },
  { id: "show-hide-breadcrumbs", title: "Show or Hide Breadcrumb Trails", paragraphs: ["The Breadcrumb Trails option in Map Layers only controls whether recorded trails are visible on the map. It does not start or stop breadcrumb recording.", "To record a new trail, open Field Navigation and tap Start Breadcrumb. Once recording begins, keep Show Breadcrumb Trails enabled to see the route extend as you move.", "You can pause, resume, or finish recording from Field Navigation. Turning the map layer off only hides the trail; recording continues until you pause or finish it."] },
  { id: "breadcrumb", title: "Record a Breadcrumb", paragraphs: ["Open Field Navigation and tap Start Breadcrumb. Breadcrumb recording stores your traveled route and can continue in the background on supported native devices after you grant the required location permission. Use Pause, Resume, or Finish / Stop to control recording. Show Breadcrumb Trails in Map Layers only changes whether the route is visible; it does not start or stop recording. Background tracking does not begin automatically."] },
  { id: "offline", title: "Download an Analysis for Offline Use", paragraphs: ["Open My Analyses and use the available download action to prepare an analysis for field use. Offline packages can include supported map and analysis information. Some third-party GIS layers may remain online-only because of provider restrictions. Synchronize pending field changes when a connection is available."] },
  { id: "team", title: "Share an Analysis with a Team", paragraphs: ["Open Teams, select the team, and choose the owned analysis you want to share. After the analysis shows as shared, authorized team members can use the collaboration features available to their role. A shared analysis can also be selected for an authorized Live SAR session when Live SAR is enabled."] },
  { id: "live-sar", title: "Use Live SAR Responsibly", paragraphs: ["Live SAR is designed for authorized team coordination. A team owner or coordinator can start a session using an analysis shared with the team. Participants must explicitly enable location sharing. Live SAR does not replace emergency services, incident command, professional training, official procedures, or sound field judgment."] },
];

export const SUPPORT_FAQS = [
  { id: "about", question: "What is HuntIntel Terrain Intelligence?", answer: "HuntIntel Terrain Intelligence analyzes a user-defined area and produces terrain features, relationships, recommended waypoints, and an explainable report. Available analysis modes may include wildlife, search-and-rescue, and terrain-assessment workflows." },
  { id: "acreage", question: "How large can an analysis be?", answer: "The boundary must stay within the minimum and maximum acreage limits displayed in the app. HuntIntel Terrain currently supports areas from 5 through 2,000 acres. The server confirms the final acreage before purchase." },
  { id: "price", question: "How much does an analysis cost?", answer: "The exact price is based on the server-confirmed acreage and is displayed before purchase. Terrain analyses are sold as one-time purchases rather than a recurring Terrain subscription." },
  { id: "processing", question: "How long does an analysis take?", answer: "Processing time depends on the selected area and available terrain data. An analysis may take several minutes. You can open My Analyses to check its status and resume eligible work." },
  { id: "find-purchase", question: "Where can I find an analysis I already purchased?", answer: "Open My Analyses. Completed analyses and eligible recoverable purchases are associated with the signed-in HuntIntel account. Make sure you are using the same account used for the original purchase." },
  { id: "missing-purchase", question: "Why is my purchase or analysis not appearing?", answer: "Confirm that you are signed into the correct HuntIntel account and have a working internet connection. Open My Analyses to trigger purchase recovery and refresh available analyses. If the analysis still does not appear, contact support and include your account email, platform, approximate purchase date, and analysis name." },
  { id: "outside-boundary", question: "Can I use my current location outside the analysis boundary?", answer: "Yes. Current-location, navigation, breadcrumb, and authorized SAR tools can use the device’s actual position even when it is outside the saved analysis polygon. The terrain results themselves remain associated with the area that was analyzed." },
  { id: "location-permission", question: "Why does HuntIntel Terrain request location permission?", answer: "Location is used only for user-requested features such as showing your current position, field navigation, breadcrumb recording, and authorized Live SAR sharing. Background location is requested only when you explicitly start a feature that requires it. You can stop tracking or sharing from the applicable feature." },
  { id: "automatic-tracking", question: "Does HuntIntel Terrain track me automatically?", answer: "No. Opening the app or an analysis does not automatically start background tracking. Breadcrumb recording and Live SAR location sharing require explicit user actions and provide visible controls to stop them." },
  { id: "location-not-moving", question: "Why is my location not moving on the map?", answer: "Confirm that Location Services and Precise Location are enabled for HuntIntel Terrain. Make sure current location or Field Navigation is active. GPS movement can appear limited indoors or over very short distances. Try moving outdoors with a clear view of the sky. Contact support if the timestamp updates but the marker does not move." },
  { id: "offline", question: "Can I use HuntIntel Terrain without internet access?", answer: "Downloaded analyses can provide supported offline map and analysis information. Some services, purchases, synchronization actions, live team features, and provider-restricted map layers require an internet connection." },
  { id: "offline-layer", question: "Why is a map or GIS layer unavailable offline?", answer: "Offline availability depends on the map provider’s license and technical support. HuntIntel Terrain identifies layers that require an internet connection instead of representing them as available offline." },
  { id: "teams", question: "How do Teams work?", answer: "A team owner can create a team, invite verified HuntIntel accounts, manage member roles, and share owned analyses. Access depends on each member’s assigned role and the analyses shared with that team." },
  { id: "sar-analysis", question: "Why is an analysis not available in Live SAR?", answer: "The analysis must first be explicitly shared with the selected team. The acting user must also have the role required to start the session, and Live SAR must be enabled for the service." },
  { id: "sar-emergency", question: "Is Live SAR an emergency service?", answer: "No. HuntIntel Terrain does not dispatch emergency responders and does not replace 911, local emergency services, incident command, professional search-and-rescue procedures, training, or safety equipment. Contact the appropriate emergency authority when immediate help is needed." },
  { id: "password", question: "How do I change or reset my password?", answer: "Use Forgot Password on the sign-in screen to request reset instructions. Signed-in users can also open Account to review available security options." },
  { id: "delete", question: "How do I delete my account?", answer: "Sign in, open Account, and choose Delete Account. Account deletion is permanent. Review the confirmation carefully before proceeding." },
  { id: "support-details", question: "What information should I include in a support request?", answer: "Include your HuntIntel account email, platform, app version, device and operating system, the screen or analysis involved, steps to reproduce the problem, the result you expected, and the result you received. Do not send your password, verification code, purchase token, or other secret credentials." },
  { id: "feature", question: "How do I request a new analysis mode or terrain feature?", answer: "Choose Request a Feature or email support@huntintelapp.com. Describe the problem you are trying to solve, the requested behavior, and how the feature would help." },
  { id: "legal", question: "Where can I read the Terms of Use and Privacy Policy?", answer: "Use the Terms of Use and Privacy Policy links at the bottom of this page or from the Account screen in the app." },
];

export const TROUBLESHOOTING_ITEMS = [
  "Confirm that the device has a working internet connection.",
  "Confirm that you are signed into the intended HuntIntel account.",
  "Close and reopen the relevant screen.",
  "Check that the app is updated to the latest available version.",
  "Confirm the required camera, photo, microphone, or location permission is enabled.",
  "For map issues, try another basemap and confirm the Map Layers settings.",
  "For location issues, enable Precise Location and test outdoors.",
  "For purchase issues, open My Analyses and allow purchase recovery to complete.",
  "For team or Live SAR issues, confirm the analysis is shared with the selected team.",
  "Record any visible error message and include it in the support request.",
];

export function createSupportMailto(action) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(action.subject)}&body=${encodeURIComponent(action.body)}`;
}

export function toggleExpandedId(currentId, nextId) {
  return currentId === nextId ? null : nextId;
}

export async function tryOpenExternalUrl(linking, url) {
  try {
    if (!(await linking.canOpenURL(url))) return false;
    await linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
