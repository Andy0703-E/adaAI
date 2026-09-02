# TECH-STACK.md

## 1. Tujuan Arsitektur
Arsitektur harus memenuhi prioritas berikut:
1. API key dan secret tidak pernah masuk browser.
2. Streaming stabil dan dapat dibatalkan.
3. Provider AI dapat diganti tanpa mengubah Chat UI.
4. Data user terisolasi secara server-side.
5. Schema mendukung history, search, settings, dan model cache tanpa kontradiksi.
6. Stack cocok untuk deployment serverless maupun self-hosted.

## 2. Stack Utama
### Frontend
- Next.js App Router versi stabil saat implementasi.
- React versi yang kompatibel dengan Next.js terpilih.
- TypeScript strict mode.
- Tailwind CSS versi stabil saat implementasi.
- shadcn/ui untuk komponen dasar yang dapat dikustomisasi.
- Lucide Icons.
- `react-markdown` + `remark-gfm` untuk Markdown.
- `rehype-sanitize` untuk sanitasi output Markdown.
- Shiki atau library syntax highlighter setara untuk code block.

Jangan memakai `dangerouslySetInnerHTML` untuk output AI kecuali sudah melalui sanitizer yang eksplisit dan teruji.

### Backend
Gunakan Next.js Route Handlers pada App Router.

Alasan:
- satu codebase frontend/backend;
- native Web Streams API;
- cocok untuk Vercel/serverless;
- mudah menjaga secret tetap server-side;
- sederhana untuk same-origin auth dan API.

### Database
- PostgreSQL.
- Prisma ORM untuk query type-safe dan migration dasar.
- Migration SQL manual diperbolehkan untuk extension/index PostgreSQL yang tidak diekspresikan penuh oleh Prisma, misalnya `pg_trgm` atau expression GIN index.

### Authentication
MVP:
- Auth.js Credentials provider;
- registrasi dibuat melalui endpoint aplikasi;
- password hash menggunakan Argon2id;
- session berbasis JWT/cookie Auth.js;
- cookie production Secure + HttpOnly;
- authorization resource tetap dilakukan di setiap Route Handler.

OAuth adalah fitur lanjutan. Bila OAuth ditambahkan, tambahkan schema adapter Auth.js yang sesuai pada migration terpisah.

### State Management
- React state untuk state lokal.
- TanStack Query untuk server state non-streaming seperti conversation list, settings, dan model list.
- Zustand hanya jika state lintas komponen benar-benar tidak nyaman dikelola dengan React/context.
- Streaming message aktif dikelola lokal di chat state agar tidak memicu refetch seluruh history pada setiap chunk.

### Distributed Rate Limiting
Untuk serverless, jangan gunakan Map/in-memory limiter sebagai kontrol utama.
Gunakan Redis-compatible store seperti Upstash Redis atau Redis managed melalui `REDIS_URL`.

## 3. Struktur Folder
```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── chat/
│   │   └── [conversationId]/
│   ├── settings/
│   ├── api/
│   │   └── v1/
│   │       ├── auth/
│   │       │   └── register/
│   │       ├── chat/
│   │       ├── models/
│   │       ├── conversations/
│   │       │   ├── route.ts
│   │       │   ├── search/
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── messages/
│   │       └── settings/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── chat/
│   ├── sidebar/
│   ├── model/
│   ├── settings/
│   └── ui/
├── lib/
│   ├── ai/
│   │   ├── provider.ts
│   │   ├── openai-compatible.ts
│   │   ├── stream-parser.ts
│   │   ├── models.ts
│   │   ├── errors.ts
│   │   └── config.ts
│   ├── auth/
│   │   ├── auth.ts
│   │   ├── password.ts
│   │   └── authorization.ts
│   ├── db/
│   │   └── prisma.ts
│   ├── rate-limit/
│   ├── validation/
│   ├── logging/
│   └── utils/
├── hooks/
├── types/
└── middleware.ts
prisma/
├── schema.prisma
└── migrations/
```

## 4. AI Provider Abstraction
### Interface
```ts
export interface AIProvider {
  listModels(signal?: AbortSignal): Promise<AIModel[]>;
  chat(request: ChatRequest, signal: AbortSignal): Promise<Response>;
  normalizeError(error: unknown): AIProviderError;
}
```

Gunakan `Response` atau wrapper yang mempertahankan `ReadableStream<Uint8Array>` agar backend dapat meneruskan stream dengan overhead minimum.

### Implementasi Pertama
`OpenAICompatibleProvider`

Konfigurasi:
```env
AI_BASE_URL=https://bandelbanget.xyz/v1
AI_API_KEY=
AI_DEFAULT_MODEL=
AI_MODELS_FALLBACK=
```

Jangan mengikat UI ke nama `bandelbanget`. UI hanya mengenal `modelId`, display name, capabilities, dan status availability.

### Path Provider
Default adapter menguji/menggunakan pola:
- `GET {AI_BASE_URL}/models`
- `POST {AI_BASE_URL}/chat/completions`

Path harus dapat dioverride melalui config jika provider ternyata memakai variasi berbeda.

### Request Chat Umum
```json
{
  "model": "MODEL_ID",
  "messages": [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": "Halo"}
  ],
  "stream": true
}
```

Parameter seperti `temperature` dan `max_tokens` hanya diteruskan bila:
- user/settings mengirim nilai valid;
- server mengizinkan;
- metadata/capability model tidak menyatakan parameter tersebut unsupported.

## 5. Compatibility Probe
Jangan mengasumsikan provider sepenuhnya kompatibel sebelum diuji.

Buat utility/script `scripts/check-provider.ts` yang:
1. mencoba `GET /models`;
2. mencoba chat non-streaming dengan prompt pendek;
3. mencoba streaming;
4. mencatat status code dan bentuk payload tanpa mencetak API key;
5. menandai capability yang berhasil.

Hasil probe bersifat operasional dan tidak boleh membuat aplikasi gagal start jika model fallback sudah tersedia.

## 6. Streaming Architecture
Flow:
```text
Browser
  ↓ POST /api/v1/chat
Next.js Route Handler
  ↓ validation + auth + rate limit
AIProvider
  ↓
https://bandelbanget.xyz/v1
  ↓ streaming bytes/SSE
Next.js transform/forward stream
  ↓
Browser incremental renderer
```

### Abort
- Browser membuat `AbortController` per generation.
- Abort client menghentikan fetch ke backend.
- Backend menghubungkan request abort ke upstream provider signal.
- Status assistant message menjadi `CANCELLED` bila user menghentikan generation.

### Timeout
Gunakan tiga level berbeda:
- `AI_FIRST_BYTE_TIMEOUT_MS=30000`
- `AI_STREAM_IDLE_TIMEOUT_MS=60000`
- `AI_TOTAL_TIMEOUT_MS=600000`

Jangan memakai timeout total 30 detik untuk seluruh generation.

### Retry
Retry otomatis maksimal 2 kali dan hanya **sebelum chunk pertama diteruskan**.

Retryable:
- transient network error;
- 502;
- 503;
- 504;
- 429 hanya bila `Retry-After` masuk retry budget.

Tidak retry otomatis:
- 400;
- 401;
- 403;
- 404;
- request yang sudah menghasilkan sebagian stream.

Setelah stream dimulai, error menghasilkan partial message `FAILED`; user dapat memilih Retry/Regenerate secara eksplisit.

## 7. Persistence Strategy Saat Streaming
### User Login
1. Validasi ownership conversation.
2. Simpan user message.
3. Buat assistant message `PENDING`.
4. Mulai provider request.
5. Ubah status in-memory menjadi `STREAMING` saat chunk pertama datang.
6. Tampilkan stream ke client.
7. Persist final content sekali pada completion.
8. Opsional: checkpoint setiap beberapa detik/ukuran tertentu, bukan setiap token.
9. Pada error/cancel, persist partial content yang sudah diterima dan status akhir yang tepat.

### Guest
Tidak ada write database conversation. Browser menyimpan history sementara di `sessionStorage`.

## 8. Kontrak API Internal
Prefix: `/api/v1`

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| POST | `/auth/register` | Public | Registrasi credentials |
| POST | `/chat` | Optional | Chat streaming |
| GET | `/models` | Optional | Model list/cache |
| GET | `/conversations` | Required | List conversation user |
| POST | `/conversations` | Required | Create conversation |
| GET | `/conversations/:id` | Required | Detail conversation milik user |
| PATCH | `/conversations/:id` | Required | Rename/archive/update |
| DELETE | `/conversations/:id` | Required | Hard delete conversation |
| GET | `/conversations/:id/messages` | Required | Paginated messages |
| GET | `/conversations/search?q=` | Required | Search title/message content |
| GET | `/settings` | Required | Ambil settings |
| PATCH | `/settings` | Required | Update settings |

## 9. Chat Request Internal
Untuk menghindari client login memalsukan history, kontrak dibedakan.

### Authenticated
```ts
type AuthenticatedChatRequest = {
  conversationId: string;
  content: string;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
};
```
Server memuat history conversation dari DB setelah ownership check.

### Guest
```ts
type GuestChatRequest = {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
};
```
Server membatasi jumlah message, panjang per message, dan total payload.

## 10. Input Validation
Gunakan Zod.

Batas default MVP:
- body chat maksimal 256 KB;
- prompt tunggal maksimal 64 KB;
- conversation title maksimal 200 karakter;
- system prompt maksimal 8.000 karakter;
- temperature 0..2 bila didukung;
- `maxOutputTokens` minimal 1 dan maksimal `min(AI_MAX_OUTPUT_TOKENS, provider/model limit)`;
- UUID/CUID divalidasi sesuai format ID yang dipilih.

## 11. Database dan Search
Database mengikuti `SCHEMA.md`.

Search production:
- aktifkan `pg_trgm` atau PostgreSQL full-text search;
- gunakan GIN index untuk title dan message content;
- filter `user_id`/ownership tetap bagian wajib dari query;
- jangan hanya membuat B-tree index `conversations(title)` untuk fitur search substring/full text.

## 12. Model Cache
`model_cache` adalah cache metadata provider, bukan sumber kebenaran history.

Karena model dapat hilang dari provider:
- conversation/message menyimpan `provider_key` dan `model_id` sebagai snapshot string;
- tidak wajib FK ke `model_cache`;
- `model_cache` menggunakan `is_available`, bukan status `ACTIVE`;
- model aktif user berada pada conversation atau user settings.

Sync:
- TTL default 24 jam;
- on-demand refresh jika cache kosong/stale;
- background cron opsional;
- provider failure tidak menghapus cache lama langsung;
- model yang tidak terlihat pada sync baru dapat ditandai unavailable setelah policy tertentu.

## 13. Authentication Detail
### Register
`POST /api/v1/auth/register`
- normalize email lowercase;
- validasi password minimum sesuai policy;
- hash Argon2id;
- simpan `password_hash`;
- jangan pernah return hash.

### Login
Auth.js Credentials provider memverifikasi email + Argon2id hash.

### Authorization
Semua query protected menggunakan pola:
```text
session user id
  ↓
query WHERE id = :resourceId AND user_id = :sessionUserId
```
Jangan mengambil resource by ID lalu baru mempercayai client ownership.

## 14. Security Controls
- Secret server-only.
- `server-only` module boundary untuk config AI.
- Strict input schemas.
- Same-origin API.
- Secure headers: CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame restrictions.
- Markdown sanitization.
- SQL injection dicegah melalui Prisma/parameterized query.
- Distributed rate limiting.
- Request ID untuk observability.
- Log redaction.
- No message content logging secara default.
- No password/API key/auth cookie logging.
- Dependency audit dan lockfile wajib dikomit.

## 15. Error Model Internal
```ts
type AppErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "MODEL_UNAVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "STREAM_MALFORMED"
  | "REQUEST_ABORTED"
  | "INTERNAL_ERROR";
```

Response error non-streaming:
```json
{
  "error": {
    "code": "MODEL_UNAVAILABLE",
    "message": "Model yang dipilih sedang tidak tersedia.",
    "requestId": "..."
  }
}
```

Jangan kirim raw provider body jika berpotensi berisi detail sensitif.

## 16. Observability
Log minimal:
- request ID;
- route;
- authenticated/guest marker tanpa email bila tidak perlu;
- provider key;
- model ID;
- HTTP status;
- time to first byte;
- total duration;
- completion state;
- normalized error code.

Jangan log:
- AI API key;
- password/hash;
- auth token/cookie;
- prompt/response content secara default.

## 17. Environment Variables
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

## 18. Testing Minimum
### Unit
- Zod validation;
- provider error normalization;
- timeout helper;
- retry eligibility;
- stream parser;
- password hashing/verification;
- model fallback selection.

### Integration
- register/login;
- ownership/IDOR checks;
- create/rename/archive/delete conversation;
- search hanya mengembalikan data user sendiri;
- chat provider mocked streaming;
- cancel mid-stream;
- partial failure setelah first chunk;
- `/models` fallback ketika provider gagal.

### E2E
- guest chat;
- authenticated chat tersimpan;
- refresh lalu history tetap ada;
- model switching;
- Stop generation;
- dark/light/system theme;
- mobile sidebar drawer.

## 19. Deployment
### Vercel/Serverless
- PostgreSQL managed seperti Neon/Supabase/Postgres provider setara;
- Redis managed untuk rate limit;
- environment secret di platform;
- streaming Route Handler diuji di environment production;
- cron optional untuk refresh model.

### Self-hosted
- Docker image Next.js;
- PostgreSQL;
- Redis;
- reverse proxy dengan streaming buffering dimatikan untuk endpoint chat.

## 20. Prinsip Implementasi
Jangan:
- expose API key;
- hardcode model di komponen;
- menganggap semua model punya context/output limit sama;
- melakukan retry setelah stream sudah terlihat user;
- write database per token;
- menggunakan model cache sebagai penanda model aktif user;
- membuat endpoint protected tanpa ownership check;
- menyimpan raw HTML AI tanpa sanitization.
