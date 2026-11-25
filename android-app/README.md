# RozBazaar Android app (WebView)

Replaces the PWABuilder/TWA build (Nov 2026). New Play app (21 Nov 2026): package `shop.rozbazaar.app`, listed as "RozBazaar: Sabzi Mandi at Home".
(The old app `shop.rozbazaar.twa` got versionCode 5/6 from this project before the switch.)
Shows https://rozbazaar.shop/?source=pwa in a full-screen WebView — no TWA / androidbrowserhelper code.

- `MainActivity.java` — WebView, splash, offline screen + Retry, pull-to-refresh, back button,
  external links (WhatsApp, phone, maps, other sites) to their own apps, photo picker + camera,
  location permission, Google login in a Chrome Custom Tab (Google blocks login inside WebViews;
  it returns through the verified rozbazaar.shop App Link — `customer/.well-known/assetlinks.json`).
- `WebBridge.java` + `assets/rb-bridge.js` — what WebView lacks, done with the phone's features:
  voice (SpeechRecognition → Android SpeechRecognizer), share (navigator.share → share sheet),
  blob downloads → share sheet, permission state, pull-to-refresh rules. Only on rozbazaar.shop.
- No push code: the site checks `'Notification' in window`, which is false in a WebView.

## Build (needs JDK 17+ and the Android SDK, platform 36)
Signing passwords are never in the repo. Make a file OUTSIDE the repo with
`storeFile=…/signing.keystore`, `storePassword=…`, `keyAlias=rozbazaar`, `keyPassword=…`, then:

    export ANDROID_HOME=/path/to/android-sdk RB_SIGNING_PROPS=/path/to/signing.properties
    ./gradlew assembleRelease bundleRelease

Raise `versionCode` (and `versionName`) in `app/build.gradle` for every Play upload.
shop.rozbazaar.app: 1 = 1.0.0 (upload attempt), 2 = 1.0.1 (first release), 3 = 1.1.0 (notifications + fast location).
