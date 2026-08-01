import { Router, type IRouter } from "express";
import { and, eq, sql, isNull, or } from "drizzle-orm";
import { db, modelsTable, conversations, messages } from "@workspace/db";
import {
  CreateModelBody,
  UpdateModelBody,
  GetModelParams,
  UpdateModelParams,
  DeleteModelParams,
  GetStatsResponse,
  ListModelsResponse,
  CreateModelResponse,
  GetModelResponse,
  UpdateModelResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Extract the caller's email from request headers or Clerk auth. */
function getUserIdentity(req: any): string {
  const rawEmail =
    (req.headers["x-user-email"] as string) ||
    req.auth?.claims?.email ||
    req.auth?.sessionClaims?.email ||
    req.auth?.email;
  return rawEmail ? rawEmail.toLowerCase().trim() : "";
}

/** Build a drizzle WHERE clause that limits results to the caller's own rows. */
function userOwnershipFilter(userEmail: string) {
  // Show models that belong to this user OR legacy models with no owner (userId IS NULL)
  return userEmail
    ? or(eq(modelsTable.userId, userEmail), isNull(modelsTable.userId))
    : isNull(modelsTable.userId);
}

// GET /stats — scoped to the calling user
router.get("/stats", async (req, res): Promise<void> => {
  try {
    const userEmail = getUserIdentity(req);

    const [modelCounts] = await db
      .select({
        totalModels: sql<number>`count(*)::int`,
        enabledModels: sql<number>`count(*) filter (where ${modelsTable.enabled})::int`,
      })
      .from(modelsTable)
      .where(userOwnershipFilter(userEmail));

    const [convCount] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(conversations)
      .where(userEmail ? eq(conversations.userId, userEmail) : isNull(conversations.userId));

    const [msgCount] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(messages);

    const stats = {
      totalModels: modelCounts?.totalModels ?? 0,
      enabledModels: modelCounts?.enabledModels ?? 0,
      totalConversations: convCount?.total ?? 0,
      totalMessages: msgCount?.total ?? 0,
    };

    res.json(GetStatsResponse.parse(stats));
  } catch (err: any) {
    res.json({
      totalModels: 0,
      enabledModels: 0,
      totalConversations: 0,
      totalMessages: 0,
    });
  }
});

// GET /models — only return this user's models
router.get("/models", async (req, res): Promise<void> => {
  try {
    const userEmail = getUserIdentity(req);
    const models = await db
      .select()
      .from(modelsTable)
      .where(userOwnershipFilter(userEmail))
      .orderBy(modelsTable.createdAt);
    res.json(ListModelsResponse.parse(models));
  } catch (err: any) {
    res.json([]);
  }
});

// POST /models — tag with the caller's userId
router.post("/models", async (req, res): Promise<void> => {
  try {
    const parsed = CreateModelBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userEmail = getUserIdentity(req);
    const [model] = await db.insert(modelsTable).values({
      userId: userEmail || null,
      name: parsed.data.name,
      modelId: parsed.data.modelId,
      description: parsed.data.description ?? null,
      temperature: parsed.data.temperature ?? 0.7,
      maxTokens: parsed.data.maxTokens ?? 8192,
      systemPrompt: parsed.data.systemPrompt ?? null,
      topP: parsed.data.topP ?? 1.0,
      enabled: parsed.data.enabled ?? true,
      webSearchEnabled: parsed.data.webSearchEnabled ?? false,
    }).returning();
    res.status(201).json(CreateModelResponse.parse(model));
  } catch (err: any) {
    console.error("Error creating model:", err);
    res.status(500).json({ error: err.message || "Failed to create model" });
  }
});

const BEST_FREE_MODELS = [
  {
    name: "Llama 3.3 70B Instruct (Free)",
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    description: "Meta's flagship 70B open weight model with 128k context window. 100% free on OpenRouter.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "Gemini 2.0 Flash Exp (Free)",
    modelId: "google/gemini-2.0-flash-exp:free",
    description: "Google's next-gen Gemini 2.0 Flash model. Ultra fast speed, high intelligence & multimodal.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "DeepSeek R1 (Free)",
    modelId: "deepseek/deepseek-r1:free",
    description: "DeepSeek's flagship open-weights reasoning model with chain-of-thought capabilities.",
    maxTokens: 8192,
    temperature: 0.6,
  },
  {
    name: "DeepSeek V3 (Free)",
    modelId: "deepseek/deepseek-chat:free",
    description: "DeepSeek V3 671B mixture-of-experts model. Exceptional coding, reasoning, and math performance.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "Qwen 2.5 Coder 32B (Free)",
    modelId: "qwen/qwen-2.5-coder-32b-instruct:free",
    description: "Alibaba's elite 32B coding model optimized for code generation, bug fixing, and refactoring.",
    maxTokens: 8192,
    temperature: 0.5,
  },
  {
    name: "NVIDIA Nemotron 3 Ultra (Free)",
    modelId: "nvidia/nemotron-3-ultra:free",
    description: "NVIDIA's customized high-throughput model tuned for high quality, instruction following, and chat.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "Mistral 7B Instruct (Free)",
    modelId: "mistralai/mistral-7b-instruct:free",
    description: "Mistral's fast and efficient 7B instruct model. Great for general tasks and rapid responses.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "Phi-3 Medium 128k (Free)",
    modelId: "microsoft/phi-3-medium-128k-instruct:free",
    description: "Microsoft's 14B parameter state-of-the-art small language model with 128k context support.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "Gemma 2 9B IT (Free)",
    modelId: "google/gemma-2-9b-it:free",
    description: "Google's Gemma 2 9B instruction-tuned model with high performance across benchmarks.",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    name: "OpenChat 7B (Free)",
    modelId: "openchat/openchat-7b:free",
    description: "OpenChat 7B tuned with C-RLFT for ChatGPT-like conversational quality.",
    maxTokens: 8192,
    temperature: 0.7,
  },
];

// POST /models/seed-free-models — scoped to user
router.post("/models/seed-free-models", async (req, res): Promise<void> => {
  try {
    const userEmail = getUserIdentity(req);

    // 1. Query OpenRouter's live public catalog API for 100% 0-cost free models
    let liveFreeModels: Array<{ name: string; modelId: string; description: string; maxTokens: number; temperature: number }> = [];
    try {
      const liveRes = await fetch("https://openrouter.ai/api/v1/models");
      if (liveRes.ok) {
        const body: any = await liveRes.json();
        const catalog = body.data || [];
        liveFreeModels = catalog
          .filter((m: any) => {
            const promptCost = parseFloat(m.pricing?.prompt ?? "1");
            const completionCost = parseFloat(m.pricing?.completion ?? "1");
            return promptCost === 0 && completionCost === 0;
          })
          .map((m: any) => ({
            name: `${m.name || m.id} (Free)`,
            modelId: m.id,
            description: m.description ? m.description.slice(0, 150) : "OpenRouter 100% active free model",
            maxTokens: m.top_provider?.max_completion_tokens || 8192,
            temperature: 0.7,
          }));
      }
    } catch (apiErr) {
      console.warn("Could not query OpenRouter live API, falling back to verified preset list:", apiErr);
    }

    // Combine live models or fallback to static list if live models empty
    const pool = liveFreeModels.length > 0 ? liveFreeModels : BEST_FREE_MODELS;

    // Only check THIS user's models for deduplication
    const existing = await db.select().from(modelsTable).where(userOwnershipFilter(userEmail));
    const existingIds = new Set(existing.map((m) => m.modelId));

    const inserted = [];
    for (const item of pool) {
      if (!existingIds.has(item.modelId)) {
        const [newRow] = await db
          .insert(modelsTable)
          .values({
            userId: userEmail || null,
            name: item.name,
            modelId: item.modelId,
            description: item.description,
            temperature: item.temperature,
            maxTokens: item.maxTokens,
            topP: 1.0,
            enabled: true,
            webSearchEnabled: false,
          })
          .returning();
        inserted.push(newRow);
      }
    }

    res.json({ message: `Seeded ${inserted.length} verified free models`, seeded: inserted });
  } catch (error: any) {
    console.error("Error seeding free models:", error);
    res.status(500).json({ error: error.message || "Failed to seed free models" });
  }
});

// POST /models/purge-non-free — scoped to user
router.post("/models/purge-non-free", async (req, res): Promise<void> => {
  try {
    const userEmail = getUserIdentity(req);
    const liveRes = await fetch("https://openrouter.ai/api/v1/models");
    const activeFreeIds = new Set<string>();

    if (liveRes.ok) {
      const body: any = await liveRes.json();
      const catalog = body.data || [];
      catalog.forEach((m: any) => {
        const promptCost = parseFloat(m.pricing?.prompt ?? "1");
        const completionCost = parseFloat(m.pricing?.completion ?? "1");
        if (promptCost === 0 && completionCost === 0) {
          activeFreeIds.add(m.id);
        }
      });
    }

    const existing = await db.select().from(modelsTable).where(userOwnershipFilter(userEmail));
    const removedNames: string[] = [];

    for (const m of existing) {
      const isFree = m.modelId.endsWith(":free") && (activeFreeIds.size === 0 || activeFreeIds.has(m.modelId));
      if (!isFree) {
        await db.delete(modelsTable).where(eq(modelsTable.id, m.id));
        removedNames.push(m.name);
      }
    }

    res.json({ message: `Removed ${removedNames.length} non-free or offline model(s)`, removed: removedNames });
  } catch (error: any) {
    console.error("Error purging non-free models:", error);
    res.status(500).json({ error: error.message || "Failed to purge non-free models" });
  }
});

// GET /models/:id — user can only access their own models
router.get("/models/:id", async (req, res): Promise<void> => {
  try {
    const params = GetModelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userEmail = getUserIdentity(req);
    const [model] = await db
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.data.id), userOwnershipFilter(userEmail)));
    if (!model) {
      res.status(404).json({ error: "Model not found" });
      return;
    }
    res.json(GetModelResponse.parse(model));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch model" });
  }
});

// PATCH /models/:id — only the owner can edit
router.patch("/models/:id", async (req, res): Promise<void> => {
  try {
    const params = UpdateModelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateModelBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userEmail = getUserIdentity(req);

    // Verify ownership first
    const [existing] = await db
      .select()
      .from(modelsTable)
      .where(and(eq(modelsTable.id, params.data.id), userOwnershipFilter(userEmail)));
    if (!existing) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.modelId !== undefined) updateData.modelId = parsed.data.modelId;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.temperature !== undefined) updateData.temperature = parsed.data.temperature;
    if (parsed.data.maxTokens !== undefined) updateData.maxTokens = parsed.data.maxTokens;
    if (parsed.data.systemPrompt !== undefined) updateData.systemPrompt = parsed.data.systemPrompt;
    if (parsed.data.topP !== undefined) updateData.topP = parsed.data.topP;
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;
    if (parsed.data.webSearchEnabled !== undefined) updateData.webSearchEnabled = parsed.data.webSearchEnabled;

    const [model] = await db
      .update(modelsTable)
      .set(updateData)
      .where(eq(modelsTable.id, params.data.id))
      .returning();
    if (!model) {
      res.status(404).json({ error: "Model not found" });
      return;
    }
    res.json(UpdateModelResponse.parse(model));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update model" });
  }
});

// DELETE /models/:id — only the owner can delete
router.delete("/models/:id", async (req, res): Promise<void> => {
  try {
    const params = DeleteModelParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userEmail = getUserIdentity(req);
    const [model] = await db
      .delete(modelsTable)
      .where(and(eq(modelsTable.id, params.data.id), userOwnershipFilter(userEmail)))
      .returning();
    if (!model) {
      res.status(404).json({ error: "Model not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete model" });
  }
});

export default router;
