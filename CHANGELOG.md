# Changelog

All notable changes to the Munshi site app. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Adding an entry:** write a short, user-facing bullet under **Unreleased** (Added / Changed / Fixed / Removed) in the same change as the code; on release, rename Unreleased to the date and start a new empty one. Name any new file in `src/db/migrations`.

## [Unreleased]

### Plain English

- English texts are plain English (no Roman Urdu words); Roman Urdu / Urdu unchanged. The English UI now says advance (peshgi), attendance (hazri), site clerk (munshi), Owner (thekedar), balance owed / on credit (udhaar), site expense (kharcha), delivery note (challan), roof slab (lenter), mason / labourer (mistri / mazdoor), stair room (mumty) and so on. Keys, enum values and API codes are unchanged; a guard test fails if a Roman Urdu word comes back into the English texts.

### Owner decisions (integration)

- API types (`src/api/schema.ts`) regenerated from the merged API (decisions 1–8: adds share links, `finishingAllowance`, `latestProject`, the loss-charge error codes). No app change.

### Owner decisions (3, 4)

- **Worker daily wage is a company toggle (`fields.wages`, decision 4).** On by default (Munshi, Project Manager, Accountant, Administrator), so nothing changes unless the company turns it off for a role or person. Without it the server leaves worker, team, worker-type and wage-line rates out of the pull: the app stores those rows without crashing and never shows a rate (no "Rs 0"). Weekly wage totals made by the server still show.
- **Naya mazdoor without `fields.wages`:** no daily-rate box, no rate filled in from the type, and no `dailyRatePaisa` sent (the company rate is used). Setting a rate now needs `fields.rates` and `fields.wages`.
- **Equipment shows no money (decision 3).** Equipment, stock, transfers, rentals and losses carry counts and statuses only; any money value a server might send (hire rate, value, deposit, charges, rent to date, idle cost) is dropped on pull and never shown.
- No new migration (rows are stored as the server's JSON, so a missing rate is simply absent). Tests 174 → 186 (`tests/wages.test.tsx`). API types (`src/api/schema.ts`) regenerated (`FieldAccess.wages`).

### Steps 13, 15, 16, 17 (mobile)

- **Aaj ka kaam (Step 13).** *Aaj* shows today's milestones of the site (window covers today, or in progress / curing / blocked): stage, status, progress, late, curing until and the **quota left per material** (quantities only, never money). Tap → **Progress likhein**: progress %, status (only the server's allowed changes; BLOCKED needs a note), optional photos → `MILESTONE_PROGRESS`; the milestone changes on the phone at once. All milestones under *Mazeed → Site → Kaam ki progress*.
- **Kaam ruk gaya (Step 13).** Log stoppage days offline: reason, from + days (1–31, up to 60 days ahead), photo required except HOLIDAY, note required for OTHER, no day logged twice → `STOPPAGE_LOG`; list with PENDING / APPROVED / REJECTED.
- **Maal lag gaya → Kis kaam ke liye.** Usage can be booked against an open milestone (`MATERIAL_USAGE_CREATE` + `milestoneId`); its quota left drops at once.
- **Hidayat (Step 15).** Record what the owner asked for on site (photos + note) → `SITE_INSTRUCTION_CREATE`; own list with NEW / CONVERTED (change order code) / DISMISSED (reason).
- **Machinery & shuttering (Step 16).** *Maal* shows equipment transfers on the way (count per item, damaged, note; blind count hides the sent quantity) → `EQUIPMENT_RECEIVE`; equipment on site (own vs rented, counts only); **Gum / toota saaman** (missing / damaged, photo for damage) → `EQUIPMENT_LOSS_REPORT`; reported losses.
- **Kharabi (snag) and Naqshe (Step 17).** Snag list with status filter; new snag with place, description, before photo(s), fix-by date and (with `closeout.snag.manage`) who fixes it → `SNAG_CREATE`; **Theek ho gaya** with after photo(s) → `SNAG_FIX`. Drawings: latest revision per drawing by folder with revision number and approved date; the file is fetched once through a signed link and kept on the phone for offline viewing (pictures in the app, PDFs in the phone's viewer); superseded files are removed and logout deletes them.
- Ten new pull tables stored locally (`milestones`, `stoppages`, `site_instructions`, `equipment`, `equipment_stock`, `equipment_transfers`, `equipment_rentals`, `equipment_losses`, `snags`, `drawings`) — migration **`src/db/migrations/0002_site_modules.sql`** (also clears the pull cursor once so existing phones pull a fresh snapshot). Photos upload first with their own clientId and respect *Wi-Fi only*.
- Every screen and button gated by its key (`ROUTE_PERMS` / `TAB_PERMS`; the Maal tab also opens for equipment-only people). All new texts and server values (statuses, reasons, stages, milestone names by key, folders, equipment categories, error codes) in English, Roman Urdu and Urdu. API types regenerated. Tests 146 → 174 (`tests/features/site.test.ts`, `tests/siteScreens.test.tsx`, permissions).

### Added

- **Language sent to the server.** Changing the language in *Mazeed* (or on the login screen) also saves it on the server (`PATCH /auth/me/preferences`), so SMS, notifications and PDFs arrive in the same language; offline or signed out it is sent after the next sign-in / app start. On the first sign-in on a phone where nobody chose a language, the app takes the person's language from the server (e.g. the language of their invite). API types regenerated; tests 141 → 146 (`tests/languageSync.test.ts`).
- Cash book shows the new "Opening cash in hand" entry type (opening balances entered by the office) in English, Roman Urdu and Urdu; API types (`src/api/schema.ts`) regenerated for the onboarding / import / opening-balance / demo endpoints.
- **Release set-up (pilot).** EAS profiles `development` (dev client), `preview` (pilot APK, internal distribution) and `production` (Play Store AAB) with their own API address, app name and package (`Munshi Dev` / `Munshi Pilot` / `Munshi`, `pk.construction.munshi[.dev|.preview]`) so they install side by side. versionCode is kept by EAS (remote, auto-increment); `VERSION` in `app.config.ts` is the semver app version. Guide: [docs/RELEASE.md](docs/RELEASE.md).
- **Over-the-air updates** (expo-updates) with a channel per profile and runtime version = app version: checked on every start and quietly when the app returns to the foreground (at most every 6 h); downloaded in the background and used on the next start, never in the middle of an entry. *Mazeed* shows the channel and update id next to the version. Off until the EAS project id is set.
- **"Upload photos on Wi-Fi only"** in *Mazeed* (English / Roman Urdu / Urdu). On mobile data photos and voice notes wait, with the entries that need them; everything before them still syncs, the banner says "Photos waiting for Wi-Fi", and joining Wi-Fi starts a sync.
- Placeholder app icon, adaptive icon (with monochrome) and splash in the brand colours (charcoal, sun, sand), generated by `scripts/generate-icons.mjs`.
- Tests for the background-sync scheduling, the Wi-Fi-only policy, the OTA check and photo compression (117 → 141).

- **GitHub Actions**: CI on pull requests and `main` (typecheck, lint, jest) and a manual **EAS build** workflow (choose profile and platform; needs the `EXPO_TOKEN` secret). See README → Building with EAS.

- **Permissions from the server.** The app reads the person's permission keys, field access, scopes and approval limits from login, `/auth/me` (on app start, when online) and every sync pull (`access`), and keeps them in the encrypted local database for offline use (wiped on logout). `useCan(key)` / `can()` in `src/features/access.ts` / `src/lib/permissions.ts`; the old legacy names (`rates.view`, `site.entry`, …) map to the new keys.
- Tabs, buttons and actions the person can't use are hidden: Hazri / Maal / Kharcha tabs, hazri marking, *Naya mazdoor*, peshgi, measurement, settlement (make / send / pay wages), receiving dispatches and purchases, usage, owner delivery, purchase, stock count, kharcha, top-up, float confirm, daily log, and the matching *Aaj* to-dos and quick actions. Opening a hidden screen anyway shows "Aap ko is ki ijazat nahi".
- Server `PERMISSION_DENIED` (REST 403 or a refused sync entry under *Sync problems*) shows **"Aap ko is ki ijazat nahi"** (English "You don't have permission for this", Urdu "آپ کو اس کی اجازت نہیں"); `APPROVAL_LIMIT_EXCEEDED` has its own message.
- **Observability (optional, off by default).** Crash reporting with `@sentry/react-native` when `EXPO_PUBLIC_SENTRY_DSN` is set (no PII: `sendDefaultPii` off, no screenshots / replay, request bodies, auth headers, phones, emails, tokens and amounts scrubbed from every event and breadcrumb). Product analytics through a small offline-tolerant PostHog fetch client when `EXPO_PUBLIC_POSTHOG_KEY` is set: `login` and `sync_error` (`error_code` + `count`, throttled) with allow-listed props only; the user is a hashed id and the company a group keyed by tenant id. Sentry source maps upload during EAS builds only when `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` are set. See README → Observability and `.env.example`.

- **Every screen fully in Roman Urdu and Urdu** (no English fallbacks). Urdu now has every text (it used to fall back to Roman Urdu for about 140 of them), and the last hard-coded English is gone: back / close / previous day / next day buttons for screen readers, overtime on weekly wages ("OT 2 ghante"), the app version, the boot error and the sync error under *Sync status*.
- Server values shown in the user's language: payment methods, cash entry types, roles (the profile on *Mazeed* and the company picker; a company's own role keeps its name), notification titles by type, units (bori, adad, murabba fut, …; an unknown unit shows as written) and *Sync problems* titles by entry type ("Peshgi", "Hazri", …) with the entry's detail below.
- Dates in the user's language: month and weekday names, am / pm and "last sync 5 minute pehle" (Pakistan time, Western digits).
- Messages for every server error code the app can receive (about 90 more, e.g. login ended, company paused, rate limited, file too large, worker not on this site, wages already paid, delivery cancelled), in English, Roman Urdu and Urdu.
- Tests that fail when any key is missing, extra, empty or still English in a dictionary, when placeholders differ, when an API error code has no message, or when a screen shows a literal word (`tests/i18n.test.ts`, `tests/i18nLiterals.test.ts`). See README → Languages.

### Changed

- **Faster on low-end phones:** *Sync problems* is a FlashList; list rows on Hazri (day and week), Maal stock, Kharcha, notifications, log history and sync problems are memoised, so marking one worker re-renders only that row; Hazri groups attendance per worker once instead of searching it for every row.
- Background sync: the interval from the server is kept at 15 minutes or more (Android's minimum), the task is registered only when the phone allows background work, does nothing when nobody is signed in, and an offline run no longer counts as a failure. The network coming back **or switching from mobile data to Wi-Fi** starts a sync.
- Plain-http API addresses work only in development builds; pilot and store builds need HTTPS. Splash and adaptive-icon background are brand charcoal instead of navy / blue.

- **Urdu (RTL):** arrows and chevrons that mean back / next point the right way (list rows, sync banner, Hazri previous / next day, previous week, Aaj → Kharcha); numbers, amounts and Latin names inside Urdu sentences keep their own direction.
- Sync entries are stored with a language-neutral detail (date, number, amount or name) instead of an English label; the title comes from the entry type in the current language. Entries already on a phone keep their old label as the detail.
- The worker daily rate on *Naya mazdoor* follows `fields.rates` instead of the account type; money the server leaves out (hidden by field access) is not shown as Rs 0.
- `src/api/schema.ts` regenerated from the API (permission fields in login, `/auth/me` and `/sync/pull`; `503 SMS_UNAVAILABLE` on the login-code request).
- When the login code could not be sent (`SMS_UNAVAILABLE`) the sign-in screen says so in English / Roman Urdu / Urdu and the code can be asked for again at once.

### Fixed

- The kharcha approval-limit warning said "Rs Rs 5,000".
- A failed photo showed the phone's English error text; it now shows the app's own message.

### Security

- `npm audit fix` (no breaking changes): Expo CLI tooling patch updates. Remaining audit items are build / test tooling only (see the API's `docs/SECURITY.md`).
- `POST /sync/push` can now answer `429 RATE_LIMITED` (60 pushes a minute per user); the app already treats it as "try again later".

## 2026-10-12

### Added

- **Company worker types.** *Naya mazdoor* now offers the company's own active worker types (from the web app), named in the munshi's language (Urdu → Roman → English fallback), plus *Deegar*.
- Choosing a type fills in its daily rate (for roles that may set rates); a rate the munshi typed is never overwritten, and an empty rate lets the server use the type's rate.
- Until the first sync brings the company list, *Naya mazdoor* still works offline with built-in Mistri / Mazdoor.

### Changed

- Worker type names on the Hazri list come from the synced company types instead of a fixed list.
- **Migration `0001_worker_types.sql`:** adds the local `worker_types` table and clears the pull cursor, so phones that already synced download one fresh snapshot to receive the types.

## 2026-10-08

### Added

- **Password sign-in** as an alternative to the SMS code (password set by the Thekedar or when accepting the invite); also works with the company picker.
- The code screen says when the login code was also sent to the user's email.
- Login screen with a slowly drifting building photo (`BuildingHero`).

### Changed

- Full visual redesign of login, home, tabs and every form: vector icons instead of emoji, card shadows, icon badges.
- Warm "cabin" palette shared with the web app (charcoal, sand, sun, stone) and the **Cabin** font (replaces Inter).
- Warm gradient backdrop on every screen; light top bars with shadow; sand cash cards with a watermark icon on Aaj / Kharcha; white icons on charcoal active tab pills.

### Fixed

- Photo and voice-note uploads failing with "Unsupported FormDataPart implementation" on Expo's fetch.

## 2026-10-07

### Added

- First release of the offline-first Munshi app (Expo SDK 57, Android).
- Sign-in with phone + SMS code, company picker when the number belongs to several companies, first full sync, forced update for old builds, logout that first sends pending entries.
- Encrypted local database (SQLCipher) with an outbox: every save works offline and is sent when there is signal; refused entries are rolled back and listed under *Sync problems*.
- Tabs **Aaj**, **Hazri**, **Maal**, **Kharcha**, **Mazeed**: hazri with overtime, new worker, peshgi, measurements and settlement; material receive, purchase, owner delivery, usage and stock count; kharcha with slip photo and top-up requests; daily log with photos and voice notes; notifications.
- Roman Urdu (default), English and Urdu (RTL).
- Initial local schema: migration `0000_complete_iron_lad.sql`.

## 2026-10-06

### Added

- Project created from the `create-expo` template.
