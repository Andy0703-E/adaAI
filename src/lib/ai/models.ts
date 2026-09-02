import { AIModel } from "@/types/ai";
import { defaultProvider } from "./openai-compatible";
import { aiConfig } from "./config";
import { prisma, isDatabaseAvailable } from "../db/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "../logging/logger";

interface MemoryModelCache {
  models: AIModel[];
  cachedAt: number;
}

function getDefaultFallbackModels(): AIModel[] {
  return aiConfig.modelsFallback.map((modelId) => ({
    id: modelId,
    name: modelId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    isAvailable: true,
    providerKey: defaultProvider.providerKey,
    capabilities: {
      text: true,
      vision: modelId.includes("vision"),
      temperature: true,
    },
    contextWindow: null,
    maxOutputTokens: aiConfig.maxOutputTokens,
  }));
}

let inMemoryCache: MemoryModelCache | null = {
  models: getDefaultFallbackModels(),
  cachedAt: 0, // stale by default, so first request triggers background refresh without blocking
};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

function orderAndFilterModels(models: AIModel[]): AIModel[] {
  const configuredIds = aiConfig.modelsFallback;
  if (configuredIds.length === 0) return models;

  const modelMap = new Map(models.map((m) => [m.id, m]));
  const ordered: AIModel[] = [];

  for (const id of configuredIds) {
    const existing = modelMap.get(id);
    if (existing) {
      ordered.push(existing);
    } else {
      ordered.push({
        id,
        name: id
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        isAvailable: true,
        providerKey: defaultProvider.providerKey,
        capabilities: {
          text: true,
          vision: id.includes("vision"),
          temperature: true,
        },
        contextWindow: null,
        maxOutputTokens: aiConfig.maxOutputTokens,
      });
    }
  }

  return ordered;
}

let isRefreshingBackground = false;

function refreshModelsInBackground() {
  if (isRefreshingBackground) return;
  isRefreshingBackground = true;

  (async () => {
    try {
      const liveModels = await defaultProvider.listModels(AbortSignal.timeout(2000));
      if (liveModels && liveModels.length > 0) {
        const filtered = orderAndFilterModels(liveModels);
        inMemoryCache = {
          models: filtered,
          cachedAt: Date.now(),
        };
        await syncModelsToDb(liveModels);
      }
    } catch (err) {
      logger.warn("Background model refresh failed", { error: (err as Error).message });
    } finally {
      isRefreshingBackground = false;
    }
  })();
}

export async function getAvailableModels(forceRefresh = false): Promise<{ models: AIModel[]; source: string }> {
  const now = Date.now();

  // 1. Instant Memory Cache (SWR)
  if (!forceRefresh && inMemoryCache) {
    if (now - inMemoryCache.cachedAt > 5 * 60 * 1000) {
      refreshModelsInBackground();
    }
    return { models: inMemoryCache.models, source: "memory" };
  }

  // 2. Instant Database Cache if memory empty
  if (!forceRefresh && (await isDatabaseAvailable())) {
    try {
      const dbCached = await prisma.modelCache.findMany({
        where: {
          providerKey: defaultProvider.providerKey,
          isAvailable: true,
        },
        orderBy: { displayName: "asc" },
      });

      if (dbCached.length > 0) {
        const mapped: AIModel[] = dbCached.map((m) => ({
          id: m.modelId,
          name: m.displayName,
          isAvailable: m.isAvailable,
          providerKey: m.providerKey,
          capabilities: (m.capabilities as Record<string, unknown>) || { text: true },
          contextWindow: m.contextWindow,
          maxOutputTokens: m.maxOutputTokens,
          metadata: (m.metadata as Record<string, unknown>) || null,
        }));

        inMemoryCache = {
          models: mapped,
          cachedAt: now,
        };

        refreshModelsInBackground();
        return { models: mapped, source: "database" };
      }
    } catch {
      // Database read fallback
    }
  }

  // 3. Upstream fetch (only when forceRefresh requested or completely cold cache)
  try {
    const liveModels = await defaultProvider.listModels(AbortSignal.timeout(2000));
    if (liveModels && liveModels.length > 0) {
      const filtered = orderAndFilterModels(liveModels);
      inMemoryCache = {
        models: filtered,
        cachedAt: now,
      };

      syncModelsToDb(liveModels).catch((err) => {
        logger.warn("Could not sync models to database cache", { error: (err as Error).message });
      });

      return { models: filtered, source: "provider" };
    }
  } catch (err) {
    logger.warn("Failed to fetch fresh models from provider, attempting database/fallback cache", {
      error: (err as Error).message,
    });
  }

  // 4. Database fallback
  if (await isDatabaseAvailable()) {
    try {
      const dbCached = await prisma.modelCache.findMany({
        where: {
          providerKey: defaultProvider.providerKey,
          isAvailable: true,
        },
        orderBy: { displayName: "asc" },
      });

      if (dbCached.length > 0) {
        const mapped: AIModel[] = dbCached.map((m) => ({
          id: m.modelId,
          name: m.displayName,
          isAvailable: m.isAvailable,
          providerKey: m.providerKey,
          capabilities: (m.capabilities as Record<string, unknown>) || { text: true },
          contextWindow: m.contextWindow,
          maxOutputTokens: m.maxOutputTokens,
          metadata: (m.metadata as Record<string, unknown>) || null,
        }));

        inMemoryCache = {
          models: mapped,
          cachedAt: now,
        };

        return { models: mapped, source: "database_fallback" };
      }
    } catch {
      // Fallback to configured
    }
  }

  // 5. Configured static fallback models
  const fallback = getDefaultFallbackModels();
  inMemoryCache = {
    models: fallback,
    cachedAt: now,
  };
  return { models: fallback, source: "fallback" };
}

async function syncModelsToDb(models: AIModel[]) {
  if (!(await isDatabaseAvailable())) {
    return;
  }

  const now = new Date();
  for (const model of models) {
    try {
      await prisma.modelCache.upsert({
        where: {
          model_cache_provider_model_key: {
            providerKey: model.providerKey,
            modelId: model.id,
          },
        },
        create: {
          providerKey: model.providerKey,
          modelId: model.id,
          displayName: model.name,
          isAvailable: model.isAvailable,
          capabilities: (model.capabilities ?? {}) as Prisma.InputJsonValue,
          contextWindow: model.contextWindow ?? null,
          maxOutputTokens: model.maxOutputTokens ?? null,
          metadata: (model.metadata ?? {}) as Prisma.InputJsonValue,
          lastSeenAt: now,
          lastSyncedAt: now,
        },
        update: {
          displayName: model.name,
          isAvailable: model.isAvailable,
          capabilities: (model.capabilities ?? {}) as Prisma.InputJsonValue,
          contextWindow: model.contextWindow ?? null,
          maxOutputTokens: model.maxOutputTokens ?? null,
          metadata: (model.metadata ?? {}) as Prisma.InputJsonValue,
          lastSeenAt: now,
          lastSyncedAt: now,
        },
      });
    } catch {
      // Ignore individual upsert errors
    }
  }
}
