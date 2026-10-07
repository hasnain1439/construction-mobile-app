# Munshi — site app (Expo / React Native)

The phone app for the site **munshi** (and PM / Thekedar in the field): hazri, material, kharcha
and the daily log — **offline first**. Everything is saved on the phone at once and sent to the
server when there is signal. Roman Urdu is the default language (English and Urdu RTL too).

The app never shows material rates, purchase amounts, supplier details (beyond the name) or
contract values. Only wages, peshgi and the user's own cash.

| | |
|---|---|
| Stack | Expo SDK 57 (React Native 0.86, React 19.2), TypeScript strict, expo-router |
| Local data | expo-sqlite + **SQLCipher** (encrypted), drizzle-orm, key in expo-secure-store |
| Sync | custom outbox → `POST /sync/push`, cursor pull ← `GET /sync/pull` (server is the source of truth) |
| UI | NativeWind 4 (Tailwind 3), Inter, FlashList, 48 dp touch targets |
| Forms | react-hook-form + zod |
| Media | expo-image-picker + expo-image-manipulator (≤ 1280 px, JPEG 0.6), expo-audio (voice notes ≤ 30 s) |
| Background | expo-background-task (every ~15 min), NetInfo, AppState |
| Tests | jest-expo, @testing-library/react-native, better-sqlite3 (the real migrations, in memory) |

All dependency versions are pinned exactly (`npx expo install --check` is clean).

## Windows setup

1. **Node.js 22 LTS** and Git.
2. **Android Studio** (latest) → SDK Manager: Android SDK Platform 36, Build-Tools, Platform-Tools, an emulator image (Pixel, API 35/36, x86_64).
3. **JDK 17** — Android Studio ships one: set `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr`.
4. Environment variables (System Properties → Environment Variables):
   - `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
   - add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` to `Path`
   - check in a new terminal: `adb --version`
5. Install: `npm install`

The backend (`construction-platform`) must be running and seeded: `npm run db:seed` then `npm run dev`
(it listens on port 4000 on all network interfaces).

## API address (`.env`)

```bash
copy .env.example .env
```

`EXPO_PUBLIC_API_BASE_URL` must end in `/api/v1`.

| Where the app runs | Value |
|---|---|
| Android emulator | `http://10.0.2.2:4000/api/v1` (the emulator's name for your PC) |
| Real phone on the same Wi-Fi | `http://<PC Wi-Fi IP>:4000/api/v1` |

Find the PC's IP: run `ipconfig` and take **IPv4 Address** under *Wireless LAN adapter Wi-Fi*
(e.g. `192.168.1.20`). Windows Firewall must allow inbound TCP 4000 the first time
(allow Node.js on *Private* networks, or add a rule: `netsh advfirewall firewall add rule name="API 4000" dir=in action=allow protocol=TCP localport=4000`).
After changing `.env`, restart Metro with `npx expo start -c`.

## Run

The app uses **SQLCipher**, which needs a native build — it does not run in Expo Go with
encryption (in Expo Go the database falls back to an unencrypted file, development only).

**Emulator**

```bash
# start the emulator from Android Studio (Device Manager ▶), then:
npx expo run:android
```

The first build takes several minutes (Gradle). Later runs only start Metro: `npm start` and press `a`.

**Real phone (USB)**

1. Phone: Settings → About → tap *Build number* 7× → Developer options → **USB debugging** on.
2. Connect the cable, accept the "Allow USB debugging" prompt; `adb devices` must list it.
3. Set `.env` to the PC's Wi-Fi IP (above); phone and PC on the same Wi-Fi.
4. `npx expo run:android --device` and pick the phone.

**Sign in (seed data):** Rafaqat Ali (munshi) — `0321 1234567` (`+923211234567`). The OTP is
printed in the **backend console** (`SMS_PROVIDER=console`). Rafaqat works for two companies in
the seed, so after the code the app asks which company.

**Preview APK (EAS)** — profile `preview` in `eas.json` (internal APK; set the real API URL
there first). Not run as part of this step: `npx eas build -p android --profile preview`.

## Scripts

| Script | |
|---|---|
| `npm start` | Metro (dev client) |
| `npm run android` | `expo run:android` — native build + install |
| `npm run start:go` | Metro for Expo Go (no SQLCipher) |
| `npm run lint` | `expo lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | jest |
| `npm run api:types` | regenerate `src/api/schema.ts` from the backend OpenAPI (`/api/docs/openapi.json`) |
| `npm run db:generate` | new drizzle migration after changing `src/db/schema.ts` |
| `npm run doctor` | `expo-doctor` |

## Architecture

```
app/                     expo-router screens
  (auth)/login, otp, select-company
  first-sync, update     first full download · forced update
  (tabs)/aaj, hazri, maal, kharcha, mazeed
  hazri/ maal/ kharcha/ log/   forms (stack screens)
  sync-problems, notifications
components/              Screen, Header, BigButton, StepperInput, QuantityInput, MoneyText, StatusChip,
                         SyncBanner, EmptyState, PhotoPicker, VoiceRecorder, ListItem, BottomSheet,
                         ConfirmSheet, ProjectSwitcher, MaterialLines
src/
  api/        fetch client (refresh mutex), session (SecureStore), auth calls, OpenAPI types
  db/         drizzle schema + migrations, encrypted open, live queries, generic row store
  sync/       outbox, push, pull, attachments queue, engine (one run at a time), triggers
  features/   row types, read queries, write actions (optimistic rows + mutation), session, project, media
  i18n/       en (source of keys), roman (default, complete), ur (RTL, falls back to roman)
  lib/        money (paisa, Rs 27,75,000), dates (Asia/Karachi), phone, uuid v7, permissions
```

### Local database

* Every pulled table is mirrored as `{ id, project_id, client_id, local, data(JSON), updated_at }`.
  `data` is exactly what the server sent; `local = 1` marks a row written on the phone that the
  server has not confirmed yet.
* `outbox` — mutations in creation order (`seq`), with `depends_on`, status, attempts / back-off,
  the optimistic row snapshots (`local_changes`) and a short label for "Sync problems".
* `attachments_queue` — photos and voice notes waiting to upload. `sync_state` — pull cursor and
  timings. `kv` — the chosen site.
* The SQLCipher key is 32 random bytes per install, kept in SecureStore. Logout (and a revoked
  phone) wipes every table.

### Sync rules

One run (never two at once): **(1)** upload queued files → **(2)** push the outbox → **(3)** pull
until `hasMore = false`. Runs on app start / foreground, when the network comes back, every
~15 min in the background (OS decides the exact time), on pull-to-refresh, and right after every save.

| Push result | On the phone |
|---|---|
| `APPLIED` / `DUPLICATE` | done; a row created on the phone takes the server id |
| `REJECTED` | the optimistic change is rolled back exactly; the entry appears under **Sync problems** with the reason in the user's language |
| `RETRY` / no network | back off 15 s → 30 s → 1 min … max 30 min; nothing after it is sent (order matters) |

* Only the ready **prefix** of the outbox is sent (≤ 100 per call), with `X-Pending-Mutations`
  so the office sees how many entries are stuck on the phone.
* A record made offline has `id = clientId` (UUID v7). Later entries that refer to it list it in
  `dependsOn`; the server swaps in the real id.
* Pull applies each page in **one SQLite transaction**. Rows still waiting in the outbox are not
  overwritten; optimistic copies are dropped when the server row arrives (same `clientId`, or for
  hazri the same worker + day). `deletes` are tombstones. `resetRequired` (cursor too old, or the
  user's site access changed) → wipe the mirror (unsent work stays) and pull a fresh snapshot.
* Logout first tries to send everything; if entries are still unsent the user must confirm
  ("these will be deleted from this phone").
* On start the app checks `GET /auth/mobile-config`; a build older than `minimumAppVersion` is blocked.

## Offline test script (manual)

Backend running + seeded; app signed in as Rafaqat on the emulator.

1. **Hazri offline** — emulator ⋯ → Cellular: *Data: Off* and Wi-Fi off (or airplane mode).
   Banner turns amber "Offline — saved on phone". Hazri → *All present* → *Save hazri*.
   The workers show "Not sent yet"; the banner shows "N entries waiting".
2. **New worker offline** — Hazri → *New worker* → "Test Mazdoor" → save → mark him *Full* → save.
3. **Kharcha offline** — Kharcha → *Add kharcha* Rs 500 chai, slip photo from the camera.
   Cash in hand drops by Rs 500 at once.
4. **Daily log offline** — Mazeed → Daily log: tick *Rain* + *Curing*, write work done, 1 photo,
   record a 10 s voice note → save. Aaj shows "Daily log written".
5. **Back online** — network on. Within seconds the banner goes "Syncing…" → "All synced".
   Web: Projects → DHA → Daily Logs shows today's log with the photo and the voice note;
   the hazri and the kharcha appear; the new worker is on the site.
6. **Late sync badge** — an entry that reaches the server more than 48 h after it was made on
   the phone is marked late. The seed has one: on the web, the DHA daily log from 3 days ago shows "📱 late sync".
7. **Refused entry** — on the web, lock this week's wages (send for approval). On the phone
   (offline) change a hazri of this week → go online. The change is undone on the phone and
   *Sync problems* shows "This week's hazri is locked".
8. **Kill during sync** — go offline, add 3 kharcha, go online and immediately swipe the app
   away. Reopen: nothing is lost or duplicated (same clientIds → `DUPLICATE`).
9. **Logout with unsent work** — offline, add a kharcha, Mazeed → Log out → the warning shows
   "1 entries are not sent yet…"; cancel, go online, log out → no warning.

## Known limitations

* Background sync is best effort: Android may delay it (battery saver, Doze); iOS decides itself.
* Photos already on the server are listed but not shown on the phone (the sync only carries
  attachment ids); photos taken on this phone are shown from local storage.
* Notifications are read-only on the phone (no push notifications yet).
* Two pending entries that change the same row (e.g. two kharcha on the cash balance) restore the
  first one's snapshot when one is refused; the next pull corrects the numbers.
* Hazri can be entered up to 6 days back (the server allows a munshi 7).
