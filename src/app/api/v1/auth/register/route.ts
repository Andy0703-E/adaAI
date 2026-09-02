import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createErrorResponse } from "@/lib/utils/error-response";
import { rateLimit } from "@/lib/rate-limit";
import { hashIdentifier } from "@/lib/rate-limit/keys";
import { logAuditEvent } from "@/lib/logger/audit";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai/constants";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const t0 = performance.now();

  try {
    const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const identifierHash = hashIdentifier(rawIp);

    const rlStart = performance.now();
    const rl = await rateLimit({
      scope: "register",
      ip: rawIp,
    });
    const rlMs = Math.round(performance.now() - rlStart);

    if (!rl.allowed) {
      logAuditEvent({
        event: "RATE_LIMIT_BLOCKED",
        requestId,
        identifierHash,
        metadata: { scope: "register", retryAfter: rl.retryAfter },
      });

      if (rl.error === "REDIS_UNAVAILABLE") {
        return createErrorResponse(
          "REDIS_UNAVAILABLE",
          "Layanan registrasi sementara tidak tersedia. Silakan coba beberapa saat lagi.",
          undefined,
          503,
          undefined,
          requestId
        );
      }

      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Terlalu banyak percobaan registrasi. Coba lagi dalam ${rl.retryAfter} detik.`,
          requestId,
          retryAfter: rl.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter),
            "X-Request-Id": requestId,
          },
        }
      );
    }

    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      logAuditEvent({
        event: "AUTH_REGISTER_REJECTED",
        requestId,
        identifierHash,
        metadata: { reason: "VALIDATION_FAILED" },
      });
      return createErrorResponse("VALIDATION_FAILED", "Data pendaftaran tidak valid.", result.error.format(), 400, undefined, requestId);
    }

    const { name, email, password } = result.data;
    const emailHash = hashIdentifier(email);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      logAuditEvent({
        event: "AUTH_REGISTER_REJECTED",
        requestId,
        identifierHash: emailHash,
        metadata: { reason: "EMAIL_EXISTS" },
      });
      return createErrorResponse("VALIDATION_FAILED", "Email sudah terdaftar. Silakan gunakan email lain atau login.", undefined, 400, undefined, requestId);
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Create user and initial settings in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      await tx.userSettings.create({
        data: {
          userId: user.id,
          theme: "DARK",
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
        },
      });

      return user;
    });

    logAuditEvent({
      event: "AUTH_REGISTER_SUCCESS",
      requestId,
      userId: newUser.id,
      identifierHash: emailHash,
    });

    return NextResponse.json(
      {
        data: {
          user: newUser,
          message: "Akun berhasil dibuat. Silakan login.",
        },
      },
      {
        status: 201,
        headers: {
          "X-Request-Id": requestId,
        },
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Terjadi kesalahan saat memproses pendaftaran.", undefined, 500, undefined, requestId);
  }
}
