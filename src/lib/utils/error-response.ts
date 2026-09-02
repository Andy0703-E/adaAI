import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
  | "DATABASE_UNAVAILABLE"
  | "REDIS_UNAVAILABLE"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "INTERNAL_ERROR"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_TOO_MANY_FILES"
  | "DOCUMENT_UNSUPPORTED_TYPE"
  | "DOCUMENT_MIME_MISMATCH"
  | "DOCUMENT_INVALID_FILE"
  | "DOCUMENT_PARSE_FAILED"
  | "DOCUMENT_NO_EXTRACTABLE_TEXT"
  | "DOCUMENT_TEXT_TOO_LARGE"
  | "DOCUMENT_ATTACHMENT_NOT_FOUND"
  | "DOCUMENT_ATTACHMENT_FORBIDDEN"
  | "DOCUMENT_UPLOAD_FAILED";

export interface NormalizedApiErrorResponse {
  error: ApiErrorCode;
  message: string;
  requestId: string;
  details?: unknown;
  retryAfter?: number;
}

const statusMap: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  DATABASE_UNAVAILABLE: 503,
  REDIS_UNAVAILABLE: 503,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
  DOCUMENT_TOO_LARGE: 400,
  DOCUMENT_TOO_MANY_FILES: 400,
  DOCUMENT_UNSUPPORTED_TYPE: 400,
  DOCUMENT_MIME_MISMATCH: 400,
  DOCUMENT_INVALID_FILE: 400,
  DOCUMENT_PARSE_FAILED: 400,
  DOCUMENT_NO_EXTRACTABLE_TEXT: 400,
  DOCUMENT_TEXT_TOO_LARGE: 400,
  DOCUMENT_ATTACHMENT_NOT_FOUND: 404,
  DOCUMENT_ATTACHMENT_FORBIDDEN: 403,
  DOCUMENT_UPLOAD_FAILED: 500,
};

const safeDefaultMessages: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Permintaan data tidak valid.",
  UNAUTHORIZED: "Sesi tidak valid atau telah berakhir. Silakan login kembali.",
  FORBIDDEN: "Anda tidak memiliki hak akses untuk sumber daya ini.",
  NOT_FOUND: "Sumber daya tidak ditemukan.",
  RATE_LIMIT_EXCEEDED: "Terlalu banyak permintaan. Silakan tunggu beberapa saat.",
  DATABASE_UNAVAILABLE: "Layanan database sementara tidak tersedia. Silakan coba lagi.",
  REDIS_UNAVAILABLE: "Layanan antrean atau rate limiter sementara tidak tersedia.",
  AI_PROVIDER_UNAVAILABLE: "Penyedia model AI sementara tidak dapat dihubungi.",
  AI_TIMEOUT: "Waktu tunggu respons AI habis. Silakan coba lagi.",
  INTERNAL_ERROR: "Terjadi kesalahan internal pada server.",
  DOCUMENT_TOO_LARGE: "File dokumen terlalu besar.",
  DOCUMENT_TOO_MANY_FILES: "Terlalu banyak dokumen yang diunggah.",
  DOCUMENT_UNSUPPORTED_TYPE: "Tipe dokumen tidak didukung.",
  DOCUMENT_MIME_MISMATCH: "Tipe file tidak sesuai dengan ekstensi.",
  DOCUMENT_INVALID_FILE: "File dokumen tidak valid.",
  DOCUMENT_PARSE_FAILED: "Gagal memproses dokumen.",
  DOCUMENT_NO_EXTRACTABLE_TEXT: "Tidak ada teks yang dapat diekstrak dari dokumen.",
  DOCUMENT_TEXT_TOO_LARGE: "Teks dokumen terlalu panjang.",
  DOCUMENT_ATTACHMENT_NOT_FOUND: "Lampiran dokumen tidak ditemukan.",
  DOCUMENT_ATTACHMENT_FORBIDDEN: "Tidak memiliki akses ke lampiran dokumen.",
  DOCUMENT_UPLOAD_FAILED: "Gagal mengunggah dokumen.",
};

export function createErrorResponse(
  code: ApiErrorCode | string,
  message?: string,
  details?: unknown,
  statusOverride?: number,
  headers?: HeadersInit,
  requestIdOverride?: string
): NextResponse<NormalizedApiErrorResponse> {
  // Normalize unknown codes to INTERNAL_ERROR or mapping
  let normalizedCode: ApiErrorCode = "INTERNAL_ERROR";
  if (code in statusMap) {
    normalizedCode = code as ApiErrorCode;
  } else if (code === "RESOURCE_NOT_FOUND" || code === "MODEL_UNAVAILABLE") {
    normalizedCode = "NOT_FOUND";
  } else if (code === "RATE_LIMITED") {
    normalizedCode = "RATE_LIMIT_EXCEEDED";
  } else if (code === "PROVIDER_UNAVAILABLE" || code === "STREAM_MALFORMED" || code === "PROVIDER_AUTH_FAILED") {
    normalizedCode = "AI_PROVIDER_UNAVAILABLE";
  } else if (code === "PROVIDER_TIMEOUT") {
    normalizedCode = "AI_TIMEOUT";
  }

  const status = statusOverride ?? statusMap[normalizedCode] ?? 500;
  const requestId = requestIdOverride || crypto.randomUUID();
  const safeMessage = message || safeDefaultMessages[normalizedCode] || "Terjadi kesalahan pada sistem.";

  const finalHeaders = new Headers(headers);
  finalHeaders.set("X-Request-Id", requestId);

  return NextResponse.json(
    {
      error: normalizedCode,
      message: safeMessage,
      requestId,
      ...(details !== undefined ? { details } : {}),
    },
    { status, headers: finalHeaders }
  );
}
