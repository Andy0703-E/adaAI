import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailableModels } from "@/lib/ai/models";
import { defaultProvider } from "@/lib/ai/openai-compatible";
import * as prismaModule from "@/lib/db/prisma";

describe("Model Fallback", () => {
  beforeEach(() => {
    vi.spyOn(prismaModule, "isDatabaseAvailable").mockResolvedValue(false);
  });

  it("returns fallback model list when provider listModels throws an error", async () => {
    // Mock listModels to simulate provider failure
    vi.spyOn(defaultProvider, "listModels").mockRejectedValueOnce(
      new Error("Provider endpoint unreachable")
    );

    const { models } = await getAvailableModels(true);

    expect(models).toBeDefined();
    expect(models.length).toBeGreaterThanOrEqual(16);
    expect(models.some((m) => m.id === "hy3")).toBe(true);
    expect(models.some((m) => m.id === "deepseek-v4-flash")).toBe(true);
  }, 10000);
});
