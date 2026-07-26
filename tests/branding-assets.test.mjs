import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function pngMetadata(relativePath) {
  const bytes = await readFile(new URL(relativePath, import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
    size: bytes.length,
  };
}

test("Google launcher, adaptive, splash, and Play icons are wired and valid", async () => {
  const config = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
  const adaptiveXml = await readFile(
    new URL("../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml", import.meta.url),
    "utf8",
  );
  const v31Styles = await readFile(
    new URL("../android/app/src/main/res/values-v31/styles.xml", import.meta.url),
    "utf8",
  );
  const appIcon = await pngMetadata("../assets/images/icon.png");
  const adaptiveIcon = await pngMetadata("../assets/images/adaptive-icon.png");
  const splashIcon = await pngMetadata("../assets/images/splash-icon.png");
  const playIcon = await pngMetadata("../store-assets/google-play-icon.png");

  assert.equal(config.expo.icon, "./assets/images/icon.png");
  assert.equal(config.expo.android.icon, "./assets/images/icon.png");
  assert.deepEqual(config.expo.android.adaptiveIcon, {
    foregroundImage: "./assets/images/adaptive-icon.png",
    backgroundColor: "#020706",
  });
  assert.deepEqual(config.expo.splash, {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#020706",
  });
  assert.deepEqual(
    { width: appIcon.width, height: appIcon.height },
    { width: 1024, height: 1024 },
  );
  assert.deepEqual(
    { width: adaptiveIcon.width, height: adaptiveIcon.height },
    { width: 1024, height: 1024 },
  );
  assert.deepEqual(
    { width: splashIcon.width, height: splashIcon.height },
    { width: 1024, height: 1024 },
  );
  assert.deepEqual(
    { width: playIcon.width, height: playIcon.height, colorType: playIcon.colorType },
    { width: 512, height: 512, colorType: 6 },
  );
  assert.ok(playIcon.size <= 1024 * 1024);
  assert.match(adaptiveXml, /@drawable\/ic_launcher_foreground/);
  assert.match(v31Styles, /android:windowSplashScreenAnimatedIcon/);
});
