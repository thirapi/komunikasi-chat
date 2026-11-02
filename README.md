<div align="center">
  <img src="public/icons/maskable_icon.png" alt="Komunikasi" width="128" height="128">
  <h1>Komunikasi</h1>
  <p><strong>Real-time messaging, one codebase, web and native Android.</strong></p>
  <p>
    <a href="CHANGELOG.md">Changelog</a> ·
    <a href="docs/">Docs</a> ·
    <a href="https://dbdiagram.io/d/komunikasi-67f935074f7afba184451999">ERD</a>
  </p>
</div>

---

## Contents

| | |
|---|---|
| [Quick start](#quick-start) | [Architecture](#architecture) |
| [What's inside](#whats-inside) | [Native Android](#native-android) |
| [Push](#push-notifications) | [Testing](#testing) |
| [Tooling](#tooling) | [Reference](#reference) |

---

## Quick start

Needs **Node 20+**, a PostgreSQL database, a Pusher app, an Upstash Redis
database and a Cloudflare R2 bucket.

```console
$ git clone https://github.com/thirapi/komunikasi-chat.git
$ cd komunikasi-chat
$ npm install
$ cp .env.example .env          # 19 variables, each documented
$ npm run db:migrate            # apply migrations in drizzle/
$ npm run db:seed               # optional: dev users
$ npm run dev
```

<http://localhost:3000>

Only `DATABASE_URL`, `PUSHER_*`, `R2_*` and `UPSTASH_REDIS_*` (presence,
session throttling) are needed to boot. Everything else degrades gracefully: no
push keys means no notifications, not a broken app.

Migrations are not run on deploy. After pulling a change that adds one to
`drizzle/`, run `npm run db:migrate` against the database yourself, and check
it ends with `✅ Migrations completed successfully!`. Before that, prove the
migrations on a throwaway database (CI does this on every push too):

```console
$ docker compose up -d postgres
$ MIGRATION_TEST_DATABASE_URL=postgres://postgres:password@localhost:5432/mydb npm run verify:migrations
✓ 31 migrations applied from scratch
✓ all 20 tables in schema.ts exist with every column
✓ re-running is a no-op
```

`npx tsx scripts/inspect-migration-state.ts` (read-only) shows which
migrations a database has recorded and which of their effects exist.

**Develop against a local database** instead of the one in `.env`. `db.ts`
switches to node-postgres for local hosts, and `NEXT_DIST_DIR` lets this run
next to another dev server. `db:reset` and `db:seed` refuse non-local hosts.

```console
$ docker compose up -d postgres
$ export DATABASE_URL=postgres://postgres:password@localhost:5432/mydb
$ MIGRATION_TEST_DATABASE_URL=$DATABASE_URL npm run verify:migrations   # migrate from scratch
$ npm run db:seed                                                        # users dev / dev2, password123
$ NEXT_DIST_DIR=.next-local DISCORD_WEBHOOK_URL= npx next dev -p 3100
```

---

## What's inside

**Messaging**
: Channels and DMs, replies, attachments (uploaded straight to R2, up to 50 MB),
  reactions, edits and deletions. Lexical rich text with `@mention` tokens;
  code pasted from an editor or a web page becomes a fenced code block with its
  language. Sends are optimistic, with retry and discard when they fail.

**Feels like WhatsApp/Telegram**
: Rooms switch on the client and paint from an in-memory + IndexedDB cache on
  the first frame, then catch up with a **delta sync** (only what changed since
  the last sync, edits and deletions included). The chat list shows unread
  counts, mention badges, live previews and "sedang mengetik…"; DMs show ✓ / ✓✓
  read receipts; an "@" button jumps to unread mentions. The view stays pinned
  to the newest message, and on phones you swipe a message to reply and
  long-press for its actions. Design choices take the middle ground between
  WhatsApp, Telegram and Teams.

**Chat tools**
: Mute (mentions still notify), pinned messages, link previews, forward to up
  to 5 chats, voice messages, saved messages, archive, polls, blocking, and
  privacy settings for last seen and read receipts (both reciprocal).

**Realtime**
: Pusher private channels (authorised per room membership) carry messages,
  reactions, deletions, read state and typing. Presence is WebSocket-backed
  through a Redis index, so it survives multiple tabs and devices.

**Push**
: Web Push for browsers, Firebase Cloud Messaging for the app. Both stored, both
  delivered, neither shadowing the other.

**Accounts**
: Rotating session cookies, roles and permissions, impersonation for support,
  profile editing, custom emoji with shortcodes.

**Platform**
: Server-rendered App Router, installable PWA, native Android shell, dark and
  light themes.

---

## Architecture

Clean Architecture, with dependencies pointing inward. Each layer may only know
about the one above it.

```
   src/app/                routes · layouts · server actions
        │
        │   Action → Controller → Use Case → Repository / Service
        ▼
   interface-adapters/     controllers          validate, delegate
        ▼
   application/            use cases            business logic
        │                  repositories / services   (interfaces only)
        ▼
   infrastructure/         implementations      Drizzle · Pusher · R2 · Redis
        ▲
   entities/               types and DTOs       no logic
```

**The five rules**

```console
[1]  Frontend never bypasses a layer.       Action → Controller → Use Case
[2]  A use case never calls a use case.
[3]  No business logic in a controller,
     an action, or a repository.
[4]  Class-based everywhere, except
     controllers (functions) and actions.
[5]  Dependencies arrive through constructors.
     A service with a second implementation
     gets an interface first.
```

Wiring happens once, in the controller — never in a route:

```ts
// interface-adapters/controllers/users/search.controller.ts
const userRepository = new UserRepository(db);
const searchUserUseCase = new SearchUserUseCase(userRepository);

export async function searchUserController(query: string, limit?: number) {
  return await searchUserUseCase.execute(query, limit);
}
```

The rationale for each non-obvious decision is written down in `docs/`, and those
documents are standards the code is expected to follow — not post-mortems.

---

## Native Android

The Android app is a Capacitor shell around the deployed web app.

> **Why it loads a URL instead of a bundle.** A static export is not possible
> here. The app exposes 50+ Server Actions across 12 `"use server"` modules, and
> Server Actions only execute against a live Next.js server — a static export
> would strip the entire data layer. Loading the deployment keeps the backend
> untouched and every action working.

What the shell adds that a browser tab cannot:

- Hardware **back** navigates the stack instead of leaving the app
- Status bar follows the theme, and stays opaque
- Body resizes for the keyboard, so the input is never covered (the web app
  does the same in mobile browsers via `interactive-widget` and `visualViewport`)
- Native launch screen
- Haptics on message sent and received

```console
$ npm run cap:sync
$ npm run cap:run:android
```

Building an APK needs the Android SDK and a JDK — **not** macOS or Xcode. Full
setup in [`docs/native-app.md`](docs/native-app.md).

### Versioning

`package.json` holds the single version string. The app reads it through
`src/lib/version.ts`; the Android build reads the same field for `versionName`.

`versionCode` is **derived**, never hand-maintained:

```console
versionCode = major × 10000 + minor × 100 + patch

1.0.0 → 10000      1.0.1 → 10001      1.2.3 → 10203      2.0.0 → 20000
```

That matters because Play Store rejects an upload whose `versionCode` has not
increased — a forgotten bump silently blocks a release. The Gradle build also
fails loudly if `package.json` is not `major.minor.patch`, since the code
cannot be derived from anything else.

To ship a new version: bump `package.json`, rebuild, tag. Settings → About
shows the version and build number, and whether the app is running natively.

---

## Push notifications

Two transports, one table, routed per row:

| `type` | Transport | Reaches |
|:--|:--|:--|
| `web` | VAPID (Web Push) | browsers, desktop |
| `fcm` | Firebase Cloud Messaging | native Android |

> **FCM is delivered by Google Play Services.** Devices without GMS — Huawei
> above all — can never receive it, and that is not something the server can
> fix. Web Push remains their transport, so nobody loses notifications.

Dead tokens (`UNREGISTERED`, `INVALID_ARGUMENT`) are deleted so the table stops
growing and sends stop retrying them. Transient failures keep the token.

---

## Testing

```console
$ npm test
 ✓ 18 files · 177 tests

$ npx tsc --noEmit
```

Covers server actions (session identity and room access on every one), use
cases against mocked repositories (delta sync, read state and receipts, typing
fan-out, unread counts), the code-paste heuristics, markdown sanitising, touch
gestures, password hashing including backwards compatibility of hashes written
by the previous implementation, the presence index and its stale-entry pruning,
and push transport routing.

The sidebar projection is checked against a **real Postgres**, not a mock:

```console
$ npm run verify:sidebar
ALL CHECKS PASSED
```

---

## Tooling

Every performance figure this project claims is reproducible. Nothing is taken
on trust.

```console
$ npm run measure:bundle
```

```console
route                            chunks   raw KB   gzip KB
------------------------------------------------------------------------
(with-sidebar)/channels/[roomId]      18    1351.0      414.4
admin/(with-sidebar)/users            17     722.5      212.6
/ (landing)                           12     555.7      169.5
...
TOTAL across routes                         8546.1     2568.9
```

It reads the client-reference manifest, whose `async` flag separates chunks that
load eagerly from those behind a dynamic import — so it reports what a browser
actually pays for, not total static output.

| Command | Answers |
|:--|:--|
| `measure:bundle` | What does a browser download before the page is usable? |
| `measure:sidebar` | How many statements, how many milliseconds? |
| `verify:sidebar` | Is the result actually correct? |
| `measure:markdown` | What does each remark/rehype plugin cost? |
| `measure:password` | How long does hashing block the event loop? |
| `bench:content` | CPU cost of the message render path. |

---

## Reference

<details>
<summary><b>Environment variables</b></summary>

Required to boot:

| Variable | Purpose |
|:--|:--|
| `DATABASE_URL` | PostgreSQL connection string |
| `PUSHER_APP_ID` `PUSHER_SECRET` | Realtime |
| `NEXT_PUBLIC_PUSHER_KEY` `NEXT_PUBLIC_PUSHER_CLUSTER` | Realtime, client |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET_NAME` `R2_PUBLIC_DOMAIN_URL` | File uploads |
| `UPSTASH_REDIS_REST_URL` `UPSTASH_REDIS_REST_TOKEN` | Presence |

Optional:

| Variable | Purpose |
|:--|:--|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` | Web Push, browsers |
| `FIREBASE_PROJECT_ID` `FIREBASE_CLIENT_EMAIL` `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM, native push |
| `DISCORD_WEBHOOK_URL` | New-message notifications |
| `NEXT_PUBLIC_APP_URL` | Public origin, avoids proxying R2 twice |

</details>

<details>
<summary><b>Layout</b></summary>

```console
src/
├── app/                    routes, layouts, server actions
├── components/             UI
│   ├── ui/                 shadcn/ui primitives
│   ├── lexical/            editor plugins
│   └── native-shell*       Capacitor integration
├── hooks/                  reusable hooks
├── lib/
│   ├── entities/           types and DTOs
│   ├── application/        use cases, ports
│   ├── interface-adapters/ controllers
│   ├── infrastructure/     repository and service implementations
│   └── native/             native platform helpers
└── utils/

docs/       feature and design documents
drizzle/    schema migrations
scripts/    build, measurement, maintenance
```

</details>

<details>
<summary><b>Scripts</b></summary>

| | |
|:--|:--|
| `dev` `build` `start` | Next.js |
| `lint` `test` | ESLint, Vitest |
| `db:migrate` | apply the migrations in `drizzle/` (not run on deploy) |
| `verify:migrations` | run every migration from scratch on a throwaway Postgres and check schema.ts |
| `db:push` `db:seed` `db:reset` `db:studio` | dev schema sync and data |
| `npx drizzle-kit generate` | new migration after editing `schema.ts` |
| `cap:sync` `cap:open:android` `cap:run:android` `cap:open:ios` | native |
| `android:keystore` `android:signing-config` `android:release` | release builds |
| `measure:*` `verify:*` `bench:*` | performance and correctness |

</details>

<details>
<summary><b>Design documents</b></summary>

| Document | Covers |
|:--|:--|
| [mark-as-read](docs/mark-as-read.md) | Read state, unread counts, mentions, DM receipts, multi-device sync |
| [column-reverse-architecture](docs/column-reverse-architecture.md) | CSS chat anchoring, plus the small stick-to-bottom exception |
| [indexeddb-sync](docs/indexeddb-sync.md) | Local-first message cache and delta sync |
| [lexical-editor](docs/lexical-editor.md) | Editor architecture, mention nodes |
| [native-app](docs/native-app.md) | Capacitor shell, push setup |
| [optimistic-ui-flow](docs/optimistic-ui-flow.md) | Optimistic sends and reconciliation |
| [custom-emojis](docs/custom-emojis.md) | Shortcodes, R2-hosted emoji |
| [ui-design-standards](docs/ui-design-standards.md) | Visual conventions |

The microblog / Fediverse feature these documents describe is not part of the
current app; they are kept for reference:
[fediverse-implementation](docs/fediverse-implementation.md),
[federation-whitelist-strategy](docs/federation-whitelist-strategy.md),
[social-post-flow](docs/social-post-flow.md),
[post-actions](docs/post-actions.md),
[post-item-navigation](docs/post-item-navigation.md),
[optimistic-ui-persistence](docs/optimistic-ui-persistence.md),
[account-filtering](docs/account-filtering.md).

</details>

---

<div align="center">
  <sub>Private project · All rights reserved · <a href="https://github.com/thirapi">Thirafi</a></sub>
</div>
