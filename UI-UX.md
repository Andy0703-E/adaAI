# UI-UX.md

## 1. Prinsip Desain
UI harus terasa modern, minimal, cepat, dan fokus pada percakapan. Desain tidak meniru branding produk tertentu, tetapi boleh menggunakan pola interaksi yang sudah familiar pada aplikasi AI Chat modern.

Prinsip utama:
- conversation-first;
- minim distraksi;
- responsif desktop dan mobile;
- state streaming mudah dipahami;
- feedback aksi jelas;
- keyboard-friendly;
- aksesibilitas menjadi bagian desain, bukan tambahan belakangan.

## 2. Information Architecture
Area utama aplikasi:
1. Authentication: Login dan Register.
2. Chat Workspace.
3. Conversation History.
4. Model Selector.
5. Settings.

## 3. Desktop Layout
```text
┌──────────────────────┬───────────────────────────────────────────┐
│ Sidebar              │ Header                                    │
│                      ├───────────────────────────────────────────┤
│ Logo / App Name      │                                           │
│ + New Chat           │              Conversation                 │
│ Search               │                                           │
│ History              │                                           │
│                      │                                           │
│ Settings / Account   ├───────────────────────────────────────────┤
│                      │              Composer                     │
└──────────────────────┴───────────────────────────────────────────┘
```

Desktop sidebar:
- lebar default sekitar 260–300 px;
- dapat collapse;
- conversation list scroll independen;
- composer tetap terlihat di bawah chat area.

## 4. Mobile Layout
- Sidebar berubah menjadi drawer/sheet.
- Chat menggunakan hampir seluruh lebar layar.
- Header tetap ringkas.
- Composer sticky di bawah viewport.
- Layout harus aman terhadap virtual keyboard mobile.
- Tombol sentuh minimum nyaman, target sekitar 44×44 px untuk aksi utama.

## 5. Sidebar
Elemen:
- logo/nama aplikasi;
- tombol New Chat;
- search conversation untuk user login;
- daftar history;
- section Today / Previous 7 Days / Older opsional;
- menu context conversation: Rename, Archive/Unarchive, Delete;
- Settings;
- Account/Login state.

### Guest State
Sidebar menampilkan history sementara dari `sessionStorage`. Berikan label ringan seperti "Sementara" agar user memahami chat akan hilang setelah session berakhir.

### Authenticated State
History diambil dari server dengan pagination/cursor. Saat scroll mendekati akhir, load batch berikutnya tanpa memblokir chat aktif.

## 6. Empty State
Saat belum ada conversation aktif:
- nama aplikasi/AI;
- greeting singkat;
- composer utama;
- model selector;
- 4–6 suggestion prompts.

Contoh suggestion:
- Buatkan landing page untuk produk saya
- Jelaskan kode ini dengan sederhana
- Bantu saya belajar topik baru
- Buat ide project aplikasi
- Ringkas teks menjadi poin penting

Suggestion hanya mengisi composer; user tetap dapat mengedit sebelum mengirim.

## 7. Header Chat
Berisi:
- sidebar toggle;
- conversation title;
- model selector;
- status model bila unavailable/error;
- menu conversation untuk user login.

Conversation title dipotong secara visual jika terlalu panjang tetapi full title tersedia lewat tooltip/accessible label.

## 8. Model Selector
Model selector berupa popover/dialog searchable.

Tampilkan:
- display name;
- model ID sekunder bila perlu;
- availability;
- capability singkat jika metadata tersedia, misalnya text/multimodal/context window.

Jangan tampilkan status `Active` sebagai properti global model. Model yang sedang dipilih cukup ditandai pada selector conversation/user saat ini.

States:
- Loading models;
- Available;
- No models found;
- Provider unavailable + fallback active;
- Selected model unavailable.

Jika selected model menjadi unavailable, tampilkan banner ringan dan minta user memilih model lain tanpa menghapus conversation.

## 9. Conversation Area
### User Message
Aksi yang tersedia:
- Copy;
- Edit untuk user message terakhir sesuai scope MVP.

Visual:
- jelas berbeda dari assistant;
- tidak harus memakai bubble besar jika mengurangi ruang baca;
- teks tetap selectable.

### Assistant Message
Mendukung:
- Markdown;
- GFM tables;
- blockquote;
- inline code;
- code block;
- syntax highlighting;
- Copy response;
- Regenerate;
- Retry pada state gagal.

Jangan merender raw HTML yang tidak disanitasi.

## 10. Code Block
Setiap code block memiliki:
- label bahasa bila terdeteksi;
- tombol Copy;
- horizontal scroll jika baris panjang;
- font monospace;
- contrast memadai pada light/dark theme.

Setelah copy:
- ikon/check feedback singkat;
- teks "Tersalin" sekitar 1–2 detik;
- tidak memunculkan toast besar berulang untuk setiap copy code.

## 11. Composer
Fitur:
- autosize textarea;
- Enter = Send;
- Shift+Enter = newline;
- Send button;
- Stop button ketika generation aktif;
- disable Send saat prompt kosong;
- preserve draft bila request gagal sebelum terkirim;
- model selector dapat muncul di composer pada mobile jika header terlalu sempit.

Attachment button boleh ditampilkan disabled/hidden sampai fitur file benar-benar tersedia. Jangan membuat affordance yang terlihat aktif tetapi belum berfungsi.

## 12. Streaming State
Saat assistant sedang generate:
- chunk muncul seketika;
- status subtle seperti "Menjawab...";
- tombol Stop menggantikan Send;
- tidak ada fake typing delay;
- scroll mengikuti output hanya jika user masih berada dekat bagian bawah;
- jika user scroll ke atas, jangan paksa auto-scroll kembali ke bawah.

Jika stream berhenti karena user:
- partial response tetap terlihat;
- label state opsional "Dihentikan";
- action Regenerate tersedia.

Jika stream gagal setelah sebagian output:
- partial response tetap terlihat;
- tampilkan inline error di bawah response;
- tombol Retry/Regenerate tersedia;
- jangan menghapus partial output secara otomatis.

## 13. Edit Prompt
Scope MVP: edit message user terakhir yang memiliki assistant response setelahnya.

Flow:
1. User memilih Edit.
2. Message berubah menjadi textarea inline.
3. Tombol Cancel dan Save & Regenerate muncul.
4. Setelah konfirmasi, response assistant setelah message tersebut diganti dengan generation baru.
5. Tampilkan warning ringan bahwa response sebelumnya akan diganti.

Jangan diam-diam membuat branching history tersembunyi pada MVP.

## 14. Regenerate
Saat Regenerate:
- gunakan context conversation yang sama;
- default menggunakan model yang sedang dipilih saat regenerate;
- response assistant lama diganti sesuai scope MVP;
- generation state mengikuti mekanisme streaming normal.

Jika model lama sudah unavailable, user harus memilih model valid sebelum regenerate.

## 15. Search Conversation
Hanya tersedia untuk user login.

Search UI:
- input debounce sekitar 250–350 ms;
- hasil menampilkan title, snippet yang cocok, dan waktu terakhir aktif;
- highlight match secara aman;
- search empty state menjelaskan tidak ada hasil.

Search mencakup title dan message content sesuai backend; UI tidak boleh menyatakan hanya mencari title.

## 16. Conversation Actions
### Rename
- inline/modal kecil;
- max 200 karakter;
- Enter save, Escape cancel.

### Archive
- conversation hilang dari list utama;
- tersedia filter/section Archived;
- dapat dipulihkan.

### Delete
Delete adalah hard delete pada MVP.

Flow:
1. User memilih Delete.
2. Dialog konfirmasi menyebut bahwa chat tidak dapat dipulihkan.
3. User menekan tombol destructive yang jelas.
4. Setelah sukses, arahkan ke New Chat atau conversation berikutnya.

Jangan menggunakan label/status "Deleted" setelah hard delete selesai.

## 17. Settings
Section:
- Default Model;
- System Prompt;
- Temperature;
- Max Output Tokens;
- Theme: Light / Dark / System;
- Data: Clear/Delete all conversations;
- Account: logout.

Parameter model:
- Temperature dan max output tokens diberi helper text "bergantung dukungan model/provider".
- Jika capability model menyatakan parameter unsupported, kontrol disabled dengan penjelasan.
- Jangan menampilkan angka batas universal jika server/model memiliki limit berbeda.

## 18. Authentication Screens
### Login
Field:
- Email;
- Password;
- Submit;
- Link Register.

### Register
Field:
- Name;
- Email;
- Password;
- Confirm Password;
- Submit;
- Link Login.

Error auth dibuat generik untuk mengurangi account enumeration. Jangan tampilkan detail hash/provider/auth internal.

## 19. Loading States
### Initial App
Gunakan skeleton ringan untuk sidebar/history, bukan fullscreen spinner jika chat shell sudah dapat dirender.

### Conversation Load
- skeleton message blocks;
- composer dapat disabled sampai conversation metadata valid.

### Model Load
- selector menampilkan skeleton/loading label;
- jika cache lama tersedia, tampilkan cache sambil refresh di background.

## 20. Error States
### Provider Unavailable
Banner/message inline:
"Layanan AI sedang tidak tersedia. Coba lagi beberapa saat atau pilih model lain."

### Rate Limit
Tampilkan:
"Terlalu banyak permintaan. Coba lagi dalam X detik."
Jika backend memberikan retry time.

### Auth Expired
Tampilkan dialog/toast yang menjelaskan session berakhir lalu arahkan ke login tanpa menghapus draft composer lokal bila memungkinkan.

### Network Offline
Tampilkan offline indicator non-intrusif. Disable Send atau izinkan user menyimpan draft, tetapi jangan membuat request yang pasti gagal berulang.

## 21. Theme
Dukung:
- Light;
- Dark;
- System.

Theme harus:
- berlaku tanpa full reload;
- disimpan di akun untuk user login;
- disimpan lokal untuk guest;
- menghindari flash tema salah pada initial render.

## 22. Accessibility
Wajib:
- semantic HTML;
- keyboard navigation;
- visible focus ring;
- ARIA label untuk icon-only button;
- dialog focus trap;
- Escape untuk menutup modal/popover;
- contrast WCAG yang layak;
- `aria-live` yang tidak berlebihan untuk status generation/error;
- reduced-motion support;
- jangan mengumumkan setiap token streaming ke screen reader; update announcement pada state penting saja.

## 23. Responsive Breakpoints
Gunakan breakpoint Tailwind sebagai panduan, bukan aturan visual kaku.

- Mobile: < 768 px — drawer sidebar, compact header.
- Tablet: 768–1023 px — sidebar collapsible/overlay sesuai ruang.
- Desktop: ≥ 1024 px — persistent sidebar.

Conversation text width dibatasi agar baris tetap nyaman dibaca pada monitor sangat lebar.

## 24. Design Tokens
Gunakan semantic tokens:
- background;
- surface;
- elevated surface;
- foreground;
- muted foreground;
- border;
- primary;
- destructive;
- success/warning bila diperlukan.

Hindari hardcode warna langsung pada banyak komponen. Semua theme melalui CSS variables/design tokens.

## 25. UX Acceptance Checklist
- Sidebar mobile dapat dibuka/tutup via keyboard dan touch.
- New Chat selalu mudah dijangkau.
- Model yang dipilih terlihat jelas.
- User dapat Stop selama streaming.
- Partial response tidak hilang setelah stream failure.
- Delete selalu meminta konfirmasi.
- Search menampilkan hasil title/message content.
- Composer tidak tertutup virtual keyboard mobile.
- Semua icon-only actions memiliki accessible name.
- Dark/light/system theme tidak menyebabkan flash berlebihan.
