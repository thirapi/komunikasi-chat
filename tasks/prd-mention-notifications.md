# PRD: Mention & Pengaturan Notifikasi per Room

## Pendahuluan

Komunikasi sudah mendukung @mention di editor (autocomplete Lexical, token `<@userId>` dan `<@everyone>`, render di pesan, badge mention di sidebar saat halaman dimuat). Namun setiap pesan baru masih mengirim push notification ke **semua** anggota room, tanpa membedakan apakah pengguna disebut atau tidak, dan pengguna tidak bisa mengatur atau membisukan notifikasi per room. Akibatnya channel ramai menjadi bising, dan mention penting tenggelam.

Fitur ini menambahkan **level notifikasi per room** (`all` / `mentions` / `none`) dan membuat mention benar-benar dipakai sebagai sinyal notifikasi: di push, di toast/suara realtime, dan di badge sidebar secara realtime.

### Istilah

- **Level notifikasi**: preferensi per pengguna per room, disimpan di `RoomParticipant.notificationLevel`.
  - `all`: notifikasi untuk setiap pesan (perilaku saat ini, dan default).
  - `mentions`: notifikasi hanya jika pengguna disebut langsung (`<@userId>`) atau ada `<@everyone>`.
  - `none` (ditampilkan sebagai "Bisukan"): tidak ada push, toast, suara, maupun browser Notification.
- **Mention langsung**: token `<@userId>` di konten pesan, dengan `userId` = id pengguna penerima.
- **Push**: notifikasi lewat Web Push (VAPID, `type = "web"`) atau FCM (`type = "fcm"`), dikirim dari `SendMessageUseCase`.
- **Notifikasi realtime**: event Pusher `new-message-notification` di channel `user-<id>`, ditangani `RealtimeNotificationListener` (toast, suara, haptic, browser `Notification`).

## Goals

- Pengguna bisa memilih level notifikasi per room dalam ≤ 2 klik dari header room.
- Push tidak dikirim ke pengguna yang level-nya `none`, atau `mentions` tanpa disebut.
- Badge mention di sidebar menyala secara realtime saat pesan yang menyebut pengguna masuk (bukan hanya setelah reload).
- Isi push menampilkan `@username`, bukan token mentah `<@id>`.
- Pengguna bisa langsung melihat pesan mana yang menyebut dirinya.

## User Stories

### US-001: Tambah kolom `notificationLevel` di RoomParticipant
**Description:** Sebagai developer, saya perlu menyimpan level notifikasi per peserta room agar preferensi bertahan antar sesi dan perangkat.

**Acceptance Criteria:**
- [ ] `src/lib/infrastructure/drizzle/schema.ts`: tabel `roomParticipants` punya kolom `notificationLevel: text("notificationLevel", { enum: ["all", "mentions", "none"] }).default("all").notNull()`
- [ ] Ekspor tipe `NotificationLevel = "all" | "mentions" | "none"` dari `src/lib/entities/models/` (file model room/participant yang sudah ada, atau `notification-level.model.ts` baru) dan konstanta `NOTIFICATION_LEVELS` berisi ketiga nilai
- [ ] Migration dibuat dengan `npx drizzle-kit generate` sebagai file baru `drizzle/0007_*.sql`; baris yang sudah ada otomatis bernilai `'all'`
- [ ] `npx tsc --noEmit` lolos

### US-002: Utilitas parser mention bersama
**Description:** Sebagai developer, saya ingin satu fungsi untuk mengekstrak mention dari konten pesan, agar server dan klien memakai aturan yang sama.

**Acceptance Criteria:**
- [ ] File baru `src/lib/mentions.ts` mengekspor `MENTION_TOKEN = /<@([a-zA-Z0-9_-]+)>/g` dan `extractMentions(content: string): { userIds: string[]; everyone: boolean }`
- [ ] `userIds` unik (tanpa duplikat), urut sesuai kemunculan pertama, dan **tidak** mengandung `"everyone"`
- [ ] Mengekspor `isMentioned(content: string, userId: string): boolean`, yang `true` jika ada `<@userId>` atau `<@everyone>`
- [ ] Unit test `src/lib/__tests__/mentions.test.ts` mencakup: tanpa mention, satu mention, mention ganda/duplikat, `<@everyone>`, token di dalam teks lain (`halo <@abc>!`), dan string `@abc` tanpa kurung sudut (bukan mention)
- [ ] `npx vitest run src/lib/__tests__/mentions.test.ts` lolos
- [ ] `npx tsc --noEmit` lolos

### US-003: `getOtherParticipants` mengembalikan username dan level notifikasi
**Description:** Sebagai developer, saya butuh username dan level notifikasi setiap penerima saat mengirim pesan, untuk memfilter push dan menampilkan nama di isi notifikasi.

**Acceptance Criteria:**
- [ ] `IRoomRepository.getOtherParticipants` mengembalikan `Promise<{ userId: string; username: string; notificationLevel: NotificationLevel }[]>`
- [ ] Implementasi di `src/lib/infrastructure/repositories/room.repository.ts` mengambil `username` lewat relasi `user` dan kolom `notificationLevel`, tetap dalam **satu** query
- [ ] Semua pemanggil dan mock test (`send-message.use-case.test.ts` dan lainnya yang memakai `getOtherParticipants`) diperbarui agar typecheck lolos
- [ ] `npx vitest run` lolos
- [ ] `npx tsc --noEmit` lolos

### US-004: Use case dan server action untuk mengubah level notifikasi
**Description:** Sebagai pengguna, saya ingin mengubah level notifikasi saya untuk satu room, dan perubahan itu tersimpan di server.

**Acceptance Criteria:**
- [ ] `IRoomRepository.updateNotificationLevel(roomId: string, userId: string, level: NotificationLevel): Promise<boolean>`, yang mengembalikan `false` jika pengguna bukan peserta room
- [ ] Use case baru `src/lib/application/use-cases/rooms/update-notification-level.use-case.ts`:
  - menolak `level` di luar `NOTIFICATION_LEVELS` dengan error validasi yang sudah dipakai di `src/lib/entities/errors`
  - untuk room `isDirect = true`, menolak `"mentions"` (DM hanya `all` atau `none`)
  - melempar error "bukan peserta" jika repository mengembalikan `false`
- [ ] Controller baru di `src/lib/interface-adapters/controllers/rooms/` mengikuti pola controller room yang sudah ada, dan memakai sesi pengguna yang login (userId tidak boleh dari input klien)
- [ ] Server action `updateNotificationLevelAction(roomId, level)` diekspos ke klien dari lokasi action room yang sudah ada
- [ ] Unit test use case untuk: sukses, level tidak valid, `mentions` pada DM, dan bukan peserta
- [ ] `npx vitest run` lolos
- [ ] `npx tsc --noEmit` lolos

### US-005: Filter push berdasarkan level notifikasi dan mention
**Description:** Sebagai pengguna, saya hanya ingin menerima push untuk room yang saya pedulikan, agar channel ramai tidak membanjiri ponsel saya.

**Acceptance Criteria:**
- [ ] Di `SendMessageUseCase.execute`, penerima push dihitung dengan `extractMentions(content)` dan level tiap peserta:
  - `all` → dapat push
  - `mentions` → dapat push hanya jika `userIds` berisi id-nya **atau** `everyone === true`
  - `none` → tidak pernah dapat push, termasuk saat disebut
- [ ] `getSubscriptionsByUserIds` hanya dipanggil dengan id penerima push yang lolos filter; jika daftarnya kosong, query subscription tidak dijalankan
- [ ] Event Pusher `new-message-notification` tetap dikirim ke **semua** peserta lain (untuk unread), dengan payload tambahan `mentionedUserIds: string[]` dan `mentionsEveryone: boolean`
- [ ] Semua anggota boleh memakai `<@everyone>` (tidak ada pembatasan baru)
- [ ] Test di `send-message.use-case.test.ts`: (a) peserta `all` dapat push, (b) `mentions` tanpa mention tidak dapat, (c) `mentions` + mention langsung dapat, (d) `mentions` + `<@everyone>` dapat, (e) `none` + mention tidak dapat, (f) payload Pusher berisi `mentionedUserIds` dan `mentionsEveryone`
- [ ] `npx vitest run` lolos
- [ ] `npx tsc --noEmit` lolos

### US-006: Isi push menampilkan @username
**Description:** Sebagai penerima, saya ingin isi notifikasi menampilkan `@budi`, bukan `<@clx123...>`.

**Acceptance Criteria:**
- [ ] `resolveContentForNotification` di `SendMessageUseCase` memakai `username` dari hasil `getOtherParticipants` (US-003), tanpa cast `as any`
- [ ] Token pengirim sendiri menjadi `@<username pengirim>`, `<@everyone>` menjadi `@everyone`, dan token untuk id yang tidak dikenal dibiarkan apa adanya
- [ ] Test: konten `"halo <@u2> dan <@everyone>"` dengan peserta `{ userId: "u2", username: "budi" }` menghasilkan body push `"halo @budi dan @everyone"`
- [ ] `npx vitest run` lolos
- [ ] `npx tsc --noEmit` lolos

### US-007: Data sidebar menyertakan level notifikasi
**Description:** Sebagai developer, saya butuh level notifikasi setiap room di klien, agar listener realtime dan sidebar bisa menghormatinya.

**Acceptance Criteria:**
- [ ] Query `getSidebarRooms` di `room.repository.ts` menambahkan `me."notificationLevel" AS "notificationLevel"`, dan tipe `SidebarRoomRow` diperbarui
- [ ] `GetSidebarDataUseCase` meneruskan `notificationLevel` di setiap item room
- [ ] `UnreadProvider` (`src/components/unread-provider.tsx`) menyimpan `notificationLevel` per room: `initializeUnread` menerima field ini, dan ada fungsi baru `setNotificationLevel(roomId, level)` di context
- [ ] Pemanggil `initializeUnread` (`app-sidebar.tsx` atau yang setara) meneruskan `notificationLevel`
- [ ] Logika `hasMention` di SQL tidak berubah
- [ ] `npx vitest run` lolos
- [ ] `npx tsc --noEmit` lolos

### US-008: Listener realtime menghormati level dan menyalakan badge mention
**Description:** Sebagai pengguna, saya ingin toast, suara, dan badge mengikuti level notifikasi saya, dan badge mention langsung muncul saat saya disebut.

**Acceptance Criteria:**
- [ ] Di `src/components/realtime-notification-listener.tsx`, handler `new-message-notification` menghitung `mentioned = mentionedUserIds.includes(user.id) || mentionsEveryone`
- [ ] `markAsUnread(roomId, mentioned)` dipanggil untuk room yang tidak sedang dibuka, **di semua level** termasuk `none`
- [ ] Suara, haptic, toast, dan browser `Notification` hanya dijalankan jika level room `all`, atau `mentions` dan `mentioned === true`. Untuk `none` tidak ada satu pun dari keempatnya
- [ ] Level dibaca lewat ref atau context terkini (bukan nilai basi), sehingga perubahan level berlaku tanpa resubscribe Pusher
- [ ] Toast memakai isi pesan dengan token mention yang sudah di-resolve ke `@username` jika data tersedia, dan fallback ke `@everyone` atau token mentah
- [ ] `npx tsc --noEmit` lolos
- [ ] Verify in browser: dengan dua akun di room yang sama, akun B mengatur room ke "Hanya mention"; akun A mengirim "tes" → B tidak mendapat toast/suara tapi titik unread muncul; A mengirim "tes <@B>" → B mendapat toast dan badge mention muncul tanpa reload

### US-009: Kontrol level notifikasi di header room
**Description:** Sebagai pengguna, saya ingin mengubah level notifikasi room dari header room.

**Acceptance Criteria:**
- [ ] Tombol ikon lonceng di `chat-header.tsx` (Phosphor `Bell`, atau `BellSlash` saat `none`), dengan `aria-label="Pengaturan notifikasi"`, membuka `DropdownMenu` berisi `DropdownMenuRadioGroup`
- [ ] Opsi channel: "Semua pesan" (`all`), "Hanya mention" (`mentions`), "Bisukan" (`none`). Opsi DM: hanya "Semua pesan" dan "Bisukan"
- [ ] Memilih opsi langsung memanggil `setNotificationLevel` (optimistic) lalu `updateNotificationLevelAction`. Jika gagal, nilai dikembalikan dan muncul `toast.error("Gagal menyimpan pengaturan notifikasi")`
- [ ] Opsi yang aktif sesuai nilai dari `UnreadProvider`
- [ ] `npx tsc --noEmit` lolos
- [ ] Verify in browser: di /channels/<id> sebuah channel, pilih "Bisukan" → ikon berubah ke lonceng dicoret, dan setelah reload opsi "Bisukan" masih terpilih; di sebuah DM, menu hanya berisi dua opsi

### US-010: Tampilan room yang dibisukan di sidebar
**Description:** Sebagai pengguna, saya ingin melihat room mana yang dibisukan, dan room tersebut tidak menarik perhatian sebesar room lain.

**Acceptance Criteria:**
- [ ] Di `nav-main.tsx` dan `nav-main-direct-message.tsx`, room dengan level `none` menampilkan ikon `BellSlash` kecil (`size-3.5 text-muted-foreground`) di samping nama
- [ ] Indikator unread untuk room `none` ditampilkan redup (`opacity-40`) dan nama room tidak ditebalkan
- [ ] Badge mention tetap tampil normal (tidak redup) untuk room `none` jika `hasMention` true
- [ ] `npx tsc --noEmit` lolos
- [ ] Verify in browser: bisukan sebuah channel, lalu kirim pesan ke sana dari akun lain → di sidebar akun pertama room tersebut punya ikon lonceng dicoret dan titik unread redup; kirim pesan yang menyebutnya → badge mention muncul dengan warna penuh

### US-011: Sorot pesan yang menyebut saya
**Description:** Sebagai pengguna, saya ingin pesan yang menyebut saya mudah terlihat saat menggulir riwayat chat.

**Acceptance Criteria:**
- [ ] Di `message-item.tsx`, jika `isMentioned(message.content, currentUserId)` (dari US-002) bernilai true dan pengirim bukan pengguna saat ini, kontainer pesan diberi kelas `bg-primary/5 border-l-2 border-primary`
- [ ] Pesan milik sendiri yang berisi `<@everyone>` tidak disorot
- [ ] Penyorotan juga berlaku untuk pesan yang masuk lewat realtime (tanpa reload)
- [ ] `npx tsc --noEmit` lolos
- [ ] Verify in browser: di sebuah channel, pesan dari akun lain berisi `@<username saya>` tampil dengan latar tipis dan garis kiri berwarna primary; pesan tanpa mention tampil normal

## Functional Requirements

- FR-1: Setiap `RoomParticipant` memiliki `notificationLevel` ∈ {`all`, `mentions`, `none`}, default `all`.
- FR-2: Room DM (`isDirect = true`) hanya menerima `all` atau `none`. Server menolak `mentions` untuk DM.
- FR-3: Pengguna hanya bisa mengubah level notifikasinya sendiri, dan hanya di room tempat ia menjadi peserta.
- FR-4: Push dikirim ke peserta jika level `all`, atau `mentions` dan pesan berisi `<@userId>` miliknya atau `<@everyone>`. Level `none` tidak pernah menerima push.
- FR-5: Event Pusher `new-message-notification` tetap dikirim ke semua peserta lain dan menyertakan `mentionedUserIds` dan `mentionsEveryone`.
- FR-6: Klien selalu menandai room sebagai unread (dan sebagai mention bila disebut), apa pun level-nya. Suara, toast, haptic, dan browser Notification mengikuti aturan FR-4.
- FR-7: Isi push dan toast menampilkan `@username` sebagai pengganti token `<@userId>`.
- FR-8: Semua anggota room boleh memakai `@everyone`.
- FR-9: Room dengan level `none` tampil dengan ikon lonceng dicoret dan unread redup di sidebar, sedangkan badge mention tetap penuh.
- FR-10: Pesan yang menyebut pengguna saat ini (langsung atau `@everyone`, dari orang lain) disorot di daftar pesan.

## Non-Goals

- Tidak ada halaman/inbox "Mention saya" atau daftar mention lintas room.
- Tidak ada pengaturan notifikasi global (semua room sekaligus), jam senyap, atau mute berbatas waktu ("bisukan 1 jam").
- Tidak ada notifikasi baru saat pesan **diedit** untuk menambahkan mention.
- Tidak ada pembatasan siapa yang boleh memakai `@everyone`, dan tidak ada `@here` atau mention berbasis role.
- Tidak mengubah `DiscordNotifierService` (masih mengirim setiap pesan, di luar cakupan).
- Tidak mengubah autocomplete mention di editor Lexical, maupun format token `<@userId>`.
- Tidak memindahkan deteksi `hasMention` di SQL sidebar ke tabel mention terpisah.

## Design Considerations

- Pakai komponen yang sudah ada: `DropdownMenu`, `DropdownMenuRadioGroup`, dan `DropdownMenuRadioItem` dari `src/components/ui/dropdown-menu`, serta ikon Phosphor `Bell` / `BellSlash` (`weight="duotone"` seperti ikon lain di header).
- Label UI dalam Bahasa Indonesia: "Semua pesan", "Hanya mention", "Bisukan".
- Tombol lonceng di header ditempatkan sebelum tombol pencarian. Di mobile tombol ini harus tetap terlihat (bukan hanya `md:flex`).

## Technical Considerations

- File kunci:
  - Skema: `src/lib/infrastructure/drizzle/schema.ts` (`roomParticipants`); migrasi di `drizzle/`, dibuat dengan `npx drizzle-kit generate`.
  - Kirim pesan dan push: `src/lib/application/use-cases/messages/send-message.use-case.ts`; wiring di `src/lib/interface-adapters/controllers/messages/send-message.controller.ts`.
  - Repository room: `src/lib/infrastructure/repositories/room.repository.ts` (`getOtherParticipants`, `getSidebarRooms`).
  - Klien: `src/components/realtime-notification-listener.tsx`, `src/components/unread-provider.tsx`, `src/app/(with-sidebar)/nav-main*.tsx`, `src/app/(with-sidebar)/channels/[roomId]/components/{chat-header,message-item}.tsx`.
- Regex mention saat ini diduplikasi di beberapa file (`send-message.use-case.ts`, `get-sidebar-data.use-case.ts`, `message-item.tsx`, `chat-room.tsx`). US-002 menyediakan `src/lib/mentions.ts`. Story baru wajib memakainya, tetapi refactor file lama yang tidak disentuh story bukan bagian dari PRD ini.
- **Bug yang sudah ada dan diperbaiki oleh US-003/US-006:** `getOtherParticipants` hanya mengembalikan `userId`, sehingga resolusi `@username` di body push selalu jatuh ke token mentah.
- **Bug yang sudah ada dan diperbaiki oleh US-008:** listener memanggil `markAsUnread(roomId)` tanpa flag mention, sehingga badge mention baru muncul setelah reload.
- `SendMessageUseCase` saat ini memanggil `getSubscriptionsByUserIds` untuk semua penerima. Setelah US-005, panggilan hanya untuk penerima yang lolos filter, sehingga beban query berkurang di channel besar.
- Perintah verifikasi: typecheck `npx tsc --noEmit`, test `npx vitest run`, lint `npm run lint`.

## Success Metrics

- Jumlah push per pesan di channel yang memiliki peserta `mentions`/`none` turun sebanding dengan jumlah peserta tersebut.
- Badge mention muncul realtime pada 100% pesan yang menyebut pengguna (dicek manual dengan dua akun).
- Tidak ada lagi body push yang berisi token `<@...>` mentah.
- Mengubah level notifikasi butuh ≤ 2 klik dari header room.

## Open Questions

- Asumsi: default `all` untuk room yang ada maupun yang baru (dipilih user). Apakah channel publik yang sangat besar nantinya perlu default `mentions`?
- Asumsi: mention langsung di room yang dibisukan **tidak** mengirim push, hanya badge mention di sidebar (dipilih user). Perlu dievaluasi setelah rilis bila pengguna melewatkan mention penting.
- Apakah `DiscordNotifierService` (mengirim `@everyone` ke Discord untuk **setiap** pesan) masih diinginkan? Ini di luar cakupan, tapi kemungkinan besar jadi sumber kebisingan berikutnya.
- Apakah perlu "bisukan sementara" (1 jam / 8 jam / sampai dibuka lagi) di iterasi berikutnya?
