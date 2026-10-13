# Changelog

All notable changes to the Munshi site app. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Adding an entry:** write a short, user-facing bullet under **Unreleased** (Added / Changed / Fixed / Removed) in the same change as the code; on release, rename Unreleased to the date and start a new empty one. Name any new file in `src/db/migrations`.

## [Unreleased]

### Added

- **GitHub Actions**: CI on pull requests and `main` (typecheck, lint, jest) and a manual **EAS build** workflow (choose profile and platform; needs the `EXPO_TOKEN` secret). See README → Building with EAS.

- **Permissions from the server.** The app reads the person's permission keys, field access, scopes and approval limits from login, `/auth/me` (on app start, when online) and every sync pull (`access`), and keeps them in the encrypted local database for offline use (wiped on logout). `useCan(key)` / `can()` in `src/features/access.ts` / `src/lib/permissions.ts`; the old legacy names (`rates.view`, `site.entry`, …) map to the new keys.
- Tabs, buttons and actions the person can't use are hidden: Hazri / Maal / Kharcha tabs, hazri marking, *Naya mazdoor*, peshgi, measurement, settlement (make / send / pay wages), receiving dispatches and purchases, usage, owner delivery, purchase, stock count, kharcha, top-up, float confirm, daily log, and the matching *Aaj* to-dos and quick actions. Opening a hidden screen anyway shows "Aap ko is ki ijazat nahi".
- Server `PERMISSION_DENIED` (REST 403 or a refused sync entry under *Sync problems*) shows **"Aap ko is ki ijazat nahi"** (English "You don't have permission for this", Urdu "آپ کو اس کی اجازت نہیں"); `APPROVAL_LIMIT_EXCEEDED` has its own message.
- **Observability (optional, off by default).** Crash reporting with `@sentry/react-native` when `EXPO_PUBLIC_SENTRY_DSN` is set (no PII: `sendDefaultPii` off, no screenshots / replay, request bodies, auth headers, phones, emails, tokens and amounts scrubbed from every event and breadcrumb). Product analytics through a small offline-tolerant PostHog fetch client when `EXPO_PUBLIC_POSTHOG_KEY` is set: `login` and `sync_error` (`error_code` + `count`, throttled) with allow-listed props only; the user is a hashed id and the company a group keyed by tenant id. Sentry source maps upload during EAS builds only when `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` are set. See README → Observability and `.env.example`.

### Changed

- The worker daily rate on *Naya mazdoor* follows `fields.rates` instead of the account type; money the server leaves out (hidden by field access) is not shown as Rs 0.
- `src/api/schema.ts` regenerated from the API (permission fields in login, `/auth/me` and `/sync/pull`; `503 SMS_UNAVAILABLE` on the login-code request).
- When the login code could not be sent (`SMS_UNAVAILABLE`) the sign-in screen says so in English / Roman Urdu / Urdu and the code can be asked for again at once.

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
