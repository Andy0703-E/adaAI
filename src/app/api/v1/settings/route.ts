import { NextRequest, NextResponse } from "next/server";
import { requireAuthUserId, getAuthorizedUserSettings } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { updateSettingsSchema } from "@/lib/validation/settings";
import { createErrorResponse } from "@/lib/utils/error-response";

export async function GET() {
  const totalStart = performance.now();
  try {
    const authStart = performance.now();
    const userId = await requireAuthUserId();
    const authMs = performance.now() - authStart;

    const prefStart = performance.now();
    const settings = await getAuthorizedUserSettings(userId);
    const preferencesMs = performance.now() - prefStart;

    console.log("[PERF SETTINGS PAGE]", {
      authMs: Math.round(authMs),
      preferencesMs: Math.round(preferencesMs),
      totalMs: Math.round(performance.now() - totalStart),
    });

    return NextResponse.json({
      data: settings,
    });
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message);
    }
    console.error("GET settings error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal memuat pengaturan.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireAuthUserId();
    const body = await req.json().catch(() => ({}));
    const parse = updateSettingsSchema.safeParse(body);

    if (!parse.success) {
      return createErrorResponse("VALIDATION_FAILED", "Data pengaturan tidak valid.", parse.error.format());
    }

    const { defaultModelId, defaultProviderKey, systemPrompt, temperature, maxOutputTokens } = parse.data;

    // Ensure settings record exists
    await getAuthorizedUserSettings(userId);

    const updated = await prisma.userSettings.update({
      where: { userId },
      data: {
        ...(defaultModelId !== undefined ? { defaultModelId } : {}),
        ...(defaultProviderKey !== undefined ? { defaultProviderKey } : {}),
        ...(systemPrompt !== undefined ? { systemPrompt } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      },
    });

    return NextResponse.json({
      data: updated,
    });
  } catch (error: any) {
    if (error.name === "AuthorizationError") {
      return createErrorResponse("UNAUTHORIZED", error.message);
    }
    console.error("PATCH settings error:", error);
    return createErrorResponse("INTERNAL_ERROR", "Gagal memperbarui pengaturan.");
  }
}
