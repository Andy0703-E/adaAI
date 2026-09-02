import { NextRequest, NextResponse } from "next/server";
import { getAvailableModels } from "@/lib/ai/models";
import { createErrorResponse } from "@/lib/utils/error-response";

export async function GET(req: NextRequest) {
  const start = performance.now();
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const { models, source } = await getAvailableModels(forceRefresh);

    const totalMs = performance.now() - start;
    console.log("[PERF MODELS]", {
      source,
      cacheHit: source === "memory" || source === "database",
      totalMs: Math.round(totalMs),
      modelCount: models.length,
    });

    return NextResponse.json({
      data: models,
    });
  } catch (error) {
    console.error("Models route error:", error);
    return createErrorResponse("PROVIDER_UNAVAILABLE", "Gagal memuat daftar model.");
  }
}
