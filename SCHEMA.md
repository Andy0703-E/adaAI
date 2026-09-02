# SCHEMA.md

## 1. Prinsip Schema
Database menggunakan PostgreSQL. Guest conversation **tidak disimpan** di database; schema hanya menyimpan data user terautentikasi dan cache sistem.

Keputusan penting:
- delete conversation pada MVP adalah **hard delete**;
- tidak ada enum/status `DELETED` pada conversation;
- `model_cache` hanya menyimpan availability/metadata provider, bukan model aktif user;
- conversation dan message menyimpan `provider_key` + `model_id` sebagai snapshot string, bukan FK wajib ke `model_cache`;
- password credentials memiliki `password_hash`;
- search title + message content menggunakan PostgreSQL trigram/GIN atau FTS, bukan B-tree title saja.

## 2. ERD
```text
users
 │ 1
 ├────────────── 1 user_settings
 │
 └────────────── N conversations
                    │ 1
                    └────────────── N messages

model_cache      (cache sistem, tidak menjadi parent history)
audit_logs       (metadata audit, tanpa konten chat)
```

## 3. Enum
### ConversationStatus
```text
DRAFT
ACTIVE
ARCHIVED
```

### MessageRole
```text
SYSTEM
USER
ASSISTANT
```

### MessageStatus
```text
PENDING
STREAMING
COMPLETED
FAILED
CANCELLED
```

### Theme
```text
LIGHT
DARK
SYSTEM
```

## 4. Table: users
| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| id | UUID | PK | ID user |
| name | VARCHAR(120) | NOT NULL | Nama tampilan |
| email | VARCHAR(320) | NOT NULL UNIQUE | Email normalized lowercase |
| password_hash | TEXT | NOT NULL | Hash Argon2id, tidak pernah dikirim ke client |
| image | TEXT | NULL | Avatar URL opsional |
| email_verified_at | TIMESTAMPTZ | NULL | Disiapkan untuk verifikasi email masa depan |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Dibuat |
| updated_at | TIMESTAMPTZ | NOT NULL | Diubah |

Rules:
- email disimpan lowercase setelah normalization;
- password plaintext tidak pernah masuk database;
- unique email harus case-insensitive secara aplikasi; opsional gunakan `citext` di PostgreSQL jika diinginkan.

## 5. Table: conversations
| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| id | UUID | PK | ID conversation |
| user_id | UUID | FK → users.id, NOT NULL | Pemilik |
| title | VARCHAR(200) | NOT NULL DEFAULT 'New Chat' | Judul |
| status | ConversationStatus | NOT NULL DEFAULT DRAFT | Lifecycle |
| provider_key | VARCHAR(80) | NOT NULL | Provider snapshot, contoh `bandel-openai-compatible` |
| model_id | VARCHAR(200) | NOT NULL | Model aktif untuk conversation |
| system_prompt | TEXT | NULL | Override system prompt conversation |
| last_message_at | TIMESTAMPTZ | NULL | Waktu message terakhir |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Dibuat |
| updated_at | TIMESTAMPTZ | NOT NULL | Diubah |

Foreign key:
```text
conversations.user_id → users.id ON DELETE CASCADE
```

Lifecycle:
```text
DRAFT → ACTIVE      saat message user pertama disimpan
ACTIVE → ARCHIVED   saat user archive
ARCHIVED → ACTIVE   saat user unarchive
DELETE              hard delete row + cascade messages
```

Tidak ada transisi menuju `DELETED` karena record benar-benar dihapus.

## 6. Table: messages
| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| id | UUID | PK | ID message |
| conversation_id | UUID | FK → conversations.id, NOT NULL | Parent |
| sequence_no | INTEGER | NOT NULL | Urutan deterministik dalam conversation |
| role | MessageRole | NOT NULL | SYSTEM/USER/ASSISTANT |
| content | TEXT | NOT NULL DEFAULT '' | Isi message/partial response |
| status | MessageStatus | NOT NULL DEFAULT PENDING | State generation |
| provider_key | VARCHAR(80) | NULL | Snapshot provider untuk assistant generation |
| model_id | VARCHAR(200) | NULL | Snapshot model untuk assistant generation |
| prompt_tokens | INTEGER | NULL CHECK >= 0 | Usage bila provider memberi |
| completion_tokens | INTEGER | NULL CHECK >= 0 | Usage bila provider memberi |
| total_tokens | INTEGER | NULL CHECK >= 0 | Usage bila provider memberi |
| finish_reason | VARCHAR(80) | NULL | Stop reason provider yang dinormalisasi |
| error_code | VARCHAR(80) | NULL | App error code bila FAILED |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Dibuat |
| updated_at | TIMESTAMPTZ | NOT NULL | Diubah |

Constraints:
```text
messages.conversation_id → conversations.id ON DELETE CASCADE
UNIQUE(conversation_id, sequence_no)
```

Catatan:
- `model_id` tidak FK ke `model_cache` agar history tetap valid ketika model hilang dari provider/cache.
- `content` boleh kosong saat assistant message baru `PENDING`, lalu diisi saat streaming selesai/checkpoint.
- token usage nullable karena provider mungkin tidak mengirim usage dalam streaming.

### Lifecycle Assistant Message
```text
PENDING → STREAMING → COMPLETED
PENDING → FAILED
PENDING → CANCELLED
STREAMING → FAILED
STREAMING → CANCELLED
```

`FAILED`/`CANCELLED` boleh memiliki partial `content`.

### USER dan SYSTEM Message
Message non-assistant dapat langsung disimpan sebagai `COMPLETED`.

## 7. Table: user_settings
| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| id | UUID | PK | ID settings |
| user_id | UUID | FK → users.id, NOT NULL UNIQUE | One-to-one |
| default_provider_key | VARCHAR(80) | NULL | Provider default |
| default_model_id | VARCHAR(200) | NULL | Model default |
| system_prompt | TEXT | NULL | Default system prompt |
| temperature | DOUBLE PRECISION | NULL CHECK 0..2 | Hanya diteruskan jika supported |
| max_output_tokens | INTEGER | NULL CHECK > 0 | Server tetap melakukan clamp terhadap limit aktual |
| theme | Theme | NOT NULL DEFAULT SYSTEM | LIGHT/DARK/SYSTEM |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Dibuat |
| updated_at | TIMESTAMPTZ | NOT NULL | Diubah |

Foreign key:
```text
user_settings.user_id → users.id ON DELETE CASCADE
```

Jangan membuat DB constraint universal seperti `max_output_tokens <= 128000` karena limit model berbeda-beda. Server menggunakan:
```text
min(user_setting, AI_MAX_OUTPUT_TOKENS, provider/model limit)
```

## 8. Table: model_cache
| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| id | UUID | PK | Internal cache ID |
| provider_key | VARCHAR(80) | NOT NULL | Provider |
| model_id | VARCHAR(200) | NOT NULL | External model ID |
| display_name | VARCHAR(200) | NOT NULL | Nama tampilan |
| is_available | BOOLEAN | NOT NULL DEFAULT true | Availability global |
| capabilities | JSONB | NULL | text, vision, tools, temperature support, dll |
| context_window | INTEGER | NULL CHECK > 0 | Jika diketahui |
| max_output_tokens | INTEGER | NULL CHECK > 0 | Jika diketahui |
| metadata | JSONB | NULL | Raw metadata aman/terpilih |
| last_seen_at | TIMESTAMPTZ | NULL | Terakhir terlihat dari provider |
| last_synced_at | TIMESTAMPTZ | NOT NULL | Terakhir sync |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Dibuat |
| updated_at | TIMESTAMPTZ | NOT NULL | Diubah |

Constraint:
```text
UNIQUE(provider_key, model_id)
```

Tidak ada status `ACTIVE` pada model cache. Model aktif disimpan pada `conversations.model_id` atau `user_settings.default_model_id`.

## 9. Table: audit_logs
Audit log bersifat metadata dan tidak menyimpan prompt/response.

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| id | UUID | PK | Audit ID |
| user_id | UUID | FK → users.id, NULL | Actor bila login |
| action | VARCHAR(100) | NOT NULL | Contoh CREATE_CONVERSATION |
| entity_type | VARCHAR(80) | NULL | conversation/settings/etc |
| entity_id | UUID | NULL | Resource ID bila relevan |
| request_id | VARCHAR(100) | NULL | Correlation ID |
| ip_hash | VARCHAR(128) | NULL | Hash IP opsional, bukan raw IP bila tidak diperlukan |
| metadata | JSONB | NULL | Metadata non-sensitive |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Waktu |

Foreign key:
```text
audit_logs.user_id → users.id ON DELETE SET NULL
```

Dilarang menyimpan pada `metadata`:
- API key;
- auth token/cookie;
- password/hash;
- prompt lengkap;
- assistant response lengkap.

## 10. Index Wajib
### Relational/Sorting
```sql
CREATE INDEX conversations_user_last_message_idx
ON conversations (user_id, last_message_at DESC NULLS LAST);

CREATE INDEX conversations_user_status_last_message_idx
ON conversations (user_id, status, last_message_at DESC NULLS LAST);

CREATE INDEX messages_conversation_sequence_idx
ON messages (conversation_id, sequence_no ASC);

CREATE INDEX messages_conversation_created_idx
ON messages (conversation_id, created_at ASC);

CREATE INDEX messages_status_idx
ON messages (status);

CREATE INDEX model_cache_available_idx
ON model_cache (provider_key, is_available);

CREATE INDEX model_cache_synced_idx
ON model_cache (last_synced_at);
```

Perhatikan: index `model_cache(is_active)` **tidak ada** karena kolom tersebut tidak digunakan.

## 11. Search Index
Untuk search multilingual title + message content, MVP direkomendasikan menggunakan `pg_trgm`.

Raw migration PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX conversations_title_trgm_idx
ON conversations USING GIN (title gin_trgm_ops);

CREATE INDEX messages_content_trgm_idx
ON messages USING GIN (content gin_trgm_ops);
```

Contoh strategi query:
1. filter conversation berdasarkan `user_id`;
2. match `conversations.title ILIKE '%query%'` atau message milik conversation yang `content ILIKE '%query%'`;
3. deduplicate conversation;
4. urutkan berdasarkan relevance sederhana + `last_message_at DESC`;
5. limit/paginate hasil.

Untuk skala lebih besar, migrasikan ke generated `tsvector` + GIN FTS atau dedicated search service tanpa mengubah kontrak API UI.

## 12. Ownership dan IDOR
Semua endpoint protected wajib memfilter resource menggunakan user session.

Contoh aman:
```text
SELECT ... FROM conversations
WHERE id = :conversationId
AND user_id = :sessionUserId
```

Jangan:
```text
SELECT conversation by id
→ lalu percaya userId dari body/client
```

Untuk message, authorization dilakukan melalui parent conversation yang dimiliki session user.

## 13. Hard Delete Semantics
### Delete Conversation
```text
DELETE conversations row
→ ON DELETE CASCADE
→ messages terhapus
```

UI wajib meminta konfirmasi karena tidak ada restore.

### Delete User Data
Jika user meminta penghapusan seluruh account/data:
- delete user;
- cascade settings/conversations/messages;
- audit user reference menjadi NULL;
- data yang wajib dipertahankan karena alasan operasional/legal harus didokumentasikan terpisah jika fitur tersebut kelak ada.

## 14. Archive Semantics
Archive tidak menghapus data.

```text
ACTIVE → ARCHIVED
ARCHIVED → ACTIVE
```

Conversation DRAFT yang belum pernah memiliki message dapat dibersihkan otomatis berdasarkan TTL opsional, misalnya > 24 jam, tetapi ini bukan kewajiban MVP.

## 15. Edit Prompt dan Regenerate
Scope MVP tidak menyimpan branch/revision kompleks.

### Edit Last User Prompt
Transaction/flow:
1. pastikan message target adalah user message terakhir yang diizinkan;
2. batalkan generation aktif jika ada;
3. hapus/rewrite assistant response setelahnya sesuai aturan aplikasi;
4. update content user message;
5. mulai generation assistant baru;
6. jaga `sequence_no` tetap konsisten.

### Regenerate Last Assistant
- response assistant terakhir diganti dengan generation baru;
- model/provider snapshot diperbarui sesuai model yang digunakan saat regenerate;
- versi lama tidak wajib dipertahankan pada MVP.

Jika fitur response variants ditambahkan nanti, buat tabel/versioning baru; jangan menyalahgunakan `model_cache`.

## 16. Model Cache Lifecycle
```text
provider sync sukses
→ upsert model by (provider_key, model_id)
→ is_available=true
→ last_seen_at=now()
→ last_synced_at=now()
```

Jika provider sync gagal total:
- jangan langsung menandai semua model unavailable;
- pertahankan cache terakhir;
- catat sync failure secara operasional.

Jika sync sukses dan model tertentu tidak lagi terlihat setelah policy grace period:
- `is_available=false`.

History tetap aman karena conversation/message menyimpan model sebagai snapshot string.

## 17. Prisma Mapping Konseptual
Nama field aplikasi boleh camelCase sementara nama kolom DB snake_case melalui `@map`/`@@map`.

Contoh inti:
```prisma
enum ConversationStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum MessageRole {
  SYSTEM
  USER
  ASSISTANT
}

enum MessageStatus {
  PENDING
  STREAMING
  COMPLETED
  FAILED
  CANCELLED
}

enum Theme {
  LIGHT
  DARK
  SYSTEM
}
```

`pg_trgm` index dibuat dengan raw SQL migration jika Prisma version yang dipakai tidak dapat merepresentasikannya secara penuh.

## 18. Retention
- guest conversation: browser session only;
- authenticated conversation: sampai user hard delete;
- failed/cancelled assistant partial content: disimpan sebagai bagian history kecuali user menghapus/regenerate;
- model cache: refreshed berkala, bukan hard source of truth;
- audit logs: default 90–365 hari sesuai kebijakan deployment; cleanup job terjadwal.

## 19. Data Security Checklist
- password hash Argon2id;
- API key provider tidak ada di DB untuk MVP;
- tidak ada secret pada model metadata;
- DB connection menggunakan TLS pada managed production;
- backup database terenkripsi sesuai fasilitas provider;
- least-privilege DB credentials;
- migration dijalankan terkontrol;
- content AI tidak masuk audit log;
- query protected selalu scoped ke session user.
