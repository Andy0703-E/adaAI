# VIBECODER-PROMPT.md

Anda adalah senior full-stack engineer yang bertugas membangun aplikasi web AI Chat production-ready berdasarkan 4 dokumen di folder root proyek:
- `PRD.md`
- `TECH-STACK.md`
- `UI-UX.md`
- `SCHEMA.md`

## Aturan Utama
1. **Baca keempat file sampai selesai sebelum menulis kode.** Jangan menyalin isi dokumen kembali ke output; gunakan sebagai source of truth.
2. Jika ada keputusan lintas dokumen, gunakan prioritas:
   - `PRD.md` untuk scope, behavior, acceptance criteria, dan kebutuhan produk.
   - `TECH-STACK.md` untuk arsitektur, integrasi provider, timeout/retry, auth, security, API, dan testing.
   - `UI-UX.md` untuk layout, interaction, states, accessibility, dan responsive behavior.
   - `SCHEMA.md` untuk database, constraint, lifecycle data, relation, index, dan ownership.
3. Jangan mengubah keputusan utama tanpa alasan teknis yang kuat. Jika implementasi library membutuhkan penyesuaian kecil, jaga behavior dan security contract tetap sama.
4. Jangan menganggap `https://bandelbanget.xyz/v1` mendukung seluruh OpenAI API v1. Perlakukan sebagai OpenAI-compatible endpoint yang harus diverifikasi melalui compatibility probe.
5. Jangan pernah mengekspos `AI_API_KEY` ke frontend.
6. Jangan hardcode satu model di UI.
7. Jangan melakukan retry otomatis setelah stream sudah mulai terlihat oleh user.
8. Jangan melakukan database write per token.
9. Jangan membuat model cache memiliki status "active" per-user. Active model berasal dari conversation/settings.
10. Delete conversation adalah hard delete dengan confirmation; jangan membuat status `DELETED`.

## Target Arsitektur
```text
Browser
  ↓
Next.js App Router
  ├─ Auth.js Credentials
  ├─ Route Handlers /api/v1/*
  ├─ PostgreSQL + Prisma
  ├─ Redis rate limiting
  └─ AI Provider Abstraction
        ↓
OpenAICompatibleProvider
        ↓
https://bandelbanget.xyz/v1
```

## Environment Minimum
Buat `.env.example`, jangan commit secret:
```env
AI_BASE_URL=https://bandelbanget.xyz/v1
AI_API_KEY=
AI_DEFAULT_MODEL=
AI_MODELS_FALLBACK=
AI_CHAT_PATH=/chat/completions
AI_MODELS_PATH=/models
AI_FIRST_BYTE_TIMEOUT_MS=30000
AI_STREAM_IDLE_TIMEOUT_MS=60000
AI_TOTAL_TIMEOUT_MS=600000
AI_MAX_OUTPUT_TOKENS=8192
DATABASE_URL=
AUTH_SECRET=
REDIS_URL=
NEXT_PUBLIC_APP_NAME=AdaAI
```

## Urutan Implementasi
### Phase 1 — Bootstrap
- Inisialisasi Next.js App Router + TypeScript strict.
- Setup Tailwind, shadcn/ui, lint, formatter.
- Setup Prisma/PostgreSQL.
- Buat `.env.example` dan server-only config validation.
- Jangan gunakan dependency `latest` tanpa version lock pada lockfile.

### Phase 2 — Database
Implementasikan schema persis sesuai `SCHEMA.md`:
- users dengan `password_hash`;
- conversations tanpa `DELETED`;
- messages dengan status streaming;
- user_settings;
- model_cache dengan `is_available`;
- audit_logs tanpa konten chat.

Tambahkan migration PostgreSQL untuk `pg_trgm` dan GIN index title/message content.

Pastikan:
- `ON DELETE CASCADE` untuk user→conversation→message dan user→settings;
- `ON DELETE SET NULL` untuk audit user;
- unique `(conversation_id, sequence_no)`;
- unique `(provider_key, model_id)` pada model cache.

### Phase 3 — Authentication
- Register endpoint dengan Zod.
- Normalize email.
- Hash password menggunakan Argon2id.
- Auth.js Credentials login.
- Secure cookie/session config untuk production.
- Buat helper authorization agar semua conversation query ter-scope ke `session.user.id`.
- Tambahkan integration tests untuk IDOR.

### Phase 4 — AI Provider Layer
Buat:
```text
src/lib/ai/provider.ts
src/lib/ai/openai-compatible.ts
src/lib/ai/stream-parser.ts
src/lib/ai/models.ts
src/lib/ai/errors.ts
src/lib/ai/config.ts
```

Provider wajib mendukung:
- model listing dengan fallback;
- streaming chat;
- AbortSignal;
- normalized error;
- first-byte timeout;
- stream idle timeout;
- total timeout;
- retry hanya sebelum chunk pertama.

Buat `scripts/check-provider.ts` untuk menguji:
- models endpoint;
- chat non-streaming singkat;
- streaming;
- status code/error shape.

Script dilarang mencetak API key.

### Phase 5 — API Internal
Implementasikan minimal:
```text
POST   /api/v1/auth/register
POST   /api/v1/chat
GET    /api/v1/models
GET    /api/v1/conversations
POST   /api/v1/conversations
GET    /api/v1/conversations/:id
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id
GET    /api/v1/conversations/:id/messages
GET    /api/v1/conversations/search?q=
GET    /api/v1/settings
PATCH  /api/v1/settings
```

Authenticated chat:
- client mengirim `conversationId` + prompt + parameter yang diizinkan;
- server memverifikasi ownership;
- server memuat history authoritative dari DB;
- jangan percaya history dari browser user login.

Guest chat:
- client boleh mengirim history sementara;
- server membatasi message count, role, content, dan total body.

### Phase 6 — Streaming Persistence
- Simpan user message sebelum generation.
- Buat assistant `PENDING`.
- Saat first chunk, UI menjadi streaming.
- Jangan update DB tiap token.
- Simpan final response pada completion.
- Pada cancel/error, simpan partial content dan status `CANCELLED`/`FAILED`.
- Abort dari browser harus diteruskan ke upstream provider bila memungkinkan.

### Phase 7 — UI
Ikuti `UI-UX.md`.

Wajib tersedia:
- desktop sidebar + mobile drawer;
- New Chat;
- history;
- search;
- model selector searchable;
- chat header;
- Markdown renderer aman;
- syntax highlighting + copy code;
- composer autosize;
- Enter send / Shift+Enter newline;
- Send → Stop selama generation;
- edit last prompt;
- regenerate;
- retry;
- rename/archive/delete conversation;
- settings;
- light/dark/system theme;
- login/register.

Streaming UX:
- tidak ada fake typing delay;
- auto-scroll hanya bila user masih dekat bottom;
- partial response tetap terlihat saat cancel/failure.

### Phase 8 — Search
Search harus benar-benar mencari:
- conversation title;
- message content.

Gunakan index PostgreSQL dari `SCHEMA.md`, bukan pencarian client-side penuh atau B-tree title saja.

Selalu filter hasil berdasarkan `session.user.id`.

### Phase 9 — Security
Checklist sebelum selesai:
- API key tidak berada di client bundle.
- Tidak ada direct browser request ke provider.
- Zod pada semua input API.
- Ownership check untuk seluruh protected resource.
- Distributed rate limiting menggunakan Redis-compatible store.
- Body limit chat 256 KB default.
- CSP/secure headers.
- Markdown sanitization.
- No raw secret/prompt logging secara default.
- Password Argon2id.
- Tidak ada `dangerouslySetInnerHTML` yang tidak disanitasi.

### Phase 10 — Testing
Buat unit, integration, dan E2E tests sesuai `TECH-STACK.md`.

Critical tests:
- invalid auth;
- register duplicate email;
- IDOR conversation;
- provider 401 tidak membocorkan API key;
- provider 429 menghormati retry policy;
- provider 503 retry sebelum first chunk;
- error setelah first chunk **tidak** auto retry;
- Stop generation;
- malformed stream;
- models endpoint fallback;
- hard delete cascade;
- search title/message scoped to current user;
- XSS payload pada Markdown tidak dieksekusi.

## Coding Rules
- TypeScript strict; hindari `any`.
- Komponen besar dipecah berdasarkan responsibility.
- Gunakan server-only modules untuk secret/provider config.
- Gunakan error codes internal yang konsisten.
- Jangan log raw request body chat.
- Jangan membuat abstraction yang belum diperlukan, kecuali provider interface yang memang requirement.
- Gunakan accessible semantic components.
- Jangan membuat tombol attachment aktif sebelum backend attachment tersedia.
- Jangan menyimpan guest conversation ke database.

## Definition of Done
Project dianggap selesai hanya jika:
1. Build production berhasil.
2. Migration database berhasil dari database kosong.
3. Login/register bekerja.
4. Guest chat bekerja.
5. Authenticated chat tersimpan dan dapat dibuka setelah refresh.
6. Streaming dan Stop bekerja.
7. Model selector menggunakan backend/cache/fallback, bukan hardcode UI.
8. Search title + message content bekerja.
9. Rename/archive/hard-delete bekerja.
10. Markdown/code rendering aman.
11. Semua protected endpoint lulus ownership test.
12. Tidak ada secret di browser bundle/log.
13. Critical tests lulus.
14. README menjelaskan setup, env, migration, provider probe, dev, test, dan production build.

Setelah implementasi, lakukan audit terhadap keempat dokumen dan laporkan hanya gap yang benar-benar tersisa. Jangan menyatakan fitur selesai jika belum diimplementasikan atau belum diuji.
