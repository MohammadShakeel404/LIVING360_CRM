# Living 360 as an Android app (APK / AAB)

The Android app is a **Trusted Web Activity (TWA)**: a small native wrapper that opens your live
website full-screen, with your icon, splash screen and no browser bar. Every update you deploy to
the website appears in the app instantly — no need to rebuild the APK.

## 1. Put the website online (required first)

The APK only wraps a live **https** address; it cannot run from `localhost`.

1. Create a Postgres database (Neon, Supabase, …) and deploy the app (Vercel, Render, Railway or a VPS).
   Follow **README → Going live**.
2. Point a domain at it, e.g. `app.living360.in` (HTTPS is required).
3. Set env vars `DATABASE_URL`, `NEXTAUTH_URL=https://app.living360.in`, `NEXTAUTH_SECRET`.
4. Open `https://app.living360.in` on your phone in Chrome and sign in to confirm it works.

## 2. Generate the Android package (PWABuilder — no coding)

1. Go to **https://www.pwabuilder.com**, enter `https://app.living360.in`, click **Start**.
2. It should report the manifest, service worker and icons as found. Click **Package for stores**
   → **Android** → **Generate package**.
3. In the options:
   - **Package ID**: `in.living360.app` (permanent — can never change after publishing)
   - **App name**: `Living 360`, **Launcher name**: `Living 360`
   - **Start URL**: `/dashboard`
   - **Theme / nav colour**: `#251A51`, **Background**: `#F6F5FB`
   - **Signing key**: *Create new* — fill in your company details and **choose and write down a strong password**
4. Download the zip. It contains:
   - `app-release-signed.apk` — install directly on phones
   - `app-release-bundle.aab` — upload to Google Play
   - `signing.keystore` + `signing-key-info.txt` — **back these up safely** (Google Drive + a USB drive).
     Losing them means you can never update the app.
   - `assetlinks.json` — contains your key fingerprint

## 3. Link the app to the website (removes the browser bar)

1. Open `assetlinks.json` from the zip and copy the value inside `sha256_cert_fingerprints`
   (looks like `AB:CD:12:…`).
2. On your hosting, set the env vars and redeploy/restart:
   ```
   ANDROID_PACKAGE_NAME=in.living360.app
   ANDROID_SHA256_FINGERPRINTS=AB:CD:12:...
   ```
3. Check `https://app.living360.in/.well-known/assetlinks.json` shows your package and fingerprint.

## 4. Install on Android phones (without Play Store)

1. Send `app-release-signed.apk` to the phone (WhatsApp to yourself, Google Drive or USB).
2. Tap it → allow **Install unknown apps** for that app (WhatsApp / Files / Drive) when asked → **Install**.
3. Open **Living 360** and sign in.

If you see a browser bar at the top, step 3 isn't done yet (or the fingerprint doesn't match).
Clear the app's storage (long-press icon → App info → Storage → Clear) after fixing it.

## 5. Publish on Google Play (optional)

1. Create a Google Play Console account (one-time US$25): https://play.google.com/console
2. **Create app** → upload `app-release-bundle.aab` to **Internal testing** first (share with your team).
3. Play re-signs the app: go to **Setup → App signing**, copy the **SHA-256** of the *App signing key*
   and **add it** to `ANDROID_SHA256_FINGERPRINTS` (comma-separated, keep the first one too).
4. Fill in the store listing, privacy policy URL and content rating, then promote to Production.

## Updating the app later

- Normal changes (features, fixes): just deploy the website — the app updates automatically.
- Only rebuild the APK if you change the app name, icon, package or colours: use PWABuilder again
  with **Use existing key** and the same `signing.keystore`, and increase the **version code**.
