# Project Gemini Instructions

## Primary Mandates
- **Clean Architecture**: Follow the patterns defined in [clean-architecture.md](./clean-architecture.md).
- **Mark as Read**: All changes related to message read status must adhere to the throttled and real-time synchronization strategy documented in [docs/mark-as-read.md](./docs/mark-as-read.md).
- **Lexical Editor**: All chat input components use the Lexical rich text framework. Refer to [docs/lexical-editor.md](./docs/lexical-editor.md) for architecture decisions.
- **Content Integrity**: All components rendering user content (messages, bios, usernames) MUST use `parseFediverseContent` (`lib/fediverse-content-parser.ts`, the name is historical) so custom emojis render consistently.
- **Product Direction**: Chat behaviour takes the middle ground between WhatsApp, Telegram and Teams (pick what most of them converge on). Users expect WhatsApp/Telegram-level smoothness; small UX gaps count.
- **Server-side Fetching (SSRF)**: Any server fetch of a user-supplied URL MUST go through `lib/net/safe-fetch.ts` (public IPs only on every hop, checked in the socket's DNS lookup; type allow-list; size, time and redirect limits), like the media proxy and link previews.
- **Custom Emojis & Reactions**: Implementation of exclusive emoji reactions and R2-hosted custom emojis MUST follow [docs/custom-emojis.md](./docs/custom-emojis.md).

## Architecture Constraints
1. **Realtime (Pusher)**:
    - Chat channels (`private-chat-{roomId}`) and per-user channels (`private-user-{userId}`) are private and authorised by membership/identity in `/api/pusher`. Never add public channels for user data.
    - Room events: `new-message`, `message-updated`, `message-deleted`, `message-reaction`, `user-typing`, `pins-changed`, `read-receipt` (DMs), `block-changed` (DMs).
    - User events: `new-message-notification`, `message-deleted-notification`, `room-marked-read`, `room-typing` (DMs and rooms of up to 10), `room-mute-changed`.
    - Fan out to many users with `triggerToUsers` (one API call per 100 channels).

2. **Interaction Integrity**:
    - **No-Null User**: Every interaction (reaction, pin, vote, save) MUST have a valid `userId` taken from the session (`lib/auth/actor.ts`), never from the client.
    - **Idempotency**: Use unique constraints (and transactions where needed) so a user cannot react, vote or save twice.
    - **Visual Debugging**: If the UI shows doubles but the database is clean, the bug is in frontend state (optimistic UI / cache), not the backend.

3. **Message Timestamps**:
    - `updatedAt` moves on edits, deletions, reactions and pins (delta sync depends on it). "(diedit)" MUST use `editedAt`, never `updatedAt`.
    - Reaction and other side-table changes MUST call `touchMessage` so delta sync sees them.

4. **Privacy & Blocks**:
    - Room data returned to a client MUST go through `applyRoomPrivacy` (per viewer: read positions and last seen, reciprocal settings, blocks) or `withoutOthersReadPositions` for list/create endpoints.
    - DM blocks are enforced in `SendMessageUseCase` and `StartDirectMessageUseCase`; new send paths MUST go through `SendMessageUseCase`.

5. **Storage**:
    - Deleting a message removes its R2 files only via `DeleteMessageUseCase` (key derived from our URL under `channels/<roomId>/`, kept while another live message references it). Never delete storage keys taken from client input.

6. **Migrations**:
    - Migrations are not run on deploy. A change that adds columns read by queries MUST ship its migration (`npx drizzle-kit generate`) and the migration must be applied before the code is deployed.
    - Every migration change MUST pass `npm run verify:migrations` (throwaway Postgres; CI runs it on every push). Confirm `db:migrate` printed `✅ Migrations completed successfully!` before deploying code that needs it.

## Implementation Rules
1. **Unread Management**:
    - Use `UnreadProvider` for UI state.
    - `RealtimeNotificationListener` is the entry point for Pusher-based unread/read synchronization.
2. **Viewport Performance**:
    - Marking as read via scroll is optimized for responsiveness (~600ms delay) to balance server load and user experience.
    - Refer to `useMarkAsRead.ts` for implementation details.
3. **Local-First Caching**:
    - Message fetching is implemented primarily using the **Stale-While-Revalidate** pattern against IndexedDB.
    - Please consult [docs/indexeddb-sync.md](./docs/indexeddb-sync.md) for caching architectures.
4. **Chat Render Architectures**:
    - Avoid Javascript DOM manipulations for anchoring list positions. Leverage column-reverse mechanics.
    - The one exception is stick-to-bottom (`hooks/use-auto-scroll.ts`): pin `scrollTop = 0` while the reader follows the bottom.
    - Refer to [docs/column-reverse-architecture.md](./docs/column-reverse-architecture.md) for deep-dive.
5. **Multi-device Sync**:
    - Backend must broadcast `room-marked-read` to the user's private channel after a successful update.
6. **Robust Deletion Strategy**:
    - Message deletions MUST execute `fallbackLastReadMessageId` from `roomRepository` prior to deletion to adjust anchors safely.
7. **Lexical Editor**:
    - Chat input is powered by `MentionTextarea` (Lexical-based). Do NOT use raw `<textarea>` elements.
    - Markdown symbols (`**`, `_`, `~~`, `` ` ``) are **always preserved** in the text — never stripped. Visual decoration is applied via `MarkdownDecoratorPlugin`.
    - Mentions are stored as `<@userId>` tokens in the database and rendered as atomic `MentionNode` instances in the editor.
    - Refer to [docs/lexical-editor.md](./docs/lexical-editor.md) for the full architecture.

## AI Operational & Code Integrity
- **Mandatory Context Review**: AI WAJIB membaca file ini dan dokumentasi relevan di `docs/` sebelum memulai riset atau eksekusi untuk memahami konteks dan batasan proyek.
- **Surgical Modifications**: Utamakan penggunaan tool `replace` daripada `write_file` untuk mengedit file yang sudah ada. Pastikan `old_string` bersifat unik dan konteks yang diambil cukup luas untuk menghindari penimpaan blok kode yang tidak sengaja.
- **Logic Preservation**: JANGAN PERNAH menghapus atau mengubah logika bisnis yang sudah ada kecuali diminta secara eksplisit. Jika perbaikan bug memerlukan perubahan logika, AI harus menjelaskan alasannya dan mempertimbangkan efek sampingnya.
- **Impact Assessment**: Sebelum melakukan perubahan, evaluasi bagaimana perubahan tersebut mempengaruhi flow lain, hook, atau relasi database. Patuhi batasan "Clean Architecture" yang didefinisikan di `clean-architecture.md`.
- **Validation Mandate**: Semua kode yang ditulis harus valid secara sintaksis, *type-safe* (TypeScript), dan diverifikasi melalui skrip pengujian atau unit test sebelum dianggap selesai.
- **Zero Hallucination Policy**: Jika ragu tentang struktur file atau alur logika, gunakan `read_file` atau `grep_search` untuk verifikasi. Dilarang berasumsi tentang keberadaan fungsi, variabel, atau file.
- **User Intent Alignment**: Hanya lakukan perubahan yang benar-benar diminta oleh user atau yang secara teknis diperlukan untuk menyelesaikan masalah yang dilaporkan. Hindari "improvisasi" yang mengubah perilaku dasar aplikasi tanpa persetujuan.

