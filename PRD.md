# PRD.md

## 1. Ringkasan Produk
Aplikasi adalah platform web AI Chat modern yang menyediakan percakapan dengan model AI melalui endpoint eksternal `https://bandelbanget.xyz/v1`. Integrasi eksternal diperlakukan sebagai **OpenAI-compatible API yang harus diverifikasi**, bukan sebagai kontrak yang diasumsikan sempurna. Browser tidak pernah berkomunikasi langsung dengan provider menggunakan API key; seluruh request AI melewati backend aplikasi.

Produk mendukung dua mode penggunaan:
- **Tamu**: dapat chat tanpa akun; riwayat hanya disimpan sementara di `sessionStorage` browser.
- **Pengguna terautentikasi**: dapat menyimpan dan mencari percakapan, mengatur preferensi, serta mengakses riwayat lintas perangkat.

Fokus utama produk adalah pengalaman chat yang cepat, streaming respons secara real-time, pemilihan model yang fleksibel, keamanan API key, serta arsitektur provider-independent agar provider lain dapat ditambahkan tanpa refactor UI utama.

## 2. Masalah yang Diselesaikan
Pengguna membutuhkan interface AI yang:
- sederhana dan cepat digunakan;
- menampilkan jawaban secara streaming tanpa animasi palsu;
- memiliki riwayat percakapan yang mudah dikelola;
- mendukung banyak model;
- tidak mengunci aplikasi ke satu provider;
- aman karena API key tidak terekspos di frontend;
- mudah dikembangkan untuk multimodal, file input, tool calling, web search, dan provider baru.

## 3. Tujuan Produk
1. Menyediakan pengalaman AI Chat yang responsif dan stabil.
2. Menampilkan token/segmen respons secepat provider mulai mengirim data.
3. Menyediakan model selector dinamis dengan fallback aman.
4. Menyimpan percakapan pengguna login secara konsisten dan aman.
5. Menyediakan guest mode tanpa memaksa registrasi.
6. Menjaga seluruh secret provider di server.
7. Membuat lapisan AI provider yang dapat diganti atau diperluas.
8. Menyediakan error state yang jelas tanpa membocorkan detail sensitif.

## 4. Non-Goals MVP
Fitur berikut disiapkan secara arsitektural tetapi bukan kewajiban MVP:
- image generation;
- image/file upload;
- web search;
- tool/function calling;
- voice input/output;
- shared/public conversation;
- billing dan kredit pengguna;
- user-supplied provider API key;
- branching conversation kompleks dan penyimpanan semua versi regenerate.

## 5. Target Pengguna
- pengguna umum;
- mahasiswa;
- programmer;
- content creator;
- pekerja profesional;
- AI power user.

## 6. Role dan Permission
### Tamu
Dapat:
- membuat chat baru;
- mengirim pesan;
- memilih model yang tersedia;
- menghentikan generation;
- retry dan regenerate;
- mengedit pesan user terakhir;
- copy jawaban dan code block;
- mengganti tema;
- melihat riwayat sementara selama tab/session browser masih aktif.

Tidak dapat:
- menyimpan percakapan ke database;
- mencari histori lintas session/perangkat;
- menyimpan pengaturan akun permanen.

### Pengguna Terautentikasi
Memiliki semua kemampuan tamu ditambah:
- menyimpan percakapan ke database;
- membuka histori lintas perangkat;
- rename, archive, unarchive, dan delete conversation;
- mencari percakapan berdasarkan judul atau isi pesan;
- menyimpan default model, system prompt, temperature, max output tokens, dan theme;
- menghapus seluruh data percakapan miliknya.

### Sistem
Bertanggung jawab untuk:
- memvalidasi request;
- memeriksa ownership resource;
- rate limiting;
- komunikasi ke provider;
- normalisasi error;
- sinkronisasi/caching model;
- logging metadata operasional tanpa menyimpan secret atau isi percakapan secara default.

## 7. User Stories
### Chat
- Sebagai pengguna, saya ingin mengirim prompt agar mendapatkan jawaban AI.
- Sebagai pengguna, saya ingin respons tampil secara streaming agar saya tidak menunggu seluruh jawaban selesai.
- Sebagai pengguna, saya ingin menghentikan generation yang sedang berjalan.
- Sebagai pengguna, saya ingin retry jika request gagal.
- Sebagai pengguna, saya ingin regenerate jawaban terakhir dengan konteks yang sama.
- Sebagai pengguna, saya ingin mengedit pesan user terakhir dan menghasilkan ulang jawaban terkait.
- Sebagai pengguna, saya ingin menyalin jawaban AI maupun code block.

### Conversation
- Sebagai pengguna, saya ingin membuat New Chat.
- Sebagai pengguna login, saya ingin melihat history berdasarkan aktivitas terbaru.
- Sebagai pengguna login, saya ingin rename conversation.
- Sebagai pengguna login, saya ingin archive/unarchive conversation.
- Sebagai pengguna login, saya ingin menghapus conversation secara permanen setelah konfirmasi.
- Sebagai pengguna login, saya ingin mencari conversation dari judul atau isi pesan.

### Model
- Sebagai pengguna, saya ingin memilih model sebelum mengirim pesan.
- Sebagai pengguna, saya ingin mengganti model di tengah percakapan.
- Sebagai pengguna, saya ingin mencari model dari daftar yang tersedia.
- Sebagai pengguna, saya ingin tetap bisa menggunakan aplikasi jika sinkronisasi daftar model gagal, selama fallback model server tersedia.

### Settings
- Sebagai pengguna login, saya ingin menyimpan default model.
- Sebagai pengguna login, saya ingin menentukan system prompt default.
- Sebagai pengguna login, saya ingin mengatur temperature jika model/provider mendukungnya.
- Sebagai pengguna login, saya ingin mengatur max output tokens dalam batas yang diizinkan server/provider.
- Sebagai pengguna, saya ingin memilih light/dark/system theme.

## 8. Fitur Utama
### 8.1 Chat Composer
- textarea autosize;
- `Enter` mengirim pesan;
- `Shift+Enter` membuat baris baru;
- tombol Send berubah menjadi Stop saat generation aktif;
- tidak boleh mengirim prompt kosong;
- disable double-submit selama request aktif;
- panjang input divalidasi client dan server.

### 8.2 Streaming Response
- backend meneruskan stream provider ke browser;
- UI menampilkan chunk segera saat diterima;
- tidak ada fake typing delay;
- user dapat membatalkan dengan AbortController;
- partial response disimpan sebagai `CANCELLED` atau `FAILED` jika sudah ada isi;
- jangan melakukan write database untuk setiap token; persist final response atau checkpoint terbatas.

### 8.3 Conversation History
- urut berdasarkan `last_message_at DESC`;
- pagination/cursor untuk daftar panjang;
- rename dan archive;
- hard delete setelah dialog konfirmasi;
- delete menggunakan cascade untuk message terkait;
- tidak ada status `DELETED` karena record benar-benar dihapus.

### 8.4 Conversation Search
Search harus mencakup:
- judul conversation;
- isi message.

Implementasi production menggunakan PostgreSQL full-text search atau `pg_trgm`/GIN index. Pencarian tidak boleh mengandalkan index B-tree sederhana pada `title` saja.

### 8.5 Model Selector
- daftar model diperoleh melalui backend;
- backend mencoba endpoint provider yang kompatibel seperti `GET /models` relatif terhadap base URL;
- jika endpoint models tidak tersedia/gagal, gunakan model fallback dari konfigurasi server;
- status model bersifat global hanya `available/unavailable`, bukan `active`;
- model yang sedang dipakai user ditentukan oleh conversation/settings, bukan status pada model cache.

### 8.6 Markdown Renderer
Harus mendukung:
- paragraph dan heading;
- ordered/unordered list;
- table/GFM;
- blockquote;
- link;
- inline code;
- fenced code block;
- syntax highlighting;
- copy code.

Raw HTML dari model tidak boleh langsung dirender. Sanitasi output sebelum masuk DOM.

## 9. Authentication
MVP menggunakan **Auth.js Credentials flow** dengan registrasi aplikasi sendiri:
- user mendaftar menggunakan nama, email, password;
- password di-hash dengan Argon2id sebelum disimpan;
- login dikelola melalui Auth.js Credentials provider;
- session menggunakan secure HttpOnly cookie/JWT session;
- email dinormalisasi dan unik;
- authorization selalu diperiksa di server berdasarkan `user_id` pemilik resource.

OAuth dapat ditambahkan nanti sebagai fitur tambahan dan memerlukan tabel adapter terkait bila digunakan.

## 10. Kontrak Chat Berdasarkan Mode
### Tamu
Frontend dapat mengirim history sementara bersama prompt karena server tidak memiliki conversation database untuk tamu. Server wajib:
- memvalidasi semua role/content;
- membatasi jumlah message dan total body;
- hanya menerima role yang diizinkan;
- menolak metadata/provider parameter yang tidak diizinkan.

### Pengguna Terautentikasi
Frontend mengirim `conversation_id`, prompt baru, model yang dipilih, dan parameter yang diizinkan. Backend:
1. memverifikasi session;
2. memverifikasi conversation milik user;
3. memuat history authoritative dari database;
4. menambahkan message user;
5. mengirim request provider;
6. menyimpan hasil assistant.

Frontend tidak menjadi sumber kebenaran untuk history user login.

## 11. Error Handling
| Kondisi | UX |
|---|---|
| 400 invalid request | Tampilkan pesan input tidak valid tanpa detail internal |
| 401/403 provider auth | Tampilkan "Layanan AI sedang mengalami kendala"; jangan sebut API key |
| 404 model unavailable | Minta user memilih model lain; conversation tidak hilang |
| 409 conflict | Tampilkan pesan state berubah dan refresh data terkait |
| 413 payload too large | Minta user memperpendek prompt/history |
| 429 rate limit | Tampilkan waktu retry jika tersedia dari `Retry-After` |
| 500 internal | Pesan umum + request ID untuk dukungan |
| 502/503/504 provider | Pesan provider sementara tidak tersedia + Retry |
| first-byte timeout | Tampilkan provider terlalu lama merespons |
| stream idle timeout | Simpan partial response bila ada lalu tampilkan Retry |
| network offline | Tampilkan status koneksi dan Retry |
| malformed stream | Hentikan stream dengan aman dan tandai FAILED |

## 12. Timeout dan Retry Policy
Timeout dibedakan agar respons panjang tidak terpotong secara keliru:
- provider connection/first-byte timeout: default 30 detik;
- stream idle timeout: default 60 detik tanpa chunk baru;
- total generation timeout: default 10 menit, configurable.

Retry otomatis:
- maksimal 2 kali;
- hanya sebelum chunk/token pertama diteruskan ke user;
- untuk network transient, 502, 503, 504;
- 429 hanya jika `Retry-After` masih dalam retry budget;
- tidak retry 4xx lain;
- setelah stream sudah dimulai, kegagalan ditampilkan sebagai partial failure dan user memilih Retry/Regenerate sendiri.

## 13. Security Requirements
- `AI_API_KEY` hanya server-side.
- Provider request hanya dari backend.
- Zod validation untuk semua endpoint.
- Authorization/IDOR check untuk setiap conversation/message/settings.
- Distributed rate limiting untuk deployment serverless.
- Request body `/chat` default maksimal 256 KB untuk MVP text-only.
- CSP dan secure HTTP headers.
- Markdown/HTML sanitization.
- Jangan log API key, auth token, password, atau isi percakapan secara default.
- Password menggunakan Argon2id dan tidak pernah disimpan plaintext.
- CORS tetap same-origin kecuali ada kebutuhan eksplisit.
- Cookie production: Secure, HttpOnly, SameSite yang sesuai.
- Secret hanya berasal dari environment/secret manager.

## 14. Performance Requirements
Target produk, bukan jaminan provider:
- UI local interaction < 100 ms untuk aksi umum;
- user message muncul optimistic segera setelah Send;
- backend overhead sebelum provider request serendah mungkin;
- sidebar menggunakan pagination/cursor;
- streaming tidak menyebabkan re-render seluruh conversation pada setiap chunk;
- model list di-cache dengan TTL;
- pencarian 1.000 conversation pengguna ditargetkan < 1 detik pada database production dengan index aktif.

## 15. Acceptance Criteria MVP
### Chat
- Pesan user muncul segera setelah Send.
- Assistant response dapat muncul incremental.
- Hanya satu generation aktif per composer/conversation di client.
- Stop membatalkan upstream request bila memungkinkan.
- Partial response tidak berubah menjadi `COMPLETED` setelah cancel/error.

### Model
- Model selector dapat menggunakan daftar provider yang valid atau fallback server.
- Aplikasi tidak crash ketika endpoint model provider gagal.
- Model tidak di-hardcode di komponen UI.

### History
- User login hanya dapat membaca/mengubah conversation miliknya.
- Rename dan archive bekerja tanpa mengubah message.
- Delete benar-benar menghapus conversation dan messages terkait.

### Search
- Query dapat menemukan conversation melalui title atau message content.
- Search hanya mengembalikan data milik user yang sedang login.

### Auth
- Registrasi menyimpan hash password, bukan password plaintext.
- Login salah tidak membocorkan apakah password tertentu benar.
- Endpoint protected menolak session invalid.

### Security
- Tidak ada `AI_API_KEY` di bundle browser, HTML, network request browser ke provider, atau log client.
- Markdown berbahaya tidak dapat mengeksekusi script.

## 16. Environment Variables Minimum
```env
AI_BASE_URL=https://bandelbanget.xyz/v1
AI_API_KEY=
AI_DEFAULT_MODEL=
AI_MODELS_FALLBACK=
AI_FIRST_BYTE_TIMEOUT_MS=30000
AI_STREAM_IDLE_TIMEOUT_MS=60000
AI_TOTAL_TIMEOUT_MS=600000
AI_MAX_OUTPUT_TOKENS=8192
DATABASE_URL=
AUTH_SECRET=
REDIS_URL=
NEXT_PUBLIC_APP_NAME=AdaAI
```

## 17. Prinsip Integrasi Provider
Jangan menulis klaim bahwa `https://bandelbanget.xyz/v1` pasti mendukung seluruh OpenAI API v1 sebelum diuji. Implementasi harus memiliki compatibility check minimal untuk:
1. request daftar model bila endpoint tersedia;
2. `POST /chat/completions` atau path kompatibel yang dikonfigurasi;
3. format error;
4. format streaming;
5. dukungan parameter seperti temperature/max_tokens per model.

Jika fitur tertentu tidak didukung provider, aplikasi melakukan graceful degradation tanpa merusak chat dasar.
