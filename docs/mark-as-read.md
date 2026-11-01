# Dokumentasi Mark as Read (Robust & Throttled)

## Overview
Fitur "Mark as Read" dalam aplikasi ini diimplementasikan dengan mengikuti best practice dari platform besar seperti Slack dan Discord. Fokus utamanya adalah efisiensi (throttling), real-time update di sidebar, dan sinkronisasi antar perangkat (multi-device sync).

## Flow Implementasi

### 1. Real-time Unread Notification (Sidebar)
Ketika pesan baru tiba, sistem akan memberitahu semua peserta ruangan melalui Pusher (`new-message-notification`).
- **Frontend (`RealtimeNotificationListener.tsx`)**: Komponen ini mendengarkan notifikasi tersebut. Jika user sedang tidak membuka ruangan (room) yang dimaksud, sistem akan memanggil `markAsUnread(roomId)` pada `UnreadProvider`.
- **UI Feedback**: Sidebar akan langsung menampilkan indikator "pulse" merah pada ruangan tersebut tanpa perlu refresh halaman.

### 2. Throttled Viewport Marking (Slack-style)
Untuk menghindari update server yang berlebihan dan memastikan akurasi "pesan benar-benar dibaca", sistem menggunakan pendekatan throttled.
- **Hook (`useMarkAsRead.ts`)**: Menggunakan `IntersectionObserver` untuk melacak pesan yang masuk ke viewport.
- **Delay (600ms)**: Pesan baru ditandai sebagai "dibaca" jika menetap di viewport selama minimal 600ms (dioptimalkan dari sebelumnya 1.5s untuk responsivitas tinggi).
- **Auto-Mark All**: Jika user melakukan scroll hingga mencapai bagian paling bawah chat, seluruh pesan di ruangan tersebut akan langsung ditandai sebagai dibaca.

### 3. Exit Animations & Initial Anchoring
Untuk memberikan pengalaman yang mulus dan mencegah separator unread "meloncat" saat pesan mulai dibaca:
- **Initial Anchor**: Garis unread dikunci pada posisi pesan pertama yang belum dibaca saat user masuk. Garis tidak akan berpindah (turun satu per satu) meskipun pesan di bawahnya dibaca.
- **Framer Motion Exit**: Saat status unread dibersihkan, garis separator akan menghilang dengan animasi *fade-out* dan *height-collapse* yang halus.

### 4. Sinkronisasi Antar Perangkat (Multi-device Sync)
Status "sudah dibaca" disinkronkan di semua tab atau perangkat user yang sedang aktif.
- **Backend (`UpdateLastReadAtUseCase.ts`)**: Setelah database berhasil diupdate, server akan mengirim event `room-marked-read` ke channel privat user (`private-user-{userId}`, lihat `lib/pusher/channels.ts`).
- **Frontend**: `RealtimeNotificationListener.tsx` mendengarkan event ini dan memanggil `markAsRead(roomId)` pada `UnreadProvider` lokal, sehingga indikator unread di sidebar hilang secara otomatis di tab lain.

### 4. Sidebar Unread Logic & UI Alignment
Untuk menjaga konsistensi antara tampilan chat dan sidebar:
- **Sender Awareness Rule**: Indikator unread (baik separator maupun sidebar dot) hanya muncul jika ada pesan baru dari **orang lain**. Pesan yang dikirim oleh diri sendiri tidak akan pernah memicu status unread.
- **Logic Alignment**: Sidebar menggunakan `lastReadAt` (timestamp) sebagai sumber kebenaran utama untuk dibandingkan dengan `createdAt` pesan terbaru.
- **UI Positioning**: 
    - **Position**: Indikator unread (dot merah) diletakkan di pojok kanan atas avatar (`-top-0.5 -right-0.5`).
    - **Consistency**: Posisi ini seragam baik dalam mode expanded maupun collapsed.
    - **Visual**: Animasi pulse dihilangkan untuk tampilan yang lebih bersih.

### 5. Hanya dibaca saat benar-benar terlihat
- `markAsRead` di `chat-room.tsx` ditunda bila tab tidak terlihat atau window tidak fokus. Permintaan disimpan (`pendingReadRef`) dan dijalankan saat user kembali (`focus` / `visibilitychange`), hanya untuk pesan yang memang ada di layar.
- Bila room sedang terbuka tetapi tab di background, `RealtimeNotificationListener` tetap memanggil `markAsUnread` (tanpa bunyi kedua) sehingga sidebar dan judul tab ikut menandai.

### 6. Sidebar live & judul tab
- `UnreadProvider.recordActivity` menyimpan preview & waktu pesan terakhir per room dari event realtime (pesan orang lain via `new-message-notification`, pesan di room yang terbuka termasuk milik sendiri via `chat-room`). Sidebar memakai data ini bila lebih baru dari data server, sehingga preview, waktu, dan urutan berubah tanpa refresh. Format preview mengikuti `get-sidebar-data.use-case.ts` (lihat `lib/chat/message-preview.ts`).
- Flag mention dikirim saat realtime: `markAsUnread(roomId, mentionsMe)`.
- Pesan dari room yang belum ada di sidebar (DM baru, baru diundang) memicu `router.refresh()` sekali per room.
- Judul tab menampilkan jumlah room unread: `(3) Komunikasi`.

### 7. Batching read, separator, dan sinkronisasi sidebar
- **Target terjauh menang**: `markAsReadApi` di `chat-room.tsx` mengumpulkan permintaan selama ~400ms dan menulis pesan **paling bawah** yang dilaporkan (bukan argumen panggilan terakhir seperti debounce lama), dan tidak bisa "kelaparan" oleh callback observer yang terus berdatangan. Antrian yang tersisa ditulis saat room ditutup.
- **Sidebar hanya bersih bila sampai pesan terbaru**: titik unread di sidebar dihapus saat pembacaan mencapai pesan nyata terakhir, termasuk bila read position sudah tersimpan sebelumnya (misal dibaca di perangkat lain).
- **Separator diputuskan sekali**: `MessageList` boleh menentukan separator dari cache, lalu dikunci setelah snapshot server masuk (`unreadSettled`, fallback 4 detik). Pesan yang datang saat room terbuka tidak lagi memunculkan separator sesaat.
- **Merge snapshot server**: `UnreadProvider.initializeUnread` (dipanggil ulang setiap `router.refresh`) tidak menimpa keputusan lokal yang lebih baru dari pesan terakhir di snapshot (`at` per room), sehingga titik yang sudah dibaca tidak muncul kembali karena data server yang tertinggal.
- **Presisi timestamp**: `Message.createdAt` berpresisi mikrodetik (`now()` di DB) sedangkan `lastReadAt` ditulis dari JS (milidetik). Query sidebar membandingkan dengan `date_trunc('milliseconds', ...)`.

### 8. Membuka room: satu request, cache ikut terisi realtime
- `getRoomSnapshot` (room.action.ts) mengambil room, 50 pesan terbaru, dan read position dalam **satu** server action (server action Next.js antre satu per satu, sebelumnya 3 round trip berurutan).
- `RealtimeNotificationListener` menulis pesan dari room lain ke cache memori (`clientChatCache.appendLive`), sehingga room yang dibuka dari sidebar langsung menampilkan pesan barunya di frame pertama.

## Aturan Pengembangan (Guardrails)
1. **Prioritas Kebenaran (Timestamp-First)**: Selalu gunakan `lastReadAt` (timestamp) sebagai *Primary Source of Truth*. Update hanya dilakukan jika timestamp baru **lebih besar** (lebih baru) dari yang tersimpan. Hal ini mencegah *stale data* dari server menimpa update lokal yang cepat.
2. **Auto-Mark at Bottom**: Jika user berada di dasar chat (`isAtBottom: true`), setiap pesan baru yang masuk (via Pusher) harus otomatis ditandai sebagai dibaca tanpa menunggu interaksi scroll tambahan.
3. **Sender Awareness**: Filter ketat `userId !== currentUserId` wajib diterapkan di semua logika penentuan status unread agar pesan sendiri tidak memicu indikator.
4. **Clean Architecture**: Logika broadcast dan penentuan unread harus tetap berada di layer Use Case.

## Handling Message Deletions (Robust Deletion Strategy)
Untuk menjaga konsistensi posisi separator unread saat ada pesan yang dihapus:
1. **Neighbor Anchor**: Jika pesan yang menjadi `lastReadMessageId` dihapus, sistem akan mencoba mencari pesan **tepat sebelum** pesan yang dihapus tersebut sebagai anchor baru. Ini dienkapsulasi menggunakan method `fallbackLastReadMessageId` di dalam `IRoomRepository` dan dieksekusi oleh `DeleteMessageUseCase`. Ini menjaga posisi "sudah dibaca" tetap stabil.
2. **Timestamp Fallback**: Jika anchor baru tidak ditemukan, sistem jatuh (fallback) ke penggunaan `lastReadAt`. Karena `lastReadAt` menyimpan waktu pembuatan pesan terakhir yang valid, posisi unread akan tetap akurat.
3. **Self-Correction**: Jika setelah penghapusan pesan, semua pesan yang tersisa adalah milik user sendiri, indikator unread akan otomatis hilang.

---
*Dokumen ini merupakan bagian dari standar engineering proyek. Referensi Arsitektur: [clean-architecture.md](../clean-architecture.md)*
