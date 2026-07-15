# HuntIntel Terrain Google

Expo/React Native Android emulator MVP for weekend terrain analysis testing.

Completed saved analyses expose versioned PDF generation from Results. The app downloads an authorized report into temporary cache storage, opens the Android share sheet, and removes the cached file afterward. No signed URL or report binary is persisted in secure session or offline-package state.

Build Section 1 adds the complete shared HuntIntel account flow. Session tokens are persisted with Expo SecureStore; the app contains no issuer signing keys, database credentials, or Postmark token.

Build Section 2 adds an authenticated My Analyses library with pagination, boundary previews, status, owner/shared role, and read-only result replay.

## Local development

```bash
cp .env.example .env
npm install
npm test
npm run start:expo
```

Set `EXPO_PUBLIC_TERRAIN_API_BASE_URL` to a Codespaces forwarded URL or a deployed API URL for emulator access.
