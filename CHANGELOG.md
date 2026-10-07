# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] — 2026-10-07

Hardening pass on the Android shell plus the branding that `1.0.0` shipped
with stock Capacitor artwork. No user-facing behaviour change on the web app.

### Fixed

#### Native splash screen showed Capacitor branding

The eleven `splash.png` files across `drawable-*` were still the ones Capacitor
ships: the blue Capacitor logo centred on white. Everything else in the app is
dark, so the launch screen was the last surface still showing stock artwork.
Regenerated from `public/icons/logo-mark-white.png` on the `#0a0a0a` background
that `capacitor.config.ts` already declared. Regeneration is scripted in
`scripts/generate-android-splash.sh` so the files stop drifting from the brand
mark again.

### Changed

#### R8 enabled for release builds

`minifyEnabled` was `false`, so the release APK shipped unshrunk and
unobfuscated. Both `minifyEnabled` and `shrinkResources` are now on, using
`proguard-android-optimize.txt`. The APK went from 4.3 MB to 1.5 MB.

Capacitor resolves plugins reflectively through `@CapacitorPlugin` annotations,
so its `consumerProguardFiles` must stay on the classpath — the fix keeps the
existing `proguardFiles` list and only adds the flag.

#### Backups disabled

`android:allowBackup` was `true`, which security scanners flag and which lets
app data leave the device through cloud backup or device-to-device transfer.
Now `false`, with `data_extraction_rules.xml` excluding every domain for
Android 12+ builds where `allowBackup` alone is not sufficient, and
`usesCleartextTraffic="false"` stated explicitly rather than left to default.

---

## [1.0.0] — 2026-09-28

First public release. The web app has been running behind a real domain; this
release promotes it to `1.0.0` and adds the native Android client.

The bulk of the work is a performance pass whose numbers are reproducible via
the tooling committed alongside it.

### Added

#### Native Android app (Capacitor 8)

- Capacitor shell for Android. The WebView loads the deployed web app rather
  than a local bundle, so the backend is unchanged and all 53 Server Actions
  keep working. A static export is not possible: Server Actions only run
  against a live Next.js server.
- Hardware back button navigates the stack instead of exiting the app.
- Status bar follows the active theme and stays opaque.
- Body resizes for the software keyboard, so the chat input is not covered.
- Native launch screen.
- Haptics on message received and on message sent.
- `scripts/build-icons.py` regenerates the full icon set from one source and
  derives the maskable inset from the safe-circle geometry rather than a guess.

#### Push notifications

- Firebase Cloud Messaging (HTTP v1) for the native app, alongside the existing
  Web Push. Both transports are stored in `PushSubscription.type` and routed per
  row, so a user can be reachable on both without one path shadowing the other.
- Dead FCM tokens (`UNREGISTERED`, `INVALID_ARGUMENT`) are deleted so the table
  does not grow and sends stop retrying them. Transient failures keep the token.
- `scripts/verify-fcm-credentials.mts` proves a service account is valid by
  obtaining a real OAuth2 token and confirming FCM rejects a dummy
  registration token with `INVALID_ARGUMENT` rather than rejecting the auth.

#### Performance tooling

Measurement committed so the numbers below can be reproduced, not taken on
trust.
- `measure:bundle` — initial-load payload per route, read from the
  client-reference manifest's `async` flag, so it reports what a browser
  actually downloads rather than total static output.
- `measure:sidebar` / `verify:sidebar` — statement count, latency and 20
  correctness assertions for the sidebar projection against a real Postgres.
- `measure:markdown`, `measure:password` — per-plugin and per-backend cost.
- `bench:content` — CPU benchmarks for the message rendering path.

#### Versioning

- Single source of truth: `package.json` `version`. `src/lib/version.ts` reads
  it for the app, and `android/app/build.gradle` reads the same field for
  `versionName`.
- `versionCode` is computed, not hand-maintained:
  `major * 10000 + minor * 100 + patch`. Play Store rejects an upload whose
  versionCode has not increased, so a forgotten bump used to block releases.
  Verified by building `1.0.0` and `1.0.1` and reading the resulting APKs.
- The Gradle build fails loudly if `package.json` is not `major.minor.patch`,
  since `versionCode` cannot be derived from anything else.
- Settings gains an **About** section showing the version, the build number and
  whether the app is running in the native shell or a browser.
- Covered by `src/lib/__tests__/version.test.ts`, including a check that
  successive releases always produce a strictly increasing code.

#### Documentation

- Rewrote `README.md` against the actual codebase.
- Added `docs/native-app.md` covering the shell, the live-URL decision and the
  FCM setup.
- `.env.example` now documents all 20 environment variables with purpose.

### Changed

#### Initial-load payload

- `/channels/[roomId]`: **1532.3 → 1349.8 KB** raw, **468.1 → 414.0 KB** gzip
  (**−11.6%**).
- Across all 17 routes: 8813.6 → 8500.1 KB raw, 2636.7 → 2554.4 KB gzip.
- Largest single chunk: **701.5 → 418.8 KB** (−40%).
- `frimousse` (emoji dataset, 685 KB) and `dexie` (97 KB) moved out of the
  eager path into dynamically imported chunks.

#### Message rendering

- `parseFediverseContent` compiled one `RegExp` per custom emoji inside a loop
  and ran a full-string replace for each, on every message, on every render.
  Replaced with a single pass over one module-level pattern and a `Map` lookup,
  cached against the emoji array with a `WeakMap`.
  **Measured: 2.4629 ms → 0.0411 ms per 50-message render pass (60×).**
- `MessageItem` (1091 lines) had no memoization at all. Now `React.memo` with
  `useMemo` on the expensive derivations, and the `markdownComponents` map is
  static at module scope instead of rebuilt per render.
- Participant lookup for mentions changed from a linear `find` inside a
  `replace` callback to a prebuilt `Map`.
- `AnimatePresence` was instantiated per message; now only when a date or
  unread separator is actually present.
- The message list is now capped at 500 mounted messages. Pagination still
  works past the cap because it pages from the oldest *mounted* message.
  Windowing was deliberately not used: the viewport relies on
  `flex-col-reverse` so the browser anchors the newest message with no JS
  measurement, per `docs/column-reverse-architecture.md`.
- The Lexical markdown decorator re-lexed the whole document on every
  keystroke; now coalesced to a trailing debounce.
- `useIsMobile` created a `MediaQueryList` and listener per hook instance
  (~110 active). Now one shared listener via `useSyncExternalStore`.
- Context values for presence, unread and breadcrumbs were rebuilt every
  render, forcing whole-subtree re-renders. Now memoised.

#### Database

- Sidebar data is a single `SELECT` instead of a seven-table relational
  fan-out. **2 statements → 1, 5.58 → 2.43 ms (−56%), 19634 → 8584 bytes
  serialised (−56%).**
- Mention detection now scans the unread range in SQL rather than only the
  single latest message, which is what the previous `limit: 1` relation
  reduced it to. It is also gated on the same unread condition as the badge it
  sits next to, so a read room can no longer show a mention.
- Password hashing moved from `bcrypt-ts` to `@node-rs/bcrypt`.
  **Event-loop blocking 65 ms → 1.1 ms per hash.** The async API of
  `bcrypt-ts` was measured and does *not* help — it is pure JS; only the
  native binding moves the work off-thread.
- Session validation no longer runs a `SELECT count(*)` over the activity log
  on every request; the 24-hour throttle is now a Redis `SET NX EX`.
- Presence uses a sorted-set index instead of `KEYS`, which was O(keyspace)
  and blocked Redis, on every page load.
- Repositories declare explicit column lists. `users.password` (a bcrypt hash)
  was being transferred and discarded for every participant of every room.
- Push subscriptions for all receivers are fetched in one batched query instead
  of one serial round-trip per room member.
- Reaction toggles read one column instead of a five-query relational fetch.
- Admin log and session reads are bounded instead of returning whole tables.
- Invite search fetches the membership set directly and is debounced; it was
  loading the full room graph on every keystroke.

#### Mark as read

- Removed `revalidatePath("/(with-sidebar)", "layout")` from the read-receipt
  path. It re-ran the entire server tree on every viewport intersection, own
  message, visibility change and unmount. Per `docs/mark-as-read.md` the
  authoritative sync is the `room-marked-read` broadcast plus the local
  `UnreadProvider` update, so the sidebar never depended on it.

#### Dependencies

Removed 41 MB of unused packages: `three`, six `@lexical/*` packages,
`zustand`, `dexie-react-hooks`, `idb-keyval`, `lodash` (5 MB for a single
`debounce`) and the `radix-ui` umbrella package, which re-exported all 37
primitives when only two were used and pinned a second, divergent set of
`@radix-ui/*` versions. `node_modules` 856.7 → 813.9 MB.

### Fixed

- **`/settings` returned 500.** `pusher.client.ts` constructed the Pusher
  client at module scope, and `pusher-js` has no server-side ESM interop. The
  module is reachable from server components transitively, so any route that
  rendered the sidebar after auth died with
  `pusher.js.default is not a constructor`. Construction is now deferred to
  first use. This was pre-existing and reproduced on the previous release.
- `change-password.use-case.ts` did not await the password service. A `Promise`
  was compared for truthiness and written into the password column. Latent
  because the interface used to be synchronous.
- The Debie client is instantiated lazily, so the ~97 KB IndexedDB layer is no
  longer part of the initial load.
- The in-memory message cache had no eviction; it is now bounded.

### Security

- Added `import "server-only"` to the R2, password and device-info services.
  The R2 service holds bucket credentials and previously had no guard, so an
  accidental import from a client component would have shipped them to the
  browser.
- `google-services.json` and the Firebase service-account JSON are now
  gitignored. The latter contains a private key that can push to every device.
  Neither had been committed.
- `.gitignore` matched `.env*`, which also silently excluded `.env.example`.
  Added a negation so the template can be committed while real secrets stay
  ignored.

### Removed

- Dead code with no importers: the `three`-backed `ColorBends` background, a
  canvas particle background, three unused Framer Motion components, and the
  unused accordion and collapsible primitives.
- `hasLogWithinLast24Hours` from the activity log repository, superseded by the
  Redis throttle.

### Verification

Every figure above is reproducible from the committed tooling.

```
tsc        clean (including a pre-existing test error, now fixed)
tests      59 passing
lint       clean
build      clean
```

---

[1.0.0]: https://github.com/thirapi/komunikasi-chat/releases/tag/v1.0.0
