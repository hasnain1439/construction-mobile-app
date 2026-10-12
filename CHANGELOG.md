# Changelog

All notable changes to the Munshi site app. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Adding an entry:** write a short, user-facing bullet under **Unreleased** (Added / Changed / Fixed / Removed) in the same change as the code; on release, rename Unreleased to the date and start a new empty one. Name any new file in `src/db/migrations`.

## [Unreleased]

_Nothing yet._

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
