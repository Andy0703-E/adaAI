# AdaAI — Production-Ready AI Chat Application

AdaAI adalah platform web AI Chat modern dan responsif yang dibangun menggunakan Next.js App Router, TypeScript (strict), Tailwind CSS, shadcn/ui, PostgreSQL + Prisma, Argon2id, Auth.js Credentials, serta integrasi AI provider OpenAI-compatible (`https://bandelbanget.xyz/v1`).

---

## Fitur Utama

- **Mode Tamu (Guest Chat)**: Mengobrol langsung tanpa registrasi. Riwayat disimpan sementara di `sessionStorage` browser dan tidak menulis data ke database server.
- **Mode Terautentikasi (Authenticated Chat)**: Percakapan dan pesan disimpan di PostgreSQL, terlindung oleh pemeriksaan hak milik (IDOR guard) ketat, dan dapat diakses lintas perangkat.
- **Streaming Real-time & Kontrol Stop**: Respons AI dialirkan secara langsung chunk-by-chunk tanpa animasi typing palsu. Pengguna dapat menghentikan generasi kapan saja via tombol Stop, dan respon parsial tetap tersimpan aman dengan status `CANCELLED`.
- **Model Selector Dinamis**: Mengambil daftar model dari provider melalui backend dengan caching database dan fallback server jika provider offline. Status ketersediaan model ditampilkan secara informatif tanpa hardcode di UI.
- **Pencarian Riwayat Komprehensif**: Fitur pencarian dengan debounce yang mencari baik **judul percakapan** maupun **isi pesan** menggunakan indeks trigram PostgreSQL (`pg_trgm` GIN index), terisolasi untuk masing-masing pengguna.
- **Manajemen Percakapan Lengkap**: Buat Chat Baru, Ubah Nama (Rename), Arsipkan/Batalkan Arsip, serta Hapus Permanen (Hard Delete) yang menghapus percakapan beserta seluruh pesannya (cascade) setelah dialog konfirmasi.
- **Markdown & Code Rendering Aman**: Dukungan GitHub Flavored Markdown (GFM), syntax highlighting, sanitasi output HTML (`rehype-sanitize`) untuk mencegah XSS, dan tombol salin kode dengan feedback "Tersalin".
- **Pengaturan & Parameter Inferensi**: Konfigurasi model default, system prompt, temperature (0–2), max output tokens, dan tema tampilan (Terang / Gelap / Sistem).

---

## Arsitektur

```text
Browser (Client Components)
   ↓ POST /api/v1/chat
Next.js App Router (Route Handlers)
   ├─ Auth.js (Credentials, JWT session, Argon2id)
   ├─ IDOR & Ownership Guard (Scoped to session.user.id)
   ├─ Rate Limiting (Redis / In-memory sliding window fallback)
   ├─ PostgreSQL + Prisma (pg_trgm & GIN index)
   └─ AI Provider Abstraction (AIProvider interface)
         ↓
   OpenAICompatibleProvider (Timeout, Retry, Error Normalization)
         ↓
   https://bandelbanget.xyz/v1
```

---

## Kebutuhan Sistem

- **Node.js**: v20.x atau v22.x LTS
- **PostgreSQL**: v14+ (dengan ekstensi `pg_trgm`)
- **Redis** (Opsional untuk development, fallback otomatis ke in-memory sliding window)

---

## Setup & Instalasi

### 1. Salin Environment Variables
```bash
cp .env.example .env
```

Isi konfigurasi pada `.env`:
```env
AI_BASE_URL=https://bandelbanget.xyz/v1
AI_API_KEY=your_api_key_here
AI_DEFAULT_MODEL=auto
AI_MODELS_FALLBACK=auto,auto-debug,claude-sonnet-5,deepseek-v4-flash
AI_CHAT_PATH=/chat/completions
AI_MODELS_PATH=/models
AI_FIRST_BYTE_TIMEOUT_MS=30000
AI_STREAM_IDLE_TIMEOUT_MS=60000
AI_TOTAL_TIMEOUT_MS=600000
AI_MAX_OUTPUT_TOKENS=8192
DATABASE_URL=postgresql://postgres:password@localhost:5432/ada_ai?schema=public
AUTH_SECRET=rahasia-minimum-32-karakter-acak-aman
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_NAME=AdaAI
```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Generate & Migrasi Database
Untuk generate Prisma Client:
```bash
npm run db:generate
```

Untuk menjalankan migrasi ke PostgreSQL:
```bash
npm run db:migrate
```
File migrasi awal berada di `prisma/migrations/0_init/migration.sql`, mencakup pembuatan tabel, foreign key cascade, enums, serta indeks `pg_trgm` GIN untuk pencarian judul dan isi pesan.

---

## Uji Kompatibilitas Provider (Probe)

Sebelum atau selama deployment, jalankan probe operasional untuk menguji kompatibilitas provider tanpa mengekspos API key:
```bash
npm run check:provider
```

Probe akan memeriksa:
1. Endpoint `GET /models`
2. Endpoint non-streaming `POST /chat/completions`
3. Endpoint streaming `POST /chat/completions`
4. Bentuk payload dan error tanpa mencetak rahasia/token.

---

## Menjalankan Aplikasi

### Development Mode
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

### Menjalankan Pengujian (Vitest)
Unit dan integration tests mencakup validasi Zod, IDOR guard, parser SSE, retry policy, Argon2id, model fallback, dan proteksi XSS markdown:
```bash
npm run test
```

### Production Build
```bash
npm run build
npm run start
```

---

## Keamanan & Kepatuhan

- **Zero Client Leakage**: `AI_API_KEY` dan `AUTH_SECRET` dilindungi menggunakan modul `server-only` dan tidak pernah disertakan dalam bundle browser client.
- **IDOR Guard**: Setiap endpoint terlindungi memvalidasi kepemilikan resource (`where: { id, userId }`). Upaya mengakses resource milik pengguna lain ditolak dengan status 404 (Resource Not Found).
- **Proteksi XSS**: Seluruh output respons markdown AI disanitasi menggunakan `rehype-sanitize`. Tag `<script>`, atribut `onerror`, dan payload berbahaya lainnya dihilangkan secara aman.
- **Argon2id Hashing**: Password pengguna di-hash menggunakan algoritma modern Argon2id sebelum disimpan ke database.
- **Logging Aman**: Operational logger secara otomatis menyaring dan meredaksi kunci sensitif seperti `apiKey`, `password`, `prompt`, dan `response`.
