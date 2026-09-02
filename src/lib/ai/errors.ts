import { AppErrorCode, AIProviderError } from "@/types/ai";

export class AIProviderException extends Error implements AIProviderError {
  code: AppErrorCode;
  status?: number;
  retryable: boolean;
  retryAfterSeconds?: number;
  originalError?: unknown;

  constructor(params: {
    code: AppErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    retryAfterSeconds?: number;
    originalError?: unknown;
  }) {
    super(params.message);
    this.name = "AIProviderException";
    this.code = params.code;
    this.status = params.status;
    this.retryable = params.retryable ?? false;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.originalError = params.originalError;
  }
}

export function normalizeProviderError(error: unknown): AIProviderException {
  if (error instanceof AIProviderException) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("aborted")) {
      return new AIProviderException({
        code: "REQUEST_ABORTED",
        message: "Permintaan dihentikan oleh pengguna.",
        retryable: false,
        originalError: error,
      });
    }

    if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
      return new AIProviderException({
        code: "PROVIDER_TIMEOUT",
        message: "Layanan AI membutuhkan waktu terlalu lama untuk merespons.",
        status: 504,
        retryable: true,
        originalError: error,
      });
    }
  }

  // Response-like or status-containing error
  const status = (error as { status?: number })?.status;
  if (typeof status === "number") {
    if (status === 400) {
      return new AIProviderException({
        code: "VALIDATION_FAILED",
        message: "Format permintaan tidak didukung oleh penyedia AI.",
        status,
        retryable: false,
        originalError: error,
      });
    }
    if (status === 401 || status === 403) {
      return new AIProviderException({
        code: "PROVIDER_AUTH_FAILED",
        message: "Layanan AI sedang mengalami kendala autentikasi. Silakan hubungi admin.",
        status,
        retryable: false,
        originalError: error,
      });
    }
    if (status === 404) {
      return new AIProviderException({
        code: "MODEL_UNAVAILABLE",
        message: "Model yang dipilih tidak ditemukan pada penyedia AI.",
        status,
        retryable: false,
        originalError: error,
      });
    }
    if (status === 429) {
      return new AIProviderException({
        code: "RATE_LIMITED",
        message: "Batas frekuensi permintaan tercapai. Coba lagi beberapa saat.",
        status,
        retryable: true,
        originalError: error,
      });
    }
    if (status === 502 || status === 503 || status === 504) {
      return new AIProviderException({
        code: "PROVIDER_UNAVAILABLE",
        message: "Layanan AI sedang tidak dapat dijangkau. Coba beberapa saat lagi.",
        status,
        retryable: true,
        originalError: error,
      });
    }
  }

  return new AIProviderException({
    code: "INTERNAL_ERROR",
    message: "Terjadi kesalahan internal saat menghubungi layanan AI.",
    status: 500,
    retryable: false,
    originalError: error,
  });
}
