# Android build and release verification

## Payment audit and implementation

Before this change the app had no Google Play Billing dependency or billing permission. `PaymentGate` only created an API attempt and displayed a placeholder; it never queried ProductDetails, launched Play Billing, sent a token for verification, consumed a purchase, or recovered callbacks.

The app uses the Expo 53 / React Native 0.79-compatible `react-native-iap` 14.0.1 with Google Play Billing 8.0.0 and its matched Nitro runtime. Expo prebuild adds `com.android.vending.BILLING`. It queries both fixed one-time products, displays `Product.displayPrice`, binds SHA-256(`draftId`) as `obfuscatedAccountId`, sends the purchase token to the Terrain API, and calls consumable `finishTransaction` only after the API durably returns an active entitlement. Consumption also acknowledges the purchase. A secure local draft hint is only a pointer to authoritative API state. Active/consumed entitlements auto-submit or resume, and paid failures remain in Pending Analyses with a no-repurchase retry.

Products:

- `standard_analysis` → `com.huntintel.terrainintelligence.analysis.standard`
- `large_analysis` → `com.huntintel.terrainintelligence.analysis.large`

Build from a generated native project with JDK 17 and Android SDK 35: `npx expo prebuild --platform android --no-install && cd android && ./gradlew bundleRelease`. Expected output: `android/app/build/outputs/bundle/release/app-release.aab`. Do not upload until Play App Signing/release signing and the production API verifier are configured.

Consumable lifecycle: the API verifies the globally unique token and records the entitlement first; the client then consumes/acknowledges it. Submission failure preserves server value. Replayed tokens and callbacks resume the same entitlement/job and cannot create a second one.

CI expectation: Node 22, `npm ci`, `npm test`, `npx tsc --noEmit`, and `npx expo export --platform android`. Configure only `EXPO_PUBLIC_TERRAIN_API_BASE_URL` and an app-restricted `EXPO_PUBLIC_TERRAIN_MAPBOX_ACCESS_TOKEN`. Keystores/Play credentials remain outside Git and no Play submission is automated by Build Section 11.

Emulator script: login; draft/quote/local development payment API; processing/library replay; media permission-on-use; offline package download/open; restart; simulated location/navigation; breadcrumb lifecycle; external Google Maps handoff where installed; team share; opt-in foreground SAR; disconnect, queue allowed durable operations, reconnect twice and verify no duplicates; PDF open/share; revoke access and verify future API/download/sync/SAR denial. Inspect background-location and foreground-service permissions/configuration and the persistent visible stop affordance. Emulator results do not establish physical-device OEM background execution behavior.
