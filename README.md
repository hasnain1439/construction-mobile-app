# Munshi — site app (Expo / React Native)

The phone app for the site **munshi** (and PM / Thekedar in the field): hazri, material, kharcha
and the daily log, **offline first**. Every save lands on the phone at once and goes to the server
when there is signal. Roman Urdu is the default language (English and Urdu RTL too).

The app never shows material rates, purchase amounts, supplier details (beyond the name) or
contract values, only wages, peshgi and the user's own cash.

What changed and when: [CHANGELOG.md](CHANGELOG.md).

| | |
|---|---|
| Stack | Expo SDK 57 (React Native 0.86, React 19.2), TypeScript strict, expo-router |
| Local data | expo-sqlite + **SQLCipher** (encrypted), drizzle-orm, key in expo-secure-store |
| Sync | custom outbox → `POST /sync/push`, cursor pull ← `GET /sync/pull` (server is the source of truth) |
| UI | NativeWind 4 (Tailwind 3), Cabin font, MaterialCommunityIcons, expo-linear-gradient, FlashList, 48 dp touch targets |
| Forms | react-hook-form + zod |
| Media | expo-image-picker + expo-image-manipulator (≤ 1280 px, JPEG 0.6), expo-audio (voice notes ≤ 30 s) |
| Background | expo-background-task (every ~15 min, dev/production builds only), NetInfo, AppState |
| Tests | jest-expo, @testing-library/react-native, better-sqlite3 (the real migrations, in memory) |

## Setup

1. **Node.js 22 LTS** and Git, then `npm install`.
2. The backend (`construction-platform`) running and seeded: `npm run db:seed`, then `npm run dev`
   (listens on port 4000 on all network interfaces).
3. API address: `copy .env.example .env` and set `EXPO_PUBLIC_API_BASE_URL` (must end in `/api/v1`).

| Where the app runs | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Real phone (Expo Go or a build) on the same Wi-Fi | `http://<PC Wi-Fi IPv4>:4000/api/v1` |
| Android emulator | `http://10.0.2.2:4000/api/v1` (the emulator's name for your PC) |

Find the PC's IP with `ipconfig` → **IPv4 Address** under *Wireless LAN adapter Wi-Fi*
(e.g. `192.168.1.20`). After changing `.env`, restart Metro with `npx expo start -c`.

**Windows Firewall** must allow inbound TCP **8081** (Metro) and **4000** (API) on *Private*
networks: allow Node.js when Windows asks, or

```bash
netsh advfirewall firewall add rule name="Metro 8081" dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="API 4000" dir=in action=allow protocol=TCP localport=4000
```

## Run with Expo Go (quickest)

1. Install **Expo Go** on the phone; phone and PC on the **same Wi-Fi**.
2. `.env` points at the PC's Wi-Fi IPv4 (above).
3. `npx expo start -c` and scan the QR code with Expo Go (or `npm run start:go`).

Expo Go limits (development only):

* No SQLCipher: the local database is an **unencrypted** file.
* No background sync task: syncing still runs on start, foreground, network back, pull-to-refresh
  and after every save. The 15-minute background task works only in a dev or production build.

## Run a native build (emulator or USB phone)

Needs Android Studio (SDK Platform 36, Build-Tools, Platform-Tools, an x86_64 emulator image),
JDK 17 (`JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`), `ANDROID_HOME` =
`C:\Users\<you>\AppData\Local\Android\Sdk` with `platform-tools` and `emulator` on `Path`
(check: `adb --version`).

* **Emulator:** start it from Android Studio (Device Manager ▶), then `npx expo run:android`.
  The first Gradle build takes several minutes.
* **USB phone:** enable *Developer options* → **USB debugging**, accept the prompt
  (`adb devices` lists it), set `.env` to the PC's Wi-Fi IP, then `npx expo run:android --device`.

## Sign in

* **Phone + SMS code** (default). The code also goes to the user's **email** when they have one;
  the code screen says so. With the seed backend (`SMS_PROVIDER=console`) the code is printed in
  the backend console.
* **Phone + password**: for when the SMS does not arrive (password set by the Thekedar, or when
  accepting the invite).
* If the number belongs to more than one company, the app asks which **company** next.
* Seed user: Rafaqat Ali (munshi), `0321 1234567` (`+923211234567`), in two companies.

After sign-in the app does a first full sync. On start it checks `GET /auth/mobile-config`;
a build older than `minimumAppVersion` is blocked with an update screen.

## Screens

| Tab | |
|---|---|
| **Aaj** | greeting, my cash card, today's to-do (hazri, daily log, incoming material, floats, settlement), quick actions |
| **Hazri** | mark the day (full, half, absent, overtime) and see the week, *Naya mazdoor*, peshgi, measurements, settlement |
| **Maal** | receive dispatches and purchases, usage, owner delivery, purchase, stock count, site stock |
| **Kharcha** | cash in hand, add kharcha with slip photo, top-up request |
| **Mazeed** | daily log (photos, voice note) and my logs, notifications, sync problems, sync status, language, log out |

**Naya mazdoor** offers the company's own active **worker types** (synced `worker_types`, named in
the current language). Picking a type fills its daily rate for roles that may set rates; leaving
the rate empty lets the server use the type's rate. Before the first sync it falls back to
Mistri / Mazdoor. Type names on the Hazri list come from the same table
(`src/features/workerTypes.ts`).

## Offline-first sync

* **Local SQLite** (`src/db`): every pulled table is mirrored as
  `{ id, project_id, client_id, local, data(JSON), updated_at }`; `local = 1` is a phone-made row
  the server has not confirmed. Pulled tables (`SYNC_TABLES` in `src/db/schema.ts`) include
  projects, workers, **worker_types**, project_workers, attendance, settlements, advances,
  materials, dispatches, purchases, site_stock, daily_logs, cash accounts / entries, settings,
  holidays and notifications.
* **Outbox:** mutations in order with `depends_on`, back-off and the optimistic row snapshots.
  `attachments_queue` holds photos and voice notes waiting to upload.
* **One run at a time** (`src/sync/engine.ts`): upload files → push the outbox → pull until
  `hasMore = false`. Runs on start / foreground, network back, after every save, pull-to-refresh,
  and every ~15 min in the background (builds only, OS decides the time).

| Push result | On the phone |
|---|---|
| `APPLIED` / `DUPLICATE` | done; a phone-made row takes the server id |
| `REJECTED` | the optimistic change is rolled back; the entry shows under **Sync problems** in the user's language |
| `RETRY` / no network | back off 15 s → 30 s → 1 min … max 30 min; nothing after it is sent |

* Only the ready prefix of the outbox is sent (≤ 100 per call), with `X-Pending-Mutations`.
* Offline records have `id = clientId` (UUID v7); later entries list it in `dependsOn`.
* Each pull page is one SQLite transaction; rows waiting in the outbox are not overwritten;
  `deletes` are tombstones; `resetRequired` wipes the mirror (unsent work stays) and pulls a snapshot.
* Logout first tries to send everything and warns if entries would be lost. Logout and a revoked
  phone wipe every table.

**Migrations** live in `src/db/migrations` (generate with `npm run db:generate` after changing
`src/db/schema.ts`). `0001_worker_types.sql` adds `worker_types` and clears the pull cursor so
existing phones pull one fresh snapshot.

## Languages

English, **Roman Urdu** (default) and **Urdu** (RTL), chosen under Mazeed. Dictionaries are in
`src/i18n/`: `en.ts` (source of keys), `roman.ts` (complete), `ur.ts` (falls back to Roman, then
English). Server error codes map to `err.*` keys; the server's own text is never shown.

## Design

* Warm "cabin" palette shared with the web app (charcoal `#201F1E`, sand `#B5A18B`,
  sun `#FFCF68`, stone `#E4E0E0`): Tailwind tokens in `tailwind.config.js`, the same raw values
  plus card / top-bar shadows in `src/lib/theme.ts` (for icons, tab bar, spinners).
* **Cabin** font (`@expo-google-fonts/cabin`; `font-medium` / `font-semibold` / `font-bold`).
* Icons: screens pass short emoji ids; `components/Icon.tsx` maps them to MaterialCommunityIcons
  vector icons (unknown values fall back to text). Add new ones to its emoji map.
* `components/WarmBackdrop.tsx`: warm gradient behind every `Screen`.
* Login: `components/BuildingHero.tsx` with the drifting `assets/login-building.jpg` photo.

## Project layout

```
app/                     expo-router screens
  (auth)/login, otp, select-company
  first-sync, update     first full download · forced update
  (tabs)/aaj, hazri, maal, kharcha, mazeed
  hazri/ maal/ kharcha/ log/   forms (stack screens)
  sync-problems, notifications
components/              Screen, Header, Icon, IconBadge, BigButton, ListItem, SyncBanner, WarmBackdrop,
                         BuildingHero, PhotoPicker, VoiceRecorder, BottomSheet, ConfirmSheet, …
src/
  api/        fetch client (refresh mutex), session (SecureStore), auth calls, OpenAPI types
  db/         drizzle schema + migrations, encrypted open, live queries, generic row store
  sync/       outbox, push, pull, attachments queue, engine, triggers (incl. background task)
  features/   row types, read queries, write actions (optimistic rows + mutation), worker types, session
  i18n/       en, roman, ur
  lib/        money (paisa, Rs 27,75,000), dates (Asia/Karachi), phone, uuid v7, permissions, theme
tests/                   jest tests (sync engine, actions, worker types, api, upload, components)
```

## Testing

```bash
npx jest            # unit + component tests (npm test)
npx tsc --noEmit    # type check (npm run typecheck)
npx eslint .        # lint (npm run lint)
```

Other scripts: `npm run api:types` (regenerate `src/api/schema.ts` from the backend OpenAPI),
`npm run db:generate` (new drizzle migration), `npm run doctor` (`expo-doctor`).

### Offline test (manual)

Backend running + seeded; signed in as Rafaqat.

1. Airplane mode → banner turns amber "Offline — saved on phone". Hazri → *All present* → save;
   workers show "Not sent yet".
2. Hazri → *Naya mazdoor* → "Test Mazdoor", pick a company type → save → mark him *Full*.
3. Kharcha → add Rs 500 with a slip photo; cash in hand drops at once.
4. Mazeed → Daily log with a photo and a 10 s voice note → Aaj shows "Daily log written".
5. Network on → "Syncing…" → "All synced"; the web shows the log, hazri, kharcha and new worker.
6. Refused entry: lock this week's wages on the web, change a hazri of this week offline, go
   online → the change is undone and *Sync problems* shows the reason.
7. Kill during sync: add 3 kharcha offline, go online and swipe the app away; reopen → nothing
   lost or duplicated.
8. Log out with unsent work → warning with the count; online → no warning.

## Building with EAS

Profiles in `eas.json`:

| Profile | Output |
|---|---|
| `development` | dev client APK (internal) |
| `preview` | internal APK, channel `preview`; set the real `EXPO_PUBLIC_API_BASE_URL` in its `env` first |
| `production` | Android app bundle, channel `production` |

```bash
npx eas build -p android --profile preview
```

## Known limitations

* Background sync is best effort (Android Doze / battery saver may delay it) and absent in Expo Go.
* Photos already on the server are listed but not shown on the phone; photos taken on this phone are.
* Notifications are read-only (no push notifications yet).
* Two pending entries changing the same row (e.g. two kharcha on the cash balance) restore the
  first one's snapshot when one is refused; the next pull corrects the numbers.
* Hazri can be entered up to 6 days back (the server allows a munshi 7).
