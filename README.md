# Munshi — site app (Expo / React Native)

The phone app for the site **munshi** (and PM / Thekedar in the field): hazri, material, kharcha
and the daily log, **offline first**. Every save lands on the phone at once and goes to the server
when there is signal. Roman Urdu is the default language (English and Urdu RTL too).

The app never shows material rates, purchase amounts, supplier details (beyond the name) or
contract values, only wages, peshgi and the user's own cash. Tabs and actions follow the user's
permissions from the server (see *Permissions*).

What changed and when: [CHANGELOG.md](CHANGELOG.md). Building, installing and updating the app: [docs/RELEASE.md](docs/RELEASE.md).

| | |
|---|---|
| Stack | Expo SDK 57 (React Native 0.86, React 19.2), TypeScript strict, expo-router |
| Local data | expo-sqlite + **SQLCipher** (encrypted), drizzle-orm, key in expo-secure-store |
| Sync | custom outbox → `POST /sync/push`, cursor pull ← `GET /sync/pull` (server is the source of truth) |
| UI | NativeWind 4 (Tailwind 3), Cabin font, MaterialCommunityIcons, expo-linear-gradient, FlashList, 48 dp touch targets |
| Forms | react-hook-form + zod |
| Media | expo-image-picker + expo-image-manipulator (≤ 1280 px, JPEG 0.6), expo-audio (voice notes ≤ 30 s) |
| Background | expo-background-task (every ~15 min, dev/production builds only), NetInfo, AppState; optional "photos on Wi-Fi only" |
| Release | EAS Build (development / preview APK / production AAB, side-by-side variants), expo-updates OTA (channels per profile) |
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

## Permissions

What a person may do comes from the server, not from the account type: login results, `GET /auth/me`
(on app start, when online) and every `/sync/pull` (`access`) carry `permissions` (catalogue keys
such as `labor.attendance.create`), `fieldAccess`, `scopes`, `approvalLimits` and `permissionRole`
(contract: `PERMISSIONS_API.md` in the parent folder). The block is stored in the encrypted local
database (`src/db/access.ts`, kv `auth.access`) so the app works offline, and wiped on logout.

* `useCan(key)` / `usePermissions()` (`src/features/access.ts`) and `can(access, role, key)`
  (`src/lib/permissions.ts`). THEKEDAR may do everything; old legacy names (`rates.view`,
  `site.entry`, …) map to the new keys; without a stored block (before the first pull on an older
  build) the old behaviour applies.
* Tabs (`TAB_PERMS`), buttons and the Aaj to-dos / quick actions are hidden without their key;
  `components/RouteGuard.tsx` blocks a stack screen (`ROUTE_PERMS`) opened anyway.
* Values the server leaves out (`fieldAccess`) are not shown; the worker rate needs `fields.rates`.
* A server `PERMISSION_DENIED` (REST 403, or a sync entry `REJECTED` → *Sync problems*) shows
  "Aap ko is ki ijazat nahi" (`err.PERMISSION_DENIED`).

## Offline-first sync

* **Local SQLite** (`src/db`): every pulled table is mirrored as
  `{ id, project_id, client_id, local, data(JSON), updated_at }`; `local = 1` is a phone-made row
  the server has not confirmed. Pulled tables (`SYNC_TABLES` in `src/db/schema.ts`) include
  projects, workers, **worker_types**, project_workers, attendance, settlements, advances,
  materials, dispatches, purchases, site_stock, daily_logs, cash accounts / entries, settings,
  holidays and notifications.
* **Outbox:** mutations in order with `depends_on`, back-off and the optimistic row snapshots.
  A `429 RATE_LIMITED` from `/sync/push` (60 pushes / min per user, see
  [../construction-platform/docs/SECURITY.md](../construction-platform/docs/SECURITY.md)) is treated like a network error: retried later.
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
* **Photos on Wi-Fi only** (Mazeed toggle, off by default): on mobile data photos / voice notes
  and the entries that need them (plus the ones after, to keep the order) wait; the rest syncs; joining
  Wi-Fi starts a sync. Logout sends everything regardless.
* Logout first tries to send everything and warns if entries would be lost. Logout and a revoked
  phone wipe every table.

**Migrations** live in `src/db/migrations` (generate with `npm run db:generate` after changing
`src/db/schema.ts`). `0001_worker_types.sql` adds `worker_types` and clears the pull cursor so
existing phones pull one fresh snapshot.

## Languages

English, **Roman Urdu** (default) and **Urdu** (RTL), chosen under Mazeed or on the login screen.
Every screen is fully translated in all three; there are no fallbacks.

* **Dictionaries** in `src/i18n/`: `en.ts` is the source of every key; `roman.ts` and `ur.ts` are
  `Record<TKey, string>`, so TypeScript refuses a missing key. Screens use `useT()` /
  `useI18n()` (`t`, `language`, `rtl`, `f`); never write text in JSX.
* **Adding text:** add the key to `en.ts`, then the same key to `roman.ts` (the app's tone:
  *Hazri, Maal, Kharcha, Peshgi, Wasool karein*) and `ur.ts` (Urdu script), then use `t('key')`.
* **Server values → text:** enum-like values from the server are keys too: kharcha categories
  `cat.*`, site conditions `cond.*`, settlement `settlement.*`, count reasons `reason.*`, payment
  methods `method.*`, cash entry types `cashType.*`, roles `role.*` (account types and the built-in
  permission roles; a company's own role shows its name), notification types `notif.*` (the server
  title is the fallback), sync entry types `outbox.*` (Sync problems: type as title, the entry's
  detail below) and units `unit.*` (`unitLabel()`; a unit the app doesn't know shows as the office
  wrote it). Names typed by people (workers, materials, suppliers, sites) are shown as written.
* **Errors:** server error codes map to `err.*` keys (`errorText()` / `rejectedText()`); the
  server's own text is never shown and an unknown code shows `err.generic`.
* **Dates:** `useFormat()` / `f.shortDate`, `f.longDate`, `f.dateTime` (Pakistan time),
  `f.weekDayShort`, `f.timeAgo` take month / weekday / am-pm names from the dictionaries
  (`date.*`, `time.*`). Digits stay Western (0-9) in every language, and money is `Rs 1,500` as on
  receipts and bank SMS.
* **RTL (Urdu):** switching to or from Urdu reloads the app with `I18nManager.forceRTL`. Rows,
  margins and paddings mirror by themselves (React Native swaps left / right in RTL); arrows and
  chevrons that mean "back / next" flip with `rtl` (header back, list chevrons, sync banner,
  Hazri previous / next day, previous week, Aaj → Kharcha). Values put into an Urdu sentence (`{n}`,
  `{amount}`, names) are wrapped in Unicode isolates so "Rs 1,500" or a Latin name keeps its own
  direction.
* **Tests** (`tests/i18n.test.ts`, `tests/i18nLiterals.test.ts`) fail when a key is missing or
  extra in `roman` / `ur`, a text is empty, `{placeholders}` differ from English, Urdu text is
  English (copied, or Latin words other than `Rs`, `kg`, `OTP`, `PDF`, `SMS`, `OT`, `PKR`), an
  error code the app can receive (read from `src/api/schema.ts` for the endpoints in
  `src/api/endpoints.ts`, plus codes named in the code) has no `err.*` text, or a `.tsx` file in
  `app/` or `components/` shows a literal word (JSX text, text props such as `label` / `title` /
  `placeholder` / `accessibilityLabel`, or `Alert.alert`).
* The language names in the picker (`LANGUAGE_NAMES`: "Roman Urdu", "اردو", "English") stay in
  their own script on purpose, so anyone can find their language.
* **Server language** (`src/i18n/languageSync.ts`): the server sends SMS, notifications and PDFs
  in the person's `language` (`en` / `roman` / `ur`). `setLanguage` stores the choice
  (`app.language`), marks it unsynced and sends `PATCH /auth/me/preferences` when signed in;
  `retryLanguageSync()` sends a pending choice on app start (with `/auth/me`) and after sign-in.
  After a sign-in `adoptServerLanguage(user.language)` switches the app to the server's language
  only when nobody chose one on this phone; a choice made on the phone wins and is sent instead.
  Notification titles come from the server already in the person's language.

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
  sync/       outbox, push, pull, attachments queue, engine, triggers (incl. background task), Wi-Fi-only upload policy
  features/   row types, read queries, write actions (optimistic rows + mutation), worker types, session
  i18n/       en, roman, ur
  lib/        money (paisa, Rs 27,75,000), dates (Asia/Karachi), phone, uuid v7, permissions (can, keys), theme, OTA update check
  lib/observability/  Sentry (off without DSN) + PII scrubber, PostHog fetch client, hashed user id
tests/                   jest tests (sync engine, triggers, Wi-Fi-only, actions, worker types, permissions, api, upload, media, updates, components, observability)
scripts/                 api-types (OpenAPI → TS), generate-icons (placeholder icons / splash from the brand colours)
docs/RELEASE.md          pilot APK, OTA updates, Play Store, rollback, background-sync and low-end checks
```

## Observability

Optional and **off by default**: with the env keys empty Sentry is never initialised and PostHog gets no request. Code: `src/lib/observability/` (`sentry.ts`, `scrub.ts`, `analytics.ts`, `hash.ts`, `index.ts`). Same rules as the API and web app (see the API README → Observability).

| Key (`.env`, see `.env.example`) | Default | Effect |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | empty = off | crash reporting (`@sentry/react-native`) |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | `development` in dev, else `production` | |
| `EXPO_PUBLIC_SENTRY_RELEASE` | native `<bundle id>@<version>+<build>` | |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.1` | performance sampling (0..1) |
| `EXPO_PUBLIC_POSTHOG_KEY` | empty = off | product analytics |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | EU: `https://eu.i.posthog.com` |

`EXPO_PUBLIC_*` values are baked into the JS bundle — a DSN and a PostHog project key are public by design; never put an auth token there.

### Sentry (crashes)

- `initSentry()` runs at module scope in `app/_layout.tsx`; the root is `wrapRoot(RootLayout)` (`Sentry.wrap` only when on). Every helper is a no-op without a DSN.
- `sendDefaultPii: false`, no screenshots, view hierarchy or session replay.
- `beforeSend` / `beforeSendTransaction` / `beforeBreadcrumb` run `scrub.ts`: request bodies and cookies dropped, only harmless headers kept (no `Authorization` / `Cookie`), user reduced to the hashed id, touch breadcrumbs lose their on-screen labels, console arguments / fetch bodies dropped, and in every string: emails, Pakistani / E.164 phones, CNICs, JWTs, `Bearer` values, long tokens, cookies, `token= / code= / sig= / otp=` URL params and `Rs 1,200` amounts → `[Filtered]`.
- User = `{ id: <hashed user id> }`, tag `tenantId`. Sync failures other than "no network" are captured with tags `sync_kind`, `error_code`.
- **Source maps**: `metro.config.js` uses `getSentryExpoConfig` (debug ids; harmless when Sentry is off). The `@sentry/react-native/expo` config plugin (upload during native builds) is added in `app.config.ts` **only** when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set — put them as EAS secrets (`eas env:create`), never in `.env` or git. Without them builds work as before, just without uploaded maps.

### PostHog (product analytics)

A small fetch client (`analytics.ts`, no native SDK, works in Expo Go): events are queued in memory (max 200, oldest dropped) and posted to `<host>/batch/`; offline / 429 / 5xx keeps them queued and retries with backoff (5 s → 5 min) and right after every successful sync. Other 4xx drops the batch. It never throws and nothing waits on it. Nothing is recorded before sign-in (no anonymous ids) or after logout.

| Event | When | Props |
|---|---|---|
| `login` | after a successful sign-in | `client: "mobile"`, `method` (`otp` / `password`), `role` |
| `sync_error` | a sync run failed (at most once per `error_code` per 10 min) | `kind` (`upload` / `push` / `pull` / `network`), `error_code`, `count` (unsent entries), `offline` |

Every event also carries `client`, `platform`, `app_version`. The other shared events (`project_activated`, `hazri_marked`, `purchase_saved`, `invoice_issued`) are sent by the API. Rules: only the props `client, platform, method, source, role, status, kind, count, error_code, app_version, offline, duration_ms`; numbers only for `count` / `duration_ms`; strings ≤ 64 chars that don't look like an email, phone, token or amount; **no money, names, phones or free text**. Person = `distinct_id` = first 32 hex of SHA-256(`"user:" + userId`) (`hash.ts`, via `expo-crypto`; same value as API / web); company = PostHog group `company` = tenant id.

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

Full guide (set-up, install, OTA, rollback, versioning): **[docs/RELEASE.md](docs/RELEASE.md)**.

| Profile | Output | App / package | OTA channel |
|---|---|---|---|
| `development` | dev client APK (internal) | Munshi Dev · `pk.construction.munshi.dev` | `development` |
| `preview` | **pilot APK**, internal distribution | Munshi Pilot · `pk.construction.munshi.preview` | `preview` |
| `production` | Android app bundle (Play Store) | Munshi · `pk.construction.munshi` | `production` |

The three install side by side (`APP_VARIANT` in each profile). Set the real `EXPO_PUBLIC_API_BASE_URL`
(HTTPS) per profile in `eas.json` and the EAS project id (`eas init`) in `app.config.ts` first.

```bash
npx eas build -p android --profile preview                                   # pilot APK (QR / link on the build page)
APP_VARIANT=preview npx eas update --channel preview --message "…"           # OTA, same app version only
```

Versions: `VERSION` in `app.config.ts` (semver) = runtime version for OTA; bump it for native changes.
versionCode is kept by EAS (remote, auto-increment). Icons / splash are placeholders from
`node scripts/generate-icons.mjs` (brand charcoal, sun, sand).

### From GitHub Actions

- `.github/workflows/eas-build.yml` — **manual**: Actions → *EAS build* → Run workflow → `profile` (development / preview / production), `platform` (android / ios / all), `wait`. Runs typecheck + tests, then `eas build --non-interactive`. Needs the repository secret **`EXPO_TOKEN`** (expo.dev → Account settings → Access tokens) and the project linked once with `npx eas init`. Build-time keys (`EXPO_PUBLIC_API_BASE_URL`, Sentry, PostHog) come from `eas.json` or EAS environment variables, never from the repository.
- `.github/workflows/ci.yml` — pull requests and `main`: typecheck, lint, jest.
- Server side (API + web on a VPS, HTTPS, backups): [construction-platform/docs/DEPLOYMENT.md](../construction-platform/docs/DEPLOYMENT.md).

## Known limitations

* Background sync is best effort (Android Doze / battery saver may delay it) and absent in Expo Go; how to check it on a device: [docs/RELEASE.md](docs/RELEASE.md#8-background-sync-check-dev-build).
* Photos already on the server are listed but not shown on the phone; photos taken on this phone are.
* Notifications are read-only (no push notifications yet).
* Two pending entries changing the same row (e.g. two kharcha on the cash balance) restore the
  first one's snapshot when one is refused; the next pull corrects the numbers.
* Hazri can be entered up to 6 days back (the server allows a munshi 7).
