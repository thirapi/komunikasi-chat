# CSS Column-Reverse Architecture

## Deskripsi Singkat
Aplikasi komunkasi ini telah mengadopsi standar *Enterprise Tier* pada kanvas obrolannya (Chat UI) melalui integrasi **CSS `flex-col-reverse`**. Migrasi ini menggantikan *library* *third-party* yang memblokir render secara mutlak dengan teknik penandaan titik dasar secara murni via gaya rentang layar (CSS).

## Masalah *Scroll-Flash*
Secara historis, setiap transisi pembukaan obrolan atau pemasukan *image* baru memerlukan injeksi hitungan tinggi/lebar layar (DOM sizing calculations) melalui JavaScript. Skema ini berujung pada kilatan posisi layar (*scroll flash*) saat pertama kali *hook* seperti `scrollIntoView` dieksekusi. Hal ini tidak dapat mengimbangi kecepatan sinkronisasi RAM-Cache dari IndexedDB yang sangat kilat.

## Mekanika Kerja Cerdas
Dengan melakukan pembaharuan pada berkas `message-list.tsx`:
1. Kontainer dibubuhi utilitas `flex-col-reverse` dan `overflow-y-auto`.
2. Konstruksi pelukisan peramban (DOM) disusun terbalik, meletakkan titik referensi engsel terdalam tepat pada *Pixel-0* / dasar jendela baca. 
3. Titik tersebut (scroll-y `0`) selamanya mengakar di dasar chat.
4. **Natural Anchoring (Tanpa JS)**: Saat barisan teks baru ditembakkan melalui memori cache maupun soket *Pusher*, atau saat memuat rekam jejak gambar (*dynamic image resize*), batas atas dari layout tersebut sekadar menjauh ke teratas langit-langit layar (terekstrusi ke belakang) *TANPA* mengusik/merubah patokan `ScrollTop = 0`. Hal ini menghilangkan mutlak peranan `ResizeObserver` atau komputasi gulir.

## Stabilitas Layout Media
Meskipun `flex-col-reverse` menangani pertumbuhan konten di atas dengan sangat baik, pemuatan aset media (gambar/video) tetap dapat menyebabkan *layout shift* yang mengganggu jika dimensi akhir tidak diketahui.
- **Placeholder & Aspect Ratio:** Setiap kontainer media wajib memiliki `bg-muted` dan `min-height` atau `aspect-ratio` yang disetel secara eksplisit (misal: `aspect-[4/3]` untuk grid atau `min-h-[200px]` untuk single image).
- **Extrusion Direction:** Karena patokan kita berada di dasar (bawah), maka "ledakan" ukuran gambar akan mengekstrusi pesan-pesan lama ke arah atas, menjaga pesan terbaru tetap terlihat tanpa pergerakan tiba-tiba pada area yang sedang dibaca pengguna.

## Konvensi yang Harus Dijaga
**DILARANG membalik ulang iterasi di DOM**. 
Setiap barisan *Component* harus disusun ke dalam koleksi kronologis normal lalu dikunci menggunakan perputaran utuh sebelum diproduksi ulang. Hal ini demi merekayasa pelukisan CSS tetapi tetap menetapkan logika hari dan pemisah unread (*Date And Unread Separators*) menyatu solid dan bermakna normal di balik layar.

## Stick-to-Bottom (pengecualian kecil)
`flex-col-reverse` hanya menahan view di dasar selama `scrollTop` tepat `0`. Bila meleset beberapa piksel (pembulatan DPI, smooth scroll yang berhenti sedikit sebelum dasar, composer membesar, gambar selesai dimuat), *scroll anchoring* browser menahan konten lama dan pesan baru jatuh di bawah layar — padahal bottom observer sudah menandainya terbaca.
`hooks/use-auto-scroll.ts` karena itu melacak apakah pembaca sedang "mengikuti dasar" (≤32px dari dasar, dari event scroll) dan, hanya dalam kondisi itu, menyetel `scrollTop = 0` di layout effect (sebelum paint) saat pesan bertambah, media selesai dimuat, atau viewport berubah ukuran. Tidak ada pengukuran tinggi; pembaca yang sedang scroll ke atas tidak pernah ditarik turun, kecuali saat ia sendiri mengirim pesan.
