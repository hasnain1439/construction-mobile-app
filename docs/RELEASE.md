# Releasing the Munshi app

How to build the pilot APK, put it on phones, ship an over-the-air (OTA) update, build the Play
Store bundle, and undo a bad update. Everything runs on EAS (Expo's build service); nothing needs
Android Studio except the low-end emulator check at the end.

## 1. One-time set-up (owner)

| What | How |
|---|---|
| Expo account | Sign up at expo.dev (free plan is enough for the pilot; builds queue longer). Create an organisation if the company should own the app. |
| EAS CLI | `npm i -g eas-cli` (or prefix every command with `npx`), then `eas login`. |
| Project id | In `construction-mobile`: `eas init`. Because the config is `app.config.ts`, EAS cannot write the id itself — paste it into `EAS_PROJECT_ID_FROM_INIT` in `app.config.ts` (or set `EAS_PROJECT_ID` in your shell **and** as an EAS environment variable). Until then OTA updates are switched off (`updates.enabled: false`). |
| API addresses | Replace the placeholders in `eas.json` → `build.preview.env` / `build.production.env` `EXPO_PUBLIC_API_BASE_URL` (`https://…/api/v1`). Pilot and store builds **only talk HTTPS** (`usesCleartextTraffic` is on in development builds only). |
| Android keystore | Let EAS create and keep it: on the first `eas build -p android` answer **yes** to "Generate a new Android Keystore?". Download a backup once with `eas credentials -p android` → *Download credentials* and keep it somewhere safe (losing it = no more Play Store updates). Each variant (`.dev`, `.preview`, store) gets its own keystore. |
| versionCode | Kept by EAS (`cli.appVersionSource: "remote"`). The first build asks to initialise it — accept (starts at 1). To set it by hand: `eas build:version:set -p android`. |
| GitHub Actions | Repository secret **`EXPO_TOKEN`** (expo.dev → Account settings → Access tokens) for `.github/workflows/eas-build.yml`. |
| Optional keys | Sentry / PostHog: EAS environment variables (expo.dev → project → Environment variables) — `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, and the secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` for source maps. Never in git. |
| Play Store (production only) | Google Play developer account, an app with package **`pk.construction.munshi`**, and the very first AAB uploaded by hand in Play Console. For `eas submit`: a Google service-account JSON key with release rights (`eas credentials` → *Google Service Account*). |

## 2. Variants

`APP_VARIANT` (set by each `eas.json` profile) picks the name, the Android package and the OTA
channel, so all three can be installed on the same phone:

| Profile | App name | Package | Output | OTA channel |
|---|---|---|---|---|
| `development` | Munshi Dev | `pk.construction.munshi.dev` | dev-client APK (internal) | `development` |
| `preview` | Munshi Pilot | `pk.construction.munshi.preview` | APK, internal distribution — **the pilot** | `preview` |
| `production` | Munshi | `pk.construction.munshi` | AAB for Play Store | `production` |

Check what a variant resolves to: `APP_VARIANT=preview npx expo config --type public`
(PowerShell: `$env:APP_VARIANT='preview'; npx expo config --type public`).

## 3. Version rules

* `VERSION` in `app.config.ts` is semver (`1.0.0`) and the only number people change.
* `runtimeVersion` follows it (policy `appVersion`): an OTA update reaches **only** builds with the
  same version.
* **Native change** (new / upgraded package with native code, Expo SDK upgrade, a config-plugin or
  permission change, icon / splash, package name): bump `VERSION` (minor, e.g. 1.1.0) and make a
  new build. The appVersion policy does *not* detect native changes for you — if in doubt, build.
* **JavaScript / text / image-only change**: keep `VERSION`, ship it with `eas update` (section 5).
* Bug-fix build without native change: patch (1.0.1) only when you need a new binary anyway.
* Android `versionCode` is increased by EAS on every preview / production build (`autoIncrement`).
* Old binaries that must go: raise `minimumAppVersion` on the server (`/auth/mobile-config`); those
  phones show the *Please update the app* screen until the new build is installed.
* Every release gets a CHANGELOG section (rename *Unreleased* to the date).

## 4. Pilot APK: build and install

```bash
cd construction-mobile
npx eas build -p android --profile preview
```

(or GitHub → Actions → *EAS build* → profile `preview`, platform `android`). The build runs
typecheck and tests first in the workflow; locally run `npx tsc --noEmit && npx jest` before.

When it finishes, the build page (link in the terminal and on expo.dev → Builds) shows a **QR code
and an install link**.

**On the phone (link / QR):** open the link in Chrome → *Install* → Android asks to allow installs
from this source (Chrome) → allow → install. Send the link to munshis by WhatsApp; it works for
anyone with the link while the build is kept (internal distribution).

**With a cable (adb):** download the `.apk` from the build page, then

```bash
adb devices                          # phone listed, USB debugging on
adb install -r munshi-pilot.apk      # -r keeps the data when updating
```

A newer pilot APK installs over the old one and keeps the signed-in session and unsent entries
(same package, same keystore, higher versionCode). Uninstalling deletes unsent entries — tell
munshis to wait for *All synced* first.

## 5. OTA update (JavaScript-only change)

Only for changes that keep the same `VERSION` (see section 3). The update is built **on your PC**,
so the `EXPO_PUBLIC_*` values come from your shell / `.env`, **not** from `eas.json`. Always set the
variant and API address explicitly:

```bash
# bash
APP_VARIANT=preview EXPO_PUBLIC_API_BASE_URL=https://pilot-api.example.pk/api/v1 \
  npx eas update --channel preview --message "Hazri: fix overtime total"
```

```powershell
# PowerShell
$env:APP_VARIANT='preview'; $env:EXPO_PUBLIC_API_BASE_URL='https://pilot-api.example.pk/api/v1'
npx eas update --channel preview --message "Hazri: fix overtime total"
```

(If the variables live in EAS environment variables instead: `npx eas update --channel preview --environment preview --message "…"`.)

How phones pick it up:

* On every cold start the app checks (`checkAutomatically: ON_LOAD`), keeps starting with what it
  has (`fallbackToCacheTimeout: 0`) and downloads in the background; **the next start runs the
  update**.
* While the app stays open, it also checks quietly when it comes back to the foreground (at most
  every 6 hours) and downloads; again used on the next start. It never reloads in the middle of an
  entry.
* Check on a phone: *Mazeed* → bottom line shows `Version 1.0.0 (preview · 0193ab12)` — the channel
  and the first 8 characters of the running update id (`eas update:list --branch preview` shows the ids).

Production: the same with `APP_VARIANT=production`, the production API URL and `--channel production`.

## 6. Roll back an update

```bash
npx eas update:list --branch preview                 # find the last good update group
npx eas update:republish --group <good-group-id>     # publish it again as the newest
# or: back to the JavaScript inside the installed APK
npx eas update:roll-back-to-embedded --channel preview
```

Phones switch on their next start (or after the quiet check + a restart). Newer eas-cli versions
also offer the interactive `npx eas update:rollback`.

## 7. Production AAB (Play Store)

```bash
npx eas build -p android --profile production        # app bundle, versionCode +1
npx eas submit -p android --profile production       # Play Console → internal track, as a draft
```

The first AAB must be uploaded by hand in Play Console (Google's rule); after that `eas submit`
works. Promote internal → closed → production in Play Console. The forced-update screen opens the
Play Store page of `pk.construction.munshi`.

## 8. Background sync check (dev build)

Background sync cannot run in Expo Go or in jest; the scheduling logic is unit-tested
(`tests/sync/triggers.test.ts`), the OS part has to be checked on a phone or emulator once per
native change:

1. Install a dev build: `npx eas build -p android --profile development` (or `npx expo run:android`),
   start Metro with `npx expo start --dev-client`, sign in and finish the first sync.
2. The task is registered once the app is *ready*:
   `adb shell dumpsys jobscheduler | grep -i munshi` lists a `SystemJobService` job for
   `pk.construction.munshi.dev` (WorkManager), or ask WorkManager directly:
   `adb shell am broadcast -a androidx.work.diagnostics.REQUEST_DIAGNOSTICS -p pk.construction.munshi.dev`
   then `adb logcat -s WM-DiagnosticsWrkr`.
3. Run it now instead of waiting 15 minutes: open React Native DevTools (press `j` in Metro) and
   run `__munshiRunBackgroundSync()` in the console (dev builds only).
4. Real-life test: airplane mode → add a kharcha → swipe the app away (do **not** *Force stop*, that
   cancels scheduled work) → airplane mode off → wait 15–30 minutes with the screen off → the
   web app shows the kharcha. Android may delay it more in Doze / battery saver.
5. Pilot phones: Settings → Apps → Munshi Pilot → Battery → *Unrestricted / No restrictions*.
   Xiaomi, Oppo, Vivo, Tecno and Infinix kill background work aggressively otherwise.
6. Logout unregisters the task (`dumpsys jobscheduler` no longer lists it).

### "Upload photos on Wi-Fi only"

*Mazeed* → toggle (off by default; kept on the phone across logouts). On mobile data, photos and
voice notes stay queued and so do entries that point at one of them (the server needs the file
first) and the entries after those (the outbox keeps its order); entries before them sync as usual.
The banner shows "Photos waiting for Wi-Fi". Joining Wi-Fi (or turning the setting off) starts a
sync. Logout always sends everything, whatever the network. Test: toggle on, mobile data only, add a
kharcha with a slip photo → stays *waiting*; connect Wi-Fi → photo and kharcha go.

Photos are always compressed before they are queued: long side 1280 px, JPEG quality 0.6
(`src/features/media.ts`, `tests/media.test.ts`) — typically 150–400 KB.

## 9. Low-end device pass (Android 9, 2 GB)

What changed in the code for slow phones:

* Long lists use `@shopify/flash-list` (recycling): Hazri day and week, Maal stock, Kharcha
  entries, notifications, log history and now **Sync problems** (was a `.map` in a ScrollView).
* Rows are memoised components (`React.memo`): Hazri day / week rows, Maal stock, Kharcha entries,
  notifications, log history, sync problems. Tapping *Full / Half / Absent* on one worker re-renders
  that worker only — the mark handler is a stable `useCallback` that reads the latest draft inside
  the state update.
* Hazri groups attendance by worker once per query (a `Map`) instead of a `find` / `filter` per row
  per render (O(n) instead of O(n²) with 50+ workers × 7 days).
* Left as plain lists on purpose: the *incoming* deliveries on Maal (a handful, inside the list
  header), forms with text inputs per line (*Stock count*, *Receive* — recycling would move focus
  and typed values between rows) and short pick lists (sites, companies, languages).

The emulator profile could not be run where this was written; do this before the pilot:

1. Android Studio → SDK Manager → *Android 9.0 (Pie), API 28, Google APIs x86_64* image.
2. Device Manager → *Create device* → a small phone (e.g. Pixel 2, 1080×1920) → API 28 →
   *Advanced*: RAM **2048 MB**, VM heap 256 MB, 2 CPU cores, internal storage 4 GB.
   Command line: `avdmanager create avd -n munshi-lowend -k "system-images;android-28;google_apis;x86_64" -d pixel_2`,
   then set `hw.ramSize=2048` and `hw.cpu.ncore=2` in `~/.android/avd/munshi-lowend.avd/config.ini`.
3. Install the **preview APK** (release JavaScript; a dev build is much slower and not
   representative): `adb install -r munshi-pilot.apk`.
4. Use a site with at least 50 workers, 30 days of hazri, 100 kharcha entries and 40
   notifications (seed on the web or the API demo seed).
5. Developer options → *Profile HWUI rendering* → *On screen as bars*. Check:
   * cold start to *Aaj*: `adb shell am start -W pk.construction.munshi.preview/.MainActivity` → `TotalTime` under 5 s;
   * Hazri: scroll the list fast, tap *Full / Half* on 10 workers, switch day ↔ week, previous / next day — no visible stutter, bars mostly under the green line;
   * Maal, Kharcha, Notifications, *My logs*, *Sync problems* (make 20 refused entries offline): fast scroll without blank rows staying;
   * camera photo on Kharcha → the screen stays responsive while the photo is compressed;
   * `adb shell dumpsys gfxinfo pk.construction.munshi.preview` → *Janky frames* under 10 %;
   * `adb shell dumpsys meminfo pk.construction.munshi.preview` → *TOTAL PSS* under ~250 MB; switch to the camera and back — the app must not restart (no lost form).
6. Note the results (phone / emulator, numbers) in the pilot notes; anything above the limits → open an issue with the screen and the numbers.
